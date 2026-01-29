/**
 * Auth Middleware Tests
 * Tests for authentication and authorization middleware
 */

const { getPool, closePool, clearTables, createTestUser, createTestSession } = require('../helpers/testDb');

describe('Auth Middleware', () => {
    let pool;
    let authMiddleware;

    beforeAll(() => {
        pool = getPool();
        authMiddleware = require('../../middleware/auth')(pool);
    });

    afterAll(async () => {
        await closePool();
    });

    beforeEach(async () => {
        await clearTables(['user_sessions', 'users']);
    });

    // Helper to create mock request/response
    function createMockReqRes(overrides = {}) {
        const req = {
            headers: {},
            params: {},
            body: {},
            ...overrides
        };
        
        const res = {
            statusCode: 200,
            jsonData: null,
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.jsonData = data;
                return this;
            }
        };
        
        return { req, res };
    }

    // ==================== getUserFromToken ====================

    describe('getUserFromToken', () => {
        it('should return user for valid token', async () => {
            const user = await createTestUser({
                username: 'tokenuser',
                name: 'Token User',
                role: 'Machinist'
            });
            const token = await createTestSession(user.id);

            const result = await authMiddleware.getUserFromToken(token);

            expect(result).not.toBeNull();
            expect(result.username).toBe('tokenuser');
            expect(result.name).toBe('Token User');
            expect(result.role).toBe('Machinist');
        });

        it('should return null for invalid token', async () => {
            const result = await authMiddleware.getUserFromToken('invalidtoken123');
            expect(result).toBeNull();
        });

        it('should return null for expired token', async () => {
            const user = await createTestUser();
            
            // Create expired session directly
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            const expiredAt = new Date(Date.now() - 1000);
            
            await pool.query(`
                INSERT INTO user_sessions (user_id, token, expires_at)
                VALUES ($1, $2, $3)
            `, [user.id, token, expiredAt]);

            const result = await authMiddleware.getUserFromToken(token);
            expect(result).toBeNull();
        });

        it('should return null for inactive user', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);
            
            // Deactivate user
            await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [user.id]);

            const result = await authMiddleware.getUserFromToken(token);
            expect(result).toBeNull();
        });

        it('should include default appearance settings if none set', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const result = await authMiddleware.getUserFromToken(token);

            expect(result.appearanceSettings).toBeDefined();
            expect(result.appearanceSettings.theme).toBeDefined();
        });

        it('should include default tab permissions if none set', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const result = await authMiddleware.getUserFromToken(token);

            expect(result.tabPermissions).toBeDefined();
            expect(typeof result.tabPermissions.dashboard).toBe('boolean');
        });
    });

    // ==================== extractToken ====================

    describe('extractToken', () => {
        it('should extract token from Bearer header', () => {
            const { req } = createMockReqRes({
                headers: { authorization: 'Bearer abc123token' }
            });

            const token = authMiddleware.extractToken(req);
            expect(token).toBe('abc123token');
        });

        it('should return null for missing authorization header', () => {
            const { req } = createMockReqRes();

            const token = authMiddleware.extractToken(req);
            expect(token).toBeNull();
        });

        it('should return null for non-Bearer authorization', () => {
            const { req } = createMockReqRes({
                headers: { authorization: 'Basic abc123' }
            });

            const token = authMiddleware.extractToken(req);
            expect(token).toBeNull();
        });

        it('should handle Bearer with no token', () => {
            const { req } = createMockReqRes({
                headers: { authorization: 'Bearer ' }
            });

            const token = authMiddleware.extractToken(req);
            expect(token).toBe('');
        });
    });

    // ==================== requireAuth ====================

    describe('requireAuth', () => {
        it('should call next() for valid token', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` }
            });
            const next = jest.fn();

            await authMiddleware.requireAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.id).toBe(user.id);
            expect(req.token).toBe(token);
        });

        it('should return 401 for missing token', async () => {
            const { req, res } = createMockReqRes();
            const next = jest.fn();

            await authMiddleware.requireAuth(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(401);
            expect(res.jsonData.error).toBe('Authentication required');
        });

        it('should return 401 for invalid token', async () => {
            const { req, res } = createMockReqRes({
                headers: { authorization: 'Bearer invalidtoken' }
            });
            const next = jest.fn();

            await authMiddleware.requireAuth(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(401);
            expect(res.jsonData.error).toBe('Invalid or expired session');
        });
    });

    // ==================== requireAdmin ====================

    describe('requireAdmin', () => {
        it('should call next() for admin user', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const token = await createTestSession(admin.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` }
            });
            const next = jest.fn();

            await authMiddleware.requireAdmin(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user.role).toBe('Administrator');
        });

        it('should return 403 for non-admin user', async () => {
            const operator = await createTestUser({
                username: 'operator',
                role: 'Operator'
            });
            const token = await createTestSession(operator.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` }
            });
            const next = jest.fn();

            await authMiddleware.requireAdmin(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
            expect(res.jsonData.error).toBe('Administrator access required');
        });

        it('should return 401 for missing token', async () => {
            const { req, res } = createMockReqRes();
            const next = jest.fn();

            await authMiddleware.requireAdmin(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(401);
        });
    });

    // ==================== optionalAuth ====================

    describe('optionalAuth', () => {
        it('should set user for valid token', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` }
            });
            const next = jest.fn();

            await authMiddleware.optionalAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.id).toBe(user.id);
        });

        it('should call next() without user for missing token', async () => {
            const { req, res } = createMockReqRes();
            const next = jest.fn();

            await authMiddleware.optionalAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeUndefined();
        });

        it('should call next() without user for invalid token', async () => {
            const { req, res } = createMockReqRes({
                headers: { authorization: 'Bearer invalidtoken' }
            });
            const next = jest.fn();

            await authMiddleware.optionalAuth(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeUndefined();
        });
    });

    // ==================== requireRole ====================

    describe('requireRole', () => {
        it('should allow user with matching role', async () => {
            const machinist = await createTestUser({
                username: 'machinist',
                role: 'Machinist'
            });
            const token = await createTestSession(machinist.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` }
            });
            const next = jest.fn();

            const middleware = authMiddleware.requireRole('Machinist', 'Administrator');
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should allow admin when admin is in allowed roles', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const token = await createTestSession(admin.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` }
            });
            const next = jest.fn();

            const middleware = authMiddleware.requireRole('Machinist', 'Administrator');
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny user without matching role', async () => {
            const operator = await createTestUser({
                username: 'operator',
                role: 'Operator'
            });
            const token = await createTestSession(operator.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` }
            });
            const next = jest.fn();

            const middleware = authMiddleware.requireRole('Administrator', 'Machinist');
            await middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
            expect(res.jsonData.error).toContain('Access denied');
        });
    });

    // ==================== requireSelfOrAdmin ====================

    describe('requireSelfOrAdmin', () => {
        it('should allow user to access own resource', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` },
                params: { id: user.id.toString() }
            });
            const next = jest.fn();

            const middleware = authMiddleware.requireSelfOrAdmin('id');
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should allow admin to access any resource', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const targetUser = await createTestUser({ username: 'target' });
            const token = await createTestSession(admin.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` },
                params: { id: targetUser.id.toString() }
            });
            const next = jest.fn();

            const middleware = authMiddleware.requireSelfOrAdmin('id');
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        it('should deny non-admin accessing other user resource', async () => {
            const user1 = await createTestUser({ username: 'user1' });
            const user2 = await createTestUser({ username: 'user2' });
            const token = await createTestSession(user1.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` },
                params: { id: user2.id.toString() }
            });
            const next = jest.fn();

            const middleware = authMiddleware.requireSelfOrAdmin('id');
            await middleware(req, res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.statusCode).toBe(403);
            expect(res.jsonData.error).toContain('only modify your own');
        });

        it('should work with custom parameter name', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const { req, res } = createMockReqRes({
                headers: { authorization: `Bearer ${token}` },
                params: { userId: user.id.toString() }
            });
            const next = jest.fn();

            const middleware = authMiddleware.requireSelfOrAdmin('userId');
            await middleware(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });
});
