// backend/routes/users.js
// User management, authentication, and permissions routes

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const { 
    loginLimiter, 
    createUserLimiter 
} = require('../middleware/rateLimit');

const { 
    validateBody, 
    schemas 
} = require('../middleware/validation');

// Bcrypt configuration
const SALT_ROUNDS = 12;

module.exports = function(pool) {
    const router = express.Router();
    
    // Import auth middleware
    const authMiddleware = require('../middleware/auth')(pool);
    const { requireAuth, requireAdmin, requireSelfOrAdmin } = authMiddleware;

    // ==================== HELPER FUNCTIONS ====================
    
    /**
     * Hash password using bcrypt
     * @param {string} password - Plain text password
     * @returns {Promise<string>} Hashed password
     */
    async function hashPassword(password) {
        return bcrypt.hash(password, SALT_ROUNDS);
    }
    
    /**
     * Verify password against hash
     * @param {string} password - Plain text password
     * @param {string} hash - Stored hash
     * @returns {Promise<boolean>} True if password matches
     */
    async function verifyPassword(password, hash) {
        // Handle legacy SHA-256 hashes (migration support)
        if (hash && hash.length === 64 && !hash.startsWith('$2')) {
            // This is a legacy SHA-256 hash
            const legacyHash = crypto.createHash('sha256')
                .update(password + 'bperp_salt')
                .digest('hex');
            return hash === legacyHash;
        }
        // Handle placeholder passwords (for initial migration)
        if (hash && hash.includes('placeholder')) {
            return true; // Allow any password for placeholder accounts
        }
        // Normal bcrypt comparison
        return bcrypt.compare(password, hash);
    }
    
    /**
     * Generate secure session token
     * @returns {string} Random hex token
     */
    function generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Log user activity
     * @param {number} userId - User ID
     * @param {string} action - Action type
     * @param {Object} details - Additional details
     */
    async function logActivity(userId, action, details = null) {
        try {
            await pool.query(
                'INSERT INTO user_activity_log (user_id, action, details) VALUES ($1, $2, $3)',
                [userId, action, details ? JSON.stringify(details) : null]
            );
        } catch (err) {
            console.error('Failed to log activity:', err.message);
        }
    }

    // ==================== AUTHENTICATION ROUTES ====================

    /**
     * POST /login - Authenticate user
     * Rate limited to prevent brute force attacks
     */
    router.post('/login', 
        loginLimiter,
        validateBody(schemas.login),
        async (req, res) => {
            try {
                const { username, password } = req.validatedBody;
                
                // Find user
                const result = await pool.query(
                    'SELECT * FROM users WHERE username = $1 AND is_active = TRUE',
                    [username]
                );
                
                if (result.rows.length === 0) {
                    // Use same error message to prevent username enumeration
                    return res.status(401).json({ 
                        success: false, 
                        error: 'Invalid username or password' 
                    });
                }
                
                const user = result.rows[0];
                
                // Verify password
                const isValidPassword = await verifyPassword(password, user.password_hash);
                
                if (!isValidPassword) {
                    // Log failed attempt
                    await logActivity(user.id, 'login_failed', { 
                        reason: 'invalid_password',
                        ip: req.ip 
                    });
                    
                    return res.status(401).json({ 
                        success: false, 
                        error: 'Invalid username or password' 
                    });
                }
                
                // Upgrade legacy password hash to bcrypt if needed
                if (user.password_hash && user.password_hash.length === 64 && !user.password_hash.startsWith('$2')) {
                    const newHash = await hashPassword(password);
                    await pool.query(
                        'UPDATE users SET password_hash = $1 WHERE id = $2',
                        [newHash, user.id]
                    );
                    console.log(`Upgraded password hash for user: ${username}`);
                }
                
                // Create session token
                const token = generateToken();
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                
                // Clean up old sessions for this user (optional: keep last N sessions)
                await pool.query(
                    'DELETE FROM user_sessions WHERE user_id = $1 AND expires_at < NOW()',
                    [user.id]
                );
                
                await pool.query(
                    'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
                    [user.id, token, expiresAt]
                );
                
                // Update last login
                await pool.query(
                    'UPDATE users SET last_login = NOW() WHERE id = $1',
                    [user.id]
                );
                
                // Log successful login
                await logActivity(user.id, 'login', { ip: req.ip });
                
                // Remove sensitive data
                delete user.password_hash;
                
                res.json({
                    success: true,
                    user: user,
                    token: token,
                    expiresAt: expiresAt.toISOString()
                });
            } catch (err) {
                console.error('Login error:', err);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );

    /**
     * POST /logout - End user session
     */
    router.post('/logout', async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (token) {
                // Get user for logging before deleting session
                const sessionResult = await pool.query(
                    'SELECT user_id FROM user_sessions WHERE token = $1',
                    [token]
                );
                
                // Delete session
                await pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
                
                // Log activity
                if (sessionResult.rows.length > 0) {
                    await logActivity(sessionResult.rows[0].user_id, 'logout', null);
                }
            }
            
            res.json({ success: true, message: 'Logged out successfully' });
        } catch (err) {
            console.error('Logout error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * GET /me - Get current authenticated user
     */
    router.get('/me', requireAuth, (req, res) => {
        res.json({ success: true, user: req.user });
    });

    /**
     * GET /validate - Check if session token is valid
     */
    router.get('/validate', async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            const user = await authMiddleware.getUserFromToken(token);
            
            res.json({ 
                success: true,
                data: { 
                    valid: !!user, 
                    user: user || null 
                }
            });
        } catch (err) {
            res.json({ success: true, data: { valid: false, user: null } });
        }
    });

    // ==================== USER MANAGEMENT ROUTES (Admin only) ====================

    /**
     * GET / - List all users (Admin only)
     */
    router.get('/', requireAuth, requireAdmin, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT id, username, name, email, role, appearance_settings, 
                       tab_permissions, is_active, last_login, created_at
                FROM users
                ORDER BY name
            `);
            
            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error('Get users error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * GET /roles/defaults - Get default permissions per role
     */
    router.get('/roles/defaults', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM role_defaults ORDER BY role');
            res.json({ success: true, data: result.rows });
        } catch (err) {
            console.error('Get role defaults error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * GET /activity/log - Get user activity log (Admin only)
     */
    router.get('/activity/log', requireAuth, requireAdmin, async (req, res) => {
        try {
            const limit = Math.min(parseInt(req.query.limit) || 50, 500);
            
            const result = await pool.query(`
                SELECT al.*, u.username, u.name as user_name
                FROM user_activity_log al
                LEFT JOIN users u ON al.user_id = u.id
                ORDER BY al.created_at DESC
                LIMIT $1
            `, [limit]);
            
            res.json(result.rows);
        } catch (err) {
            console.error('Get activity log error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * GET /:id - Get single user
     */
    router.get('/:id', requireAuth, requireSelfOrAdmin(), async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT id, username, name, email, role, appearance_settings, 
                       tab_permissions, is_active, last_login, created_at
                FROM users WHERE id = $1
            `, [req.params.id]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            res.json({ success: true, data: result.rows[0] });
        } catch (err) {
            console.error('Get user error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * POST / - Create new user (Admin only)
     */
    router.post('/', 
        requireAuth, 
        requireAdmin,
        createUserLimiter,
        validateBody(schemas.createUser),
        async (req, res) => {
            try {
                const { username, name, email, password, role } = req.validatedBody;
                
                // Get default permissions for role
                const defaultPerms = await pool.query(
                    'SELECT tab_permissions FROM role_defaults WHERE role = $1',
                    [role]
                );
                
                const tabPermissions = defaultPerms.rows.length > 0 
                    ? defaultPerms.rows[0].tab_permissions 
                    : { dashboard: true, workcenter: true, inventory: false, sales: false, tasks: true, settings: false };
                
                // Hash password with bcrypt
                const passwordHash = await hashPassword(password);
                
                const result = await pool.query(`
                    INSERT INTO users (username, name, email, password_hash, role, tab_permissions)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id, username, name, email, role, appearance_settings, tab_permissions, is_active, created_at
                `, [username, name, email || null, passwordHash, role, JSON.stringify(tabPermissions)]);
                
                // Log activity
                await logActivity(req.user.id, 'user_created', { 
                    created_user_id: result.rows[0].id, 
                    username 
                });
                
                res.status(201).json({ success: true, data: result.rows[0] });
            } catch (err) {
                console.error('Create user error:', err);
                if (err.code === '23505') {
                    return res.status(400).json({ success: false, error: 'Username or email already exists' });
                }
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );

    /**
     * PUT /:id - Update user (Admin or self)
     */
    router.put('/:id', 
        requireAuth, 
        requireSelfOrAdmin(),
        validateBody(schemas.updateUser),
        async (req, res) => {
            try {
                const userId = parseInt(req.params.id);
                const { name, email, password, role, is_active } = req.validatedBody;
                
                // Build update query dynamically
                const updates = [];
                const values = [];
                let paramIndex = 1;
                
                if (name) {
                    updates.push(`name = $${paramIndex++}`);
                    values.push(name);
                }
                
                if (email !== undefined) {
                    updates.push(`email = $${paramIndex++}`);
                    values.push(email || null);
                }
                
                if (password) {
                    const passwordHash = await hashPassword(password);
                    updates.push(`password_hash = $${paramIndex++}`);
                    values.push(passwordHash);
                }
                
                // Only admins can change role and active status
                if (req.isAdmin) {
                    if (role && ['Administrator', 'Machinist', 'Operator'].includes(role)) {
                        updates.push(`role = $${paramIndex++}`);
                        values.push(role);
                    }
                    
                    if (is_active !== undefined) {
                        updates.push(`is_active = $${paramIndex++}`);
                        values.push(is_active);
                    }
                }
                
                if (updates.length === 0) {
                    return res.status(400).json({ success: false, error: 'No valid fields to update' });
                }
                
                values.push(userId);
                
                const result = await pool.query(`
                    UPDATE users SET ${updates.join(', ')}
                    WHERE id = $${paramIndex}
                    RETURNING id, username, name, email, role, appearance_settings, tab_permissions, is_active, created_at
                `, values);
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                // Log activity
                await logActivity(req.user.id, 'user_updated', { updated_user_id: userId });
                
                res.json({ success: true, data: result.rows[0] });
            } catch (err) {
                console.error('Update user error:', err);
                if (err.code === '23505') {
                    return res.status(400).json({ success: false, error: 'Email already exists' });
                }
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );

    /**
     * DELETE /:id - Delete user (Admin only)
     */
    router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
        try {
            const userId = parseInt(req.params.id);
            
            // Prevent self-deletion
            if (req.user.id === userId) {
                return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
            }
            
            const result = await pool.query(
                'DELETE FROM users WHERE id = $1 RETURNING id, username',
                [userId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            // Log activity
            await logActivity(req.user.id, 'user_deleted', { 
                deleted_user_id: userId, 
                deleted_username: result.rows[0].username 
            });
            
            res.json({ success: true, message: 'User deleted successfully' });
        } catch (err) {
            console.error('Delete user error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    // ==================== PERMISSIONS ROUTES ====================

    /**
     * PUT /:id/permissions - Update user tab permissions (Admin only)
     */
    router.put('/:id/permissions', 
        requireAuth, 
        requireAdmin,
        validateBody(schemas.updatePermissions),
        async (req, res) => {
            try {
                const { tab_permissions } = req.validatedBody;
                
                const result = await pool.query(`
                    UPDATE users SET tab_permissions = $1
                    WHERE id = $2
                    RETURNING id, username, name, role, tab_permissions
                `, [JSON.stringify(tab_permissions), req.params.id]);
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                // Log activity
                await logActivity(req.user.id, 'permission_change', { 
                    target_user_id: req.params.id, 
                    new_permissions: tab_permissions 
                });
                
                res.json({ success: true, data: result.rows[0] });
            } catch (err) {
                console.error('Update permissions error:', err);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );

    // ==================== APPEARANCE SETTINGS ROUTES ====================

    /**
     * PUT /:id/appearance - Update user appearance settings
     */
    router.put('/:id/appearance', 
        requireAuth, 
        requireSelfOrAdmin(),
        validateBody(schemas.appearanceSettings),
        async (req, res) => {
            try {
                const userId = parseInt(req.params.id);
                const { appearance_settings } = req.validatedBody;
                
                // Validate and normalize appearance settings
                const validSettings = {
                    theme: appearance_settings.theme || 'automation',
                    showGrid: appearance_settings.showGrid !== false,
                    showGlow: appearance_settings.showGlow !== false,
                    animations: appearance_settings.animations !== false,
                    transparency: typeof appearance_settings.transparency === 'number' 
                        ? appearance_settings.transparency 
                        : 50
                };
                
                const result = await pool.query(`
                    UPDATE users SET appearance_settings = $1
                    WHERE id = $2
                    RETURNING id, username, name, appearance_settings
                `, [JSON.stringify(validSettings), userId]);
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                res.json({ success: true, data: result.rows[0] });
            } catch (err) {
                console.error('Update appearance error:', err);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );

    return router;
};
