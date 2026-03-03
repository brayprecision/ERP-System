// Work Orders API Routes for BPERP Sales Module
const express = require('express');
const router = express.Router();
const { validateBody, schemas } = require('../middleware/validation');

// Validation helpers (kept for PUT - Zod used for POST)
const validateWorkOrder = (data, isUpdate = false) => {
    const errors = [];
    
    if (!isUpdate) {
        if (!data.customerId) {
            errors.push({ field: 'customerId', message: 'Please select a customer' });
        }
        if (!data.partNumber || data.partNumber.trim().length === 0) {
            errors.push({ field: 'partNumber', message: 'Part number is required' });
        }
        if (!data.quantity || data.quantity < 1) {
            errors.push({ field: 'quantity', message: 'Quantity must be at least 1' });
        }
        if (!data.dueDate) {
            errors.push({ field: 'dueDate', message: 'Due date is required' });
        }
    }
    
    return { isValid: errors.length === 0, errors };
};

// Response helpers
const sendError = (res, statusCode, message, errors = null) => {
    const response = { success: false, error: message };
    if (errors) response.validationErrors = errors;
    res.status(statusCode).json(response);
};

const sendSuccess = (res, data, message = null) => {
    const response = { success: true, data };
    if (message) response.message = message;
    res.json(response);
};

// Generate WO number
const generateWONumber = async (pool) => {
    const year = new Date().getFullYear();
    const result = await pool.query(
        "SELECT wo_number FROM work_orders WHERE wo_number LIKE $1 ORDER BY id DESC LIMIT 1",
        [`WO-${year}-%`]
    );
    
    let nextNum = 1;
    if (result.rows.length > 0) {
        const lastNum = parseInt(result.rows[0].wo_number.split('-')[2]);
        nextNum = lastNum + 1;
    }
    
    return `WO-${year}-${String(nextNum).padStart(3, '0')}`;
};

// Calculate urgency color based on due date
const getUrgencyColor = (dueDate) => {
    if (!dueDate) return 'green';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const daysUntilDue = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return 'red';      // Overdue
    if (daysUntilDue <= 3) return 'yellow';  // Due within 3 days
    return 'green';                           // On schedule
};

// Transform functions
const transformWorkOrder = (row) => {
    const dueDate = row.due_date;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = dueDate ? new Date(dueDate) : null;
    if (due) due.setHours(0, 0, 0, 0);
    
    return {
        id: row.id,
        woNumber: row.wo_number,
        quoteId: row.quote_id,
        quoteItemId: row.quote_item_id,
        customerId: row.customer_id,
        partNumber: row.part_number,
        revision: row.revision,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        material: row.material,
        orderDate: row.order_date,
        dueDate: row.due_date,
        shipDate: row.ship_date,
        completedDate: row.completed_date,
        status: row.status,
        priority: row.priority,
        completionPercentage: row.completion_percentage || 0,
        currentStep: row.current_step,
        quotedPrice: parseFloat(row.quoted_price || 0),
        actualCost: parseFloat(row.actual_cost || 0),
        customerPo: row.customer_po,
        notes: row.notes,
        internalNotes: row.internal_notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Computed fields
        daysUntilDue: due ? Math.ceil((due - today) / (1000 * 60 * 60 * 24)) : null,
        urgencyColor: getUrgencyColor(dueDate),
        // Joined fields
        customerName: row.customer_name
    };
};

