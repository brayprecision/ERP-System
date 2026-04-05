/**
 * Calibration reminder tasks for inspection_tool_assets (generic tasks table, type Calibration).
 */

const CALIBRATION_TASK_TYPE = 'Calibration';
const REMINDER_KIND = 'calibration_reminder';

function getLeadDays() {
    const n = parseInt(process.env.CALIBRATION_REMINDER_DAYS || '30', 10);
    return Number.isFinite(n) && n >= 0 ? n : 30;
}

function parseIsoDate(s) {
    if (!s || typeof s !== 'string') return null;
    const d = new Date(s.trim());
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function addDays(date, days) {
    const x = new Date(date);
    x.setDate(x.getDate() + days);
    return x;
}

/**
 * Recompute next calibration due from last date + interval (ISO date YYYY-MM-DD).
 */
function recomputeNextDue(lastCalibrationDate, calibrationIntervalDays) {
    if (!lastCalibrationDate || calibrationIntervalDays == null) return null;
    const interval = parseInt(calibrationIntervalDays, 10);
    if (!Number.isFinite(interval) || interval <= 0) return null;
    const last = parseIsoDate(
        typeof lastCalibrationDate === 'string' ? lastCalibrationDate : String(lastCalibrationDate)
    );
    if (!last) return null;
    const next = addDays(last, interval);
    return next.toISOString().split('T')[0];
}

function parseTaskData(raw) {
    if (raw == null) return {};
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }
    return {};
}

/**
 * Mark open Calibration reminder tasks for this tool as Complete.
 */
async function completeOpenCalibrationTasksForTool(pool, toolId) {
    const result = await pool.query(
        `
        SELECT id, task_data FROM tasks
        WHERE deleted_at IS NULL AND type = $1 AND status != 'Complete'
    `,
        [CALIBRATION_TASK_TYPE]
    );

    for (const row of result.rows) {
        const data = parseTaskData(row.task_data);
        if (data.inspectionToolId === toolId && data.kind === REMINDER_KIND) {
            await pool.query(
                `
                UPDATE tasks SET status = 'Complete', completed_at = datetime('now'), updated_at = datetime('now')
                WHERE id = $1
            `,
                [row.id]
            );
        }
    }
}

/**
 * Ensure tasks exist for tools whose calibration is due within lead window or overdue.
 */
async function syncCalibrationReminders(pool) {
    const leadDays = getLeadDays();
    const assetsRes = await pool.query(`
        SELECT id, name, next_calibration_due FROM inspection_tool_assets
        WHERE next_calibration_due IS NOT NULL AND TRIM(next_calibration_due) != ''
    `);

    const tasksRes = await pool.query(
        `
        SELECT id, task_data FROM tasks
        WHERE deleted_at IS NULL AND type = $1 AND status != 'Complete'
    `,
        [CALIBRATION_TASK_TYPE]
    );

    const covered = new Set();
    for (const t of tasksRes.rows) {
        const data = parseTaskData(t.task_data);
        if (data.kind === REMINDER_KIND && data.inspectionToolId != null) {
            covered.add(data.inspectionToolId);
        }
    }

    const today = startOfDay(new Date());
    let created = 0;

    for (const row of assetsRes.rows) {
        if (covered.has(row.id)) continue;

        const due = parseIsoDate(row.next_calibration_due);
        if (!due) continue;

        const dueDay = startOfDay(due);
        const windowStart = addDays(dueDay, -leadDays);

        if (today < windowStart) continue;

        const dueStr = row.next_calibration_due;
        await pool.query(
            `
            INSERT INTO tasks (
                type, title, description, work_order_id, status, priority, due_date, task_data, created_at, updated_at
            ) VALUES ($1, $2, $3, NULL, 'Not Started', 'Medium', $4, $5, datetime('now'), datetime('now'))
        `,
            [
                CALIBRATION_TASK_TYPE,
                `Calibrate: ${row.name}`,
                `Calibration due for inspection tool id ${row.id}.`,
                dueStr,
                JSON.stringify({ inspectionToolId: row.id, kind: REMINDER_KIND })
            ]
        );
        created += 1;
        covered.add(row.id);
    }

    return { created, leadDays };
}

module.exports = {
    CALIBRATION_TASK_TYPE,
    REMINDER_KIND,
    getLeadDays,
    recomputeNextDue,
    parseTaskData,
    completeOpenCalibrationTasksForTool,
    syncCalibrationReminders
};
