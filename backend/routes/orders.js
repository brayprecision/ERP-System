// Purchase Orders, Receiving, Shipping, Inspection API Routes for BPERP
// Uses PostgreSQL database for persistence

const express = require('express');

module.exports = function(pool) {
    const router = express.Router();
    const { requireAuth } = require('../middleware/auth')(pool);
    router.use(requireAuth);

    // ==================== PURCHASE ORDERS ====================

    // Helper: Transform PO from DB to API format
    function transformPO(row) {
        return {
            id: row.id,
            poNumber: row.po_number,
            supplierId: row.supplier_id,
            supplierName: row.supplier_name,
            status: row.status,
            createdDate: row.created_date,
            orderDate: row.order_date,
            expectedDelivery: row.expected_delivery,
            receivedDate: row.received_date,
            subtotal: parseFloat(row.subtotal) || 0,
            tax: parseFloat(row.tax) || 0,
            shipping: parseFloat(row.shipping) || 0,
            total: parseFloat(row.total) || 0,
            workOrderId: row.work_order_id,
            trackingNumber: row.tracking_number,
            carrier: row.carrier,
            notes: row.notes,
            internalNotes: row.internal_notes,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // Helper: Transform PO item
    function transformPOItem(row) {
        return {
            id: row.id,
            poId: row.po_id,
            lineNumber: row.line_number,
            itemType: row.item_type,
            itemName: row.item_name,
            partNumber: row.part_number,
            description: row.description,
            quantityOrdered: row.quantity_ordered,
            quantityReceived: row.quantity_received || 0,
            unit: row.unit,
            unitPrice: parseFloat(row.unit_price) || 0,
            extendedPrice: parseFloat(row.extended_price) || 0,
            receivedDate: row.received_date,
            lotNumber: row.lot_number,
            location: row.location,
            inspectionRequired: row.inspection_required,
            inspectionStatus: row.inspection_status,
            notes: row.notes
        };
    }

    // GET /api/orders/purchase-orders - List purchase orders
    router.get('/purchase-orders', async (req, res) => {
        try {
            let query = 'SELECT * FROM purchase_orders WHERE 1=1';
            const params = [];
            let paramIndex = 1;

            if (req.query.status) {
                query += ` AND status = $${paramIndex++}`;
                params.push(req.query.status);
            }

            if (req.query.supplier) {
                query += ` AND LOWER(supplier_name) LIKE LOWER($${paramIndex++})`;
                params.push(`%${req.query.supplier}%`);
            }

            if (req.query.search) {
                query += ` AND (LOWER(po_number) LIKE LOWER($${paramIndex}) OR LOWER(supplier_name) LIKE LOWER($${paramIndex}))`;
                params.push(`%${req.query.search}%`);
                paramIndex++;
            }

            query += ' ORDER BY created_date DESC';

            const poResult = await pool.query(query, params);

            // Get items and issues for each PO
            const purchaseOrders = await Promise.all(poResult.rows.map(async (po) => {
                const itemsResult = await pool.query('SELECT * FROM po_items WHERE po_id = $1 ORDER BY line_number', [po.id]);
                const issuesResult = await pool.query('SELECT * FROM order_issues WHERE po_id = $1', [po.id]);

                return {
                    ...transformPO(po),
                    items: itemsResult.rows.map(transformPOItem),
                    issues: issuesResult.rows
                };
            }));

            res.json({ success: true, data: purchaseOrders });
        } catch (error) {
            console.error('Get purchase orders error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/orders/purchase-orders/:id - Get single PO
    router.get('/purchase-orders/:id', async (req, res) => {
        try {
            const poResult = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]);

            if (poResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Purchase order not found' });
            }

            const itemsResult = await pool.query('SELECT * FROM po_items WHERE po_id = $1 ORDER BY line_number', [req.params.id]);
            const issuesResult = await pool.query('SELECT * FROM order_issues WHERE po_id = $1', [req.params.id]);

            res.json({
                success: true,
                data: {
                    ...transformPO(poResult.rows[0]),
                    items: itemsResult.rows.map(transformPOItem),
                    issues: issuesResult.rows
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/orders/purchase-orders - Create PO
    router.post('/purchase-orders', async (req, res) => {
        try {
            const { supplierName, workOrderId, woNumber, expectedDelivery, notes, items } = req.body;

            if (!supplierName || !items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Supplier and at least one item are required'
                });
            }

            // Calculate totals
            let subtotal = 0;
            for (const item of items) {
                subtotal += (item.quantityOrdered || 0) * (item.unitPrice || 0);
            }
            const tax = subtotal * 0.08;
            const total = subtotal + tax;

            // Create PO
            const poResult = await pool.query(`
                INSERT INTO purchase_orders (
                    po_number, supplier_name, status, created_date, expected_delivery,
                    work_order_id, subtotal, tax, shipping, total, notes
                ) VALUES ('', $1, 'Pending', CURRENT_DATE, $2, $3, $4, $5, 0, $6, $7)
                RETURNING *
            `, [supplierName, expectedDelivery, workOrderId, subtotal, tax, total, notes]);

            const po = poResult.rows[0];

            // Create items
            const createdItems = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const extendedPrice = (item.quantityOrdered || 0) * (item.unitPrice || 0);

                const itemResult = await pool.query(`
                    INSERT INTO po_items (
                        po_id, line_number, item_type, item_name, part_number, description,
                        quantity_ordered, quantity_received, unit, unit_price, extended_price
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)
                    RETURNING *
                `, [
                    po.id, i + 1, item.itemType, item.itemName, item.partNumber, item.description,
                    item.quantityOrdered, item.unit || 'EA', item.unitPrice || 0, extendedPrice
                ]);

                createdItems.push(transformPOItem(itemResult.rows[0]));
            }

            res.status(201).json({
                success: true,
                data: {
                    ...transformPO(po),
                    items: createdItems
                }
            });
        } catch (error) {
            console.error('Create PO error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/purchase-orders/:id/mark-ordered - Mark as ordered
    router.put('/purchase-orders/:id/mark-ordered', async (req, res) => {
        try {
            const { poNumber, orderDate } = req.body;

            if (!poNumber) {
                return res.status(400).json({ success: false, error: 'PO Number is required' });
            }

            const result = await pool.query(`
                UPDATE purchase_orders 
                SET po_number = $1, status = 'Ordered', order_date = COALESCE($2, CURRENT_DATE), updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [poNumber, orderDate, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Purchase order not found' });
            }

            res.json({ success: true, data: transformPO(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/purchase-orders/:id/items/:itemId/receive - Receive item
    router.put('/purchase-orders/:id/items/:itemId/receive', async (req, res) => {
        try {
            const { quantityReceived, lotNumber, location } = req.body;

            const itemResult = await pool.query(`
                UPDATE po_items 
                SET quantity_received = quantity_received + $1, 
                    lot_number = COALESCE($2, lot_number),
                    location = COALESCE($3, location),
                    received_date = CURRENT_DATE,
                    updated_at = NOW()
                WHERE id = $4 AND po_id = $5
                RETURNING *
            `, [quantityReceived, lotNumber, location, req.params.itemId, req.params.id]);

            if (itemResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Item not found' });
            }

            // Check if all items received
            const allItemsResult = await pool.query('SELECT * FROM po_items WHERE po_id = $1', [req.params.id]);
            const allReceived = allItemsResult.rows.every(i => i.quantity_received >= i.quantity_ordered);
            const someReceived = allItemsResult.rows.some(i => i.quantity_received > 0);

            let newStatus = 'Ordered';
            if (allReceived) {
                newStatus = 'Received';
            } else if (someReceived) {
                newStatus = 'Partial';
            }

            await pool.query(`
                UPDATE purchase_orders 
                SET status = $1, received_date = CASE WHEN $1 = 'Received' THEN CURRENT_DATE ELSE received_date END, updated_at = NOW()
                WHERE id = $2
            `, [newStatus, req.params.id]);

            res.json({ success: true, data: transformPOItem(itemResult.rows[0]) });
        } catch (error) {
            console.error('Receive item error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/orders/purchase-orders/:id/issues - Report issue
    router.post('/purchase-orders/:id/issues', async (req, res) => {
        try {
            const poCheck = await pool.query('SELECT id FROM purchase_orders WHERE id = $1', [req.params.id]);
            if (poCheck.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Purchase order not found' });
            }

            const { poItemId, issueType, description, severity = 'Medium' } = req.body;

            if (!issueType || !description) {
                return res.status(400).json({
                    success: false,
                    error: 'Issue type and description are required'
                });
            }

            const result = await pool.query(`
                INSERT INTO order_issues (po_id, po_item_id, issue_type, description, severity, status)
                VALUES ($1, $2, $3, $4, $5, 'Open')
                RETURNING *
            `, [req.params.id, poItemId, issueType, description, severity]);

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== INSPECTION TASKS ====================

    // Helper: Transform inspection task
    function transformInspection(row) {
        return {
            id: row.id,
            taskId: row.task_id,
            workOrderId: row.work_order_id,
            partNumber: row.part_number,
            inspectionType: row.inspection_type,
            quantityToInspect: row.quantity_to_inspect,
            quantityInspected: row.quantity_inspected || 0,
            quantityPassed: row.quantity_passed || 0,
            quantityFailed: row.quantity_failed || 0,
            status: row.status,
            drawingNumber: row.drawing_number,
            revision: row.revision,
            specNumbers: row.spec_numbers,
            criticalDimensions: row.critical_dimensions || [],
            inspectionResults: row.inspection_results || {},
            measurementData: row.measurement_data || [],
            inspectorId: row.inspector_id,
            inspectorName: row.inspector_name,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            reportNumber: row.report_number,
            cocNumber: row.coc_number,
            ncrNumber: row.ncr_number,
            notes: row.notes,
            woNumber: row.wo_number,
            customerName: row.customer_name,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // GET /api/orders/inspections - List inspection tasks
    router.get('/inspections', async (req, res) => {
        try {
            let query = `
                SELECT it.*, wo.wo_number, c.name as customer_name
                FROM inspection_tasks it
                LEFT JOIN work_orders wo ON it.work_order_id = wo.id
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;

            if (req.query.inspectionType) {
                query += ` AND it.inspection_type = $${paramIndex++}`;
                params.push(req.query.inspectionType);
            }

            if (req.query.status) {
                query += ` AND it.status = $${paramIndex++}`;
                params.push(req.query.status);
            }

            query += ' ORDER BY it.created_at DESC';

            const result = await pool.query(query, params);
            const inspections = result.rows.map(transformInspection);

            // Group by type
            const grouped = {
                first_article: inspections.filter(i => i.inspectionType === 'first_article'),
                in_process: inspections.filter(i => i.inspectionType === 'in_process'),
                final: inspections.filter(i => i.inspectionType === 'final'),
                receiving: inspections.filter(i => i.inspectionType === 'receiving')
            };

            res.json({ success: true, data: inspections, grouped });
        } catch (error) {
            console.error('Get inspections error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // GET /api/orders/inspections/:id - Get single inspection
    router.get('/inspections/:id', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT it.*, wo.wo_number, c.name as customer_name
                FROM inspection_tasks it
                LEFT JOIN work_orders wo ON it.work_order_id = wo.id
                LEFT JOIN customers c ON wo.customer_id = c.id
                WHERE it.id = $1
            `, [req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Inspection not found' });
            }

            res.json({ success: true, data: transformInspection(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/orders/inspections - Create inspection
    router.post('/inspections', async (req, res) => {
        try {
            const {
                workOrderId, partNumber, inspectionType, quantityToInspect,
                drawingNumber, revision, specNumbers, criticalDimensions, notes
            } = req.body;

            if (!inspectionType || !quantityToInspect) {
                return res.status(400).json({
                    success: false,
                    error: 'Inspection type and quantity are required'
                });
            }

            const result = await pool.query(`
                INSERT INTO inspection_tasks (
                    work_order_id, part_number, inspection_type, quantity_to_inspect,
                    quantity_inspected, quantity_passed, quantity_failed, status,
                    drawing_number, revision, spec_numbers, critical_dimensions, notes
                ) VALUES ($1, $2, $3, $4, 0, 0, 0, 'Pending', $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                workOrderId, partNumber, inspectionType, quantityToInspect,
                drawingNumber, revision, specNumbers, JSON.stringify(criticalDimensions || []), notes
            ]);

            res.status(201).json({ success: true, data: transformInspection(result.rows[0]) });
        } catch (error) {
            console.error('Create inspection error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/inspections/:id/start - Start inspection
    router.put('/inspections/:id/start', async (req, res) => {
        try {
            const { inspectorName } = req.body;

            const result = await pool.query(`
                UPDATE inspection_tasks 
                SET status = 'In Progress', inspector_name = $1, started_at = NOW(), updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [inspectorName, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Inspection not found' });
            }

            res.json({ success: true, data: transformInspection(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/inspections/:id/complete - Complete inspection
    router.put('/inspections/:id/complete', async (req, res) => {
        try {
            const {
                status, quantityInspected, quantityPassed, quantityFailed,
                inspectorName, reportNumber, cocNumber, ncrNumber,
                inspectionResults, measurementData, notes
            } = req.body;

            const finalStatus = status || (quantityFailed > 0 ? 'Fail' : 'Pass');

            const result = await pool.query(`
                UPDATE inspection_tasks 
                SET status = $1, quantity_inspected = $2, quantity_passed = $3, quantity_failed = $4,
                    inspector_name = COALESCE($5, inspector_name), report_number = $6, coc_number = $7, ncr_number = $8,
                    inspection_results = $9, measurement_data = $10, notes = COALESCE($11, notes),
                    completed_at = NOW(), updated_at = NOW()
                WHERE id = $12
                RETURNING *
            `, [
                finalStatus, quantityInspected, quantityPassed, quantityFailed,
                inspectorName, reportNumber, cocNumber, ncrNumber,
                JSON.stringify(inspectionResults || {}), JSON.stringify(measurementData || []), notes, req.params.id
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Inspection not found' });
            }

            res.json({ success: true, data: transformInspection(result.rows[0]) });
        } catch (error) {
            console.error('Complete inspection error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/inspections/:id/hold - Put on hold
    router.put('/inspections/:id/hold', async (req, res) => {
        try {
            const { reason, inspectorName } = req.body;

            const result = await pool.query(`
                UPDATE inspection_tasks 
                SET status = 'Hold', notes = COALESCE(notes, '') || E'\nHold: ' || $1, updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [reason, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Inspection not found' });
            }

            res.json({ success: true, data: transformInspection(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== SHIPPING TASKS ====================

    // Helper: Transform shipping task
    function transformShipping(row) {
        return {
            id: row.id,
            taskId: row.task_id,
            workOrderId: row.work_order_id,
            customerId: row.customer_id,
            customerName: row.customer_name,
            status: row.status,
            items: row.items || [],
            packingRequirements: row.packing_requirements,
            packageCount: row.package_count,
            totalWeight: row.total_weight,
            dimensions: row.dimensions,
            shippingMethod: row.shipping_method,
            carrier: row.carrier,
            serviceLevel: row.service_level,
            trackingNumber: row.tracking_number,
            shippingCost: row.shipping_cost,
            shipDate: row.ship_date,
            deliveryDate: row.delivery_date,
            packingSlipNumber: row.packing_slip_number,
            bolNumber: row.bol_number,
            packedBy: row.packed_by,
            packedAt: row.packed_at,
            shippedBy: row.shipped_by,
            shippedAt: row.shipped_at,
            notes: row.notes,
            specialInstructions: row.special_instructions,
            woNumber: row.wo_number,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // GET /api/orders/shipping - List shipping tasks
    router.get('/shipping', async (req, res) => {
        try {
            let query = `
                SELECT st.*, wo.wo_number
                FROM shipping_tasks st
                LEFT JOIN work_orders wo ON st.work_order_id = wo.id
                WHERE 1=1
            `;
            const params = [];

            if (req.query.status) {
                query += ' AND st.status = $1';
                params.push(req.query.status);
            }

            query += ' ORDER BY st.created_at DESC';

            const result = await pool.query(query, params);

            res.json({ success: true, data: result.rows.map(transformShipping) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/orders/shipping - Create shipping task
    router.post('/shipping', async (req, res) => {
        try {
            const {
                workOrderId, woNumber, customerName, items,
                packingRequirements, shippingMethod, specialInstructions
            } = req.body;

            if (!customerName || !items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Customer and items are required'
                });
            }

            const result = await pool.query(`
                INSERT INTO shipping_tasks (
                    work_order_id, customer_name, status, items,
                    packing_requirements, shipping_method, special_instructions
                ) VALUES ($1, $2, 'Ready', $3, $4, $5, $6)
                RETURNING *
            `, [workOrderId, customerName, JSON.stringify(items), packingRequirements, shippingMethod, specialInstructions]);

            res.status(201).json({ success: true, data: transformShipping(result.rows[0]) });
        } catch (error) {
            console.error('Create shipping error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/shipping/:id/pack - Mark as packed
    router.put('/shipping/:id/pack', async (req, res) => {
        try {
            const { packageCount, totalWeight, dimensions, packedByName } = req.body;

            const result = await pool.query(`
                UPDATE shipping_tasks 
                SET status = 'Packed', package_count = $1, total_weight = $2, 
                    dimensions = $3, packed_at = NOW(), updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `, [packageCount, totalWeight, dimensions, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Shipping task not found' });
            }

            res.json({ success: true, data: transformShipping(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/shipping/:id/label - Add tracking info
    router.put('/shipping/:id/label', async (req, res) => {
        try {
            const { carrier, serviceLevel, trackingNumber, shippingCost } = req.body;

            const result = await pool.query(`
                UPDATE shipping_tasks 
                SET status = 'Labeled', carrier = $1, service_level = $2, 
                    tracking_number = $3, shipping_cost = $4, updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `, [carrier, serviceLevel, trackingNumber, shippingCost, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Shipping task not found' });
            }

            res.json({ success: true, data: transformShipping(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/shipping/:id/ship - Mark as shipped
    router.put('/shipping/:id/ship', async (req, res) => {
        try {
            const { shippedByName, packingSlipNumber, bolNumber } = req.body;

            const result = await pool.query(`
                UPDATE shipping_tasks 
                SET status = 'Shipped', shipped_at = NOW(), ship_date = CURRENT_DATE,
                    packing_slip_number = $1, bol_number = $2, updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [packingSlipNumber, bolNumber, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Shipping task not found' });
            }

            res.json({ success: true, data: transformShipping(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== RECEIVING TASKS ====================

    // Helper: Transform receiving task
    function transformReceiving(row) {
        return {
            id: row.id,
            taskId: row.task_id,
            poId: row.po_id,
            vendorName: row.vendor_name,
            expectedDate: row.expected_date,
            status: row.status,
            receivedDate: row.received_date,
            receivedBy: row.received_by,
            receivedByName: row.received_by_name,
            expectedItems: row.expected_items || [],
            receivedItems: row.received_items || [],
            countVerified: row.count_verified,
            conditionChecked: row.condition_checked,
            paperworkReceived: row.paperwork_received,
            putAwayComplete: row.put_away_complete,
            hasDiscrepancy: row.has_discrepancy,
            discrepancyNotes: row.discrepancy_notes,
            notes: row.notes,
            poNumber: row.po_number,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // GET /api/orders/receiving - List receiving tasks
    router.get('/receiving', async (req, res) => {
        try {
            let query = `
                SELECT rt.*, po.po_number
                FROM receiving_tasks rt
                LEFT JOIN purchase_orders po ON rt.po_id = po.id
                WHERE 1=1
            `;
            const params = [];

            if (req.query.status) {
                query += ' AND rt.status = $1';
                params.push(req.query.status);
            }

            query += ' ORDER BY rt.created_at DESC';

            const result = await pool.query(query, params);

            res.json({ success: true, data: result.rows.map(transformReceiving) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // POST /api/orders/receiving - Create receiving task
    router.post('/receiving', async (req, res) => {
        try {
            const { poId, poNumber, vendorName, expectedDate, expectedItems, notes } = req.body;

            if (!vendorName) {
                return res.status(400).json({ success: false, error: 'Vendor is required' });
            }

            const result = await pool.query(`
                INSERT INTO receiving_tasks (
                    po_id, vendor_name, expected_date, status, expected_items,
                    received_items, count_verified, condition_checked, 
                    paperwork_received, put_away_complete, has_discrepancy, notes
                ) VALUES ($1, $2, $3, 'Expected', $4, '[]', FALSE, FALSE, FALSE, FALSE, FALSE, $5)
                RETURNING *
            `, [poId, vendorName, expectedDate, JSON.stringify(expectedItems || []), notes]);

            res.status(201).json({ success: true, data: transformReceiving(result.rows[0]) });
        } catch (error) {
            console.error('Create receiving error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/receiving/:id/receive - Process receipt
    router.put('/receiving/:id/receive', async (req, res) => {
        try {
            const {
                receivedByName, receivedItems, countVerified, conditionChecked,
                paperworkReceived, hasDiscrepancy, discrepancyNotes, notes
            } = req.body;

            const allReceived = receivedItems && receivedItems.every(
                item => item.quantityReceived >= item.quantityExpected
            );
            const status = hasDiscrepancy ? 'Partial' : (allReceived ? 'Received' : 'Partial');

            const result = await pool.query(`
                UPDATE receiving_tasks 
                SET status = $1, received_by_name = $2, received_date = CURRENT_DATE,
                    received_items = $3, count_verified = $4, condition_checked = $5,
                    paperwork_received = $6, has_discrepancy = $7, discrepancy_notes = $8, notes = $9,
                    updated_at = NOW()
                WHERE id = $10
                RETURNING *
            `, [
                status, receivedByName, JSON.stringify(receivedItems || []),
                countVerified, conditionChecked, paperworkReceived, hasDiscrepancy,
                discrepancyNotes, notes, req.params.id
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Receiving task not found' });
            }

            res.json({ success: true, data: transformReceiving(result.rows[0]) });
        } catch (error) {
            console.error('Receive error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/receiving/:id/complete - Complete receiving
    router.put('/receiving/:id/complete', async (req, res) => {
        try {
            const result = await pool.query(`
                UPDATE receiving_tasks 
                SET status = 'Complete', put_away_complete = TRUE, updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `, [req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Receiving task not found' });
            }

            res.json({ success: true, data: transformReceiving(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // PUT /api/orders/receiving/:id/reject - Reject delivery
    router.put('/receiving/:id/reject', async (req, res) => {
        try {
            const { reason, rejectedByName } = req.body;

            const result = await pool.query(`
                UPDATE receiving_tasks 
                SET status = 'Rejected', notes = COALESCE(notes, '') || E'\nRejected: ' || $1, updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [reason, req.params.id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Receiving task not found' });
            }

            res.json({ success: true, data: transformReceiving(result.rows[0]) });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return router;
};
