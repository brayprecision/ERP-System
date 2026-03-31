/**
 * Migration: Labor time tracking (shifts + work-order process segments)
 */

module.exports = {
    up(client) {
        client.query(`
            CREATE TABLE IF NOT EXISTS labor_shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS labor_work_order_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shift_id INTEGER NOT NULL REFERENCES labor_shifts(id) ON DELETE CASCADE,
                work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
                workflow_step_key TEXT NOT NULL,
                line_item_id INTEGER,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`CREATE INDEX IF NOT EXISTS idx_labor_shifts_user_started ON labor_shifts(user_id, started_at)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_labor_segments_shift ON labor_work_order_segments(shift_id)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_labor_segments_wo ON labor_work_order_segments(work_order_id)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_labor_segments_step ON labor_work_order_segments(workflow_step_key)`);
    },

    down(client) {
        client.query('DROP TABLE IF EXISTS labor_work_order_segments');
        client.query('DROP TABLE IF EXISTS labor_shifts');
    }
};
