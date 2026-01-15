// Quotes API Routes for BPERP Sales Module
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Validation helpers
const validateQuote = (data, isUpdate = false) => {
    const errors = [];
    
    if (!isUpdate && !data.customerId) {
        errors.push({ field: 'customerId', message: 'Please select a customer' });
    }
    
    return { isValid: errors.length === 0, errors };
};

const validateQuoteItem = (data) => {
    const errors = [];
    
    if (!data.partNumber || data.partNumber.trim().length === 0) {
        errors.push({ field: 'partNumber', message: 'Part number is required' });
    }
    
    if (!data.quantity || data.quantity < 1) {
        errors.push({ field: 'quantity', message: 'Quantity must be at least 1' });
    }
    
    if (data.unitPrice === undefined || data.unitPrice < 0) {
        errors.push({ field: 'unitPrice', message: 'Unit price is required' });
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

// Generate quote number
const generateQuoteNumber = async (pool) => {
    const year = new Date().getFullYear();
    const result = await pool.query(
        "SELECT quote_number FROM quotes WHERE quote_number LIKE $1 ORDER BY id DESC LIMIT 1",
        [`Q-${year}-%`]
    );
    
    let nextNum = 1;
    if (result.rows.length > 0) {
        const lastNum = parseInt(result.rows[0].quote_number.split('-')[2]);
        nextNum = lastNum + 1;
    }
    
    return `Q-${year}-${String(nextNum).padStart(3, '0')}`;
};

// Transform functions
const transformQuote = (row) => ({
    id: row.id,
    quoteNumber: row.quote_number,
    customerId: row.customer_id,
    contactId: row.contact_id,
    status: row.status,
    priority: row.priority,
    rfqNumber: row.rfq_number,
    rfqReceivedDate: row.rfq_received_date,
    quoteDueDate: row.quote_due_date,
    sentAt: row.sent_at,
    sentTo: row.sent_to,
    validUntil: row.valid_until,
    wonAt: row.won_at,
    lostAt: row.lost_at,
    lostReason: row.lost_reason,
    subtotal: parseFloat(row.subtotal || 0),
    taxRate: parseFloat(row.tax_rate || 0),
    taxAmount: parseFloat(row.tax_amount || 0),
    shippingCost: parseFloat(row.shipping_cost || 0),
    totalAmount: parseFloat(row.total_amount || 0),
    notes: row.notes,
    internalNotes: row.internal_notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Joined fields
    customerName: row.customer_name,
    contactName: row.contact_name
});

const transformQuoteItem = (row) => ({
    id: row.id,
    quoteId: row.quote_id,
    lineNumber: row.line_number,
    partNumber: row.part_number,
    revision: row.revision,
    description: row.description,
    quantity: row.quantity,
    unit: row.unit,
    material: row.material,
    materialCost: parseFloat(row.material_cost || 0),
    unitPrice: parseFloat(row.unit_price || 0),
    setupCost: parseFloat(row.setup_cost || 0),
    extendedPrice: parseFloat(row.extended_price || 0),
    leadTimeDays: row.lead_time_days,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

const transformDocument = (row) => ({
    id: row.id,
    quoteId: row.quote_id,
    filename: row.filename,
    originalFilename: row.original_filename,
    fileType: row.file_type,
    fileSize: row.file_size,
    url: row.url,
    description: row.description,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at
});

module.exports = (pool) => {
    // ==================== QUOTES ====================
    
    // GET all quotes with filters
    router.get('/', async (req, res) => {
        try {
            const { 
                search, customerId, status, dateFrom, dateTo, 
                isOpen, isSent, page = 1, limit = 50,
                sortField = 'created_at', sortOrder = 'desc'
            } = req.query;
            
            let query = `
                SELECT q.*, c.name as customer_name, ct.name as contact_name
                FROM quotes q
                LEFT JOIN customers c ON q.customer_id = c.id
                LEFT JOIN contacts ct ON q.contact_id = ct.id
                WHERE q.deleted_at IS NULL
            `;
            
            const params = [];
            let paramIndex = 1;
            
            if (search) {
                query += ` AND (q.quote_number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR q.rfq_number ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            
            if (customerId) {
                query += ` AND q.customer_id = $${paramIndex}`;
                params.push(parseInt(customerId));
                paramIndex++;
            }
            
            if (status) {
                const statuses = Array.isArray(status) ? status : [status];
                query += ` AND q.status = ANY($${paramIndex}::text[])`;
                params.push(statuses);
                paramIndex++;
            }
            
            if (isOpen === 'true') {
                query += ` AND q.status IN ('New', 'In Progress')`;
            }
            
            if (isSent === 'true') {
                query += ` AND q.status IN ('Sent', 'Won', 'Lost')`;
            }
            
            if (dateFrom) {
                query += ` AND q.created_at >= $${paramIndex}`;
                params.push(dateFrom);
                paramIndex++;
            }
            
            if (dateTo) {
                query += ` AND q.created_at <= $${paramIndex}`;
                params.push(dateTo);
                paramIndex++;
            }
            
            // Count
            const countQuery = query.replace(/SELECT q\.\*.*?FROM quotes q/, 'SELECT COUNT(*) FROM quotes q');
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            
            // Sort
            const sortFieldMap = {
                'quoteNumber': 'q.quote_number',
                'customer': 'c.name',
                'status': 'q.status',
                'totalAmount': 'q.total_amount',
                'quoteDueDate': 'q.quote_due_date',
                'created_at': 'q.created_at'
            };
            const dbSortField = sortFieldMap[sortField] || 'q.created_at';
            const dbSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';
            query += ` ORDER BY ${dbSortField} ${dbSortOrder}`;
            
            // Pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            
            const result = await pool.query(query, params);
            
            res.json({
                success: true,
                data: result.rows.map(transformQuote),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (err) {
            console.error('Error fetching quotes:', err);
            sendError(res, 500, 'Failed to fetch quotes');
        }
    });
    
    // GET open RFQs (New, In Progress)
    router.get('/rfqs', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT q.*, c.name as customer_name, ct.name as contact_name,
                    (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as item_count,
                    (SELECT COUNT(*) FROM quote_documents WHERE quote_id = q.id) as document_count
                FROM quotes q
                LEFT JOIN customers c ON q.customer_id = c.id
                LEFT JOIN contacts ct ON q.contact_id = ct.id
                WHERE q.status IN ('New', 'In Progress') AND q.deleted_at IS NULL
                ORDER BY q.quote_due_date ASC NULLS LAST, q.created_at DESC
            `);
            
            const quotes = result.rows.map(row => ({
                ...transformQuote(row),
                itemCount: parseInt(row.item_count),
                documentCount: parseInt(row.document_count)
            }));
            
            sendSuccess(res, quotes);
        } catch (err) {
            console.error('Error fetching RFQs:', err);
            sendError(res, 500, 'Failed to fetch RFQs');
        }
    });
    
    // GET sent quotes (Sent, Won, Lost)
    router.get('/sent', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT q.*, c.name as customer_name, ct.name as contact_name,
                    (SELECT COUNT(*) FROM quote_items WHERE quote_id = q.id) as item_count
                FROM quotes q
                LEFT JOIN customers c ON q.customer_id = c.id
                LEFT JOIN contacts ct ON q.contact_id = ct.id
                WHERE q.status IN ('Sent', 'Won', 'Lost', 'Expired') AND q.deleted_at IS NULL
                ORDER BY q.sent_at DESC NULLS LAST, q.created_at DESC
            `);
            
            const quotes = result.rows.map(row => ({
                ...transformQuote(row),
                itemCount: parseInt(row.item_count)
            }));
            
            sendSuccess(res, quotes);
        } catch (err) {
            console.error('Error fetching sent quotes:', err);
            sendError(res, 500, 'Failed to fetch sent quotes');
        }
    });
    
    // GET single quote with details
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const quoteResult = await pool.query(`
                SELECT q.*, c.name as customer_name, ct.name as contact_name
                FROM quotes q
                LEFT JOIN customers c ON q.customer_id = c.id
                LEFT JOIN contacts ct ON q.contact_id = ct.id
                WHERE q.id = $1 AND q.deleted_at IS NULL
            `, [id]);
            
            if (quoteResult.rows.length === 0) {
                return sendError(res, 404, 'Quote not found');
            }
            
            const quote = transformQuote(quoteResult.rows[0]);
            
            // Get items
            const itemsResult = await pool.query(
                'SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY line_number ASC',
                [id]
            );
            quote.items = itemsResult.rows.map(transformQuoteItem);
            
            // Get documents
            const docsResult = await pool.query(
                'SELECT * FROM quote_documents WHERE quote_id = $1 ORDER BY uploaded_at DESC',
                [id]
            );
            quote.documents = docsResult.rows.map(transformDocument);
            
            sendSuccess(res, quote);
        } catch (err) {
            console.error('Error fetching quote:', err);
            sendError(res, 500, 'Failed to fetch quote');
        }
    });
    
    // POST create new quote
    router.post('/', async (req, res) => {
        try {
            const validation = validateQuote(req.body);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            const quoteNumber = await generateQuoteNumber(pool);
            
            const {
                customerId, contactId, priority, rfqNumber, rfqReceivedDate,
                quoteDueDate, validUntil, notes, internalNotes, items
            } = req.body;
            
            // Insert quote
            const quoteResult = await pool.query(`
                INSERT INTO quotes (quote_number, customer_id, contact_id, priority, rfq_number,
                    rfq_received_date, quote_due_date, valid_until, notes, internal_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                quoteNumber, customerId, contactId, priority || 'Normal', rfqNumber,
                rfqReceivedDate || null, quoteDueDate || null, validUntil || null, notes, internalNotes
            ]);
            
            const quote = transformQuote(quoteResult.rows[0]);
            quote.items = [];
            
            // Insert items if provided
            if (items && items.length > 0) {
                let subtotal = 0;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const itemValidation = validateQuoteItem(item);
                    if (itemValidation.isValid) {
                        const extendedPrice = (item.quantity * item.unitPrice) + (item.setupCost || 0);
                        subtotal += extendedPrice;
                        
                        const itemResult = await pool.query(`
                            INSERT INTO quote_items (quote_id, line_number, part_number, revision, description,
                                quantity, unit, material, material_cost, unit_price, setup_cost, extended_price,
                                lead_time_days, notes)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                            RETURNING *
                        `, [
                            quote.id, i + 1, item.partNumber, item.revision, item.description,
                            item.quantity, item.unit || 'EA', item.material, item.materialCost || 0,
                            item.unitPrice, item.setupCost || 0, extendedPrice, item.leadTimeDays, item.notes
                        ]);
                        quote.items.push(transformQuoteItem(itemResult.rows[0]));
                    }
                }
                
                // Update totals
                await pool.query(
                    'UPDATE quotes SET subtotal = $1, total_amount = $1 WHERE id = $2',
                    [subtotal, quote.id]
                );
                quote.subtotal = subtotal;
                quote.totalAmount = subtotal;
            }
            
            sendSuccess(res, quote, 'Quote created successfully');
        } catch (err) {
            console.error('Error creating quote:', err);
            sendError(res, 500, 'Failed to create quote');
        }
    });
    
    // PUT update quote
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const existing = await pool.query('SELECT * FROM quotes WHERE id = $1 AND deleted_at IS NULL', [id]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Quote not found');
            }
            
            const current = existing.rows[0];
            const {
                customerId = current.customer_id,
                contactId = current.contact_id,
                status = current.status,
                priority = current.priority,
                rfqNumber = current.rfq_number,
                rfqReceivedDate = current.rfq_received_date,
                quoteDueDate = current.quote_due_date,
                validUntil = current.valid_until,
                sentTo = current.sent_to,
                lostReason = current.lost_reason,
                notes = current.notes,
                internalNotes = current.internal_notes
            } = req.body;
            
            // Handle status changes
            let sentAt = current.sent_at;
            let wonAt = current.won_at;
            let lostAt = current.lost_at;
            
            if (status === 'Sent' && current.status !== 'Sent') {
                sentAt = new Date();
            }
            if (status === 'Won' && current.status !== 'Won') {
                wonAt = new Date();
            }
            if (status === 'Lost' && current.status !== 'Lost') {
                lostAt = new Date();
            }
            
            const result = await pool.query(`
                UPDATE quotes SET 
                    customer_id = $1, contact_id = $2, status = $3, priority = $4,
                    rfq_number = $5, rfq_received_date = $6, quote_due_date = $7,
                    valid_until = $8, sent_at = $9, sent_to = $10, won_at = $11,
                    lost_at = $12, lost_reason = $13, notes = $14, internal_notes = $15,
                    updated_at = NOW()
                WHERE id = $16
                RETURNING *
            `, [
                customerId, contactId, status, priority, rfqNumber, rfqReceivedDate,
                quoteDueDate, validUntil, sentAt, sentTo, wonAt, lostAt, lostReason,
                notes, internalNotes, id
            ]);
            
            sendSuccess(res, transformQuote(result.rows[0]), 'Quote updated successfully');
        } catch (err) {
            console.error('Error updating quote:', err);
            sendError(res, 500, 'Failed to update quote');
        }
    });
    
    // PUT mark quote as sent
    router.put('/:id/send', async (req, res) => {
        try {
            const { id } = req.params;
            const { sentTo } = req.body;
            
            const result = await pool.query(`
                UPDATE quotes SET status = 'Sent', sent_at = NOW(), sent_to = $1, updated_at = NOW()
                WHERE id = $2 AND deleted_at IS NULL
                RETURNING *
            `, [sentTo, id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Quote not found');
            }
            
            sendSuccess(res, transformQuote(result.rows[0]), 'Quote marked as sent');
        } catch (err) {
            console.error('Error sending quote:', err);
            sendError(res, 500, 'Failed to send quote');
        }
    });
    
    // PUT mark quote as won/lost
    router.put('/:id/status', async (req, res) => {
        try {
            const { id } = req.params;
            const { status, lostReason } = req.body;
            
            if (!['Won', 'Lost'].includes(status)) {
                return sendError(res, 400, 'Status must be Won or Lost');
            }
            
            const updates = status === 'Won' 
                ? { field: 'won_at', value: new Date() }
                : { field: 'lost_at', value: new Date() };
            
            const result = await pool.query(`
                UPDATE quotes SET 
                    status = $1, ${updates.field} = $2, 
                    lost_reason = $3, updated_at = NOW()
                WHERE id = $4 AND deleted_at IS NULL
                RETURNING *
            `, [status, updates.value, lostReason || null, id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Quote not found');
            }
            
            sendSuccess(res, transformQuote(result.rows[0]), `Quote marked as ${status.toLowerCase()}`);
        } catch (err) {
            console.error('Error updating quote status:', err);
            sendError(res, 500, 'Failed to update quote status');
        }
    });
    
    // POST duplicate quote
    router.post('/:id/duplicate', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Get original quote
            const originalResult = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
            if (originalResult.rows.length === 0) {
                return sendError(res, 404, 'Quote not found');
            }
            
            const original = originalResult.rows[0];
            const newQuoteNumber = await generateQuoteNumber(pool);
            
            // Create new quote
            const newQuoteResult = await pool.query(`
                INSERT INTO quotes (quote_number, customer_id, contact_id, priority, rfq_number,
                    quote_due_date, valid_until, notes, internal_notes, subtotal, total_amount)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [
                newQuoteNumber, original.customer_id, original.contact_id, original.priority,
                null, null, null, original.notes, original.internal_notes, 
                original.subtotal, original.total_amount
            ]);
            
            const newQuote = transformQuote(newQuoteResult.rows[0]);
            
            // Copy items
            const itemsResult = await pool.query('SELECT * FROM quote_items WHERE quote_id = $1', [id]);
            for (const item of itemsResult.rows) {
                await pool.query(`
                    INSERT INTO quote_items (quote_id, line_number, part_number, revision, description,
                        quantity, unit, material, material_cost, unit_price, setup_cost, extended_price,
                        lead_time_days, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    newQuote.id, item.line_number, item.part_number, item.revision, item.description,
                    item.quantity, item.unit, item.material, item.material_cost, item.unit_price,
                    item.setup_cost, item.extended_price, item.lead_time_days, item.notes
                ]);
            }
            
            sendSuccess(res, newQuote, 'Quote duplicated successfully');
        } catch (err) {
            console.error('Error duplicating quote:', err);
            sendError(res, 500, 'Failed to duplicate quote');
        }
    });
    
    // POST convert quote to work order
    router.post('/:id/convert-to-wo', async (req, res) => {
        try {
            const { id } = req.params;
            const { customerPo, dueDate } = req.body;
            
            // Get quote with items
            const quoteResult = await pool.query('SELECT * FROM quotes WHERE id = $1', [id]);
            if (quoteResult.rows.length === 0) {
                return sendError(res, 404, 'Quote not found');
            }
            
            const quote = quoteResult.rows[0];
            const itemsResult = await pool.query('SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY line_number', [id]);
            
            if (itemsResult.rows.length === 0) {
                return sendError(res, 400, 'Quote has no items to convert');
            }
            
            // Generate WO number
            const year = new Date().getFullYear();
            const woNumResult = await pool.query(
                "SELECT wo_number FROM work_orders WHERE wo_number LIKE $1 ORDER BY id DESC LIMIT 1",
                [`WO-${year}-%`]
            );
            let nextNum = 1;
            if (woNumResult.rows.length > 0) {
                nextNum = parseInt(woNumResult.rows[0].wo_number.split('-')[2]) + 1;
            }
            const woNumber = `WO-${year}-${String(nextNum).padStart(3, '0')}`;
            
            // Create work order from first item (or could create multiple)
            const firstItem = itemsResult.rows[0];
            const woResult = await pool.query(`
                INSERT INTO work_orders (wo_number, quote_id, quote_item_id, customer_id, part_number,
                    revision, description, quantity, unit, material, due_date, customer_po, quoted_price, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'Open')
                RETURNING *
            `, [
                woNumber, quote.id, firstItem.id, quote.customer_id, firstItem.part_number,
                firstItem.revision, firstItem.description, firstItem.quantity, firstItem.unit,
                firstItem.material, dueDate || null, customerPo, firstItem.extended_price
            ]);
            
            // Mark quote as won
            await pool.query(
                "UPDATE quotes SET status = 'Won', won_at = NOW() WHERE id = $1",
                [id]
            );
            
            sendSuccess(res, {
                workOrderId: woResult.rows[0].id,
                woNumber: woResult.rows[0].wo_number
            }, 'Work order created successfully');
        } catch (err) {
            console.error('Error converting quote to WO:', err);
            sendError(res, 500, 'Failed to convert quote to work order');
        }
    });
    
    // DELETE quote (soft delete)
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query(
                'UPDATE quotes SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
                [id]
            );
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Quote not found');
            }
            
            sendSuccess(res, { id: parseInt(id) }, 'Quote deleted successfully');
        } catch (err) {
            console.error('Error deleting quote:', err);
            sendError(res, 500, 'Failed to delete quote');
        }
    });
    
    // ==================== QUOTE ITEMS ====================
    
    // POST add item to quote
    router.post('/:quoteId/items', async (req, res) => {
        try {
            const { quoteId } = req.params;
            
            const validation = validateQuoteItem(req.body);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            // Get next line number
            const lineResult = await pool.query(
                'SELECT COALESCE(MAX(line_number), 0) + 1 as next_line FROM quote_items WHERE quote_id = $1',
                [quoteId]
            );
            const lineNumber = lineResult.rows[0].next_line;
            
            const { partNumber, revision, description, quantity, unit, material, materialCost, unitPrice, setupCost, leadTimeDays, notes } = req.body;
            const extendedPrice = (quantity * unitPrice) + (setupCost || 0);
            
            const result = await pool.query(`
                INSERT INTO quote_items (quote_id, line_number, part_number, revision, description,
                    quantity, unit, material, material_cost, unit_price, setup_cost, extended_price,
                    lead_time_days, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING *
            `, [
                quoteId, lineNumber, partNumber, revision, description, quantity, unit || 'EA',
                material, materialCost || 0, unitPrice, setupCost || 0, extendedPrice, leadTimeDays, notes
            ]);
            
            // Update quote totals
            await pool.query(`
                UPDATE quotes SET 
                    subtotal = (SELECT COALESCE(SUM(extended_price), 0) FROM quote_items WHERE quote_id = $1),
                    total_amount = (SELECT COALESCE(SUM(extended_price), 0) FROM quote_items WHERE quote_id = $1)
                WHERE id = $1
            `, [quoteId]);
            
            sendSuccess(res, transformQuoteItem(result.rows[0]), 'Item added successfully');
        } catch (err) {
            console.error('Error adding quote item:', err);
            sendError(res, 500, 'Failed to add item');
        }
    });
    
    // PUT update quote item
    router.put('/:quoteId/items/:itemId', async (req, res) => {
        try {
            const { quoteId, itemId } = req.params;
            
            const existing = await pool.query('SELECT * FROM quote_items WHERE id = $1 AND quote_id = $2', [itemId, quoteId]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Item not found');
            }
            
            const current = existing.rows[0];
            const {
                partNumber = current.part_number,
                revision = current.revision,
                description = current.description,
                quantity = current.quantity,
                unit = current.unit,
                material = current.material,
                materialCost = current.material_cost,
                unitPrice = current.unit_price,
                setupCost = current.setup_cost,
                leadTimeDays = current.lead_time_days,
                notes = current.notes
            } = req.body;
            
            const extendedPrice = (quantity * unitPrice) + (parseFloat(setupCost) || 0);
            
            const result = await pool.query(`
                UPDATE quote_items SET 
                    part_number = $1, revision = $2, description = $3, quantity = $4,
                    unit = $5, material = $6, material_cost = $7, unit_price = $8,
                    setup_cost = $9, extended_price = $10, lead_time_days = $11, notes = $12,
                    updated_at = NOW()
                WHERE id = $13
                RETURNING *
            `, [
                partNumber, revision, description, quantity, unit, material, materialCost,
                unitPrice, setupCost, extendedPrice, leadTimeDays, notes, itemId
            ]);
            
            // Update quote totals
            await pool.query(`
                UPDATE quotes SET 
                    subtotal = (SELECT COALESCE(SUM(extended_price), 0) FROM quote_items WHERE quote_id = $1),
                    total_amount = (SELECT COALESCE(SUM(extended_price), 0) FROM quote_items WHERE quote_id = $1)
                WHERE id = $1
            `, [quoteId]);
            
            sendSuccess(res, transformQuoteItem(result.rows[0]), 'Item updated successfully');
        } catch (err) {
            console.error('Error updating quote item:', err);
            sendError(res, 500, 'Failed to update item');
        }
    });
    
    // DELETE quote item
    router.delete('/:quoteId/items/:itemId', async (req, res) => {
        try {
            const { quoteId, itemId } = req.params;
            
            const result = await pool.query(
                'DELETE FROM quote_items WHERE id = $1 AND quote_id = $2 RETURNING id',
                [itemId, quoteId]
            );
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Item not found');
            }
            
            // Update quote totals
            await pool.query(`
                UPDATE quotes SET 
                    subtotal = (SELECT COALESCE(SUM(extended_price), 0) FROM quote_items WHERE quote_id = $1),
                    total_amount = (SELECT COALESCE(SUM(extended_price), 0) FROM quote_items WHERE quote_id = $1)
                WHERE id = $1
            `, [quoteId]);
            
            sendSuccess(res, { id: parseInt(itemId) }, 'Item deleted successfully');
        } catch (err) {
            console.error('Error deleting quote item:', err);
            sendError(res, 500, 'Failed to delete item');
        }
    });
    
    // ==================== QUOTE DOCUMENTS ====================
    
    // GET quote documents
    router.get('/:quoteId/documents', async (req, res) => {
        try {
            const { quoteId } = req.params;
            
            const result = await pool.query(
                'SELECT * FROM quote_documents WHERE quote_id = $1 ORDER BY uploaded_at DESC',
                [quoteId]
            );
            
            sendSuccess(res, result.rows.map(transformDocument));
        } catch (err) {
            console.error('Error fetching documents:', err);
            sendError(res, 500, 'Failed to fetch documents');
        }
    });
    
    // POST add document record (actual file upload would be handled separately)
    router.post('/:quoteId/documents', async (req, res) => {
        try {
            const { quoteId } = req.params;
            const { filename, originalFilename, fileType, fileSize, url, description } = req.body;
            
            const result = await pool.query(`
                INSERT INTO quote_documents (quote_id, filename, original_filename, file_type, file_size, url, description)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [quoteId, filename, originalFilename, fileType, fileSize, url, description]);
            
            sendSuccess(res, transformDocument(result.rows[0]), 'Document added successfully');
        } catch (err) {
            console.error('Error adding document:', err);
            sendError(res, 500, 'Failed to add document');
        }
    });
    
    // DELETE document
    router.delete('/:quoteId/documents/:docId', async (req, res) => {
        try {
            const { quoteId, docId } = req.params;
            
            const result = await pool.query(
                'DELETE FROM quote_documents WHERE id = $1 AND quote_id = $2 RETURNING id',
                [docId, quoteId]
            );
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Document not found');
            }
            
            sendSuccess(res, { id: parseInt(docId) }, 'Document deleted successfully');
        } catch (err) {
            console.error('Error deleting document:', err);
            sendError(res, 500, 'Failed to delete document');
        }
    });
    
    return router;
};
