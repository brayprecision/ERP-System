// backend/middleware/auth.js
// Centralized authentication and authorization middleware

/**
 * Creates authentication middleware with database pool access
 * @param {Pool} pool - PostgreSQL connection pool
 * @returns {Object} Authentication middleware functions
 */
module.exports = function(pool) {
    
    /**
     * Get user from session token
     * @param {string} token - Bearer token from Authorization header
     * @returns {Object|null} User object or null if invalid
     */
    async function getUserFromToken(token) {
        if (!token) return null;
        try {
            const result = await pool.query(`
                SELECT u.id, u.username, u.name, u.email, u.role, 
                       u.appearance_settings, u.tab_permissions, u.is_active
                FROM users u
                JOIN user_sessions s ON u.id = s.user_id
                WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE
            `, [token]);
            return result.rows.length > 0 ? result.rows[0] : null;
        } catch (err) {
            console.error('getUserFromToken error:', err.message);
            return null;
        }
    }

    /**
     * Extract bearer token from Authorization header
     * @param {Request} req - Express request object
     * @returns {string|null} Token or null
     */
    function extractToken(req) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7);
    }

    /**
     * Middleware: Require authentication
     * Attaches user object to req.user if authenticated
     */
    async function requireAuth(req, res, next) {
        try {
            const token = extractToken(req);
            if (!token) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Authentication required' 
                });
            }

            const user = await getUserFromToken(token);
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid or expired session' 
                });
            }

            req.user = user;
            req.token = token;
            next();
        } catch (err) {
            console.error('Auth middleware error:', err);
            res.status(500).json({ success: false, error: 'Authentication error' });
        }
    }

    /**
     * Middleware: Require admin role
     * Must be used after requireAuth
     */
    function requireAdmin(req, res, next) {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required' 
            });
        }
        
        if (req.user.role !== 'Administrator') {
            return res.status(403).json({ 
                success: false, 
                error: 'Administrator access required' 
            });
        }
        
        next();
    }

    /**
     * Middleware: Optional authentication
     * Attaches user to req.user if token is valid, but doesn't require it
     */
    async function optionalAuth(req, res, next) {
        try {
            const token = extractToken(req);
            if (token) {
                const user = await getUserFromToken(token);
                if (user) {
                    req.user = user;
                    req.token = token;
                }
            }
            next();
        } catch (err) {
            // Continue without auth on error
            next();
        }
    }

    /**
     * Middleware: Require specific role(s)
     * @param {...string} roles - Allowed roles
     */
    function requireRole(...roles) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Authentication required' 
                });
            }
            
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ 
                    success: false, 
                    error: `Access denied. Required role: ${roles.join(' or ')}` 
                });
            }
            
            next();
        };
    }

    /**
     * Middleware: Require access to self or admin
     * Checks if user is accessing their own resource or is an admin
     * @param {string} paramName - Name of the route parameter containing user ID (default: 'id')
     */
    function requireSelfOrAdmin(paramName = 'id') {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Authentication required' 
                });
            }
            
            const targetId = parseInt(req.params[paramName]);
            const isSelf = req.user.id === targetId;
            const isAdmin = req.user.role === 'Administrator';
            
            if (!isSelf && !isAdmin) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Access denied' 
                });
            }
            
            req.isSelf = isSelf;
            req.isAdmin = isAdmin;
            next();
        };
    }

    return {
        getUserFromToken,
        extractToken,
        requireAuth,
        requireAdmin,
        optionalAuth,
        requireRole,
        requireSelfOrAdmin
    };
};
