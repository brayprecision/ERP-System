// Workcenters API Routes for BPERP
// Uses PostgreSQL database for persistence

const express = require('express');

module.exports = function(pool) {
    const router = express.Router();

    // Helper: Transform queue item from DB to API format
    function transformQueueItem(row) {
        return {
            id: row.id,
            workcenterId: row.workcenter_id,
            workOrderId: row.work_order_id,
            taskId: row.task_id,
            sequence: row.sequence,
            status: row.status,
            priority: row.priority,
            partNumber: row.part_number,
            quantity: row.quantity,
            operationNumber: row.operation_number,
            operationDescription: row.operation_description,
            estimatedTime: row.estimated_time,
            setupNotes: row.setup_notes,
            woNumber: row.wo_number,
            material: row.material,
            operatorId: row.operator_id,
            operatorName: row.operator_name,
            queuedAt: row.queued_at,
            setupStartedAt: row.setup_started_at,
            processingStartedAt: row.processing_started_at,
            completedAt: row.completed_at,
            actualTime: row.actual_time,
            notes: row.notes
        };
    }

    // Helper: Transform workcenter from DB to API format
    function transformWorkcenter(row) {
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            description: row.description,
            location: row.location,
            capacity: row.capacity,
            isActive: row.is_active,
            displayOrder: row.display_order,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // GET /api/workcenters - List all workcenters
    router.get('/', async (req, res) => {
        try {
            const wcResult = await pool.query(`
                SELECT * FROM workcenters 
                WHERE is_active = TRUE
                ORDER BY display_order ASC
            `);

            const workcenters = await Promise.all(wcResult.rows.map(async (wc) => {
                // Get queue for this workcenter
                const queueResult = await pool.query(`
                    SELECT * FROM workcenter_queue
                    WHERE workcenter_id = $1 AND status != 'Complete'
                    ORDER BY sequence ASC
                `, [wc.id]);

                const queue = queueResult.rows.map(transformQueueItem);
                const workcenter = transformWorkcenter(wc);

                return {
                    ...workcenter,
                    currentJobs: queue.filter(q => q.status === 'Running' || q.status === 'Setup'),
                    queueLength: queue.filter(q => q.status === 'Waiting').length,
                    nextJobs: queue.filter(q => q.status === 'Waiting').slice(0, 3)
                };
            }));

            res.json({ success: true, data: workcenters });
        } catch (error) {
            console.error('Get workcenters error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/workcenters/:id - Get single workcenter with full queue
    router.get('/:id', async (req, res) => {
        try {
            const wcResult = await pool.query(
                'SELECT * FROM workcenters WHERE id = $1',
                [req.params.id]
            );

            if (wcResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Workcenter not found' });
            }

            const queueResult = await pool.query(`
                SELECT * FROM workcenter_queue
                WHERE workcenter_id = $1 AND status != 'Complete'
                ORDER BY sequence ASC
            `, [req.params.id]);

            const workcenter = transformWorkcenter(wcResult.rows[0]);
            const queue = queueResult.rows.map(transformQueueItem);

            res.json({
                success: true,
                data: {
                    ...workcenter,
                    queue,
                    currentJobs: queue.filter(q => q.status === 'Running' || q.status === 'Setup'),
                    waitingJobs: queue.filter(q => q.status === 'Waiting')
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/workcenters/:id/queue - Get workcenter queue
    router.get('/:id/queue', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT * FROM workcenter_queue
                WHERE workcenter_id = $1
                ORDER BY sequence ASC
            `, [req.params.id]);

            res.json({
                success: true,
                data: result.rows.map(transformQueueItem)
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/workcenters/:id/queue - Add item to queue
    router.post('/:id/queue', async (req, res) => {
        try {
            const workcenterId = parseInt(req.params.id);

            // Check workcenter exists
            const wcCheck = await pool.query('SELECT id FROM workcenters WHERE id = $1', [workcenterId]);
            if (wcCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Workcenter not found' });
            }

            const {
                workOrderId, taskId, partNumber, quantity, operationNumber,
                operationDescription, estimatedTime, setupNotes, priority = 5,
                woNumber, material
            } = req.body;

            // Get next sequence number
            const seqResult = await pool.query(`
                SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq
                FROM workcenter_queue
                WHERE workcenter_id = $1 AND status != 'Complete'
            `, [workcenterId]);

            const nextSequence = seqResult.rows[0].next_seq;

            const result = await pool.query(`
                INSERT INTO workcenter_queue (
                    workcenter_id, work_order_id, task_id, sequence, status, priority,
                    part_number, quantity, operation_number, operation_description,
                    estimated_time, setup_notes, wo_number, material
                ) VALUES ($1, $2, $3, $4, 'Waiting', $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                workcenterId, workOrderId, taskId, nextSequence, priority,
                partNumber, quantity, operationNumber, operationDescription,
                estimatedTime, setupNotes, woNumber, material
            ]);

            res.status(201).json({
                success: true,
                data: transformQueueItem(result.rows[0])
            });
        } catch (error) {
            console.error('Add to queue error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/workcenters/:id/queue/:queueId - Update queue item
    router.put('/:id/queue/:queueId', async (req, res) => {
        try {
            const updates = req.body;
            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            const fieldMap = {
                sequence: 'sequence',
                status: 'status',
                priority: 'priority',
                partNumber: 'part_number',
                quantity: 'quantity',
                operationNumber: 'operation_number',
                operationDescription: 'operation_description',
                estimatedTime: 'estimated_time',
                setupNotes: 'setup_notes',
                operatorName: 'operator_name',
                notes: 'notes'
            };

            for (const [jsField, dbField] of Object.entries(fieldMap)) {
                if (updates[jsField] !== undefined) {
                    setClauses.push(`${dbField} = $${paramIndex++}`);
                    values.push(updates[jsField]);
                }
            }

            if (setClauses.length === 0) {
                return res.status(400).json({ success: false, error: 'No fields to update' });
            }

            setClauses.push(`updated_at = NOW()`);
            values.push(parseInt(req.params.queueId), parseInt(req.params.id));

            const result = await pool.query(`
                UPDATE workcenter_queue 
                SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex} AND workcenter_id = $${paramIndex + 1}
                RETURNING *
            `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Queue item not found' });
            }

            res.json({ success: true, data: transformQueueItem(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/workcenters/:id/queue/:queueId/start-setup - Start setup
    router.put('/:id/queue/:queueId/start-setup', async (req, res) => {
        try {
            const { operatorName } = req.body;

            const result = await pool.query(`
                UPDATE workcenter_queue 
                SET status = 'Setup', setup_started_at = NOW(), operator_name = COALESCE($1, operator_name), updated_at = NOW()
                WHERE id = $2 AND workcenter_id = $3
                RETURNING *
            `, [operatorName, req.params.queueId, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Queue item not found' });
            }

            res.json({ success: true, data: transformQueueItem(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/workcenters/:id/queue/:queueId/start-processing - Start processing
    router.put('/:id/queue/:queueId/start-processing', async (req, res) => {
        try {
            const { operatorName } = req.body;

            const result = await pool.query(`
                UPDATE workcenter_queue 
                SET status = 'Running', processing_started_at = NOW(), operator_name = COALESCE($1, operator_name), updated_at = NOW()
                WHERE id = $2 AND workcenter_id = $3
                RETURNING *
            `, [operatorName, req.params.queueId, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Queue item not found' });
            }

            res.json({ success: true, data: transformQueueItem(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/workcenters/:id/queue/:queueId/complete - Complete job
    router.put('/:id/queue/:queueId/complete', async (req, res) => {
        try {
            const { quantityComplete, actualTime, notes } = req.body;

            const result = await pool.query(`
                UPDATE workcenter_queue 
                SET status = 'Complete', completed_at = NOW(), 
                    quantity_complete = COALESCE($1, quantity),
                    actual_time = $2, notes = COALESCE($3, notes), updated_at = NOW()
                WHERE id = $4 AND workcenter_id = $5
                RETURNING *
            `, [quantityComplete, actualTime, notes, req.params.queueId, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Queue item not found' });
            }

            res.json({ success: true, data: transformQueueItem(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/workcenters/:id/queue/:queueId/issue - Report issue
    router.put('/:id/queue/:queueId/issue', async (req, res) => {
        try {
            const { issueType, description } = req.body;

            const result = await pool.query(`
                UPDATE workcenter_queue 
                SET status = 'Issue', 
                    notes = COALESCE(notes, '') || E'\n' || $1 || ': ' || $2,
                    updated_at = NOW()
                WHERE id = $3 AND workcenter_id = $4
                RETURNING *
            `, [issueType || 'Issue', description, req.params.queueId, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Queue item not found' });
            }

            res.json({ success: true, data: transformQueueItem(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/workcenters/:id/queue/reorder - Reorder queue
    router.put('/:id/queue/reorder', async (req, res) => {
        try {
            const { items } = req.body;

            if (!Array.isArray(items)) {
                return res.status(400).json({ success: false, error: 'Items array is required' });
            }

            // Update sequences in transaction
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const { id, sequence } of items) {
                    await client.query(
                        'UPDATE workcenter_queue SET sequence = $1, updated_at = NOW() WHERE id = $2',
                        [sequence, id]
                    );
                }
                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }

            // Return updated queue
            const result = await pool.query(`
                SELECT * FROM workcenter_queue
                WHERE workcenter_id = $1
                ORDER BY sequence ASC
            `, [req.params.id]);

            res.json({ success: true, data: result.rows.map(transformQueueItem) });
        } catch (error) {
            console.error('Reorder queue error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // DELETE /api/workcenters/:id/queue/:queueId - Remove from queue
    router.delete('/:id/queue/:queueId', async (req, res) => {
        try {
            const result = await pool.query(`
                DELETE FROM workcenter_queue 
                WHERE id = $1 AND workcenter_id = $2
                RETURNING id
            `, [req.params.queueId, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Queue item not found' });
            }

            res.json({ success: true, message: 'Queue item removed' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/workcenters - Create new workcenter
    router.post('/', async (req, res) => {
        try {
            const { name, type, description, capacity = 1, location, displayOrder } = req.body;

            if (!name || !type) {
                return res.status(400).json({ success: false, error: 'Name and type are required' });
            }

            // Get max display order
            const maxOrderResult = await pool.query('SELECT COALESCE(MAX(display_order), 0) + 1 as next FROM workcenters');
            const nextOrder = displayOrder || maxOrderResult.rows[0].next;

            const result = await pool.query(`
                INSERT INTO workcenters (name, type, description, location, capacity, is_active, display_order)
                VALUES ($1, $2, $3, $4, $5, TRUE, $6)
                RETURNING *
            `, [name, type, description, location, capacity, nextOrder]);

            res.status(201).json({
                success: true,
                data: transformWorkcenter(result.rows[0])
            });
        } catch (error) {
            console.error('Create workcenter error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/workcenters/:id - Update workcenter
    router.put('/:id', async (req, res) => {
        try {
            const updates = req.body;
            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            const fieldMap = {
                name: 'name',
                type: 'type',
                description: 'description',
                location: 'location',
                capacity: 'capacity',
                isActive: 'is_active',
                displayOrder: 'display_order'
            };

            for (const [jsField, dbField] of Object.entries(fieldMap)) {
                if (updates[jsField] !== undefined) {
                    setClauses.push(`${dbField} = $${paramIndex++}`);
                    values.push(updates[jsField]);
                }
            }

            if (setClauses.length === 0) {
                return res.status(400).json({ success: false, error: 'No fields to update' });
            }

            setClauses.push(`updated_at = NOW()`);
            values.push(parseInt(req.params.id));

            const result = await pool.query(`
                UPDATE workcenters SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Workcenter not found' });
            }

            res.json({ success: true, data: transformWorkcenter(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
