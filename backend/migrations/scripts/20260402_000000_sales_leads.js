/**
 * Migration: sales_leads table + seed 48 default prospects (Sales Prospect List).
 */

const fs = require('fs');
const path = require('path');

module.exports = {
    up(client) {
        client.query(`
            CREATE TABLE IF NOT EXISTS sales_leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                segment TEXT,
                location TEXT,
                phone TEXT,
                email TEXT,
                industry TEXT,
                notes TEXT,
                priority_target INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        client.query(
            'CREATE INDEX IF NOT EXISTS idx_sales_leads_deleted ON sales_leads(deleted_at)'
        );
        client.query(
            'CREATE INDEX IF NOT EXISTS idx_sales_leads_name ON sales_leads(name)'
        );
        client.query(
            'CREATE INDEX IF NOT EXISTS idx_sales_leads_sort ON sales_leads(sort_order)'
        );

        const seedPath = path.join(__dirname, '../seeds/sales_leads_seed.json');
        const rows = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

        for (const r of rows) {
            client.query(
                `INSERT INTO sales_leads (id, name, segment, location, phone, email, industry, notes, priority_target, sort_order, is_active, created_at, updated_at, deleted_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, datetime('now'), datetime('now'), NULL)`,
                [
                    r.id,
                    r.name,
                    r.segment || null,
                    r.location || null,
                    r.phone ?? null,
                    r.email ?? null,
                    r.industry || null,
                    r.notes || null,
                    r.priority_target ? 1 : 0,
                    r.sort_order ?? r.id
                ]
            );
        }

        console.log('sales_leads table created and seeded.');
    },

    down(client) {
        client.query('DROP TABLE IF EXISTS sales_leads');
        console.log('sales_leads table dropped.');
    }
};
