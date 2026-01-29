/**
 * Tasks API Routes for BPERP
 * Uses PostgreSQL database for persistence
 */

import { Router, Request, Response } from 'express';
import { Pool, QueryResult } from 'pg';
import {
    Task,
    TaskType,
    TaskStatus,
    TaskPriority,
    TaskHistory,
    ApiResponse,
    PaginatedResponse
} from '../types';

// ==================== DATABASE ROW TYPES ====================

interface TaskRow {
    id: number;
    type: string;
    title: string;
    description: string | null;
    work_order_id: number | null;
    part_number: string | null;
    quantity: number | null;
    assigned_to: number | null;
    assigned_to_name: string | null;
    assigned_at: Date | null;
    status: string;
    priority: string;
    due_date: Date | null;
    started_at: Date | null;
    completed_at: Date | null;
    estimated_duration: number | null;
    actual_duration: number | null;
    task_data: Record<string, any> | null;
    is_recurring: boolean;
    recurrence_pattern: string | null;
    parent_task_id: number | null;
    created_by: number | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

interface TaskHistoryRow {
    id: number;
    task_id: number;
    action: string;
    old_value: Record<string, any> | null;
    new_value: Record<string, any> | null;
    user_id: number | null;
    user_name: string | null;
    timestamp: Date;
    notes: string | null;
    ip_address: string | null;
}

interface CountRow {
    count: string;
}

interface TypeCountRow {
    type: string;
    count: string;
}

interface StatusCountRow {
    status: string;
    count: string;
}

// ==================== API TYPES ====================

interface TaskApiResponse extends Task {
    isOverdue?: boolean;
    daysUntilDue?: number;
    urgency?: 'complete' | 'overdue' | 'urgent' | 'soon' | 'normal';
    history?: TaskHistoryRow[];
}

interface TaskStats {
    totalOpen: number;
    overdue: number;
    dueToday: number;
    completedThisWeek: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
}

interface TaskListResponse extends PaginatedResponse<TaskApiResponse> {
    stats: TaskStats;
}

interface CreateTaskInput {
    type: TaskType;
    title: string;
    description?: string;
    workOrderId?: number;
    partNumber?: string;
    quantity?: number;
    assignedToName?: string;
    priority?: TaskPriority;
    dueDate?: string;
    estimatedDuration?: number;
    isRecurring?: boolean;
    recurrencePattern?: string;
    taskData?: Record<string, any>;
}

interface UpdateTaskInput {
    type?: TaskType;
    title?: string;
    description?: string;
    workOrderId?: number;
    partNumber?: string;
    quantity?: number;
    assignedToName?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
    estimatedDuration?: number;
    actualDuration?: number;
    taskData?: Record<string, any>;
}

interface UpdateStatusInput {
    status: TaskStatus;
    notes?: string;
    actualDuration?: number;
}

interface AssignTaskInput {
    assignedToName: string;
    notes?: string;
}

interface ReportIssueInput {
    issueType?: string;
    description: string;
    severity?: 'Low' | 'Medium' | 'High';
}

interface TaskQueryParams {
    type?: string | string[];
    status?: string | string[];
    priority?: string | string[];
    assignedTo?: string;
    isOverdue?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: string;
    limit?: string;
}

// ==================== ROUTE FACTORY ====================

export default function createTasksRouter(pool: Pool): Router {
    const router = Router();

    // ==================== HELPER FUNCTIONS ====================

    /**
     * Calculate task statistics from database
     */
    async function calculateStats(): Promise<TaskStats> {
        try {
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

            const [totalOpen, overdue, dueToday, completedThisWeek, byType, byStatus] = await Promise.all([
                pool.query<CountRow>(`SELECT COUNT(*) FROM tasks WHERE status != 'Complete' AND deleted_at IS NULL`),
                pool.query<CountRow>(`SELECT COUNT(*) FROM tasks WHERE status != 'Complete' AND deleted_at IS NULL AND due_date < $1`, [now]),
                pool.query<CountRow>(`SELECT COUNT(*) FROM tasks WHERE status != 'Complete' AND deleted_at IS NULL AND due_date >= $1 AND due_date < $2`, [today, tomorrow]),
                pool.query<CountRow>(`SELECT COUNT(*) FROM tasks WHERE status = 'Complete' AND completed_at >= $1`, [weekAgo]),
                pool.query<TypeCountRow>(`SELECT type, COUNT(*) as count FROM tasks WHERE deleted_at IS NULL GROUP BY type`),
                pool.query<StatusCountRow>(`SELECT status, COUNT(*) as count FROM tasks WHERE deleted_at IS NULL GROUP BY status`)
            ]);

            return {
                totalOpen: parseInt(totalOpen.rows[0]?.count || '0', 10),
                overdue: parseInt(overdue.rows[0]?.count || '0', 10),
                dueToday: parseInt(dueToday.rows[0]?.count || '0', 10),
                completedThisWeek: parseInt(completedThisWeek.rows[0]?.count || '0', 10),
                byType: byType.rows.reduce<Record<string, number>>((acc, r) => { 
                    acc[r.type] = parseInt(r.count, 10); 
                    return acc; 
                }, {}),
                byStatus: byStatus.rows.reduce<Record<string, number>>((acc, r) => { 
                    acc[r.status] = parseInt(r.count, 10); 
                    return acc; 
                }, {})
            };
        } catch (err) {
            console.error('Error calculating stats:', err);
            return { totalOpen: 0, overdue: 0, dueToday: 0, completedThisWeek: 0, byType: {}, byStatus: {} };
        }
    }

    /**
     * Enrich task with computed fields (urgency, overdue status)
     */
    function enrichTask(task: TaskApiResponse): TaskApiResponse {
        if (!task.dueDate) return { ...task };
        
        const now = new Date();
        const dueDate = new Date(task.dueDate);
        const msUntilDue = dueDate.getTime() - now.getTime();
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

    /**
     * Transform database row to API format (snake_case -> camelCase)
     */
    function transformTask(row: TaskRow): TaskApiResponse {
        return {
            id: row.id,
            type: row.type as TaskType,
            title: row.title,
            description: row.description,
            workOrderId: row.work_order_id,
            partNumber: row.part_number,
            quantity: row.quantity,
            assignedTo: row.assigned_to,
            assignedToName: row.assigned_to_name,
            assignedAt: row.assigned_at,
            status: row.status as TaskStatus,
            priority: row.priority as TaskPriority,
            dueDate: row.due_date,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            estimatedDuration: row.estimated_duration,
            actualDuration: row.actual_duration,
            taskData: row.task_data || {},
            isRecurring: row.is_recurring,
            recurrencePattern: row.recurrence_pattern,
            parentTaskId: row.parent_task_id,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            deletedAt: row.deleted_at
        };
    }

    // ==================== ROUTES ====================

    /**
     * GET /api/tasks - List all tasks with filtering
     */
    router.get('/', async (req: Request<{}, TaskListResponse, {}, TaskQueryParams>, res: Response<TaskListResponse | ApiResponse>) => {
        try {
            let query = `
                SELECT * FROM tasks 
                WHERE deleted_at IS NULL
            `;
            const params: (string | string[] | Date)[] = [];
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
            const page = parseInt(req.query.page || '1', 10) || 1;
            const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 200);
            const offset = (page - 1) * limit;

            // Get total count
            const countQuery = query.replace(/SELECT \* FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY.*$/, '');
            const countResult = await pool.query<CountRow>(countQuery, params);
            const total = parseInt(countResult.rows[0]?.count || '0', 10);

            // Add pagination to main query
            query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(limit.toString(), offset.toString());

            const result = await pool.query<TaskRow>(query, params);
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
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * GET /api/tasks/stats - Get task statistics
     */
    router.get('/stats', async (_req: Request, res: Response<ApiResponse<TaskStats>>) => {
        try {
            const stats = await calculateStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * GET /api/tasks/my-tasks - Get tasks for current user
     */
    router.get('/my-tasks', async (req: Request<{}, ApiResponse<TaskApiResponse[]>, {}, { userName?: string }>, res: Response<ApiResponse<TaskApiResponse[]>>) => {
        try {
            const userName = req.query.userName;
            if (!userName) {
                res.status(400).json({ success: false, error: 'userName parameter required' });
                return;
            }

            const result = await pool.query<TaskRow>(`
                SELECT * FROM tasks 
                WHERE deleted_at IS NULL 
                  AND LOWER(assigned_to_name) = LOWER($1)
                ORDER BY due_date ASC NULLS LAST
            `, [userName]);

            const tasks = result.rows.map(row => enrichTask(transformTask(row)));
            res.json({ success: true, data: tasks });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * GET /api/tasks/:id - Get single task
     */
    router.get('/:id', async (req: Request<{ id: string }>, res: Response<ApiResponse<TaskApiResponse>>) => {
        try {
            const taskResult = await pool.query<TaskRow>(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [req.params.id]
            );

            if (taskResult.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const historyResult = await pool.query<TaskHistoryRow>(
                'SELECT * FROM task_history WHERE task_id = $1 ORDER BY timestamp DESC',
                [req.params.id]
            );

            const task = enrichTask(transformTask(taskResult.rows[0]!));
            task.history = historyResult.rows;

            res.json({ success: true, data: task });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * POST /api/tasks - Create new task
     */
    router.post('/', async (req: Request<{}, ApiResponse<TaskApiResponse>, CreateTaskInput>, res: Response<ApiResponse<TaskApiResponse>>) => {
        try {
            const {
                type, title, description, workOrderId, partNumber, quantity,
                assignedToName, priority = 'Medium', dueDate, estimatedDuration,
                isRecurring = false, recurrencePattern, taskData
            } = req.body;

            if (!type || !title) {
                res.status(400).json({ success: false, error: 'Type and title are required' });
                return;
            }

            const result = await pool.query<TaskRow>(`
                INSERT INTO tasks (
                    type, title, description, work_order_id, part_number, quantity,
                    assigned_to_name, status, priority, due_date, estimated_duration,
                    is_recurring, recurrence_pattern, task_data, assigned_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Not Started', $8, $9, $10, $11, $12, $13, $14)
                RETURNING *
            `, [
                type, title, description || null, workOrderId || null, partNumber || null, quantity || null,
                assignedToName || null, priority, dueDate || null, estimatedDuration || null,
                isRecurring, recurrencePattern || null, JSON.stringify(taskData || {}),
                assignedToName ? new Date() : null
            ]);

            const task = enrichTask(transformTask(result.rows[0]!));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, new_value)
                VALUES ($1, 'created', $2)
            `, [task.id, JSON.stringify({ title, type, assignedToName })]);

            res.status(201).json({ success: true, data: task });
        } catch (error) {
            console.error('Create task error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * PUT /api/tasks/:id - Update task
     */
    router.put('/:id', async (req: Request<{ id: string }, ApiResponse<TaskApiResponse>, UpdateTaskInput>, res: Response<ApiResponse<TaskApiResponse>>) => {
        try {
            const taskId = parseInt(req.params.id, 10);
            
            // Get current task
            const current = await pool.query<TaskRow>(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const oldTask = current.rows[0]!;
            const updates = req.body;

            // Build dynamic update
            const setClauses: string[] = [];
            const values: (string | number | boolean | null)[] = [];
            let paramIndex = 1;

            const fieldMap: Record<string, string> = {
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
                const value = (updates as Record<string, any>)[jsField];
                if (value !== undefined) {
                    setClauses.push(`${dbField} = $${paramIndex++}`);
                    values.push(jsField === 'taskData' ? JSON.stringify(value) : value);
                }
            }

            if (setClauses.length === 0) {
                res.status(400).json({ success: false, error: 'No fields to update' });
                return;
            }

            setClauses.push(`updated_at = NOW()`);
            values.push(taskId);

            const result = await pool.query<TaskRow>(`
                UPDATE tasks SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex} AND deleted_at IS NULL
                RETURNING *
            `, values);

            if (result.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const task = enrichTask(transformTask(result.rows[0]!));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, old_value, new_value)
                VALUES ($1, 'updated', $2, $3)
            `, [taskId, JSON.stringify(transformTask(oldTask)), JSON.stringify(updates)]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Update task error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * PUT /api/tasks/:id/status - Update task status
     */
    router.put('/:id/status', async (req: Request<{ id: string }, ApiResponse<TaskApiResponse>, UpdateStatusInput>, res: Response<ApiResponse<TaskApiResponse>>) => {
        try {
            const taskId = parseInt(req.params.id, 10);
            const { status, notes, actualDuration } = req.body;

            if (!status) {
                res.status(400).json({ success: false, error: 'Status is required' });
                return;
            }

            // Get current task
            const current = await pool.query<TaskRow>(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const currentTask = current.rows[0]!;
            const oldStatus = currentTask.status;
            let updateQuery = `UPDATE tasks SET status = $1, updated_at = NOW()`;
            const params: (string | number)[] = [status];
            let paramIndex = 2;

            if (status === 'In Progress' && !currentTask.started_at) {
                updateQuery += `, started_at = NOW()`;
            }

            if (status === 'Complete') {
                updateQuery += `, completed_at = NOW()`;
                if (actualDuration !== undefined) {
                    updateQuery += `, actual_duration = $${paramIndex++}`;
                    params.push(actualDuration);
                }
            }

            params.push(taskId);
            updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;

            const result = await pool.query<TaskRow>(updateQuery, params);
            const task = enrichTask(transformTask(result.rows[0]!));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, old_value, new_value, notes)
                VALUES ($1, 'status_changed', $2, $3, $4)
            `, [taskId, JSON.stringify({ status: oldStatus }), JSON.stringify({ status }), notes || null]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Update status error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * PUT /api/tasks/:id/assign - Assign/reassign task
     */
    router.put('/:id/assign', async (req: Request<{ id: string }, ApiResponse<TaskApiResponse>, AssignTaskInput>, res: Response<ApiResponse<TaskApiResponse>>) => {
        try {
            const taskId = parseInt(req.params.id, 10);
            const { assignedToName, notes } = req.body;

            if (!assignedToName) {
                res.status(400).json({ success: false, error: 'assignedToName is required' });
                return;
            }

            // Get current task
            const current = await pool.query<TaskRow>(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const oldAssignee = current.rows[0]!.assigned_to_name;

            const result = await pool.query<TaskRow>(`
                UPDATE tasks SET assigned_to_name = $1, assigned_at = NOW(), updated_at = NOW()
                WHERE id = $2 AND deleted_at IS NULL
                RETURNING *
            `, [assignedToName, taskId]);

            const task = enrichTask(transformTask(result.rows[0]!));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, old_value, new_value, notes)
                VALUES ($1, 'reassigned', $2, $3, $4)
            `, [taskId, JSON.stringify({ assignedToName: oldAssignee }), JSON.stringify({ assignedToName }), notes || null]);

            // Add to task_assignments table
            await pool.query(`
                INSERT INTO task_assignments (task_id, user_name, notes)
                VALUES ($1, $2, $3)
            `, [taskId, assignedToName, notes || null]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Assign task error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * POST /api/tasks/:id/issue - Report an issue
     */
    router.post('/:id/issue', async (req: Request<{ id: string }, ApiResponse<TaskApiResponse>, ReportIssueInput>, res: Response<ApiResponse<TaskApiResponse>>) => {
        try {
            const taskId = parseInt(req.params.id, 10);
            const { issueType, description, severity = 'Medium' } = req.body;

            if (!description) {
                res.status(400).json({ success: false, error: 'Description is required' });
                return;
            }

            // Get current task
            const current = await pool.query<TaskRow>(
                'SELECT * FROM tasks WHERE id = $1 AND deleted_at IS NULL',
                [taskId]
            );
            if (current.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            // Update task with issue data
            const taskData = current.rows[0]!.task_data || {};
            taskData.issue = {
                issueType,
                description,
                severity,
                reportedAt: new Date().toISOString()
            };

            const result = await pool.query<TaskRow>(`
                UPDATE tasks SET status = 'Issue', task_data = $1, updated_at = NOW()
                WHERE id = $2 AND deleted_at IS NULL
                RETURNING *
            `, [JSON.stringify(taskData), taskId]);

            const task = enrichTask(transformTask(result.rows[0]!));

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action, new_value)
                VALUES ($1, 'issue_reported', $2)
            `, [taskId, JSON.stringify({ issueType, description, severity })]);

            res.json({ success: true, data: task });
        } catch (error) {
            console.error('Report issue error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * DELETE /api/tasks/:id - Soft delete task
     */
    router.delete('/:id', async (req: Request<{ id: string }>, res: Response<ApiResponse>) => {
        try {
            const taskId = parseInt(req.params.id, 10);

            const result = await pool.query<{ id: number }>(`
                UPDATE tasks SET deleted_at = NOW()
                WHERE id = $1 AND deleted_at IS NULL
                RETURNING id
            `, [taskId]);

            if (result.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            // Log history
            await pool.query(`
                INSERT INTO task_history (task_id, action)
                VALUES ($1, 'deleted')
            `, [taskId]);

            res.json({ success: true, message: 'Task deleted successfully' });
        } catch (error) {
            console.error('Delete task error:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    /**
     * GET /api/tasks/:id/history - Get task history
     */
    router.get('/:id/history', async (req: Request<{ id: string }>, res: Response<ApiResponse<TaskHistoryRow[]>>) => {
        try {
            const taskId = parseInt(req.params.id, 10);

            const taskCheck = await pool.query<{ id: number }>('SELECT id FROM tasks WHERE id = $1', [taskId]);
            if (taskCheck.rows.length === 0) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const result = await pool.query<TaskHistoryRow>(`
                SELECT * FROM task_history 
                WHERE task_id = $1 
                ORDER BY timestamp DESC
            `, [taskId]);

            res.json({ success: true, data: result.rows });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ success: false, error: message });
        }
    });

    return router;
}
