/**
 * Migration: inspection tool assets (gages/equipment) + document attachments for traceability.
 */

module.exports = {
    up(client) {
        client.query(`
            CREATE TABLE IF NOT EXISTS inspection_tool_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                asset_tag TEXT,
                manufacturer TEXT,
                model TEXT,
                serial_number TEXT,
                location TEXT,
                traceability_note TEXT,
                notes TEXT,
                last_calibration_date TEXT,
                calibration_interval_days INTEGER,
                next_calibration_due TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER REFERENCES users(id)
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS inspection_tool_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inspection_tool_id INTEGER NOT NULL REFERENCES inspection_tool_assets(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                document_type TEXT NOT NULL DEFAULT 'other',
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL UNIQUE,
                mime_type TEXT,
                file_size INTEGER,
                uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                uploaded_by INTEGER REFERENCES users(id)
            )
        `);

        client.query(
            'CREATE INDEX IF NOT EXISTS idx_inspection_tool_assets_next_due ON inspection_tool_assets(next_calibration_due)'
        );
        client.query(
            'CREATE INDEX IF NOT EXISTS idx_inspection_tool_docs_tool ON inspection_tool_documents(inspection_tool_id)'
        );

        console.log('inspection_tool_assets and inspection_tool_documents created.');
    },

    down(client) {
        client.query('DROP TABLE IF EXISTS inspection_tool_documents');
        client.query('DROP TABLE IF EXISTS inspection_tool_assets');
        console.log('inspection tool inventory tables dropped.');
    }
};