const transformChecklistItem = (row) => ({
    id: row.id,
    workOrderId: row.work_order_id,
    stepOrder: row.step_order,
    stepName: row.step_name,
    stepKey: row.step_key,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    completedByName: row.completed_by_name,
    stepData: row.step_data || {},
    dateValue: row.date_value,
    referenceNumber: row.reference_number,
    vendorSupplier: row.vendor_supplier,
    operatorName: row.operator_name,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

module.exports = (pool) => {
    const { requireAuth } = require('../middleware/auth')(pool);
    router.use(requireAuth);

    // ==================== WORK ORDERS ====================
    
    // GET all work orders with filters
    router.get('/', async (req, res) => {
        try {
            const { 
                search, customerId, status, dueDateFrom, dueDateTo, isOverdue,
                page = 1, limit = 50, sortField = 'due_date', sortOrder = 'asc'
            } = req.query;
            
            let query = `
                SELECT wo.*, c.name as customer_name
                FROM work_orders wo
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE wo.deleted_at IS NULL
            `;
            
            const params = [];
            let paramIndex = 1;
            
            if (search) {
                query += ` AND (wo.wo_number ILIKE $${paramIndex} OR wo.part_number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR wo.customer_po ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            
            if (customerId) {
                query += ` AND wo.customer_id = $${paramIndex}`;
                params.push(parseInt(customerId));
                paramIndex++;
            }
            
            if (status) {
                const statuses = Array.isArray(status) ? status : [status];
                query += ` AND wo.status = ANY($${paramIndex}::text[])`;
                params.push(statuses);
                paramIndex++;
            }
            
            if (dueDateFrom) {
                query += ` AND wo.due_date >= $${paramIndex}`;
                params.push(dueDateFrom);
                paramIndex++;
            }
            
            if (dueDateTo) {
                query += ` AND wo.due_date <= $${paramIndex}`;
                params.push(dueDateTo);
                paramIndex++;
            }
            
            if (isOverdue === 'true') {
                query += ` AND wo.due_date < CURRENT_DATE AND wo.status NOT IN ('Complete', 'Shipped', 'Cancelled')`;
            }
            
            // Count
            const countQuery = query.replace(/SELECT wo\.\*.*?FROM work_orders wo/, 'SELECT COUNT(*) FROM work_orders wo');
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            
            // Sort
            const sortFieldMap = {
                'woNumber': 'wo.wo_number',
                'customer': 'c.name',
                'partNumber': 'wo.part_number',
                'dueDate': 'wo.due_date',
                'due_date': 'wo.due_date',
                'status': 'wo.status',
                'completionPercentage': 'wo.completion_percentage'
            };
            const dbSortField = sortFieldMap[sortField] || 'wo.due_date';
            const dbSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';
            query += ` ORDER BY ${dbSortField} ${dbSortOrder} NULLS LAST`;
            
            // Pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            
            const result = await pool.query(query, params);
            
            res.json({
                success: true,
                data: result.rows.map(transformWorkOrder),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (err) {
            console.error('Error fetching work orders:', err);
            sendError(res, 500, 'Failed to fetch work orders');
        }
    });
    
    // GET work in progress (active work orders)
    router.get('/wip', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT wo.*, c.name as customer_name,
                    (SELECT COUNT(*) FROM wo_checklist WHERE work_order_id = wo.id AND is_completed = TRUE) as completed_steps,
                    (SELECT COUNT(*) FROM wo_checklist WHERE work_order_id = wo.id) as total_steps
                FROM work_orders wo
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE wo.status IN ('Open', 'In Progress', 'On Hold') AND wo.deleted_at IS NULL
                ORDER BY 
                    CASE 
                        WHEN wo.due_date < CURRENT_DATE THEN 0
                        WHEN wo.due_date <= CURRENT_DATE + INTERVAL '3 days' THEN 1
                        ELSE 2
                    END,
                    wo.due_date ASC NULLS LAST
            `);
            
            const workOrders = result.rows.map(row => ({
                ...transformWorkOrder(row),
                completedSteps: parseInt(row.completed_steps),
                totalSteps: parseInt(row.total_steps)
            }));
            
            sendSuccess(res, workOrders);
        } catch (err) {
            console.error('Error fetching WIP:', err);
            sendError(res, 500, 'Failed to fetch work in progress');
        }
    });
    
    // GET single work order with details
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const woResult = await pool.query(`
                SELECT wo.*, c.name as customer_name
                FROM work_orders wo
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE wo.id = $1 AND wo.deleted_at IS NULL
            `, [id]);
            
            if (woResult.rows.length === 0) {
                return sendError(res, 404, 'Work order not found');
            }
            
            const workOrder = transformWorkOrder(woResult.rows[0]);
            
            // Get checklist
            const checklistResult = await pool.query(
                'SELECT * FROM wo_checklist WHERE work_order_id = $1 ORDER BY step_order ASC',
                [id]
            );
            workOrder.checklist = checklistResult.rows.map(transformChecklistItem);
            
            // Get quote if linked
            if (workOrder.quoteId) {
                const quoteResult = await pool.query(
                    'SELECT quote_number, status as quote_status FROM quotes WHERE id = $1',
                    [workOrder.quoteId]
                );
                if (quoteResult.rows.length > 0) {
                    workOrder.quoteNumber = quoteResult.rows[0].quote_number;
                    workOrder.quoteStatus = quoteResult.rows[0].quote_status;
                }
            }
            
            sendSuccess(res, workOrder);
        } catch (err) {
            console.error('Error fetching work order:', err);
            sendError(res, 500, 'Failed to fetch work order');
        }
    });
    
    // POST create new work order
    router.post('/', validateBody(schemas.workOrder), async (req, res) => {
        try {
            const woNumber = await generateWONumber(pool);
            
            const {
                customerId, quoteId, quoteItemId, partNumber, revision, description,
                quantity, unit, material, dueDate, priority, customerPo, quotedPrice,
                notes, internalNotes
            } = req.validatedBody;
            
            const result = await pool.query(`
                INSERT INTO work_orders (wo_number, customer_id, quote_id, quote_item_id, part_number,
                    revision, description, quantity, unit, material, due_date, priority, customer_po,
                    quoted_price, notes, internal_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `, [
                woNumber, customerId, quoteId, quoteItemId, partNumber, revision, description,
                quantity, unit || 'EA', material, dueDate, priority || 'Normal', customerPo,
                quotedPrice, notes, internalNotes
            ]);
            
            // Note: The trigger will auto-create the checklist items
            
            // Get the full work order with checklist
            const fullResult = await pool.query(`
                SELECT wo.*, c.name as customer_name
                FROM work_orders wo
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE wo.id = $1
            `, [result.rows[0].id]);
            
            const workOrder = transformWorkOrder(fullResult.rows[0]);
            
            const checklistResult = await pool.query(
                'SELECT * FROM wo_checklist WHERE work_order_id = $1 ORDER BY step_order ASC',
                [workOrder.id]
            );
            workOrder.checklist = checklistResult.rows.map(transformChecklistItem);
            
            sendSuccess(res, workOrder, 'Work order created successfully');
        } catch (err) {
            console.error('Error creating work order:', err);
            sendError(res, 500, 'Failed to create work order');
        }
    });
    
    // PUT update work order
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const existing = await pool.query('SELECT * FROM work_orders WHERE id = $1 AND deleted_at IS NULL', [id]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Work order not found');
            }
            
            const current = existing.rows[0];
            const {
                customerId = current.customer_id,
                partNumber = current.part_number,
                revision = current.revision,
                description = current.description,
                quantity = current.quantity,
                unit = current.unit,
                material = current.material,
                dueDate = current.due_date,
                status = current.status,
                priority = current.priority,
                customerPo = current.customer_po,
                quotedPrice = current.quoted_price,
                actualCost = current.actual_cost,
                notes = current.notes,
                internalNotes = current.internal_notes
            } = req.body;
            
            // Handle status changes
            let completedDate = current.completed_date;
            let shipDate = current.ship_date;
            
            if (status === 'Complete' && current.status !== 'Complete') {
                completedDate = new Date();
            }
            if (status === 'Shipped' && current.status !== 'Shipped') {
                shipDate = new Date();
                if (!completedDate) completedDate = new Date();
            }
            
            const result = await pool.query(`
                UPDATE work_orders SET 
                    customer_id = $1, part_number = $2, revision = $3, description = $4,
                    quantity = $5, unit = $6, material = $7, due_date = $8, status = $9,
                    priority = $10, customer_po = $11, quoted_price = $12, actual_cost = $13,
                    completed_date = $14, ship_date = $15, notes = $16, internal_notes = $17,
                    updated_at = NOW()
                WHERE id = $18
                RETURNING *
            `, [
                customerId, partNumber, revision, description, quantity, unit, material,
                dueDate, status, priority, customerPo, quotedPrice, actualCost,
                completedDate, shipDate, notes, internalNotes, id
            ]);
            
            sendSuccess(res, transformWorkOrder(result.rows[0]), 'Work order updated successfully');
        } catch (err) {
            console.error('Error updating work order:', err);
            sendError(res, 500, 'Failed to update work order');
        }
    });
    
    // DELETE work order (soft delete)
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query(
                'UPDATE work_orders SET deleted_at = NOW(), status = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id',
                ['Cancelled', id]
            );
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Work order not found');
            }
            
            sendSuccess(res, { id: parseInt(id) }, 'Work order deleted successfully');
        } catch (err) {
            console.error('Error deleting work order:', err);
            sendError(res, 500, 'Failed to delete work order');
        }
    });
    
    // ==================== CHECKLIST ====================
    
    // GET checklist for a work order
    router.get('/:id/checklist', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query(
                'SELECT * FROM wo_checklist WHERE work_order_id = $1 ORDER BY step_order ASC',
                [id]
            );
            
            sendSuccess(res, result.rows.map(transformChecklistItem));
        } catch (err) {
            console.error('Error fetching checklist:', err);
            sendError(res, 500, 'Failed to fetch checklist');
        }
    });
    
    // PUT update checklist item (complete/uncomplete with details)
    router.put('/:woId/checklist/:itemId', async (req, res) => {
        try {
            const { woId, itemId } = req.params;
            const { isCompleted, dateValue, referenceNumber, vendorSupplier, operatorName, notes, stepData, userName } = req.body;
            
            // Get existing item
            const existing = await pool.query(
                'SELECT * FROM wo_checklist WHERE id = $1 AND work_order_id = $2',
                [itemId, woId]
            );
            
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Checklist item not found');
            }
            
            const current = existing.rows[0];
            
            // Check if trying to uncheck a completed item
            if (current.is_completed && isCompleted === false) {
                // In a real app, you'd check for supervisor permission here
                // For now, we'll allow it but log it
                console.log(`Checklist item ${itemId} being unchecked - would require supervisor permission`);
            }
            
            // Merge step data
            const newStepData = {
                ...(current.step_data || {}),
                ...(stepData || {})
            };
            
            // Update item
            const result = await pool.query(`
                UPDATE wo_checklist SET 
                    is_completed = COALESCE($1, is_completed),
                    completed_at = CASE WHEN $1 = TRUE AND is_completed = FALSE THEN NOW() ELSE completed_at END,
                    completed_by_name = CASE WHEN $1 = TRUE THEN $2 ELSE completed_by_name END,
                    date_value = COALESCE($3, date_value),
                    reference_number = COALESCE($4, reference_number),
                    vendor_supplier = COALESCE($5, vendor_supplier),
                    operator_name = COALESCE($6, operator_name),
                    notes = COALESCE($7, notes),
                    step_data = $8,
                    updated_at = NOW()
                WHERE id = $9
                RETURNING *
            `, [
                isCompleted, userName || 'System', dateValue, referenceNumber, 
                vendorSupplier, operatorName, notes, newStepData, itemId
            ]);
            
            // Log to audit trail
            await pool.query(`
                INSERT INTO wo_checklist_audit (checklist_id, work_order_id, action, old_value, new_value, changed_by_name)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                itemId, woId,
                isCompleted ? 'completed' : 'updated',
                JSON.stringify({ isCompleted: current.is_completed }),
                JSON.stringify({ isCompleted: result.rows[0].is_completed }),
                userName || 'System'
            ]);
            
            // Update work order completion percentage and status
            const completionResult = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE is_completed = TRUE) as completed,
                    COUNT(*) as total
                FROM wo_checklist WHERE work_order_id = $1
            `, [woId]);
            
            const { completed, total } = completionResult.rows[0];
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            // Determine current step
            const currentStepResult = await pool.query(`
                SELECT step_name FROM wo_checklist 
                WHERE work_order_id = $1 AND is_completed = FALSE 
                ORDER BY step_order ASC LIMIT 1
            `, [woId]);
            const currentStep = currentStepResult.rows.length > 0 ? currentStepResult.rows[0].step_name : 'Complete';
            
            // Update work order
            let newStatus = 'In Progress';
            if (percentage === 0) newStatus = 'Open';
            if (percentage === 100) newStatus = 'Complete';
            
            await pool.query(`
                UPDATE work_orders SET 
                    completion_percentage = $1, 
                    current_step = $2,
                    status = CASE 
                        WHEN status IN ('On Hold', 'Cancelled', 'Shipped') THEN status
                        ELSE $3
                    END,
                    completed_date = CASE WHEN $1 = 100 THEN NOW() ELSE completed_date END,
                    updated_at = NOW()
                WHERE id = $4
            `, [percentage, currentStep, newStatus, woId]);
            
            const updatedItem = transformChecklistItem(result.rows[0]);
            updatedItem.workOrderCompletionPercentage = percentage;
            updatedItem.workOrderStatus = newStatus;
            
            sendSuccess(res, updatedItem, 'Checklist item updated successfully');
        } catch (err) {
            console.error('Error updating checklist item:', err);
            sendError(res, 500, 'Failed to update checklist item');
        }
    });
    
    // POST add note to checklist item
    router.post('/:woId/checklist/:itemId/notes', async (req, res) => {
        try {
            const { woId, itemId } = req.params;
            const { note, userName } = req.body;
            
            const existing = await pool.query(
                'SELECT notes FROM wo_checklist WHERE id = $1 AND work_order_id = $2',
                [itemId, woId]
            );
            
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Checklist item not found');
            }
            
            const currentNotes = existing.rows[0].notes || '';
            const timestamp = new Date().toISOString();
            const newNote = currentNotes 
                ? `${currentNotes}\n\n[${timestamp}] ${userName || 'User'}: ${note}`
                : `[${timestamp}] ${userName || 'User'}: ${note}`;
            
            const result = await pool.query(
                'UPDATE wo_checklist SET notes = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                [newNote, itemId]
            );
            
            // Log to audit
            await pool.query(`
                INSERT INTO wo_checklist_audit (checklist_id, work_order_id, action, new_value, changed_by_name, notes)
                VALUES ($1, $2, 'note_added', $3, $4, $5)
            `, [itemId, woId, JSON.stringify({ note }), userName || 'User', note]);
            
            sendSuccess(res, transformChecklistItem(result.rows[0]), 'Note added successfully');
        } catch (err) {
            console.error('Error adding note:', err);
            sendError(res, 500, 'Failed to add note');
        }
    });
    
    // GET checklist audit log
    router.get('/:woId/checklist/audit', async (req, res) => {
        try {
            const { woId } = req.params;
            
            const result = await pool.query(`
                SELECT a.*, c.step_name
                FROM wo_checklist_audit a
                LEFT JOIN wo_checklist c ON a.checklist_id = c.id
                WHERE a.work_order_id = $1
                ORDER BY a.changed_at DESC
            `, [woId]);
            
            const auditLog = result.rows.map(row => ({
                id: row.id,
                checklistId: row.checklist_id,
                workOrderId: row.work_order_id,
                stepName: row.step_name,
                action: row.action,
                oldValue: row.old_value,
                newValue: row.new_value,
                changedBy: row.changed_by,
                changedByName: row.changed_by_name,
                changedAt: row.changed_at,
                notes: row.notes
            }));
            
            sendSuccess(res, auditLog);
        } catch (err) {
            console.error('Error fetching audit log:', err);
            sendError(res, 500, 'Failed to fetch audit log');
        }
    });
    
    // ==================== STATS & REPORTS ====================
    
    // GET work order statistics
    router.get('/stats/summary', async (req, res) => {
        try {
            const stats = await pool.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status IN ('Open', 'In Progress', 'On Hold')) as active_count,
                    COUNT(*) FILTER (WHERE status IN ('Open', 'In Progress') AND due_date < CURRENT_DATE) as overdue_count,
                    COUNT(*) FILTER (WHERE status = 'Complete' AND DATE_TRUNC('month', completed_date) = DATE_TRUNC('month', CURRENT_DATE)) as completed_this_month,
                    COUNT(*) FILTER (WHERE due_date <= CURRENT_DATE + INTERVAL '3 days' AND due_date >= CURRENT_DATE AND status NOT IN ('Complete', 'Shipped', 'Cancelled')) as due_soon
                FROM work_orders
                WHERE deleted_at IS NULL
            `);
            
            sendSuccess(res, {
                activeWorkOrders: parseInt(stats.rows[0].active_count),
                overdueWorkOrders: parseInt(stats.rows[0].overdue_count),
                completedThisMonth: parseInt(stats.rows[0].completed_this_month),
                dueSoon: parseInt(stats.rows[0].due_soon)
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
            sendError(res, 500, 'Failed to fetch statistics');
        }
    });
    
    return router;
};
