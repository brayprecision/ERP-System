// Maintenance API Routes for BPERP
// Uses PostgreSQL database for persistence

const express = require('express');

module.exports = function(pool) {
    const router = express.Router();
    const { requireAuth } = require('../middleware/auth')(pool);
    router.use(requireAuth);

    // Helper: Transform maintenance task from DB to API format
    function transformTask(row) {
        return {
            id: row.id,
            definitionId: row.definition_id,
            machineId: row.machine_id,
            taskName: row.task_name,
            description: row.description,
            category: row.category,
            scheduledDate: row.scheduled_date,
            dueDate: row.due_date,
            frequencyType: row.frequency_type,
            status: row.status,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            completedBy: row.completed_by,
            completedByName: row.completed_by_name,
            actualDuration: row.actual_duration,
            deferredTo: row.deferred_to,
            deferredReason: row.deferred_reason,
            issuesFound: row.issues_found,
            partsReplaced: row.parts_replaced,
            notes: row.notes,
            readings: row.readings || {},
            machineName: row.machine_name,
            machineType: row.machine_type,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // Helper: Update task status based on due date
    function updateTaskStatus(task) {
        if (task.status === 'Complete' || task.status === 'Deferred') return task;

        const now = new Date();
        const dueDate = new Date(task.dueDate);

        if (dueDate < now) {
            return { ...task, status: 'Overdue' };
        }
        return task;
    }

    // Helper: Get stats
    async function getStats() {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekFromNow = new Date(today.getTime() + 7 * 86400000);
            const weekAgo = new Date(today.getTime() - 7 * 86400000);

            const [scheduledToday, overdue, completedThisWeek, upcomingThisWeek, byCategory] = await Promise.all([
                pool.query(`
                    SELECT COUNT(*) FROM maintenance_tasks 
                    WHERE status != 'Complete' AND due_date >= $1 AND due_date < $2
                `, [today, new Date(today.getTime() + 86400000)]),
                pool.query(`SELECT COUNT(*) FROM maintenance_tasks WHERE status = 'Overdue' OR (status NOT IN ('Complete', 'Deferred') AND due_date < NOW())`),
                pool.query(`SELECT COUNT(*) FROM maintenance_tasks WHERE status = 'Complete' AND completed_at >= $1`, [weekAgo]),
                pool.query(`SELECT COUNT(*) FROM maintenance_tasks WHERE status != 'Complete' AND due_date >= $1 AND due_date <= $2`, [today, weekFromNow]),
                pool.query(`SELECT category, COUNT(*) as count FROM maintenance_tasks WHERE status != 'Complete' AND category IS NOT NULL GROUP BY category`)
            ]);

            return {
                scheduledToday: parseInt(scheduledToday.rows[0].count),
                overdue: parseInt(overdue.rows[0].count),
                completedThisWeek: parseInt(completedThisWeek.rows[0].count),
                upcomingThisWeek: parseInt(upcomingThisWeek.rows[0].count),
                byCategory: byCategory.rows.reduce((acc, r) => { acc[r.category] = parseInt(r.count); return acc; }, {})
            };
        } catch (err) {
            console.error('Error calculating stats:', err);
            return { scheduledToday: 0, overdue: 0, completedThisWeek: 0, upcomingThisWeek: 0, byCategory: {} };
        }
    }

    // GET /api/maintenance/tasks - List maintenance tasks
    router.get('/tasks', async (req, res) => {
        try {
            let query = `
                SELECT mt.*, m.name as machine_name, m.type as machine_type
                FROM maintenance_tasks mt
                LEFT JOIN machines m ON mt.machine_id = m.id
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            // Filter by machine
            if (req.query.machineId) {
                query += ` AND mt.machine_id = $${paramIndex++}`;
                params.push(parseInt(req.query.machineId));
            }

            // Filter by category
            if (req.query.category) {
                query += ` AND mt.category = $${paramIndex++}`;
                params.push(req.query.category);
            }

            // Filter by status
            if (req.query.status) {
                const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
                query += ` AND mt.status = ANY($${paramIndex++})`;
                params.push(statuses);
            }

            // Filter by date range
            if (req.query.dueDateFrom) {
                query += ` AND mt.due_date >= $${paramIndex++}`;
                params.push(req.query.dueDateFrom);
            }
            if (req.query.dueDateTo) {
                query += ` AND mt.due_date <= $${paramIndex++}`;
                params.push(req.query.dueDateTo);
            }

            query += ' ORDER BY mt.due_date ASC';

            const result = await pool.query(query, params);

            // Get materials for each task
            const tasks = await Promise.all(result.rows.map(async (row) => {
                const task = updateTaskStatus(transformTask(row));
                if (task.definitionId) {
                    const materials = await pool.query(
                        'SELECT * FROM maintenance_materials WHERE task_definition_id = $1',
                        [task.definitionId]
                    );
                    task.materials = materials.rows;
                } else {
                    task.materials = [];
                }
                return task;
            }));

            const stats = await getStats();

            res.json({ success: true, data: tasks, stats });
        } catch (error) {
            console.error('Get maintenance tasks error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/maintenance/tasks/:id - Get single task
    router.get('/tasks/:id', async (req, res) => {
        try {
            const taskResult = await pool.query(`
                SELECT mt.*, m.name as machine_name, m.type as machine_type
                FROM maintenance_tasks mt
                LEFT JOIN machines m ON mt.machine_id = m.id
                WHERE mt.id = $1
            `, [req.params.id]);

            if (taskResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const task = updateTaskStatus(transformTask(taskResult.rows[0]));

            // Get definition and materials
            if (task.definitionId) {
                const defResult = await pool.query(
                    'SELECT * FROM maintenance_task_definitions WHERE id = $1',
                    [task.definitionId]
                );
                task.definition = defResult.rows[0] || null;

                const matResult = await pool.query(
                    'SELECT * FROM maintenance_materials WHERE task_definition_id = $1',
                    [task.definitionId]
                );
                task.materials = matResult.rows;
            } else {
                task.materials = [];
            }

            res.json({ success: true, data: task });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/maintenance/tasks - Create maintenance task
    router.post('/tasks', async (req, res) => {
        try {
            const {
                definitionId, machineId, taskName, description, category,
                dueDate, frequencyType, machineName, machineType
            } = req.body;

            if (!machineId || !taskName || !dueDate) {
                return res.status(400).json({
                    success: false,
                    error: 'machineId, taskName, and dueDate are required'
                });
            }

            const result = await pool.query(`
                INSERT INTO maintenance_tasks (
                    definition_id, machine_id, task_name, description, category,
                    scheduled_date, due_date, frequency_type, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'Scheduled')
                RETURNING *
            `, [definitionId, machineId, taskName, description, category, dueDate, frequencyType]);

            const task = transformTask(result.rows[0]);
            task.machineName = machineName;
            task.machineType = machineType;

            res.status(201).json({ success: true, data: task });
        } catch (error) {
            console.error('Create maintenance task error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/maintenance/tasks/:id/start - Start maintenance
    router.put('/tasks/:id/start', async (req, res) => {
        try {
            const { performerName } = req.body;

            const result = await pool.query(`
                UPDATE maintenance_tasks 
                SET status = 'In Progress', started_at = NOW(), completed_by_name = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [performerName, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            // Log history
            await pool.query(`
                INSERT INTO maintenance_history (machine_id, maintenance_task_id, action, performed_by_name)
                VALUES ($1, $2, 'started', $3)
            `, [result.rows[0].machine_id, req.params.id, performerName]);

            res.json({ success: true, data: transformTask(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/maintenance/tasks/:id/complete - Complete maintenance
    router.put('/tasks/:id/complete', async (req, res) => {
        try {
            const {
                completedByName, actualDuration, issuesFound, partsReplaced, notes, readings
            } = req.body;

            const result = await pool.query(`
                UPDATE maintenance_tasks 
                SET status = 'Complete', completed_at = NOW(), completed_by_name = $1,
                    actual_duration = $2, issues_found = $3, parts_replaced = $4, 
                    notes = $5, readings = $6, updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `, [completedByName, actualDuration, issuesFound, partsReplaced, notes, JSON.stringify(readings || {}), req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const task = result.rows[0];

            // Log history
            await pool.query(`
                INSERT INTO maintenance_history (machine_id, maintenance_task_id, action, description, performed_by_name, notes)
                VALUES ($1, $2, 'completed', $3, $4, $5)
            `, [task.machine_id, req.params.id, `Completed: ${task.task_name}`, completedByName, issuesFound || notes]);

            // Create next scheduled task if recurring
            if (task.definition_id) {
                const defResult = await pool.query(
                    'SELECT * FROM maintenance_task_definitions WHERE id = $1',
                    [task.definition_id]
                );
                const definition = defResult.rows[0];

                if (definition && definition.frequency_value) {
                    const nextDueDate = new Date(Date.now() + definition.frequency_value * 86400000).toISOString().split('T')[0];

                    await pool.query(`
                        INSERT INTO maintenance_tasks (
                            definition_id, machine_id, task_name, description, category,
                            scheduled_date, due_date, frequency_type, status
                        ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 'Scheduled')
                    `, [
                        definition.id, task.machine_id, task.task_name, task.description,
                        task.category, nextDueDate, task.frequency_type
                    ]);
                }
            }

            res.json({ success: true, data: transformTask(result.rows[0]) });
        } catch (error) {
            console.error('Complete maintenance error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/maintenance/tasks/:id/defer - Defer maintenance
    router.put('/tasks/:id/defer', async (req, res) => {
        try {
            const { deferredTo, deferredReason, deferredByName } = req.body;

            if (!deferredTo || !deferredReason) {
                return res.status(400).json({
                    success: false,
                    error: 'deferredTo and deferredReason are required'
                });
            }

            const result = await pool.query(`
                UPDATE maintenance_tasks 
                SET status = 'Deferred', due_date = $1, deferred_to = $1, 
                    deferred_reason = $2, updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [deferredTo, deferredReason, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            // Log history
            await pool.query(`
                INSERT INTO maintenance_history (machine_id, maintenance_task_id, action, description, performed_by_name)
                VALUES ($1, $2, 'deferred', $3, $4)
            `, [result.rows[0].machine_id, req.params.id, `Deferred to ${deferredTo}: ${deferredReason}`, deferredByName]);

            res.json({ success: true, data: transformTask(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/maintenance/tasks/:id/issue - Report issue during maintenance
    router.post('/tasks/:id/issue', async (req, res) => {
        try {
            const { issueDescription, severity = 'Medium', reportedByName } = req.body;

            if (!issueDescription) {
                return res.status(400).json({ success: false, error: 'Issue description is required' });
            }

            const result = await pool.query(`
                UPDATE maintenance_tasks 
                SET issues_found = COALESCE(issues_found, '') || E'\n' || $1, updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [issueDescription, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            // Log history
            await pool.query(`
                INSERT INTO maintenance_history (machine_id, maintenance_task_id, action, description, performed_by_name, notes)
                VALUES ($1, $2, 'issue_found', $3, $4, $5)
            `, [result.rows[0].machine_id, req.params.id, issueDescription, reportedByName, `Severity: ${severity}`]);

            res.json({ success: true, data: transformTask(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // DELETE /api/maintenance/tasks/:id - Delete/cancel task
    router.delete('/tasks/:id', async (req, res) => {
        try {
            const result = await pool.query(
                'DELETE FROM maintenance_tasks WHERE id = $1 RETURNING id',
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            res.json({ success: true, message: 'Task deleted' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== DEFINITIONS ====================

    // GET /api/maintenance/definitions - List task definitions
    router.get('/definitions', async (req, res) => {
        try {
            let query = 'SELECT * FROM maintenance_task_definitions WHERE is_active = TRUE';
            const params = [];

            if (req.query.machineType) {
                query += ' AND machine_type = $1';
                params.push(req.query.machineType);
            }

            query += ' ORDER BY task_name';

            const result = await pool.query(query, params);

            // Get materials for each definition
            const definitions = await Promise.all(result.rows.map(async (def) => {
                const materials = await pool.query(
                    'SELECT * FROM maintenance_materials WHERE task_definition_id = $1',
                    [def.id]
                );
                return { ...def, materials: materials.rows };
            }));

            res.json({ success: true, data: definitions });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/maintenance/definitions - Create definition
    router.post('/definitions', async (req, res) => {
        try {
            const {
                machineId, machineType, taskName, description, category,
                frequencyType, frequencyValue, estimatedDuration,
                requiresShutdown, skillLevel, instructions, safetyNotes, materials
            } = req.body;

            if (!taskName || !frequencyType) {
                return res.status(400).json({
                    success: false,
                    error: 'taskName and frequencyType are required'
                });
            }

            const result = await pool.query(`
                INSERT INTO maintenance_task_definitions (
                    machine_id, machine_type, task_name, description, category,
                    frequency_type, frequency_value, estimated_duration,
                    requires_shutdown, skill_level, instructions, safety_notes, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
                RETURNING *
            `, [
                machineId, machineType, taskName, description, category,
                frequencyType, frequencyValue, estimatedDuration,
                requiresShutdown || false, skillLevel, instructions, safetyNotes
            ]);

            const definition = result.rows[0];

            // Add materials if provided
            if (materials && Array.isArray(materials)) {
                for (const m of materials) {
                    await pool.query(`
                        INSERT INTO maintenance_materials (task_definition_id, material_name, part_number, quantity, unit, is_critical)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [definition.id, m.materialName, m.partNumber, m.quantity || 1, m.unit || 'EA', m.isCritical || false]);
                }
            }

            // Get materials
            const matResult = await pool.query(
                'SELECT * FROM maintenance_materials WHERE task_definition_id = $1',
                [definition.id]
            );

            res.status(201).json({
                success: true,
                data: { ...definition, materials: matResult.rows }
            });
        } catch (error) {
            console.error('Create definition error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== HISTORY ====================

    // GET /api/maintenance/history - Get maintenance history
    router.get('/history', async (req, res) => {
        try {
            let query = 'SELECT * FROM maintenance_history WHERE 1=1';
            const params = [];
            let paramIndex = 1;

            if (req.query.machineId) {
                query += ` AND machine_id = $${paramIndex++}`;
                params.push(parseInt(req.query.machineId));
            }

            query += ' ORDER BY performed_at DESC';

            // Pagination
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = (page - 1) * limit;

            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, offset);

            const result = await pool.query(query, params);

            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/maintenance/stats - Get maintenance statistics
    router.get('/stats', async (req, res) => {
        try {
            const stats = await getStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
