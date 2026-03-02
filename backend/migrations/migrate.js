#!/usr/bin/env node
/**
 * BPERP Database Migration System (SQLite)
 *
 * Usage:
 *   node migrations/migrate.js up      - Run all pending migrations
 *   node migrations/migrate.js down    - Rollback last migration
 *   node migrations/migrate.js status  - Show migration status
 *   node migrations/migrate.js create <name> - Create new migration file
 */

require('dotenv').config();
const { pool, initDb, closeDb } = require('../db');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'bperp.db');
initDb(dbPath);

const MIGRATIONS_DIR = path.join(__dirname, 'scripts');

// Ensure migrations directory exists
if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
}

/**
 * Create migrations tracking table if it doesn't exist
 */
function ensureMigrationsTable() {
    pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            executed_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/**
 * Get list of executed migrations from database
 */
function getExecutedMigrations() {
    const result = pool.query(
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
function runUp() {
    ensureMigrationsTable();

    const executed = getExecutedMigrations();
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

        const client = pool.connect();
        try {
            client.query('BEGIN');
            migration.up(client);
            client.query(
                'INSERT INTO schema_migrations (name) VALUES (?)',
                [file]
            );
            client.query('COMMIT');
            console.log(`  Completed: ${file}`);
        } catch (err) {
            client.query('ROLLBACK');
            console.error(`  Failed: ${file}`);
            console.error(`  Error: ${err.message}`);
            throw err;
        }
    }

    console.log('All migrations completed.');
}

/**
 * Rollback last migration
 */
function runDown() {
    ensureMigrationsTable();

    const executed = getExecutedMigrations();

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

    const client = pool.connect();
    try {
        client.query('BEGIN');
        migration.down(client);
        client.query(
            'DELETE FROM schema_migrations WHERE name = ?',
            [lastMigration]
        );
        client.query('COMMIT');
        console.log(`Rolled back: ${lastMigration}`);
    } catch (err) {
        client.query('ROLLBACK');
        console.error(`Failed to rollback: ${lastMigration}`);
        console.error(`Error: ${err.message}`);
        throw err;
    }
}

/**
 * Show migration status
 */
function showStatus() {
    ensureMigrationsTable();

    const executed = getExecutedMigrations();
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
     * @param {Object} client - Database client with query() method
     */
    up(client) {
        // Add your migration SQL here
        // client.query(\`
        //     CREATE TABLE IF NOT EXISTS example (
        //         id INTEGER PRIMARY KEY AUTOINCREMENT,
        //         name TEXT NOT NULL
        //     )
        // \`);
    },

    /**
     * Rollback the migration (optional but recommended)
     * @param {Object} client - Database client with query() method
     */
    down(client) {
        // Add your rollback SQL here
        // client.query('DROP TABLE IF EXISTS example');
    }
};
`;

    fs.writeFileSync(filepath, template);
    console.log(`Created: ${filepath}`);
}

// Main
function main() {
    const command = process.argv[2];
    const arg = process.argv[3];

    try {
        switch (command) {
            case 'up':
                runUp();
                break;
            case 'down':
                runDown();
                break;
            case 'status':
                showStatus();
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
        closeDb();
    }
}

main();
