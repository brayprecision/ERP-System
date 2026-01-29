/**
 * Test Database Helper
 * Provides a test database pool and utilities for testing
 */

const { Pool } = require('pg');

let pool;

/**
 * Get or create test database pool
 */
function getPool() {
    if (!pool) {
        pool = new Pool({
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'airshop_test',
            password: process.env.DB_PASSWORD || 'password',
            port: process.env.DB_PORT || 5432,
        });
    }
    return pool;
}

/**
 * Close database pool
 */
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

/**
 * Clear test data from specified tables
 * @param {string[]} tables - Array of table names to clear
 */
async function clearTables(tables) {
    const testPool = getPool();
    // Handle both array and spread arguments
    const tableList = Array.isArray(tables) ? tables : [tables];
    for (const table of tableList) {
        try {
            await testPool.query(`DELETE FROM ${table}`);
        } catch (err) {
            // Table might not exist in test DB, that's ok
            if (!err.message.includes('does not exist')) {
                console.warn(`Warning clearing ${table}:`, err.message);
            }
        }
    }
}

/**
 * Insert test fixture data
 */
async function insertFixture(table, data) {
    const testPool = getPool();
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    
    const result = await testPool.query(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        values
    );
    return result.rows[0];
}

/**
 * Create test user with hashed password
 */
async function createTestUser(userData = {}) {
    const bcrypt = require('bcrypt');
    const testPool = getPool();
    
    const defaultUser = {
        username: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        password: 'testpassword123',
        role: 'Operator'
    };
    
    const user = { ...defaultUser, ...userData };
    const passwordHash = await bcrypt.hash(user.password, 10);
    
    const result = await testPool.query(`
        INSERT INTO users (username, name, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name
        RETURNING *
    `, [user.username, user.name, user.email, passwordHash, user.role]);
    
    return { ...result.rows[0], plainPassword: user.password };
}

/**
 * Create test session for user
 */
async function createTestSession(userId) {
    const crypto = require('crypto');
    const testPool = getPool();
    
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await testPool.query(`
        INSERT INTO user_sessions (user_id, token, expires_at)
        VALUES ($1, $2, $3)
    `, [userId, token, expiresAt]);
    
    return token;
}

module.exports = {
    getPool,
    closePool,
    clearTables,
    insertFixture,
    createTestUser,
    createTestSession
};
