/**
 * Migration: Products, Parts, and Bill of Materials
 * Created: 2026-03-02
 *
 * Adds products (finished assemblies), parts (components), product_bom
 * (product-to-part links), and part_materials (part-to-material links for
 * manufactured parts). Supports future Kanban and BOM explosion features.
 */

module.exports = {
    up(client) {
        // ==================== PRODUCTS ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                part_number TEXT,
                category TEXT,
                description TEXT,
                qty_on_hand INTEGER DEFAULT 0,
                minimum_qty INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'EA',
                supplier TEXT,
                unit_price REAL,
                location TEXT,
                reorder_link TEXT,
                last_ordered TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        // ==================== PARTS ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS parts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                part_number TEXT,
                category TEXT,
                source TEXT DEFAULT 'purchased',
                description TEXT,
                qty_on_hand INTEGER DEFAULT 0,
                minimum_qty INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'EA',
                supplier TEXT,
                unit_price REAL,
                location TEXT,
                reorder_link TEXT,
                last_ordered TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        // ==================== PRODUCT BOM ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS product_bom (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
                quantity_per_assembly REAL NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(product_id, part_id)
            )
        `);

        // ==================== PART MATERIALS (for manufactured parts) ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS part_materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
                material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
                quantity_per_unit REAL NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(part_id, material_id)
            )
        `);
    },

    down(client) {
        client.query('DROP TABLE IF EXISTS part_materials');
        client.query('DROP TABLE IF EXISTS product_bom');
        client.query('DROP TABLE IF EXISTS parts');
        client.query('DROP TABLE IF EXISTS products');
    }
};
