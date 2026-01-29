// Machines API Routes for BPERP
// Uses PostgreSQL database for persistence

const express = require('express');

module.exports = function(pool) {
    const router = express.Router();

    // Helper: Transform machine from DB to API format
    function transformMachine(row) {
        return {
            id: row.id,
            name: row.name,
            machineId: row.machine_id,
            type: row.type,
            manufacturer: row.manufacturer,
            model: row.model,
            serialNumber: row.serial_number,
            yearInstalled: row.year_installed,
            workcenterId: row.workcenter_id,
            location: row.location,
            status: row.status,
            currentJobId: row.current_job_id,
            currentOperatorId: row.current_operator_id,
            currentOperatorName: row.current_operator_name,
            maintenanceHours: parseFloat(row.maintenance_hours) || 0,
            maintenanceCycles: row.maintenance_cycles || 0,
            lastMaintenanceDate: row.last_maintenance_date,
            nextMaintenanceDate: row.next_maintenance_date,
            maintenanceIntervalHours: row.maintenance_interval_hours,
            maintenanceIntervalDays: row.maintenance_interval_days,
            totalRunHours: parseFloat(row.total_run_hours) || 0,
            totalCycles: row.total_cycles || 0,
            notes: row.notes,
            specifications: row.specifications || {},
            isActive: row.is_active,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // Helper: Calculate maintenance status
    function getMaintenanceStatus(machine) {
        const now = new Date();
        const nextMaint = machine.nextMaintenanceDate ? new Date(machine.nextMaintenanceDate) : null;
        const hoursRemaining = machine.maintenanceIntervalHours ?
            machine.maintenanceIntervalHours - machine.maintenanceHours : null;

        // Check if overdue
        if (nextMaint && nextMaint < now) return 'Overdue';
        if (hoursRemaining !== null && hoursRemaining <= 0) return 'Overdue';

        // Check if attention needed
        const daysUntilMaint = nextMaint ? Math.ceil((nextMaint - now) / (1000 * 60 * 60 * 24)) : null;
        if (daysUntilMaint !== null && daysUntilMaint <= 7) return 'Attention';
        if (hoursRemaining !== null && hoursRemaining <= 50) return 'Attention';

        return 'Good';
    }

    // Helper: Enrich machine with computed fields
    function enrichMachine(machine) {
        return {
            ...machine,
            maintenanceStatus: getMaintenanceStatus(machine),
            hoursUntilMaintenance: machine.maintenanceIntervalHours ?
                machine.maintenanceIntervalHours - machine.maintenanceHours : null,
            daysUntilMaintenance: machine.nextMaintenanceDate ?
                Math.ceil((new Date(machine.nextMaintenanceDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
        };
    }

    // GET /api/machines - List all machines
    router.get('/', async (req, res) => {
        try {
            let query = 'SELECT * FROM machines WHERE is_active = TRUE';
            const params = [];
            let paramIndex = 1;

            // Filter by type
            if (req.query.type) {
                query += ` AND type = $${paramIndex++}`;
                params.push(req.query.type);
            }

            // Filter by status
            if (req.query.status) {
                query += ` AND status = $${paramIndex++}`;
                params.push(req.query.status);
            }

            // Filter by workcenter
            if (req.query.workcenterId) {
                query += ` AND workcenter_id = $${paramIndex++}`;
                params.push(parseInt(req.query.workcenterId));
            }

            // Search
            if (req.query.search) {
                query += ` AND (LOWER(name) LIKE LOWER($${paramIndex}) OR LOWER(machine_id) LIKE LOWER($${paramIndex}) OR LOWER(manufacturer) LIKE LOWER($${paramIndex}))`;
                params.push(`%${req.query.search}%`);
                paramIndex++;
            }

            query += ' ORDER BY name';

            const result = await pool.query(query, params);
            let machines = result.rows.map(row => enrichMachine(transformMachine(row)));

            // Filter by maintenance status (computed field)
            if (req.query.maintenanceStatus) {
                machines = machines.filter(m => m.maintenanceStatus === req.query.maintenanceStatus);
            }

            // Calculate summary stats
            const stats = {
                total: machines.length,
                running: machines.filter(m => m.status === 'Running').length,
                idle: machines.filter(m => m.status === 'Idle').length,
                down: machines.filter(m => m.status === 'Down').length,
                maintenance: machines.filter(m => m.status === 'Maintenance').length,
                maintenanceOverdue: machines.filter(m => m.maintenanceStatus === 'Overdue').length,
                maintenanceAttention: machines.filter(m => m.maintenanceStatus === 'Attention').length
            };

            res.json({ success: true, data: machines, stats });
        } catch (error) {
            console.error('Get machines error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/machines/:id - Get single machine
    router.get('/:id', async (req, res) => {
        try {
            const machineResult = await pool.query(
                'SELECT * FROM machines WHERE id = $1 AND is_active = TRUE',
                [req.params.id]
            );

            if (machineResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Machine not found' });
            }

            const historyResult = await pool.query(`
                SELECT * FROM machine_status_history 
                WHERE machine_id = $1 
                ORDER BY changed_at DESC 
                LIMIT 20
            `, [req.params.id]);

            const machine = enrichMachine(transformMachine(machineResult.rows[0]));
            machine.statusHistory = historyResult.rows;

            res.json({ success: true, data: machine });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/machines - Create new machine
    router.post('/', async (req, res) => {
        try {
            const {
                name, machineId, type, manufacturer, model, serialNumber,
                yearInstalled, workcenterId, location,
                maintenanceIntervalHours, maintenanceIntervalDays, notes, specifications
            } = req.body;

            if (!name || !type) {
                return res.status(400).json({ success: false, error: 'Name and type are required' });
            }

            // Check for duplicate machineId
            if (machineId) {
                const existing = await pool.query('SELECT id FROM machines WHERE machine_id = $1', [machineId]);
                if (existing.rows.length > 0) {
                    return res.status(400).json({ success: false, error: 'Machine ID already exists' });
                }
            }

            const nextMaintenanceDate = maintenanceIntervalDays ?
                new Date(Date.now() + maintenanceIntervalDays * 86400000).toISOString().split('T')[0] : null;

            const result = await pool.query(`
                INSERT INTO machines (
                    name, machine_id, type, manufacturer, model, serial_number,
                    year_installed, workcenter_id, location, status,
                    maintenance_hours, maintenance_cycles, last_maintenance_date, next_maintenance_date,
                    maintenance_interval_hours, maintenance_interval_days,
                    total_run_hours, total_cycles, notes, specifications, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Idle', 0, 0, CURRENT_DATE, $10, $11, $12, 0, 0, $13, $14, TRUE)
                RETURNING *
            `, [
                name, machineId, type, manufacturer, model, serialNumber,
                yearInstalled, workcenterId, location, nextMaintenanceDate,
                maintenanceIntervalHours, maintenanceIntervalDays,
                notes, JSON.stringify(specifications || {})
            ]);

            res.status(201).json({
                success: true,
                data: enrichMachine(transformMachine(result.rows[0]))
            });
        } catch (error) {
            console.error('Create machine error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/machines/:id - Update machine
    router.put('/:id', async (req, res) => {
        try {
            const updates = req.body;

            // Check for duplicate machineId
            if (updates.machineId) {
                const existing = await pool.query(
                    'SELECT id FROM machines WHERE machine_id = $1 AND id != $2',
                    [updates.machineId, req.params.id]
                );
                if (existing.rows.length > 0) {
                    return res.status(400).json({ success: false, error: 'Machine ID already exists' });
                }
            }

            const setClauses = [];
            const values = [];
            let paramIndex = 1;

            const fieldMap = {
                name: 'name',
                machineId: 'machine_id',
                type: 'type',
                manufacturer: 'manufacturer',
                model: 'model',
                serialNumber: 'serial_number',
                yearInstalled: 'year_installed',
                workcenterId: 'workcenter_id',
                location: 'location',
                maintenanceIntervalHours: 'maintenance_interval_hours',
                maintenanceIntervalDays: 'maintenance_interval_days',
                notes: 'notes'
            };

            for (const [jsField, dbField] of Object.entries(fieldMap)) {
                if (updates[jsField] !== undefined) {
                    setClauses.push(`${dbField} = $${paramIndex++}`);
                    values.push(updates[jsField]);
                }
            }

            if (updates.specifications !== undefined) {
                setClauses.push(`specifications = $${paramIndex++}`);
                values.push(JSON.stringify(updates.specifications));
            }

            if (setClauses.length === 0) {
                return res.status(400).json({ success: false, error: 'No fields to update' });
            }

            setClauses.push('updated_at = NOW()');
            values.push(parseInt(req.params.id));

            const result = await pool.query(`
                UPDATE machines SET ${setClauses.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Machine not found' });
            }

            res.json({ success: true, data: enrichMachine(transformMachine(result.rows[0])) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/machines/:id/status - Update machine status
    router.put('/:id/status', async (req, res) => {
        try {
            const { status, currentOperatorName, workOrderId, notes } = req.body;

            if (!status) {
                return res.status(400).json({ success: false, error: 'Status is required' });
            }

            // Get current status
            const current = await pool.query('SELECT status FROM machines WHERE id = $1', [req.params.id]);
            if (current.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Machine not found' });
            }
            const previousStatus = current.rows[0].status;

            const result = await pool.query(`
                UPDATE machines 
                SET status = $1, 
                    current_operator_name = COALESCE($2, current_operator_name),
                    current_job_id = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `, [status, currentOperatorName, workOrderId, req.params.id]);

            // Log status change
            await pool.query(`
                INSERT INTO machine_status_history (machine_id, status, previous_status, operator_name, work_order_id, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [req.params.id, status, previousStatus, currentOperatorName, workOrderId, notes]);

            res.json({ success: true, data: enrichMachine(transformMachine(result.rows[0])) });
        } catch (error) {
            console.error('Update status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/machines/:id/log-runtime - Log runtime hours/cycles
    router.put('/:id/log-runtime', async (req, res) => {
        try {
            const { hours, cycles } = req.body;

            let updateQuery = 'UPDATE machines SET updated_at = NOW()';
            const params = [];
            let paramIndex = 1;

            if (hours !== undefined) {
                updateQuery += `, maintenance_hours = maintenance_hours + $${paramIndex}, total_run_hours = total_run_hours + $${paramIndex}`;
                params.push(hours);
                paramIndex++;
            }

            if (cycles !== undefined) {
                updateQuery += `, maintenance_cycles = maintenance_cycles + $${paramIndex}, total_cycles = total_cycles + $${paramIndex}`;
                params.push(cycles);
                paramIndex++;
            }

            params.push(req.params.id);
            updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;

            const result = await pool.query(updateQuery, params);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Machine not found' });
            }

            res.json({ success: true, data: enrichMachine(transformMachine(result.rows[0])) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/machines/:id/reset-maintenance - Reset maintenance counters
    router.put('/:id/reset-maintenance', async (req, res) => {
        try {
            const current = await pool.query('SELECT maintenance_interval_days FROM machines WHERE id = $1', [req.params.id]);
            if (current.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Machine not found' });
            }

            const intervalDays = current.rows[0].maintenance_interval_days;
            const nextMaintenanceDate = intervalDays ?
                new Date(Date.now() + intervalDays * 86400000).toISOString().split('T')[0] : null;

            const result = await pool.query(`
                UPDATE machines 
                SET maintenance_hours = 0, 
                    maintenance_cycles = 0, 
                    last_maintenance_date = CURRENT_DATE,
                    next_maintenance_date = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [nextMaintenanceDate, req.params.id]);

            res.json({ success: true, data: enrichMachine(transformMachine(result.rows[0])) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // DELETE /api/machines/:id - Soft delete machine
    router.delete('/:id', async (req, res) => {
        try {
            const result = await pool.query(`
                UPDATE machines SET is_active = FALSE, updated_at = NOW()
                WHERE id = $1
                RETURNING id
            `, [req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Machine not found' });
            }

            res.json({ success: true, message: 'Machine deleted successfully' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/machines/:id/history - Get status history
    router.get('/:id/history', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT * FROM machine_status_history 
                WHERE machine_id = $1 
                ORDER BY changed_at DESC
            `, [req.params.id]);

            res.json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
