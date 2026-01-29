// Tasks API Routes for BPERP
// Uses PostgreSQL database for persistence

const express = require('express');

module.exports = function(pool) {
    const router = express.Router();

    // Helper: Calculate task stats from database
    async function calculateStats() {
        try {
            const now = new Date();
            const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

            const [totalOpen, overdue, dueToday, completedThisWeek, byType, byStatus] = await Promise.all([
                pool.query(`SELECT COUNT(*) FROM tasks WHERE status != 'Complete' AND deleted_at IS NULL`),
                pool.query(`SELECT COUNT(*) FROM tasks WHERE status != 'Complete' AND deleted_at IS NULL AND due_date < $1`, [now]),
                pool.query(`SELECT COUNT(*) FROM tasks WHERE status != 'Complete' AND deleted_at IS NULL AND due_date >= $1 AND due_date < $2`, [today, tomorrow]),
                pool.query(`SELECT COUNT(*) FROM tasks WHERE status = 'Complete' AND completed_at >= $1`, [weekAgo]),
                pool.query(`SELECT type, COUNT(*) as count FROM tasks WHERE deleted_at IS NULL GROUP BY type`),
                pool.query(`SELECT status, COUNT(*) as count FROM tasks WHERE deleted_at IS NULL GROUP BY status`)
            ]);

            return {
                totalOpen: parseInt(totalOpen.rows[0].count),
                overdue: parseInt(overdue.rows[0].count),
                dueToday: parseInt(dueToday.rows[0].count),
                completedThisWeek: parseInt(completedThisWeek.rows[0].count),
                byType: byType.rows.reduce((acc, r) => { acc[r.type] = parseInt(r.count); return acc; }, {}),
                byStatus: byStatus.rows.reduce((acc, r) => { acc[r.status] = parseInt(r.count); return acc; }, {})
            };
        } catch (err) {
            console.error('Error calculating stats:', err);
            return { totalOpen: 0, overdue: 0, dueToday: 0, completedThisWeek: 0, byType: {}, byStatus: {} };
        }
    }

    // Helper: Enrich task with computed fields
    function enrichTask(task) {
        if (!task.due_date) return { ...task };
        
        const now = new Date();
        const dueDate = new Date(task.due_date);
        const msUntilDue = dueDate - now;
        const hoursUntilDue = msUntilDue / (1000 * 60 * 60);
        
        return {
            ...task,
            isOverdue: msUntilDue < 0 && task.status !== 'Complete',
            daysUntilDue: Math.ceil(msUntilDue / (1000 * 60 * 60 * 24)),
            urgency: task.status === 'Complete' ? 'complete' :
                     msUntilDue < 0 ? 'overdue' :
                     hoursUntilDue < 24 ? 'urgent' :
                     hoursUntilDue < 72 ? 'soon' : 'normal'
        };
    }

    // Helper: Transform DB row to API format
    function transformTask(row) {
        return {
            id: row.id,
            type: row.type,
            title: row.title,
            description: row.description,
            workOrderId: row.work_order_id,
            partNumber: row.part_number,
            quantity: row.quantity,
            assignedTo: row.assigned_to,
            assignedToName: row.assigned_to_name,
            assignedAt: row.assigned_at,
            status: row.status,
            priority: row.priority,
            dueDate: row.due_date,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            estimatedDuration: row.estimated_duration,
            actualDuration: row.actual_duration,
            taskData: row.task_data || {},
            isRecurring: row.is_recurring,
            recurrencePattern: row.recurrence_pattern,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // GET /api/tasks - List all tasks with filtering
    router.get('/', async (req, res) => {
        try {
            let query = `
                SELECT * FROM tasks 
                WHERE deleted_at IS NULL
            `;
            const params = [];
            let paramIndex = 1;

            // Filter by type
            if (req.query.type) {
                const types = Array.isArray(req.query.type) ? req.query.type : [req.query.type];
                query += ` AND type = ANY($${paramIndex++})`;
                params.push(types);
            }

            // Filter by status
            if (req.query.status) {
                const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
                query += ` AND status = ANY($${paramIndex++})`;
                params.push(statuses);
            }

            // Filter by priority
            if (req.query.priority) {
                const priorities = Array.isArray(req.query.priority) ? req.query.priority : [req.query.priority];
                query += ` AND priority = ANY($${paramIndex++})`;
                params.push(priorities);
            }

            // Filter by assignee
            if (req.query.assignedTo) {
                query += ` AND LOWER(assigned_to_name) LIKE LOWER($${paramIndex++})`;
                params.push(`%${req.query.assignedTo}%`);
            }

            // Filter by overdue
            if (req.query.isOverdue === 'true') {
                query += ` AND due_date < NOW() AND status != 'Complete'`;
            }

            // Filter by date range
            if (req.query.dueDateFrom) {
                query += ` AND due_date >= $${paramIndex++}`;
                params.push(req.query.dueDateFrom);
            }
            if (req.query.dueDateTo) {
                query += ` AND due_date <= $${paramIndex++}`;
                params.push(req.query.dueDateTo);
            }

            // Search
            if (req.query.search) {
                query += ` AND (
                    LOWER(title) LIKE LOWER($${paramIndex}) OR
                    LOWER(description) LIKE LOWER($${paramIndex}) OR
                    LOWER(part_number) LIKE LOWER($${paramIndex}) OR
                    LOWER(assigned_to_name) LIKE LOWER($${paramIndex})
                )`;
                params.push(`%${req.query.search}%`);
                paramIndex++;
            }

            // Sort
            const sortBy = req.query.sortBy || 'due_date';
            const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';
            const validSortColumns = ['due_date', 'priority', 'status', 'title', 'created_at'];
            const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'due_date';
            
            if (sortColumn === 'priority') {
                query += ` ORDER BY CASE priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END ${sortOrder}`;
            } else {
                query += ` ORDER BY ${sortColumn} ${sortOrder} NULLS LAST`;
            }

            // Pagination
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const offset = (page - 1) * limit;

            // Get total count
            const countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);

            // Add pagination to main query
            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit, offset);

            const result = await pool.query(query, params);
            const tasks = result.rows.map(row => enrichTask(transformTask(row)));
            const stats = await calculateStats();

            res.json({
                success: true,
                data: tasks,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                },
                stats
            });
        } catch (error) {
            console.error('Get tasks error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/tasks/stats - Get task statistics
    router.get('/stats', async (req, res) => {
        try {
            const stats = await calculateStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/tasks/my-tasks - Get tasks for current user
    router.get('/my-tasks', async (req, res) => {
        try {
            const userName = req.query.userName;
            if (!userName) {
                return res.status(400).json({ success: false, error: 'userName parameter required' });
            }

            const result = await pool.query(`
                SELECT * FROM tasks 
                WHERE deleted_at IS NULL 
                  AND LOWER(assigned_to_name) = LOWER($1)
                ORDER BY due_date ASC NULLS LAST
            `, [userName]);

            const tasks = result.rows.map(row => enrichTask(transformTask(row)));
            res.json({ success: true, data: tasks });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/tasks/:id - Get single task
    router.get('/:id', async (req, res) => {
        try {
            const taskResult = await pool.query(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [req.params.id]
            );

            if (taskResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const historyResult = await pool.query(
                'SELECT * FROM task_history WHERE task_id = $1 ORDER BY timestamp DESC',
                [req.params.id]
            );

            const task = enrichTask(transformTask(taskResult.rows[0]));
            task.history = historyResult.rows;

            res.json({ success: true, data: task });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/tasks - Create new task
    router.post('/', async (req, res) => {
        try {
            const {
                type, title, description, workOrderId, partNumber, quantity,
                assignedToName, priority = 'Medium', dueDate, estimatedDuration,
                isRecurring = false, recurrencePattern, taskData
            } = req.body;

            if (!type || !title) {
                return res.status(400).json({ success: false, error: 'Type and title are required' });
            }

            const result = await pool.query(`
                INSERT INTO tasks (
                    type, title, description, work_order_id, part_number, quantity,
                    assigned_to_name, status, priority, due_date, estimated_duration,
                    is_recurring, recurrence_pattern, task_data, assigned_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Not Started', $8, $9, $10, $11, $12, $13, $14)
                RETURNING *
            `, [
                type, title, description, workOrderId || null, partNumber, quantity,
                assignedToName, priority, dueDate, estimatedDuration,
                isRecurring, recurrencePattern, JSON.stringify(taskData || {}),
                assignedToName ? new Date() : null
            ]);

            const task = enrichTask(transformTask(result.rows[0]));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, new_value)
                VALUES ($1, 'created', $2)
            `, [task.id, JSON.stringify({ title, type, assignedToName })]);

            res.status(201).json({ success: true, data: task });
        } catch (error) {
            console.error('Create task error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/tasks/:id - Update task
    router.put('/:id', async (req, res) => {
        try {
            const taskId = parseInt(req.params.id);
            
            // Get current task
            const current = await pool.query(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const oldTask = current.rows[0];
            const updates = req.body;

            // Build dynamic update
            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            const fieldMap = {
                type: 'type',
                title: 'title',
                description: 'description',
                workOrderId: 'work_order_id',
                partNumber: 'part_number',
                quantity: 'quantity',
                assignedToName: 'assigned_to_name',
                status: 'status',
                priority: 'priority',
                dueDate: 'due_date',
                estimatedDuration: 'estimated_duration',
                actualDuration: 'actual_duration',
                taskData: 'task_data'
            };

            for (const [jsField, dbField] of Object.entries(fieldMap)) {
                if (updates[jsField] !== undefined) {
                    setClauses.push(`${dbField} = $${paramIndex++}`);
                    values.push(jsField === 'taskData' ? JSON.stringify(updates[jsField]) : updates[jsField]);
                }
            }

            if (setClauses.length === 0) {
                return res.status(400).json({ success: false, error: 'No fields to update' });
            }

            setClauses.push(`updated_at = NOW()`);
            values.push(taskId);

            const result = await pool.query(`
                UPDATE tasks SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex} AND deleted_at IS NULL
                RETURNING *
            `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const task = enrichTask(transformTask(result.rows[0]));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, old_value, new_value)
                VALUES ($1, 'updated', $2, $3)
            `, [taskId, JSON.stringify(transformTask(oldTask)), JSON.stringify(updates)]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/tasks/:id/status - Update task status
    router.put('/:id/status', async (req, res) => {
        try {
            const taskId = parseInt(req.params.id);
            const { status, notes, actualDuration } = req.body;

            if (!status) {
                return res.status(400).json({ success: false, error: 'Status is required' });
            }

            // Get current task
            const current = await pool.query(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const oldStatus = current.rows[0].status;
            let updateQuery = `UPDATE tasks SET status = $1, updated_at = NOW()`;
            const params = [status];
            let paramIndex = 2;

            if (status === 'In Progress' && !current.rows[0].started_at) {
                updateQuery += `, started_at = NOW()`;
            }

            if (status === 'Complete') {
                updateQuery += `, completed_at = NOW()`;
                if (actualDuration) {
                    updateQuery += `, actual_duration = $${paramIndex++}`;
                    params.push(actualDuration);
                }
            }

            params.push(taskId);
            updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;

            const result = await pool.query(updateQuery, params);
            const task = enrichTask(transformTask(result.rows[0]));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, old_value, new_value, notes)
                VALUES ($1, 'status_changed', $2, $3, $4)
            `, [taskId, JSON.stringify({ status: oldStatus }), JSON.stringify({ status }), notes]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/tasks/:id/assign - Assign/reassign task
    router.put('/:id/assign', async (req, res) => {
        try {
            const taskId = parseInt(req.params.id);
            const { assignedToName, notes } = req.body;

            if (!assignedToName) {
                return res.status(400).json({ success: false, error: 'assignedToName is required' });
            }

            // Get current task
            const current = await pool.query(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const oldAssignee = current.rows[0].assigned_to_name;

            const result = await pool.query(`
                UPDATE tasks SET assigned_to_name = $1, assigned_at = NOW(), updated_at = NOW()
                WHERE id = $2 AND deleted_at IS NULL
                RETURNING *
            `, [assignedToName, taskId]);

            const task = enrichTask(transformTask(result.rows[0]));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, old_value, new_value, notes)
                VALUES ($1, 'reassigned', $2, $3, $4)
            `, [taskId, JSON.stringify({ assignedToName: oldAssignee }), JSON.stringify({ assignedToName }), notes]);

            // Add to task_assignments table
            await pool.query(`
                INSERT INTO task_assignments (task_id, user_name, notes)
                VALUES ($1, $2, $3)
            `, [taskId, assignedToName, notes]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Assign task error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/tasks/:id/issue - Report an issue
    router.post('/:id/issue', async (req, res) => {
        try {
            const taskId = parseInt(req.params.id);
            const { issueType, description, severity = 'Medium' } = req.body;

            if (!description) {
                return res.status(400).json({ success: false, error: 'Description is required' });
            }

            // Get current task
            const current = await pool.query(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            // Update task with issue data
            const taskData = current.rows[0].task_data || {};
            taskData.issue = {
                issueType,
                description,
                severity,
                reportedAt: new Date().toISOString()
            };

            const result = await pool.query(`
                UPDATE tasks SET status = 'Issue', task_data = $1, updated_at = NOW()
                WHERE id = $2 AND deleted_at IS NULL
                RETURNING *
            `, [JSON.stringify(taskData), taskId]);

            const task = enrichTask(transformTask(result.rows[0]));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, new_value)
                VALUES ($1, 'issue_reported', $2)
            `, [taskId, JSON.stringify({ issueType, description, severity })]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Report issue error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // DELETE /api/tasks/:id - Soft delete task
    router.delete('/:id', async (req, res) => {
        try {
            const taskId = parseInt(req.params.id);

            const result = await pool.query(`
                UPDATE tasks SET deleted_at = NOW()
                WHERE id = $1 AND deleted_at IS NULL
                RETURNING id
            `, [taskId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action)
                VALUES ($1, 'deleted')
            `, [taskId]);

            res.json({ success: true, message: 'Task deleted successfully' });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/tasks/:id/history - Get task history
    router.get('/:id/history', async (req, res) => {
        try {
            const taskId = parseInt(req.params.id);

            const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [taskId]);
            if (taskCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Task not found' });
            }

            const result = await pool.query(`
                SELECT * FROM task_history 
                WHERE task_id = $1 
                ORDER BY timestamp DESC
            `, [taskId]);

            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
