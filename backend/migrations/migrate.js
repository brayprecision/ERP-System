#!/usr/bin/env node
/**
 * BPERP Database Migration System
 * 
 * Usage:
 *   node migrations/migrate.js up      - Run all pending migrations
 *   node migrations/migrate.js down    - Rollback last migration
 *   node migrations/migrate.js status  - Show migration status
 *   node migrations/migrate.js create <name> - Create new migration file
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'airshop',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

const MIGRATIONS_DIR = path.join(__dirname, 'scripts');

// Ensure migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
}

/**
 * Create migrations tracking table if it doesn't exist
 */
async function ensureMigrationsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/**
 * Get list of executed migrations from database
 */
async function getExecutedMigrations() {
    const result = await pool.query(
        'SELECT name FROM schema_migrations ORDER BY id'
    );
    return result.rows.map(r => r.name);
}

/**
 * Get list of migration files from disk
 */
function getMigrationFiles() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        return [];
    }
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.js'))
        .sort();
}

/**
 * Run pending migrations
 */
async function runUp() {
    await ensureMigrationsTable();
    
    const executed = await getExecutedMigrations();
    const files = getMigrationFiles();
    const pending = files.filter(f => !executed.includes(f));
    
    if (pending.length === 0) {
        console.log('No pending migrations.');
        return;
    }
    
    console.log(`Running ${pending.length} migration(s)...`);
    
    for (const file of pending) {
        console.log(`  Running: ${file}`);
        const migration = require(path.join(MIGRATIONS_DIR, file));
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await migration.up(client);
            await client.query(
                'INSERT INTO schema_migrations (name) VALUES ($1)',
                [file]
            );
            await client.query('COMMIT');
            console.log(`  Completed: ${file}`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`  Failed: ${file}`);
            console.error(`  Error: ${err.message}`);
            throw err;
        } finally {
            client.release();
        }
    }
    
    console.log('All migrations completed.');
}

/**
 * Rollback last migration
 */
async function runDown() {
    await ensureMigrationsTable();
    
    const executed = await getExecutedMigrations();
    
    if (executed.length === 0) {
        console.log('No migrations to rollback.');
        return;
    }
    
    const lastMigration = executed[executed.length - 1];
    console.log(`Rolling back: ${lastMigration}`);
    
    const migration = require(path.join(MIGRATIONS_DIR, lastMigration));
    
    if (!migration.down) {
        console.error('This migration does not support rollback.');
        return;
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await migration.down(client);
        await client.query(
            'DELETE FROM schema_migrations WHERE name = $1',
            [lastMigration]
        );
        await client.query('COMMIT');
        console.log(`Rolled back: ${lastMigration}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed to rollback: ${lastMigration}`);
        console.error(`Error: ${err.message}`);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Show migration status
 */
async function showStatus() {
    await ensureMigrationsTable();
    
    const executed = await getExecutedMigrations();
    const files = getMigrationFiles();
    
    console.log('\nMigration Status:');
    console.log('=================\n');
    
    if (files.length === 0) {
        console.log('No migration files found.');
        return;
    }
    
    for (const file of files) {
        const status = executed.includes(file) ? '✓ executed' : '○ pending';
        console.log(`  ${status}  ${file}`);
    }
    
    const pending = files.filter(f => !executed.includes(f));
    console.log(`\nTotal: ${files.length} | Executed: ${executed.length} | Pending: ${pending.length}`);
}

/**
 * Create a new migration file
 */
function createMigration(name) {
    if (!name) {
        console.error('Please provide a migration name.');
        process.exit(1);
    }
    
    const timestamp = new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '_')
        .substring(0, 15);
    
    const filename = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}.js`;
    const filepath = path.join(MIGRATIONS_DIR, filename);
    
    const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
    /**
     * Run the migration
     * @param {import('pg').PoolClient} client
     */
    async up(client) {
        // Add your migration SQL here
        // await client.query(\`
        //     CREATE TABLE example (
        //         id SERIAL PRIMARY KEY,
        //         name VARCHAR(100) NOT NULL
        //     )
        // \`);
    },

    /**
     * Rollback the migration (optional but recommended)
     * @param {import('pg').PoolClient} client
     */
    async down(client) {
        // Add your rollback SQL here
        // await client.query('DROP TABLE IF EXISTS example');
    }
};
`;
    
    fs.writeFileSync(filepath, template);
    console.log(`Created: ${filepath}`);
}

// Main
async function main() {
    const command = process.argv[2];
    const arg = process.argv[3];
    
    try {
        switch (command) {
            case 'up':
                await runUp();
                break;
            case 'down':
                await runDown();
                break;
            case 'status':
                await showStatus();
                break;
            case 'create':
                createMigration(arg);
                break;
            default:
                console.log('BPERP Database Migration Tool');
                console.log('');
                console.log('Usage:');
                console.log('  node migrations/migrate.js up           Run all pending migrations');
                console.log('  node migrations/migrate.js down         Rollback last migration');
                console.log('  node migrations/migrate.js status       Show migration status');
                console.log('  node migrations/migrate.js create NAME  Create new migration');
        }
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
