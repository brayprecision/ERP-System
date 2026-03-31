/**
 * Migration: Labor misc task segments (e.g. Sweeping) — time on shift, parallel to WO segments
 */

module.exports = {
    up(client) {
        client.query(`
            CREATE TABLE IF NOT EXISTS labor_misc_task_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shift_id INTEGER NOT NULL REFERENCES labor_shifts(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                misc_task_id TEXT NOT NULL,
                misc_task_title TEXT,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        client.query(
            `CREATE INDEX IF NOT EXISTS idx_labor_misc_seg_shift ON labor_misc_task_segments(shift_id)`
        );
        client.query(
            `CREATE INDEX IF NOT EXISTS idx_labor_misc_seg_user ON labor_misc_task_segments(user_id)`
        );
    },

    down(client) {
        client.query('DROP TABLE IF EXISTS labor_misc_task_segments');
    }
};
