/**
 * User Routes Tests
 * Tests for authentication and user management endpoints
 */

const request = require('supertest');
const express = require('express');
const { getPool, closePool, clearTables, createTestUser, createTestSession } = require('../helpers/testDb');

// Create minimal Express app for testing
function createApp(pool) {
    const app = express();
    app.use(express.json());
    
    const usersRoutes = require('../../routes/users')(pool);
    app.use('/api/users', usersRoutes);
    
    return app;
}

describe('User Routes', () => {
    let pool;
    let app;

    beforeAll(() => {
        pool = getPool();
        app = createApp(pool);
    });

    afterAll(async () => {
        await closePool();
    });

    beforeEach(async () => {
        // Clear relevant tables before each test
        await clearTables(['user_sessions', 'user_activity_log', 'users']);
    });

    // ==================== AUTHENTICATION TESTS ====================

    describe('POST /api/users/login', () => {
        it('should login successfully with valid credentials', async () => {
            const user = await createTestUser({
                username: 'validuser',
                password: 'ValidPass123'
            });

            const response = await request(app)
                .post('/api/users/login')
                .send({
                    username: 'validuser',
                    password: 'ValidPass123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.token.length).toBe(64); // 32 bytes hex = 64 chars
            expect(response.body.user).toBeDefined();
            expect(response.body.user.username).toBe('validuser');
            expect(response.body.user.password_hash).toBeUndefined(); // Should not expose hash
            expect(response.body.expiresAt).toBeDefined();
        });

        it('should reject login with invalid password', async () => {
            await createTestUser({
                username: 'validuser',
                password: 'ValidPass123'
            });

            const response = await request(app)
                .post('/api/users/login')
                .send({
                    username: 'validuser',
                    password: 'WrongPassword123'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid username or password');
            expect(response.body.token).toBeUndefined();
        });

        it('should reject login with non-existent username', async () => {
            const response = await request(app)
                .post('/api/users/login')
                .send({
                    username: 'nonexistent',
                    password: 'SomePassword123'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid username or password');
        });

        it('should reject login with missing username', async () => {
            const response = await request(app)
                .post('/api/users/login')
                .send({
                    password: 'SomePassword123'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject login with missing password', async () => {
            const response = await request(app)
                .post('/api/users/login')
                .send({
                    username: 'someuser'
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should reject login for inactive user', async () => {
            // Create user then deactivate
            const user = await createTestUser({
                username: 'inactiveuser',
                password: 'ValidPass123'
            });
            
            await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [user.id]);

            const response = await request(app)
                .post('/api/users/login')
                .send({
                    username: 'inactiveuser',
                    password: 'ValidPass123'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should create a session record on successful login', async () => {
            const user = await createTestUser({
                username: 'sessionuser',
                password: 'ValidPass123'
            });

            await request(app)
                .post('/api/users/login')
                .send({
                    username: 'sessionuser',
                    password: 'ValidPass123'
                });

            const sessions = await pool.query(
                'SELECT * FROM user_sessions WHERE user_id = $1',
                [user.id]
            );

            expect(sessions.rows.length).toBeGreaterThan(0);
            expect(sessions.rows[0].token).toBeDefined();
            expect(new Date(sessions.rows[0].expires_at) > new Date()).toBe(true);
        });

        it('should update last_login timestamp on successful login', async () => {
            const user = await createTestUser({
                username: 'loginuser',
                password: 'ValidPass123'
            });

            const beforeLogin = await pool.query(
                'SELECT last_login FROM users WHERE id = $1',
                [user.id]
            );
            expect(beforeLogin.rows[0].last_login).toBeNull();

            await request(app)
                .post('/api/users/login')
                .send({
                    username: 'loginuser',
                    password: 'ValidPass123'
                });

            const afterLogin = await pool.query(
                'SELECT last_login FROM users WHERE id = $1',
                [user.id]
            );
            expect(afterLogin.rows[0].last_login).not.toBeNull();
        });
    });

    describe('POST /api/users/logout', () => {
        it('should logout successfully and invalidate token', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const response = await request(app)
                .post('/api/users/logout')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify session was deleted
            const sessions = await pool.query(
                'SELECT * FROM user_sessions WHERE token = $1',
                [token]
            );
            expect(sessions.rows.length).toBe(0);
        });

        it('should succeed even without token', async () => {
            const response = await request(app)
                .post('/api/users/logout');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should succeed with invalid token', async () => {
            const response = await request(app)
                .post('/api/users/logout')
                .set('Authorization', 'Bearer invalidtoken123');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/users/me', () => {
        it('should return current user when authenticated', async () => {
            const user = await createTestUser({
                username: 'currentuser',
                name: 'Current User',
                role: 'Machinist'
            });
            const token = await createTestSession(user.id);

            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toBeDefined();
            expect(response.body.user.username).toBe('currentuser');
            expect(response.body.user.name).toBe('Current User');
            expect(response.body.user.role).toBe('Machinist');
        });

        it('should reject request without token', async () => {
            const response = await request(app)
                .get('/api/users/me');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', 'Bearer invalidtoken123');

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it('should reject request with expired token', async () => {
            const user = await createTestUser();
            
            // Create expired session
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            const expiredAt = new Date(Date.now() - 1000); // 1 second ago
            
            await pool.query(`
                INSERT INTO user_sessions (user_id, token, expires_at)
                VALUES ($1, $2, $3)
            `, [user.id, token, expiredAt]);

            const response = await request(app)
                .get('/api/users/me')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/users/validate', () => {
        it('should return valid=true for valid token', async () => {
            const user = await createTestUser();
            const token = await createTestSession(user.id);

            const response = await request(app)
                .get('/api/users/validate')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.valid).toBe(true);
            expect(response.body.data.user).toBeDefined();
        });

        it('should return valid=false for invalid token', async () => {
            const response = await request(app)
                .get('/api/users/validate')
                .set('Authorization', 'Bearer invalidtoken');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.valid).toBe(false);
            expect(response.body.data.user).toBeNull();
        });

        it('should return valid=false for no token', async () => {
            const response = await request(app)
                .get('/api/users/validate');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.valid).toBe(false);
        });
    });

    // ==================== USER MANAGEMENT TESTS ====================

    describe('GET /api/users', () => {
        it('should list all users for admin', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const token = await createTestSession(admin.id);

            await createTestUser({ username: 'user1', name: 'User One' });
            await createTestUser({ username: 'user2', name: 'User Two' });

            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThanOrEqual(3); // admin + 2 users
        });

        it('should reject non-admin users', async () => {
            const operator = await createTestUser({
                username: 'operator',
                role: 'Operator'
            });
            const token = await createTestSession(operator.id);

            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Administrator access required');
        });
    });

    describe('POST /api/users', () => {
        it('should create user as admin', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const token = await createTestSession(admin.id);

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username: 'newuser',
                    name: 'New User',
                    email: 'newuser@example.com',
                    password: 'SecurePass123',
                    role: 'Operator'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.username).toBe('newuser');
            expect(response.body.data.role).toBe('Operator');
        });

        it('should reject duplicate username', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const token = await createTestSession(admin.id);

            await createTestUser({ username: 'existinguser' });

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username: 'existinguser',
                    name: 'Duplicate User',
                    password: 'SecurePass123',
                    role: 'Operator'
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('already exists');
        });

        it('should reject weak password', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const token = await createTestSession(admin.id);

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username: 'newuser',
                    name: 'New User',
                    password: 'weak', // Too short, no uppercase, no number
                    role: 'Operator'
                });

            expect(response.status).toBe(400);
        });

        it('should reject non-admin creating users', async () => {
            const operator = await createTestUser({
                username: 'operator',
                role: 'Operator'
            });
            const token = await createTestSession(operator.id);

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    username: 'newuser',
                    name: 'New User',
                    password: 'SecurePass123',
                    role: 'Operator'
                });

            expect(response.status).toBe(403);
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should allow user to update own profile', async () => {
            const user = await createTestUser({
                username: 'selfuser',
                name: 'Original Name'
            });
            const token = await createTestSession(user.id);

            const response = await request(app)
                .put(`/api/users/${user.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Updated Name',
                    email: 'updated@example.com'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Updated Name');
            expect(response.body.data.email).toBe('updated@example.com');
        });

        it('should allow admin to update any user', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const adminToken = await createTestSession(admin.id);

            const targetUser = await createTestUser({
                username: 'targetuser',
                name: 'Target User'
            });

            const response = await request(app)
                .put(`/api/users/${targetUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Admin Updated'
                });

            expect(response.status).toBe(200);
            expect(response.body.data.name).toBe('Admin Updated');
        });

        it('should prevent user from updating another user', async () => {
            const user1 = await createTestUser({ username: 'user1' });
            const user2 = await createTestUser({ username: 'user2' });
            const token = await createTestSession(user1.id);

            const response = await request(app)
                .put(`/api/users/${user2.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Hacked Name'
                });

            expect(response.status).toBe(403);
        });

        it('should allow password change', async () => {
            const user = await createTestUser({
                username: 'passuser',
                password: 'OldPass123'
            });
            const token = await createTestSession(user.id);

            const response = await request(app)
                .put(`/api/users/${user.id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    password: 'NewPass456'
                });

            expect(response.status).toBe(200);

            // Verify new password works
            const loginResponse = await request(app)
                .post('/api/users/login')
                .send({
                    username: 'passuser',
                    password: 'NewPass456'
                });

            expect(loginResponse.status).toBe(200);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('should allow admin to delete user', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const adminToken = await createTestSession(admin.id);

            const targetUser = await createTestUser({ username: 'deleteme' });

            const response = await request(app)
                .delete(`/api/users/${targetUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify user is deleted
            const check = await pool.query(
                'SELECT * FROM users WHERE id = $1',
                [targetUser.id]
            );
            expect(check.rows.length).toBe(0);
        });

        it('should prevent admin from deleting self', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const adminToken = await createTestSession(admin.id);

            const response = await request(app)
                .delete(`/api/users/${admin.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Cannot delete your own account');
        });

        it('should prevent non-admin from deleting users', async () => {
            const operator = await createTestUser({
                username: 'operator',
                role: 'Operator'
            });
            const token = await createTestSession(operator.id);

            const targetUser = await createTestUser({ username: 'target' });

            const response = await request(app)
                .delete(`/api/users/${targetUser.id}`)
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(403);
        });
    });

    // ==================== PERMISSIONS TESTS ====================

    describe('PUT /api/users/:id/permissions', () => {
        it('should allow admin to update permissions', async () => {
            const admin = await createTestUser({
                username: 'admin',
                role: 'Administrator'
            });
            const adminToken = await createTestSession(admin.id);

            const targetUser = await createTestUser({ username: 'target' });

            const response = await request(app)
                .put(`/api/users/${targetUser.id}/permissions`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    tab_permissions: {
                        dashboard: true,
                        workcenter: true,
                        inventory: true,
                        sales: false,
                        tasks: true,
                        settings: false
                    }
                });

            expect(response.status).toBe(200);
            expect(response.body.data.tab_permissions.inventory).toBe(true);
        });

        it('should reject non-admin updating permissions', async () => {
            const operator = await createTestUser({
                username: 'operator',
                role: 'Operator'
            });
            const token = await createTestSession(operator.id);

            const response = await request(app)
                .put(`/api/users/${operator.id}/permissions`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    tab_permissions: {
                        settings: true // Trying to give self settings access
                    }
                });

            expect(response.status).toBe(403);
        });
    });
});
