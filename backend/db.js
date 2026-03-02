/**
 * BPERP SQLite Database Module
 * Provides a PostgreSQL-compatible interface over better-sqlite3
 *
 * This wrapper translates PostgreSQL query syntax to SQLite on the fly,
 * allowing route files to work with zero changes after the pg → SQLite migration.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * Initialize the SQLite database connection
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {Database} The better-sqlite3 database instance
 */
function initDb(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // Configure SQLite for concurrent access over NAS
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');

    console.log(`Connected to SQLite database: ${dbPath}`);
    return db;
}

/**
 * Get the raw better-sqlite3 database instance
 */
function getDb() {
    if (!db) throw new Error('Database not initialized. Call initDb() first.');
    return db;
}

/**
 * Close the database connection
 */
function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}

/**
 * Translate PostgreSQL SQL to SQLite-compatible SQL and expand parameters.
 * Handles: $N params → ?, ILIKE → LIKE, NOW() → datetime('now'),
 *          type casts (::type), DROP CASCADE
 */
function translateSql(sql, pgParams = []) {
    let translated = sql;
    const newParams = [];

    // Replace $1, $2, ... with ? and build expanded params array
    // In pg, $1 can appear multiple times referring to the same param;
    // in SQLite, each ? is a separate positional param
    translated = translated.replace(/\$(\d+)/g, (match, indexStr) => {
        const pgIndex = parseInt(indexStr) - 1;
        newParams.push(pgParams[pgIndex]);
        return '?';
    });

    // ILIKE → LIKE (SQLite LIKE is case-insensitive for ASCII A-Z)
    translated = translated.replace(/\bILIKE\b/gi, 'LIKE');

    // NOW() → datetime('now')
    translated = translated.replace(/\bNOW\(\)/gi, "datetime('now')");

    // Remove PostgreSQL type casts (::text, ::float, ::jsonb, etc.)
    translated = translated.replace(/::\w+/g, '');

    // Remove CASCADE from DROP TABLE/INDEX/VIEW (not supported in SQLite)
    // But preserve "ON DELETE CASCADE" and "ON UPDATE CASCADE" in FK definitions
    translated = translated.replace(
        /(DROP\s+(?:TABLE|INDEX|VIEW|TRIGGER)\s+(?:IF\s+EXISTS\s+)?[\w.]+)\s+CASCADE/gi,
        '$1'
    );

    return { sql: translated, params: newParams.length > 0 ? newParams : pgParams };
}

/**
 * Normalize a result row:
 * - Auto-parse JSON strings (mimics pg's JSONB auto-parsing)
 * - Add aggregate function aliases (COUNT(*) → .count, SUM(...) → .sum)
 */
function normalizeRow(row) {
    if (!row) return row;
    const normalized = { ...row };

    for (const [key, value] of Object.entries(normalized)) {
        // Auto-parse JSON strings (values starting with { or [)
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try {
                normalized[key] = JSON.parse(value);
            } catch (e) {
                // Not valid JSON, keep as string
            }
        }

        // Add aggregate function aliases for pg compatibility
        const lower = key.toLowerCase();
        if ((lower === 'count(*)' || lower.startsWith('count(')) && !('count' in row)) {
            normalized.count = normalized[key];
        }
        if (lower.startsWith('sum(') && !('sum' in row)) {
            normalized.sum = normalized[key];
        }
    }

    return normalized;
}

/**
 * Execute a SQL query with PostgreSQL-compatible interface.
 * Translates pg syntax to SQLite and returns { rows, rowCount }.
 *
 * @param {string} sql - SQL query (may use PostgreSQL syntax)
 * @param {Array} pgParams - Query parameters (using $1, $2, ... indexing)
 * @returns {{ rows: Array, rowCount: number }}
 */
function query(sql, pgParams = []) {
    if (!db) throw new Error('Database not initialized. Call initDb() first.');

    const { sql: translated, params } = translateSql(sql, pgParams);
    const trimmed = translated.trim();

    // Handle transaction control and PRAGMA statements
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|PRAGMA)/i.test(trimmed)) {
        db.exec(trimmed);
        return { rows: [], rowCount: 0 };
    }

    // Handle multi-statement DDL (no params, contains CREATE/DROP/ALTER)
    if (params.length === 0 && /\b(CREATE|DROP|ALTER)\b/i.test(trimmed)) {
        db.exec(translated);
        return { rows: [], rowCount: 0 };
    }

    // Handle SELECT queries
    if (/^SELECT/i.test(trimmed)) {
        const stmt = db.prepare(translated);
        const rows = (params.length > 0 ? stmt.all(...params) : stmt.all()).map(normalizeRow);
        return { rows, rowCount: rows.length };
    }

    // Check for RETURNING clause (PostgreSQL-specific, emulated for SQLite)
    const hasReturning = /\bRETURNING\b/i.test(translated);

    if (hasReturning) {
        const withoutReturning = translated.replace(/\s+RETURNING\s+.*/si, '');

        if (/^INSERT/i.test(trimmed)) {
            const tableName = withoutReturning.match(/INSERT\s+INTO\s+(\w+)/i)?.[1];
            const info = db.prepare(withoutReturning).run(...params);
            const rows = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`)
                .all(info.lastInsertRowid)
                .map(normalizeRow);
            return { rows, rowCount: info.changes };
        }

        if (/^UPDATE/i.test(trimmed)) {
            const tableName = withoutReturning.match(/UPDATE\s+(\w+)/i)?.[1];
            db.prepare(withoutReturning).run(...params);
            // Re-fetch the updated row — WHERE id = ? is always the last param
            const id = params[params.length - 1];
            const rows = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
                .all(id)
                .map(normalizeRow);
            return { rows, rowCount: rows.length };
        }

        if (/^DELETE/i.test(trimmed)) {
            const tableName = withoutReturning.match(/DELETE\s+FROM\s+(\w+)/i)?.[1];
            // Fetch row before deleting
            const rows = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
                .all(params[0])
                .map(normalizeRow);
            db.prepare(withoutReturning).run(...params);
            return { rows, rowCount: rows.length };
        }
    }

    // Regular INSERT/UPDATE/DELETE without RETURNING
    if (params.length > 0) {
        const info = db.prepare(translated).run(...params);
        return { rows: [], rowCount: info.changes };
    }

    // No params, single statement DML or other
    try {
        const info = db.prepare(translated).run();
        return { rows: [], rowCount: info.changes };
    } catch (e) {
        // Might be multi-statement, try exec
        db.exec(translated);
        return { rows: [], rowCount: 0 };
    }
}

/**
 * PostgreSQL-compatible pool interface.
 * Routes receive this object and call pool.query() — works identically to pg.Pool.
 */
const pool = {
    query: (sql, params) => query(sql, params),
    connect: () => ({
        query: (sql, params) => query(sql, params),
        release: () => {}
    }),
    end: () => closeDb()
};

module.exports = { initDb, getDb, closeDb, query, pool };
