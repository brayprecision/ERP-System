/**
 * Test Database Helper
 * Provides a test database connection and utilities for testing
 * Uses the same db.js wrapper as the main app for consistency
 */

const path = require('path');
const { initDb, getDb, closeDb, pool } = require('../../db');

let initialized = false;

/**
 * Get or initialize test database
 */
function getPool() {
    if (!initialized) {
        const dbPath = process.env.DB_PATH || path.join(__dirname, '../../bperp_test.db');
        initDb(dbPath);
        initialized = true;
    }
    return pool;
}

/**
 * Close database connection
 */
async function closePool() {
    if (initialized) {
        closeDb();
        initialized = false;
    }
}

/**
 * Clear test data from specified tables
 * @param {string|string[]} tables - Table name(s) to clear
 */
async function clearTables(tables) {
    const testPool = getPool();
    const tableList = Array.isArray(tables) ? tables : [tables];
    for (const table of tableList) {
        try {
            testPool.query(`DELETE FROM ${table}`);
        } catch (err) {
            if (!err.message.includes('no such table')) {
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

    const result = testPool.query(
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

    const result = testPool.query(`
        INSERT INTO users (username, name, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, $5, 1)
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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    testPool.query(`
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
