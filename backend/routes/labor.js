/**
 * Labor / time tracking API — shop shifts and work-order process segments
 */

const express = require('express');
const { validateBody, validateQuery, validateParams, schemas } = require('../middleware/validation');

function canViewUserLabor(viewer, targetUserId) {
    if (viewer.id === targetUserId) return true;
    return viewer.role === 'Administrator' || viewer.role === 'Machinist';
}

module.exports = function (pool) {
    const router = express.Router();
    const { requireAuth } = require('../middleware/auth')(pool);

    router.use(requireAuth);

    /** Open shift for user, or null */
    async function getOpenShift(userId) {
        const r = await pool.query(
            `SELECT * FROM labor_shifts WHERE user_id = $1 AND ended_at IS NULL ORDER BY id DESC LIMIT 1`,
            [userId]
        );
        return r.rows[0] || null;
    }

    /** Active segments (ended_at IS NULL) for user's open shift */
    async function getActiveSegmentsForUser(userId) {
        const r = await pool.query(
            `SELECT seg.id, seg.shift_id, seg.work_order_id, seg.workflow_step_key, seg.line_item_id,
                    seg.started_at, seg.ended_at, wo.wo_number AS wo_number
             FROM labor_work_order_segments seg
             INNER JOIN labor_shifts ls ON ls.id = seg.shift_id
             LEFT JOIN work_orders wo ON wo.id = seg.work_order_id
             WHERE ls.user_id = $1 AND ls.ended_at IS NULL AND seg.ended_at IS NULL`,
            [userId]
        );
        return r.rows;
    }

    /** Active misc-task segments for user's open shift */
    async function getActiveMiscSegmentsForUser(userId) {
        const r = await pool.query(
            `SELECT m.id, m.shift_id, m.misc_task_id, m.misc_task_title, m.started_at
             FROM labor_misc_task_segments m
             INNER JOIN labor_shifts ls ON ls.id = m.shift_id
             WHERE ls.user_id = $1 AND ls.ended_at IS NULL AND m.ended_at IS NULL`,
            [userId]
        );
        return r.rows;
    }

    /**
     * GET /api/labor/status
     */
    router.get('/status', async (req, res) => {
        try {
            const userId = req.user.id;
            const shift = await getOpenShift(userId);
            const activeSegments = await getActiveSegmentsForUser(userId);
            const activeMiscSegments = await getActiveMiscSegmentsForUser(userId);
            const data = {
                shift: shift
                    ? {
                          id: shift.id,
                          startedAt: shift.started_at,
                          endedAt: shift.ended_at
                      }
                    : null,
                activeSegments: activeSegments.map((row) => ({
                    id: row.id,
                    shiftId: row.shift_id,
                    workOrderId: row.work_order_id,
                    workflowStepKey: row.workflow_step_key,
                    lineItemId: row.line_item_id,
                    woNumber: row.wo_number,
                    startedAt: row.started_at
                })),
                activeMiscSegments: activeMiscSegments.map((row) => ({
                    id: row.id,
                    shiftId: row.shift_id,
                    miscTaskId: row.misc_task_id,
                    miscTaskTitle: row.misc_task_title,
                    startedAt: row.started_at
                }))
            };
            res.json({ success: true, data });
        } catch (err) {
            console.error('Labor status error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * POST /api/labor/clock-in — start shift only
     */
    router.post('/clock-in', async (req, res) => {
        try {
            const userId = req.user.id;
            const existing = await getOpenShift(userId);
            if (existing) {
                return res.status(409).json({ success: false, error: 'Already clocked in' });
            }
            const ins = await pool.query(
                `INSERT INTO labor_shifts (user_id, started_at) VALUES ($1, datetime('now')) RETURNING *`,
                [userId]
            );
            const shift = ins.rows[0];
            res.json({
                success: true,
                data: {
                    shift: {
                        id: shift.id,
                        startedAt: shift.started_at,
                        endedAt: shift.ended_at
                    }
                }
            });
        } catch (err) {
            console.error('Labor clock-in error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * POST /api/labor/clock-out — end shift and all segments
     */
    router.post('/clock-out', async (req, res) => {
        try {
            const userId = req.user.id;
            await pool.query('BEGIN');
            try {
                await pool.query(
                    `UPDATE labor_work_order_segments SET ended_at = datetime('now')
                     WHERE ended_at IS NULL AND shift_id IN (
                         SELECT id FROM labor_shifts WHERE user_id = $1 AND ended_at IS NULL
                     )`,
                    [userId]
                );
                await pool.query(
                    `UPDATE labor_misc_task_segments SET ended_at = datetime('now')
                     WHERE ended_at IS NULL AND shift_id IN (
                         SELECT id FROM labor_shifts WHERE user_id = $1 AND ended_at IS NULL
                     )`,
                    [userId]
                );
                await pool.query(
                    `UPDATE labor_shifts SET ended_at = datetime('now')
                     WHERE user_id = $1 AND ended_at IS NULL`,
                    [userId]
                );
                await pool.query('COMMIT');
            } catch (e) {
                await pool.query('ROLLBACK');
                throw e;
            }
            res.json({ success: true, data: { clockedOut: true } });
        } catch (err) {
            console.error('Labor clock-out error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * POST /api/labor/segment/start — auto clock-in if no shift; close other open segments; start new segment
     */
    router.post('/segment/start', validateBody(schemas.laborSegmentStart), async (req, res) => {
        try {
            const userId = req.user.id;
            const { workOrderId, workflowStepKey, lineItemId } = req.validatedBody;
            const lineParam = lineItemId == null ? null : lineItemId;

            const woCheck = await pool.query(
                'SELECT id FROM work_orders WHERE id = $1 AND deleted_at IS NULL',
                [workOrderId]
            );
            if (woCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Work order not found' });
            }

            await pool.query('BEGIN');
            try {
                let shift = await getOpenShift(userId);
                if (!shift) {
                    const ins = await pool.query(
                        `INSERT INTO labor_shifts (user_id, started_at) VALUES ($1, datetime('now')) RETURNING *`,
                        [userId]
                    );
                    shift = ins.rows[0];
                }

                await pool.query(
                    `UPDATE labor_work_order_segments SET ended_at = datetime('now')
                     WHERE ended_at IS NULL AND shift_id = $1`,
                    [shift.id]
                );

                await pool.query(
                    `UPDATE labor_misc_task_segments SET ended_at = datetime('now')
                     WHERE ended_at IS NULL AND shift_id = $1`,
                    [shift.id]
                );

                await pool.query(
                    `INSERT INTO labor_work_order_segments
                        (shift_id, work_order_id, workflow_step_key, line_item_id, started_at)
                     VALUES ($1, $2, $3, $4, datetime('now'))`,
                    [shift.id, workOrderId, workflowStepKey, lineParam]
                );

                await pool.query('COMMIT');
            } catch (e) {
                await pool.query('ROLLBACK');
                throw e;
            }

            const activeSegments = await getActiveSegmentsForUser(userId);
            const activeMiscSegments = await getActiveMiscSegmentsForUser(userId);
            const seg = activeSegments.find(
                (s) =>
                    s.work_order_id === workOrderId &&
                    s.workflow_step_key === workflowStepKey &&
                    (s.line_item_id == null ? lineParam == null : s.line_item_id === lineParam)
            );

            res.json({
                success: true,
                data: {
                    segment: seg
                        ? {
                              id: seg.id,
                              workOrderId: seg.work_order_id,
                              workflowStepKey: seg.workflow_step_key,
                              lineItemId: seg.line_item_id,
                              startedAt: seg.started_at
                          }
                        : null,
                    activeSegments: activeSegments.map((row) => ({
                        id: row.id,
                        workOrderId: row.work_order_id,
                        workflowStepKey: row.workflow_step_key,
                        lineItemId: row.line_item_id,
                        woNumber: row.wo_number,
                        startedAt: row.started_at
                    })),
                    activeMiscSegments: activeMiscSegments.map((row) => ({
                        id: row.id,
                        miscTaskId: row.misc_task_id,
                        miscTaskTitle: row.misc_task_title,
                        startedAt: row.started_at
                    }))
                }
            });
        } catch (err) {
            console.error('Labor segment start error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * POST /api/labor/segment/stop — end one process segment (still on shift)
     */
    router.post('/segment/stop', validateBody(schemas.laborSegmentStop), async (req, res) => {
        try {
            const userId = req.user.id;
            const { workOrderId, workflowStepKey, lineItemId } = req.validatedBody;
            const lineParam = lineItemId == null ? null : lineItemId;

            const r = await pool.query(
                `UPDATE labor_work_order_segments SET ended_at = datetime('now')
                 WHERE id IN (
                     SELECT seg.id FROM labor_work_order_segments seg
                     INNER JOIN labor_shifts ls ON ls.id = seg.shift_id
                     WHERE ls.user_id = $1 AND ls.ended_at IS NULL
                       AND seg.ended_at IS NULL
                       AND seg.work_order_id = $2
                       AND seg.workflow_step_key = $3
                       AND (COALESCE(seg.line_item_id, -1) = COALESCE($4, -1))
                 )`,
                [userId, workOrderId, workflowStepKey, lineParam]
            );

            res.json({ success: true, data: { stopped: r.rowCount > 0 } });
        } catch (err) {
            console.error('Labor segment stop error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * POST /api/labor/misc-segment/start — misc task timer (closes WO + other misc segments on shift)
     */
    router.post('/misc-segment/start', validateBody(schemas.laborMiscSegmentStart), async (req, res) => {
        try {
            const userId = req.user.id;
            const { miscTaskId, miscTaskTitle } = req.validatedBody;
            const idStr = String(miscTaskId);
            const titleStr = miscTaskTitle == null || miscTaskTitle === '' ? null : String(miscTaskTitle).slice(0, 500);

            await pool.query('BEGIN');
            try {
                let shift = await getOpenShift(userId);
                if (!shift) {
                    const ins = await pool.query(
                        `INSERT INTO labor_shifts (user_id, started_at) VALUES ($1, datetime('now')) RETURNING *`,
                        [userId]
                    );
                    shift = ins.rows[0];
                }

                await pool.query(
                    `UPDATE labor_work_order_segments SET ended_at = datetime('now')
                     WHERE ended_at IS NULL AND shift_id = $1`,
                    [shift.id]
                );
                await pool.query(
                    `UPDATE labor_misc_task_segments SET ended_at = datetime('now')
                     WHERE ended_at IS NULL AND shift_id = $1`,
                    [shift.id]
                );

                await pool.query(
                    `INSERT INTO labor_misc_task_segments
                        (shift_id, user_id, misc_task_id, misc_task_title, started_at)
                     VALUES ($1, $2, $3, $4, datetime('now'))`,
                    [shift.id, userId, idStr, titleStr]
                );

                await pool.query('COMMIT');
            } catch (e) {
                await pool.query('ROLLBACK');
                throw e;
            }

            const activeMiscSegments = await getActiveMiscSegmentsForUser(userId);
            const activeSegments = await getActiveSegmentsForUser(userId);
            const mseg = activeMiscSegments.find((r) => String(r.misc_task_id) === idStr);

            res.json({
                success: true,
                data: {
                    miscSegment: mseg
                        ? {
                              id: mseg.id,
                              miscTaskId: mseg.misc_task_id,
                              miscTaskTitle: mseg.misc_task_title,
                              startedAt: mseg.started_at
                          }
                        : null,
                    activeSegments: activeSegments.map((row) => ({
                        id: row.id,
                        workOrderId: row.work_order_id,
                        workflowStepKey: row.workflow_step_key,
                        lineItemId: row.line_item_id,
                        woNumber: row.wo_number,
                        startedAt: row.started_at
                    })),
                    activeMiscSegments: activeMiscSegments.map((row) => ({
                        id: row.id,
                        miscTaskId: row.misc_task_id,
                        miscTaskTitle: row.misc_task_title,
                        startedAt: row.started_at
                    }))
                }
            });
        } catch (err) {
            console.error('Labor misc-segment start error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * POST /api/labor/misc-segment/stop
     */
    router.post('/misc-segment/stop', validateBody(schemas.laborMiscSegmentStop), async (req, res) => {
        try {
            const userId = req.user.id;
            const { miscTaskId } = req.validatedBody;
            const idStr = String(miscTaskId);

            const r = await pool.query(
                `UPDATE labor_misc_task_segments SET ended_at = datetime('now')
                 WHERE id IN (
                     SELECT m.id FROM labor_misc_task_segments m
                     INNER JOIN labor_shifts ls ON ls.id = m.shift_id
                     WHERE ls.user_id = $1 AND ls.ended_at IS NULL
                       AND m.ended_at IS NULL
                       AND m.misc_task_id = $2
                 )`,
                [userId, idStr]
            );

            res.json({ success: true, data: { stopped: r.rowCount > 0 } });
        } catch (err) {
            console.error('Labor misc-segment stop error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * GET /api/labor/history?userId=&from=&to=
     * Dates ISO date strings (YYYY-MM-DD) inclusive
     */
    router.get('/history', validateQuery(schemas.laborHistoryQuery), async (req, res) => {
        try {
            const { userId, from, to } = req.validatedQuery;
            if (!canViewUserLabor(req.user, userId)) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }

            const fromDay = from.slice(0, 10);
            const toDay = to.slice(0, 10);

            const shiftsR = await pool.query(
                `SELECT id, user_id, started_at, ended_at
                 FROM labor_shifts
                 WHERE user_id = $1
                   AND date(started_at) <= date($3)
                   AND (ended_at IS NULL OR date(ended_at) >= date($2))`,
                [userId, fromDay, toDay]
            );

            const shiftIds = shiftsR.rows.map((s) => s.id);
            let segments = [];
            if (shiftIds.length > 0) {
                const placeholders = shiftIds.map((_, i) => `$${i + 1}`).join(', ');
                const segR = await pool.query(
                    `SELECT seg.*, wo.wo_number
                     FROM labor_work_order_segments seg
                     LEFT JOIN work_orders wo ON wo.id = seg.work_order_id
                     WHERE seg.shift_id IN (${placeholders})
                     ORDER BY seg.started_at ASC`,
                    shiftIds
                );
                segments = segR.rows;
            }

            let miscSegments = [];
            if (shiftIds.length > 0) {
                const placeholders = shiftIds.map((_, i) => `$${i + 1}`).join(', ');
                const miscR = await pool.query(
                    `SELECT * FROM labor_misc_task_segments
                     WHERE shift_id IN (${placeholders})
                     ORDER BY started_at ASC`,
                    shiftIds
                );
                miscSegments = miscR.rows;
            }

            res.json({
                success: true,
                data: {
                    shifts: shiftsR.rows.map((s) => ({
                        id: s.id,
                        userId: s.user_id,
                        startedAt: s.started_at,
                        endedAt: s.ended_at
                    })),
                    segments: segments.map((row) => ({
                        id: row.id,
                        shiftId: row.shift_id,
                        workOrderId: row.work_order_id,
                        workflowStepKey: row.workflow_step_key,
                        lineItemId: row.line_item_id,
                        woNumber: row.wo_number,
                        startedAt: row.started_at,
                        endedAt: row.ended_at
                    })),
                    miscSegments: miscSegments.map((row) => ({
                        id: row.id,
                        shiftId: row.shift_id,
                        miscTaskId: row.misc_task_id,
                        miscTaskTitle: row.misc_task_title,
                        startedAt: row.started_at,
                        endedAt: row.ended_at
                    }))
                }
            });
        } catch (err) {
            console.error('Labor history error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * GET /api/labor/presence — users currently on shift + optional active WO segment (Dashboard)
     */
    router.get('/presence', async (req, res) => {
        try {
            const role = req.user.role;
            const viewerId = req.user.id;

            const r = await pool.query(
                `SELECT u.id AS user_id, u.username, u.name, u.role,
                        ls.started_at AS shift_started_at,
                        seg.work_order_id AS seg_work_order_id,
                        seg.workflow_step_key AS seg_workflow_step_key,
                        seg.line_item_id AS seg_line_item_id,
                        seg.started_at AS seg_started_at,
                        wo.wo_number AS wo_number,
                        mseg.misc_task_id AS misc_task_id,
                        mseg.misc_task_title AS misc_task_title,
                        mseg.started_at AS misc_started_at
                 FROM labor_shifts ls
                 INNER JOIN users u ON u.id = ls.user_id AND u.is_active = 1
                 LEFT JOIN labor_work_order_segments seg ON seg.shift_id = ls.id AND seg.ended_at IS NULL
                 LEFT JOIN work_orders wo ON wo.id = seg.work_order_id
                 LEFT JOIN labor_misc_task_segments mseg ON mseg.shift_id = ls.id AND mseg.ended_at IS NULL
                 WHERE ls.ended_at IS NULL
                 ORDER BY u.name ASC`
            );

            const byUser = new Map();
            for (const row of r.rows) {
                const uid = row.user_id;
                if (!byUser.has(uid)) byUser.set(uid, row);
                else if (row.seg_work_order_id != null) byUser.set(uid, row);
            }

            let rows = Array.from(byUser.values()).map((row) => {
                const hasWo = row.seg_work_order_id != null;
                return {
                    userId: row.user_id,
                    username: row.username,
                    name: row.name,
                    role: row.role,
                    shiftStartedAt: row.shift_started_at,
                    currentSegment: hasWo
                        ? {
                              workOrderId: row.seg_work_order_id,
                              workflowStepKey: row.seg_workflow_step_key,
                              lineItemId: row.seg_line_item_id,
                              woNumber: row.wo_number,
                              startedAt: row.seg_started_at
                          }
                        : null,
                    currentMiscSegment:
                        !hasWo && row.misc_task_id != null
                            ? {
                                  miscTaskId: row.misc_task_id,
                                  miscTaskTitle: row.misc_task_title,
                                  startedAt: row.misc_started_at
                              }
                            : null
                };
            });

            if (role === 'Operator') {
                rows = rows.filter((x) => x.userId === viewerId);
            }

            res.json({ success: true, data: rows });
        } catch (err) {
            console.error('Labor presence error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    /**
     * PATCH /api/labor/shift/:id — manual edit of shop shift clock in/out times
     */
    router.patch(
        '/shift/:id',
        validateParams(schemas.idParam),
        validateBody(schemas.laborShiftPatch),
        async (req, res) => {
            try {
                const shiftId = req.validatedParams.id;
                const { startedAt, endedAt } = req.validatedBody;

                const r = await pool.query(`SELECT * FROM labor_shifts WHERE id = $1`, [shiftId]);
                if (r.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'Shift not found' });
                }
                const shift = r.rows[0];
                const ownerId = shift.user_id;

                if (!canViewUserLabor(req.user, ownerId)) {
                    return res.status(403).json({ success: false, error: 'Access denied' });
                }
                if (req.user.role === 'Operator' && req.user.id !== ownerId) {
                    return res.status(403).json({ success: false, error: 'Access denied' });
                }

                const newStart = startedAt;
                const newEnd = endedAt !== undefined ? endedAt : shift.ended_at;

                if (newEnd != null && new Date(newEnd) < new Date(newStart)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Clock out must be at or after clock in'
                    });
                }

                const wasClosed = shift.ended_at != null;
                if (wasClosed && newEnd == null) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot clear clock out on a completed shift. Set a new clock out time instead.'
                    });
                }

                const wasOpen = shift.ended_at == null;

                await pool.query('BEGIN');
                try {
                    await pool.query(
                        `UPDATE labor_shifts SET started_at = $1, ended_at = $2 WHERE id = $3`,
                        [newStart, newEnd ?? null, shiftId]
                    );
                    if (newEnd && wasOpen) {
                        await pool.query(
                            `UPDATE labor_work_order_segments SET ended_at = $1
                             WHERE shift_id = $2 AND ended_at IS NULL`,
                            [newEnd, shiftId]
                        );
                        await pool.query(
                            `UPDATE labor_misc_task_segments SET ended_at = $1
                             WHERE shift_id = $2 AND ended_at IS NULL`,
                            [newEnd, shiftId]
                        );
                    }
                    await pool.query('COMMIT');
                } catch (e) {
                    await pool.query('ROLLBACK');
                    throw e;
                }

                const up = await pool.query(`SELECT * FROM labor_shifts WHERE id = $1`, [shiftId]);
                const row = up.rows[0];
                res.json({
                    success: true,
                    data: {
                        shift: {
                            id: row.id,
                            userId: row.user_id,
                            startedAt: row.started_at,
                            endedAt: row.ended_at
                        }
                    }
                });
            } catch (err) {
                console.error('Labor shift patch error:', err);
                res.status(500).json({ success: false, error: 'Server error' });
            }
        }
    );

    /**
     * GET /api/labor/team — users visible in Time Tracking list
     */
    router.get('/team', async (req, res) => {
        try {
            const role = req.user.role;
            if (role === 'Administrator' || role === 'Machinist') {
                const r = await pool.query(
                    `SELECT id, username, name, role FROM users WHERE is_active = 1 ORDER BY name ASC`
                );
                return res.json({ success: true, data: r.rows });
            }
            res.json({
                success: true,
                data: [
                    {
                        id: req.user.id,
                        username: req.user.username,
                        name: req.user.name,
                        role: req.user.role
                    }
                ]
            });
        } catch (err) {
            console.error('Labor team error:', err);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    });

    return router;
};
