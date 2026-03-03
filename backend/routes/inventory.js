// Inventory API Routes for BPERP
const express = require('express');
const router = express.Router();
const { validateBody, schemas } = require('../middleware/validation');

// Validation helpers (kept for tool/misc - Zod used for materials)
const validateMaterial = (data) => {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Name is required' });
    } else if (data.name.length > 200) {
        errors.push({ field: 'name', message: 'Name must be less than 200 characters' });
    }
    
    if (!data.materialType || data.materialType.trim().length === 0) {
        errors.push({ field: 'materialType', message: 'Material type is required' });
    }
    
    if (!data.materialShape || data.materialShape.trim().length === 0) {
        errors.push({ field: 'materialShape', message: 'Material shape is required' });
    }
    
    if (data.qtyOnHand === undefined || data.qtyOnHand < 0) {
        errors.push({ field: 'qtyOnHand', message: 'Quantity must be a non-negative number' });
    }
    
    if (!data.lengthUnit || data.lengthUnit.trim().length === 0) {
        errors.push({ field: 'lengthUnit', message: 'Length unit is required' });
    }
    
    if (data.unitPrice === undefined || data.unitPrice < 0) {
        errors.push({ field: 'unitPrice', message: 'Unit price must be a non-negative number' });
    }
    
    if (!data.supplier || data.supplier.trim().length === 0) {
        errors.push({ field: 'supplier', message: 'Supplier is required' });
    }
    
    if (data.minimumQty === undefined || data.minimumQty < 0) {
        errors.push({ field: 'minimumQty', message: 'Minimum quantity must be a non-negative number' });
    }
    
    return { isValid: errors.length === 0, errors };
};

const validateTool = (data) => {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Name is required' });
    }
    
    if (!data.toolType || data.toolType.trim().length === 0) {
        errors.push({ field: 'toolType', message: 'Tool type is required' });
    }
    
    if (!data.operation || data.operation.trim().length === 0) {
        errors.push({ field: 'operation', message: 'Operation is required' });
    }
    
    if (data.qtyOnHand === undefined || data.qtyOnHand < 0) {
        errors.push({ field: 'qtyOnHand', message: 'Quantity must be a non-negative number' });
    }
    
    if (data.minimumQty === undefined || data.minimumQty < 0) {
        errors.push({ field: 'minimumQty', message: 'Minimum quantity must be a non-negative number' });
    }
    
    if (!data.supplier || data.supplier.trim().length === 0) {
        errors.push({ field: 'supplier', message: 'Supplier is required' });
    }
    
    if (data.toolPrice === undefined || data.toolPrice < 0) {
        errors.push({ field: 'toolPrice', message: 'Tool price must be a non-negative number' });
    }
    
    return { isValid: errors.length === 0, errors };
};

const validateMisc = (data) => {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Name is required' });
    }
    
    if (!data.workcenter || data.workcenter.trim().length === 0) {
        errors.push({ field: 'workcenter', message: 'Workcenter is required' });
    }
    
    if (data.qtyOnHand === undefined || data.qtyOnHand < 0) {
        errors.push({ field: 'qtyOnHand', message: 'Quantity must be a non-negative number' });
    }
    
    if (data.minimumQty === undefined || data.minimumQty < 0) {
        errors.push({ field: 'minimumQty', message: 'Minimum quantity must be a non-negative number' });
    }
    
    if (data.itemPrice === undefined || data.itemPrice < 0) {
        errors.push({ field: 'itemPrice', message: 'Item price must be a non-negative number' });
    }
    
    return { isValid: errors.length === 0, errors };
};

const validateProduct = (data) => {
    const errors = [];
    if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Name is required' });
    }
    if (data.qtyOnHand === undefined || data.qtyOnHand < 0) {
        errors.push({ field: 'qtyOnHand', message: 'Quantity must be a non-negative number' });
    }
    if (data.minimumQty === undefined || data.minimumQty < 0) {
        errors.push({ field: 'minimumQty', message: 'Minimum quantity must be a non-negative number' });
    }
    if (data.unitPrice === undefined || data.unitPrice < 0) {
        errors.push({ field: 'unitPrice', message: 'Unit price must be a non-negative number' });
    }
    return { isValid: errors.length === 0, errors };
};

const validatePart = (data) => {
    const errors = [];
    if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Name is required' });
    }
    if (data.qtyOnHand === undefined || data.qtyOnHand < 0) {
        errors.push({ field: 'qtyOnHand', message: 'Quantity must be a non-negative number' });
    }
    if (data.minimumQty === undefined || data.minimumQty < 0) {
        errors.push({ field: 'minimumQty', message: 'Minimum quantity must be a non-negative number' });
    }
    if (data.unitPrice === undefined || data.unitPrice < 0) {
        errors.push({ field: 'unitPrice', message: 'Unit price must be a non-negative number' });
    }
    return { isValid: errors.length === 0, errors };
};

// Helper function to calculate urgency status
const calculateUrgency = (qtyOnHand, minimumQty) => {
    const ratio = minimumQty > 0 ? qtyOnHand / minimumQty : qtyOnHand > 0 ? 999 : 0;
    
    if (ratio <= 0.5) {
        return { score: 3, status: 'critical' };
    } else if (ratio <= 1) {
        return { score: 2, status: 'low' };
    } else if (ratio <= 1.5) {
        return { score: 1, status: 'monitor' };
    }
    return { score: 0, status: 'good' };
};

// Error response helper
const sendError = (res, statusCode, message, errors = null) => {
    const response = {
        success: false,
        error: message,
    };
    if (errors) {
        response.validationErrors = errors;
    }
    res.status(statusCode).json(response);
};

// Success response helper
const sendSuccess = (res, data, message = null) => {
    const response = { success: true, data };
    if (message) {
        response.message = message;
    }
    res.json(response);
};

module.exports = (pool) => {
    const { requireAuth } = require('../middleware/auth')(pool);
    router.use(requireAuth);

    // ==================== MATERIALS ====================
    
    // GET all materials with filtering, sorting, and pagination
    router.get('/materials', async (req, res) => {
        try {
            const { 
                search, 
                supplier, 
                status,
                minQty,
                maxQty,
                page = 1, 
                limit = 50,
                sortField = 'name',
                sortOrder = 'asc'
            } = req.query;
            
            let query = 'SELECT * FROM materials WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            
            // Search filter
            if (search) {
                query += ` AND (name ILIKE $${paramIndex} OR material_type ILIKE $${paramIndex} OR material_shape ILIKE $${paramIndex} OR supplier ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            
            // Supplier filter
            if (supplier) {
                query += ` AND supplier ILIKE $${paramIndex}`;
                params.push(`%${supplier}%`);
                paramIndex++;
            }
            
            // Quantity range filters
            if (minQty !== undefined) {
                query += ` AND qty_on_hand >= $${paramIndex}`;
                params.push(parseInt(minQty));
                paramIndex++;
            }
            
            if (maxQty !== undefined) {
                query += ` AND qty_on_hand <= $${paramIndex}`;
                params.push(parseInt(maxQty));
                paramIndex++;
            }
            
            // Count total for pagination
            const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            
            // Sort mapping
            const sortFieldMap = {
                'name': 'name',
                'qtyOnHand': 'qty_on_hand',
                'minimumQty': 'minimum_qty',
                'price': 'unit_price',
                'supplier': 'supplier',
                'createdAt': 'created_at'
            };
            
            const dbSortField = sortFieldMap[sortField] || 'name';
            const dbSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';
            
            query += ` ORDER BY ${dbSortField} ${dbSortOrder}`;
            
            // Pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            
            const result = await pool.query(query, params);
            
            // Transform to camelCase and add urgency status
            const materials = result.rows.map(row => {
                const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
                return {
                    id: row.id,
                    name: row.name,
                    materialType: row.material_type,
                    materialShape: row.material_shape,
                    qtyOnHand: row.qty_on_hand,
                    lengthUnit: row.length_unit,
                    unitPrice: parseFloat(row.unit_price),
                    supplier: row.supplier,
                    minimumQty: row.minimum_qty,
                    reorderLink: row.reorder_link,
                    urgencyStatus: urgency.status,
                    urgencyScore: urgency.score,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            });
            
            // Filter by status if specified (post-query filter since it's calculated)
            let filteredMaterials = materials;
            if (status) {
                filteredMaterials = materials.filter(m => m.urgencyStatus === status);
            }
            
            res.json({
                success: true,
                data: filteredMaterials,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: status ? filteredMaterials.length : total,
                    totalPages: Math.ceil((status ? filteredMaterials.length : total) / parseInt(limit))
                }
            });
        } catch (err) {
            console.error('Error fetching materials:', err);
            sendError(res, 500, 'Failed to fetch materials');
        }
    });
    
    // GET single material by ID
    router.get('/materials/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM materials WHERE id = $1', [id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Material not found');
            }
            
            const row = result.rows[0];
            const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
            
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                materialType: row.material_type,
                materialShape: row.material_shape,
                qtyOnHand: row.qty_on_hand,
                lengthUnit: row.length_unit,
                unitPrice: parseFloat(row.unit_price),
                supplier: row.supplier,
                minimumQty: row.minimum_qty,
                reorderLink: row.reorder_link,
                urgencyStatus: urgency.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            });
        } catch (err) {
            console.error('Error fetching material:', err);
            sendError(res, 500, 'Failed to fetch material');
        }
    });
    
    // POST create new material
    router.post('/materials', validateBody(schemas.material), async (req, res) => {
        try {
            const { name, materialType, materialShape, qtyOnHand, lengthUnit, unitPrice, supplier, minimumQty, reorderLink } = req.validatedBody;
            
            const result = await pool.query(
                `INSERT INTO materials (name, material_type, material_shape, qty_on_hand, length_unit, unit_price, supplier, minimum_qty, reorder_link, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                 RETURNING *`,
                [name.trim(), materialType.trim(), materialShape.trim(), qtyOnHand, lengthUnit.trim(), unitPrice, supplier.trim(), minimumQty, reorderLink || '']
            );
            
            const row = result.rows[0];
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                materialType: row.material_type,
                materialShape: row.material_shape,
                qtyOnHand: row.qty_on_hand,
                lengthUnit: row.length_unit,
                unitPrice: parseFloat(row.unit_price),
                supplier: row.supplier,
                minimumQty: row.minimum_qty,
                reorderLink: row.reorder_link
            }, 'Material created successfully');
        } catch (err) {
            console.error('Error creating material:', err);
            sendError(res, 500, 'Failed to create material');
        }
    });
    
    // PUT update material
    router.put('/materials/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Check if material exists
            const existing = await pool.query('SELECT * FROM materials WHERE id = $1', [id]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Material not found');
            }
            
            // Merge existing data with updates for validation
            const currentData = existing.rows[0];
            const updateData = {
                name: req.body.name ?? currentData.name,
                materialType: req.body.materialType ?? currentData.material_type,
                materialShape: req.body.materialShape ?? currentData.material_shape,
                qtyOnHand: req.body.qtyOnHand ?? currentData.qty_on_hand,
                lengthUnit: req.body.lengthUnit ?? currentData.length_unit,
                unitPrice: req.body.unitPrice ?? parseFloat(currentData.unit_price),
                supplier: req.body.supplier ?? currentData.supplier,
                minimumQty: req.body.minimumQty ?? currentData.minimum_qty,
                reorderLink: req.body.reorderLink ?? currentData.reorder_link
            };
            
            const validation = validateMaterial(updateData);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            const result = await pool.query(
                `UPDATE materials SET 
                    name = $1, material_type = $2, material_shape = $3, qty_on_hand = $4,
                    length_unit = $5, unit_price = $6, supplier = $7, minimum_qty = $8, 
                    reorder_link = $9, updated_at = NOW()
                 WHERE id = $10
                 RETURNING *`,
                [updateData.name, updateData.materialType, updateData.materialShape, updateData.qtyOnHand,
                 updateData.lengthUnit, updateData.unitPrice, updateData.supplier, updateData.minimumQty,
                 updateData.reorderLink, id]
            );
            
            const row = result.rows[0];
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                materialType: row.material_type,
                materialShape: row.material_shape,
                qtyOnHand: row.qty_on_hand,
                lengthUnit: row.length_unit,
                unitPrice: parseFloat(row.unit_price),
                supplier: row.supplier,
                minimumQty: row.minimum_qty,
                reorderLink: row.reorder_link
            }, 'Material updated successfully');
        } catch (err) {
            console.error('Error updating material:', err);
            sendError(res, 500, 'Failed to update material');
        }
    });
    
    // DELETE material
    router.delete('/materials/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query('DELETE FROM materials WHERE id = $1 RETURNING *', [id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Material not found');
            }
            
            sendSuccess(res, { id }, 'Material deleted successfully');
        } catch (err) {
            console.error('Error deleting material:', err);
            sendError(res, 500, 'Failed to delete material');
        }
    });
    
    // ==================== TOOLING ====================
    
    // GET all tools with filtering, sorting, and pagination
    router.get('/tooling', async (req, res) => {
        try {
            const { 
                search, 
                supplier, 
                operation,
                status,
                page = 1, 
                limit = 50,
                sortField = 'name',
                sortOrder = 'asc'
            } = req.query;
            
            let query = 'SELECT * FROM tooling WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            
            if (search) {
                query += ` AND (name ILIKE $${paramIndex} OR tool_type ILIKE $${paramIndex} OR operation ILIKE $${paramIndex} OR supplier ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            
            if (supplier) {
                query += ` AND supplier ILIKE $${paramIndex}`;
                params.push(`%${supplier}%`);
                paramIndex++;
            }
            
            if (operation) {
                query += ` AND operation ILIKE $${paramIndex}`;
                params.push(`%${operation}%`);
                paramIndex++;
            }
            
            const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            
            const sortFieldMap = {
                'name': 'name',
                'qtyOnHand': 'qty_on_hand',
                'minimumQty': 'minimum_qty',
                'price': 'tool_price',
                'supplier': 'supplier',
                'createdAt': 'created_at'
            };
            
            const dbSortField = sortFieldMap[sortField] || 'name';
            const dbSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';
            
            query += ` ORDER BY ${dbSortField} ${dbSortOrder}`;
            
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            
            const result = await pool.query(query, params);
            
            const tools = result.rows.map(row => {
                const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
                return {
                    id: row.id,
                    name: row.name,
                    toolType: row.tool_type,
                    operation: row.operation,
                    qtyOnHand: row.qty_on_hand,
                    minimumQty: row.minimum_qty,
                    supplier: row.supplier,
                    toolPrice: parseFloat(row.tool_price),
                    reorderLink: row.reorder_link,
                    urgencyStatus: urgency.status,
                    urgencyScore: urgency.score,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            });
            
            let filteredTools = tools;
            if (status) {
                filteredTools = tools.filter(t => t.urgencyStatus === status);
            }
            
            res.json({
                success: true,
                data: filteredTools,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: status ? filteredTools.length : total,
                    totalPages: Math.ceil((status ? filteredTools.length : total) / parseInt(limit))
                }
            });
        } catch (err) {
            console.error('Error fetching tools:', err);
            sendError(res, 500, 'Failed to fetch tools');
        }
    });
    
    // GET single tool by ID
    router.get('/tooling/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM tooling WHERE id = $1', [id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Tool not found');
            }
            
            const row = result.rows[0];
            const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
            
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                toolType: row.tool_type,
                operation: row.operation,
                qtyOnHand: row.qty_on_hand,
                minimumQty: row.minimum_qty,
                supplier: row.supplier,
                toolPrice: parseFloat(row.tool_price),
                reorderLink: row.reorder_link,
                urgencyStatus: urgency.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            });
        } catch (err) {
            console.error('Error fetching tool:', err);
            sendError(res, 500, 'Failed to fetch tool');
        }
    });
    
    // POST create new tool
    router.post('/tooling', async (req, res) => {
        try {
            const validation = validateTool(req.body);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            const { name, toolType, operation, qtyOnHand, minimumQty, supplier, toolPrice, reorderLink } = req.body;
            
            const result = await pool.query(
                `INSERT INTO tooling (name, tool_type, operation, qty_on_hand, minimum_qty, supplier, tool_price, reorder_link, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                 RETURNING *`,
                [name.trim(), toolType.trim(), operation.trim(), qtyOnHand, minimumQty, supplier.trim(), toolPrice, reorderLink || '']
            );
            
            const row = result.rows[0];
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                toolType: row.tool_type,
                operation: row.operation,
                qtyOnHand: row.qty_on_hand,
                minimumQty: row.minimum_qty,
                supplier: row.supplier,
                toolPrice: parseFloat(row.tool_price),
                reorderLink: row.reorder_link
            }, 'Tool created successfully');
        } catch (err) {
            console.error('Error creating tool:', err);
            sendError(res, 500, 'Failed to create tool');
        }
    });
    
    // PUT update tool
    router.put('/tooling/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const existing = await pool.query('SELECT * FROM tooling WHERE id = $1', [id]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Tool not found');
            }
            
            const currentData = existing.rows[0];
            const updateData = {
                name: req.body.name ?? currentData.name,
                toolType: req.body.toolType ?? currentData.tool_type,
                operation: req.body.operation ?? currentData.operation,
                qtyOnHand: req.body.qtyOnHand ?? currentData.qty_on_hand,
                minimumQty: req.body.minimumQty ?? currentData.minimum_qty,
                supplier: req.body.supplier ?? currentData.supplier,
                toolPrice: req.body.toolPrice ?? parseFloat(currentData.tool_price),
                reorderLink: req.body.reorderLink ?? currentData.reorder_link
            };
            
            const validation = validateTool(updateData);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            const result = await pool.query(
                `UPDATE tooling SET 
                    name = $1, tool_type = $2, operation = $3, qty_on_hand = $4,
                    minimum_qty = $5, supplier = $6, tool_price = $7, reorder_link = $8, updated_at = NOW()
                 WHERE id = $9
                 RETURNING *`,
                [updateData.name, updateData.toolType, updateData.operation, updateData.qtyOnHand,
                 updateData.minimumQty, updateData.supplier, updateData.toolPrice, updateData.reorderLink, id]
            );
            
            const row = result.rows[0];
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                toolType: row.tool_type,
                operation: row.operation,
                qtyOnHand: row.qty_on_hand,
                minimumQty: row.minimum_qty,
                supplier: row.supplier,
                toolPrice: parseFloat(row.tool_price),
                reorderLink: row.reorder_link
            }, 'Tool updated successfully');
        } catch (err) {
            console.error('Error updating tool:', err);
            sendError(res, 500, 'Failed to update tool');
        }
    });
    
    // DELETE tool
    router.delete('/tooling/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query('DELETE FROM tooling WHERE id = $1 RETURNING *', [id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Tool not found');
            }
            
            sendSuccess(res, { id }, 'Tool deleted successfully');
        } catch (err) {
            console.error('Error deleting tool:', err);
            sendError(res, 500, 'Failed to delete tool');
        }
    });
    
    // ==================== MISC ITEMS ====================
    
    // GET all misc items with filtering, sorting, and pagination
    router.get('/misc', async (req, res) => {
        try {
            const { 
                search, 
                workcenter,
                status,
                page = 1, 
                limit = 50,
                sortField = 'name',
                sortOrder = 'asc'
            } = req.query;
            
            let query = 'SELECT * FROM misc_items WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            
            if (search) {
                query += ` AND (name ILIKE $${paramIndex} OR workcenter ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            
            if (workcenter) {
                query += ` AND workcenter ILIKE $${paramIndex}`;
                params.push(`%${workcenter}%`);
                paramIndex++;
            }
            
            const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            
            const sortFieldMap = {
                'name': 'name',
                'qtyOnHand': 'qty_on_hand',
                'minimumQty': 'minimum_qty',
                'price': 'item_price',
                'createdAt': 'created_at'
            };
            
            const dbSortField = sortFieldMap[sortField] || 'name';
            const dbSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';
            
            query += ` ORDER BY ${dbSortField} ${dbSortOrder}`;
            
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            
            const result = await pool.query(query, params);
            
            const miscItems = result.rows.map(row => {
                const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
                return {
                    id: row.id,
                    name: row.name,
                    workcenter: row.workcenter,
                    qtyOnHand: row.qty_on_hand,
                    minimumQty: row.minimum_qty,
                    reorderLink: row.reorder_link,
                    itemPrice: parseFloat(row.item_price),
                    urgencyStatus: urgency.status,
                    urgencyScore: urgency.score,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            });
            
            let filteredMisc = miscItems;
            if (status) {
                filteredMisc = miscItems.filter(m => m.urgencyStatus === status);
            }
            
            res.json({
                success: true,
                data: filteredMisc,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: status ? filteredMisc.length : total,
                    totalPages: Math.ceil((status ? filteredMisc.length : total) / parseInt(limit))
                }
            });
        } catch (err) {
            console.error('Error fetching misc items:', err);
            sendError(res, 500, 'Failed to fetch misc items');
        }
    });
    
    // GET single misc item by ID
    router.get('/misc/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM misc_items WHERE id = $1', [id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Misc item not found');
            }
            
            const row = result.rows[0];
            const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
            
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                workcenter: row.workcenter,
                qtyOnHand: row.qty_on_hand,
                minimumQty: row.minimum_qty,
                reorderLink: row.reorder_link,
                itemPrice: parseFloat(row.item_price),
                urgencyStatus: urgency.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            });
        } catch (err) {
            console.error('Error fetching misc item:', err);
            sendError(res, 500, 'Failed to fetch misc item');
        }
    });
    
    // POST create new misc item
    router.post('/misc', async (req, res) => {
        try {
            const validation = validateMisc(req.body);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            const { name, workcenter, qtyOnHand, minimumQty, reorderLink, itemPrice } = req.body;
            
            const result = await pool.query(
                `INSERT INTO misc_items (name, workcenter, qty_on_hand, minimum_qty, reorder_link, item_price, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                 RETURNING *`,
                [name.trim(), workcenter.trim(), qtyOnHand, minimumQty, reorderLink || '', itemPrice]
            );
            
            const row = result.rows[0];
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                workcenter: row.workcenter,
                qtyOnHand: row.qty_on_hand,
                minimumQty: row.minimum_qty,
                reorderLink: row.reorder_link,
                itemPrice: parseFloat(row.item_price)
            }, 'Misc item created successfully');
        } catch (err) {
            console.error('Error creating misc item:', err);
            sendError(res, 500, 'Failed to create misc item');
        }
    });
    
    // PUT update misc item
    router.put('/misc/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const existing = await pool.query('SELECT * FROM misc_items WHERE id = $1', [id]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Misc item not found');
            }
            
            const currentData = existing.rows[0];
            const updateData = {
                name: req.body.name ?? currentData.name,
                workcenter: req.body.workcenter ?? currentData.workcenter,
                qtyOnHand: req.body.qtyOnHand ?? currentData.qty_on_hand,
                minimumQty: req.body.minimumQty ?? currentData.minimum_qty,
                reorderLink: req.body.reorderLink ?? currentData.reorder_link,
                itemPrice: req.body.itemPrice ?? parseFloat(currentData.item_price)
            };
            
            const validation = validateMisc(updateData);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            const result = await pool.query(
                `UPDATE misc_items SET 
                    name = $1, workcenter = $2, qty_on_hand = $3, minimum_qty = $4,
                    reorder_link = $5, item_price = $6, updated_at = NOW()
                 WHERE id = $7
                 RETURNING *`,
                [updateData.name, updateData.workcenter, updateData.qtyOnHand, updateData.minimumQty,
                 updateData.reorderLink, updateData.itemPrice, id]
            );
            
            const row = result.rows[0];
            sendSuccess(res, {
                id: row.id,
                name: row.name,
                workcenter: row.workcenter,
                qtyOnHand: row.qty_on_hand,
                minimumQty: row.minimum_qty,
                reorderLink: row.reorder_link,
                itemPrice: parseFloat(row.item_price)
            }, 'Misc item updated successfully');
        } catch (err) {
            console.error('Error updating misc item:', err);
            sendError(res, 500, 'Failed to update misc item');
        }
    });
    
    // DELETE misc item
    router.delete('/misc/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query('DELETE FROM misc_items WHERE id = $1 RETURNING *', [id]);
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Misc item not found');
            }
            
            sendSuccess(res, { id }, 'Misc item deleted successfully');
        } catch (err) {
            console.error('Error deleting misc item:', err);
            sendError(res, 500, 'Failed to delete misc item');
        }
    });
    
    // ==================== PRODUCTS ====================
    
    const mapProductRow = (row) => {
        const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
        return {
            id: row.id,
            name: row.name,
            partNumber: row.part_number,
            category: row.category,
            description: row.description,
            qtyOnHand: row.qty_on_hand,
            minimumQty: row.minimum_qty,
            unit: row.unit,
            supplier: row.supplier,
            unitPrice: parseFloat(row.unit_price || 0),
            location: row.location,
            reorderLink: row.reorder_link,
            urgencyStatus: urgency.status,
            urgencyScore: urgency.score,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    };
    
    router.get('/products', async (req, res) => {
        try {
            const { search, status, page = 1, limit = 50, sortField = 'name', sortOrder = 'asc' } = req.query;
            let query = 'SELECT * FROM products WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            if (search) {
                query += ` AND (name ILIKE $${paramIndex} OR part_number ILIKE $${paramIndex} OR category ILIKE $${paramIndex} OR supplier ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            const countResult = await pool.query(query.replace('SELECT *', 'SELECT COUNT(*)'), params);
            const total = parseInt(countResult.rows[0].count);
            const sortFieldMap = { name: 'name', qtyOnHand: 'qty_on_hand', minimumQty: 'minimum_qty', price: 'unit_price', supplier: 'supplier', createdAt: 'created_at' };
            const dbSortField = sortFieldMap[sortField] || 'name';
            const dbSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';
            query += ` ORDER BY ${dbSortField} ${dbSortOrder}`;
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            const result = await pool.query(query, params);
            let products = result.rows.map(mapProductRow);
            if (status) products = products.filter(p => p.urgencyStatus === status);
            res.json({
                success: true,
                data: products,
                pagination: { page: parseInt(page), limit: parseInt(limit), total: status ? products.length : total, totalPages: Math.ceil((status ? products.length : total) / parseInt(limit)) }
            });
        } catch (err) {
            console.error('Error fetching products:', err);
            sendError(res, 500, 'Failed to fetch products');
        }
    });
    
    router.get('/products/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
            if (result.rows.length === 0) return sendError(res, 404, 'Product not found');
            sendSuccess(res, mapProductRow(result.rows[0]));
        } catch (err) {
            console.error('Error fetching product:', err);
            sendError(res, 500, 'Failed to fetch product');
        }
    });
    
    router.post('/products', validateBody(schemas.product), async (req, res) => {
        try {
            const { name, partNumber, category, description, qtyOnHand, minimumQty, unit, supplier, unitPrice, location, reorderLink, notes } = req.validatedBody;
            const result = await pool.query(
                `INSERT INTO products (name, part_number, category, description, qty_on_hand, minimum_qty, unit, supplier, unit_price, location, reorder_link, notes, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
                 RETURNING *`,
                [name, partNumber || null, category || null, description || null, qtyOnHand, minimumQty, unit || 'EA', supplier || null, unitPrice, location || null, reorderLink || null, notes || null]
            );
            const row = result.rows[0];
            sendSuccess(res, mapProductRow(row), 'Product created successfully');
        } catch (err) {
            console.error('Error creating product:', err);
            sendError(res, 500, 'Failed to create product');
        }
    });
    
    router.put('/products/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const existing = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
            if (existing.rows.length === 0) return sendError(res, 404, 'Product not found');
            const cur = existing.rows[0];
            const data = {
                name: req.body.name ?? cur.name,
                partNumber: req.body.partNumber ?? cur.part_number,
                category: req.body.category ?? cur.category,
                description: req.body.description ?? cur.description,
                qtyOnHand: req.body.qtyOnHand ?? cur.qty_on_hand,
                minimumQty: req.body.minimumQty ?? cur.minimum_qty,
                unit: req.body.unit ?? cur.unit,
                supplier: req.body.supplier ?? cur.supplier,
                unitPrice: req.body.unitPrice ?? parseFloat(cur.unit_price),
                location: req.body.location ?? cur.location,
                reorderLink: req.body.reorderLink ?? cur.reorder_link,
                notes: req.body.notes ?? cur.notes
            };
            const validation = validateProduct(data);
            if (!validation.isValid) return sendError(res, 400, 'Validation failed', validation.errors);
            await pool.query(
                `UPDATE products SET name = $1, part_number = $2, category = $3, description = $4, qty_on_hand = $5, minimum_qty = $6, unit = $7, supplier = $8, unit_price = $9, location = $10, reorder_link = $11, notes = $12, updated_at = NOW() WHERE id = $13`,
                [data.name, data.partNumber, data.category, data.description, data.qtyOnHand, data.minimumQty, data.unit, data.supplier, data.unitPrice, data.location, data.reorderLink, data.notes, id]
            );
            const updated = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
            sendSuccess(res, mapProductRow(updated.rows[0]), 'Product updated successfully');
        } catch (err) {
            console.error('Error updating product:', err);
            sendError(res, 500, 'Failed to update product');
        }
    });
    
    router.delete('/products/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
            if (result.rows.length === 0) return sendError(res, 404, 'Product not found');
            sendSuccess(res, { id }, 'Product deleted successfully');
        } catch (err) {
            console.error('Error deleting product:', err);
            sendError(res, 500, 'Failed to delete product');
        }
    });
    
    // Product BOM
    router.get('/products/:id/bom', async (req, res) => {
        try {
            const { id } = req.params;
            const prodCheck = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
            if (prodCheck.rows.length === 0) return sendError(res, 404, 'Product not found');
            const result = await pool.query(
                `SELECT pb.id, pb.part_id, pb.quantity_per_assembly, p.name as part_name, p.part_number as part_number
                 FROM product_bom pb JOIN parts p ON pb.part_id = p.id WHERE pb.product_id = $1 ORDER BY p.name`,
                [id]
            );
            const bom = result.rows.map(r => ({
                id: r.id,
                partId: r.part_id,
                partName: r.part_name,
                partNumber: r.part_number,
                quantityPerAssembly: parseFloat(r.quantity_per_assembly)
            }));
            sendSuccess(res, bom);
        } catch (err) {
            console.error('Error fetching product BOM:', err);
            sendError(res, 500, 'Failed to fetch product BOM');
        }
    });
    
    router.post('/products/:id/bom', validateBody(schemas.productBom), async (req, res) => {
        try {
            const { id } = req.params;
            const { partId, quantityPerAssembly } = req.validatedBody;
            const prodCheck = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
            if (prodCheck.rows.length === 0) return sendError(res, 404, 'Product not found');
            const partCheck = await pool.query('SELECT id FROM parts WHERE id = $1', [partId]);
            if (partCheck.rows.length === 0) return sendError(res, 404, 'Part not found');
            await pool.query(
                `INSERT INTO product_bom (product_id, part_id, quantity_per_assembly, updated_at) VALUES ($1, $2, $3, NOW())
                 ON CONFLICT(product_id, part_id) DO UPDATE SET quantity_per_assembly = $3, updated_at = NOW()`,
                [id, partId, quantityPerAssembly]
            );
            const result = await pool.query(
                `SELECT pb.id, pb.part_id, pb.quantity_per_assembly, p.name as part_name, p.part_number as part_number
                 FROM product_bom pb JOIN parts p ON pb.part_id = p.id WHERE pb.product_id = $1 AND pb.part_id = $2`,
                [id, partId]
            );
            const row = result.rows[0];
            sendSuccess(res, { id: row.id, partId: row.part_id, partName: row.part_name, partNumber: row.part_number, quantityPerAssembly: parseFloat(row.quantity_per_assembly) }, 'BOM line added');
        } catch (err) {
            console.error('Error adding BOM line:', err);
            sendError(res, 500, 'Failed to add BOM line');
        }
    });
    
    router.delete('/products/:id/bom/:partId', async (req, res) => {
        try {
            const { id, partId } = req.params;
            const result = await pool.query('DELETE FROM product_bom WHERE product_id = $1 AND part_id = $2 RETURNING *', [id, partId]);
            if (result.rows.length === 0) return sendError(res, 404, 'BOM line not found');
            sendSuccess(res, {}, 'BOM line removed');
        } catch (err) {
            console.error('Error removing BOM line:', err);
            sendError(res, 500, 'Failed to remove BOM line');
        }
    });
    
    // ==================== PARTS ====================
    
    const mapPartRow = (row) => {
        const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
        return {
            id: row.id,
            name: row.name,
            partNumber: row.part_number,
            category: row.category,
            source: row.source || 'purchased',
            description: row.description,
            qtyOnHand: row.qty_on_hand,
            minimumQty: row.minimum_qty,
            unit: row.unit,
            supplier: row.supplier,
            unitPrice: parseFloat(row.unit_price || 0),
            location: row.location,
            reorderLink: row.reorder_link,
            urgencyStatus: urgency.status,
            urgencyScore: urgency.score,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    };
    
    router.get('/parts', async (req, res) => {
        try {
            const { search, status, source, page = 1, limit = 50, sortField = 'name', sortOrder = 'asc' } = req.query;
            let query = 'SELECT * FROM parts WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            if (search) {
                query += ` AND (name ILIKE $${paramIndex} OR part_number ILIKE $${paramIndex} OR category ILIKE $${paramIndex} OR supplier ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            if (source) {
                query += ` AND source = $${paramIndex}`;
                params.push(source);
                paramIndex++;
            }
            const countResult = await pool.query(query.replace('SELECT *', 'SELECT COUNT(*)'), params);
            const total = parseInt(countResult.rows[0].count);
            const sortFieldMap = { name: 'name', qtyOnHand: 'qty_on_hand', minimumQty: 'minimum_qty', price: 'unit_price', supplier: 'supplier', createdAt: 'created_at', source: 'source' };
            const dbSortField = sortFieldMap[sortField] || 'name';
            const dbSortOrder = sortOrder === 'desc' ? 'DESC' : 'ASC';
            query += ` ORDER BY ${dbSortField} ${dbSortOrder}`;
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            const result = await pool.query(query, params);
            let parts = result.rows.map(mapPartRow);
            if (status) parts = parts.filter(p => p.urgencyStatus === status);
            res.json({
                success: true,
                data: parts,
                pagination: { page: parseInt(page), limit: parseInt(limit), total: status ? parts.length : total, totalPages: Math.ceil((status ? parts.length : total) / parseInt(limit)) }
            });
        } catch (err) {
            console.error('Error fetching parts:', err);
            sendError(res, 500, 'Failed to fetch parts');
        }
    });
    
    router.get('/parts/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM parts WHERE id = $1', [id]);
            if (result.rows.length === 0) return sendError(res, 404, 'Part not found');
            sendSuccess(res, mapPartRow(result.rows[0]));
        } catch (err) {
            console.error('Error fetching part:', err);
            sendError(res, 500, 'Failed to fetch part');
        }
    });
    
    router.post('/parts', validateBody(schemas.part), async (req, res) => {
        try {
            const { name, partNumber, category, source, description, qtyOnHand, minimumQty, unit, supplier, unitPrice, location, reorderLink, notes } = req.validatedBody;
            const result = await pool.query(
                `INSERT INTO parts (name, part_number, category, source, description, qty_on_hand, minimum_qty, unit, supplier, unit_price, location, reorder_link, notes, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
                 RETURNING *`,
                [name, partNumber || null, category || null, source || 'purchased', description || null, qtyOnHand, minimumQty, unit || 'EA', supplier || null, unitPrice, location || null, reorderLink || null, notes || null]
            );
            const row = result.rows[0];
            sendSuccess(res, mapPartRow(row), 'Part created successfully');
        } catch (err) {
            console.error('Error creating part:', err);
            sendError(res, 500, 'Failed to create part');
        }
    });
    
    router.put('/parts/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const existing = await pool.query('SELECT * FROM parts WHERE id = $1', [id]);
            if (existing.rows.length === 0) return sendError(res, 404, 'Part not found');
            const cur = existing.rows[0];
            const data = {
                name: req.body.name ?? cur.name,
                partNumber: req.body.partNumber ?? cur.part_number,
                category: req.body.category ?? cur.category,
                source: req.body.source ?? cur.source,
                description: req.body.description ?? cur.description,
                qtyOnHand: req.body.qtyOnHand ?? cur.qty_on_hand,
                minimumQty: req.body.minimumQty ?? cur.minimum_qty,
                unit: req.body.unit ?? cur.unit,
                supplier: req.body.supplier ?? cur.supplier,
                unitPrice: req.body.unitPrice ?? parseFloat(cur.unit_price),
                location: req.body.location ?? cur.location,
                reorderLink: req.body.reorderLink ?? cur.reorder_link,
                notes: req.body.notes ?? cur.notes
            };
            const validation = validatePart(data);
            if (!validation.isValid) return sendError(res, 400, 'Validation failed', validation.errors);
            await pool.query(
                `UPDATE parts SET name = $1, part_number = $2, category = $3, source = $4, description = $5, qty_on_hand = $6, minimum_qty = $7, unit = $8, supplier = $9, unit_price = $10, location = $11, reorder_link = $12, notes = $13, updated_at = NOW() WHERE id = $14`,
                [data.name, data.partNumber, data.category, data.source, data.description, data.qtyOnHand, data.minimumQty, data.unit, data.supplier, data.unitPrice, data.location, data.reorderLink, data.notes, id]
            );
            const updated = await pool.query('SELECT * FROM parts WHERE id = $1', [id]);
            sendSuccess(res, mapPartRow(updated.rows[0]), 'Part updated successfully');
        } catch (err) {
            console.error('Error updating part:', err);
            sendError(res, 500, 'Failed to update part');
        }
    });
    
    router.delete('/parts/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('DELETE FROM parts WHERE id = $1 RETURNING *', [id]);
            if (result.rows.length === 0) return sendError(res, 404, 'Part not found');
            sendSuccess(res, { id }, 'Part deleted successfully');
        } catch (err) {
            console.error('Error deleting part:', err);
            sendError(res, 500, 'Failed to delete part');
        }
    });
    
    // ==================== ALL INVENTORY ====================
    
    // GET all inventory items combined
    router.get('/all', async (req, res) => {
        try {
            const { search, status, sortField = 'urgencyScore', sortOrder = 'desc' } = req.query;
            
            // Fetch all inventory types
            const [materialsResult, toolsResult, miscResult] = await Promise.all([
                pool.query('SELECT * FROM materials'),
                pool.query('SELECT * FROM tooling'),
                pool.query('SELECT * FROM misc_items')
            ]);
            
            const allItems = [];
            
            // Process materials
            materialsResult.rows.forEach(row => {
                const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
                allItems.push({
                    id: row.id,
                    category: 'Material',
                    name: row.name,
                    type: row.material_type,
                    qtyOnHand: row.qty_on_hand,
                    minimumQty: row.minimum_qty,
                    supplier: row.supplier,
                    price: parseFloat(row.unit_price),
                    reorderLink: row.reorder_link,
                    urgencyStatus: urgency.status,
                    urgencyScore: urgency.score
                });
            });
            
            // Process tools
            toolsResult.rows.forEach(row => {
                const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
                allItems.push({
                    id: row.id,
                    category: 'Tool',
                    name: row.name,
                    type: row.tool_type,
                    qtyOnHand: row.qty_on_hand,
                    minimumQty: row.minimum_qty,
                    supplier: row.supplier,
                    price: parseFloat(row.tool_price),
                    reorderLink: row.reorder_link,
                    urgencyStatus: urgency.status,
                    urgencyScore: urgency.score
                });
            });
            
            // Process misc
            miscResult.rows.forEach(row => {
                const urgency = calculateUrgency(row.qty_on_hand, row.minimum_qty);
                allItems.push({
                    id: row.id,
                    category: 'Misc',
                    name: row.name,
                    type: row.workcenter,
                    qtyOnHand: row.qty_on_hand,
                    minimumQty: row.minimum_qty,
                    supplier: '-',
                    price: parseFloat(row.item_price),
                    reorderLink: row.reorder_link,
                    urgencyStatus: urgency.status,
                    urgencyScore: urgency.score
                });
            });
            
            // Filter by search
            let filteredItems = allItems;
            if (search) {
                const searchLower = search.toLowerCase();
                filteredItems = allItems.filter(item => 
                    item.name.toLowerCase().includes(searchLower) ||
                    item.type.toLowerCase().includes(searchLower) ||
                    item.category.toLowerCase().includes(searchLower) ||
                    (item.supplier && item.supplier.toLowerCase().includes(searchLower))
                );
            }
            
            // Filter by status
            if (status) {
                filteredItems = filteredItems.filter(item => item.urgencyStatus === status);
            }
            
            // Sort
            const sortMultiplier = sortOrder === 'desc' ? -1 : 1;
            filteredItems.sort((a, b) => {
                let aVal, bVal;
                switch (sortField) {
                    case 'name':
                        return sortMultiplier * a.name.localeCompare(b.name);
                    case 'qtyOnHand':
                        return sortMultiplier * (a.qtyOnHand - b.qtyOnHand);
                    case 'price':
                        return sortMultiplier * (a.price - b.price);
                    case 'urgencyScore':
                    default:
                        return sortMultiplier * (a.urgencyScore - b.urgencyScore);
                }
            });
            
            sendSuccess(res, filteredItems);
        } catch (err) {
            console.error('Error fetching all inventory:', err);
            sendError(res, 500, 'Failed to fetch inventory');
        }
    });
    
    // GET inventory statistics
    router.get('/stats', async (req, res) => {
        try {
            const [materials, tools, misc] = await Promise.all([
                pool.query('SELECT COUNT(*) as count, SUM(qty_on_hand * unit_price) as value FROM materials'),
                pool.query('SELECT COUNT(*) as count, SUM(qty_on_hand * tool_price) as value FROM tooling'),
                pool.query('SELECT COUNT(*) as count, SUM(qty_on_hand * item_price) as value FROM misc_items')
            ]);
            
            // Count low stock items
            const [lowMaterials, lowTools, lowMisc] = await Promise.all([
                pool.query('SELECT COUNT(*) FROM materials WHERE qty_on_hand <= minimum_qty'),
                pool.query('SELECT COUNT(*) FROM tooling WHERE qty_on_hand <= minimum_qty'),
                pool.query('SELECT COUNT(*) FROM misc_items WHERE qty_on_hand <= minimum_qty')
            ]);
            
            sendSuccess(res, {
                materials: {
                    count: parseInt(materials.rows[0].count),
                    totalValue: parseFloat(materials.rows[0].value || 0),
                    lowStock: parseInt(lowMaterials.rows[0].count)
                },
                tools: {
                    count: parseInt(tools.rows[0].count),
                    totalValue: parseFloat(tools.rows[0].value || 0),
                    lowStock: parseInt(lowTools.rows[0].count)
                },
                misc: {
                    count: parseInt(misc.rows[0].count),
                    totalValue: parseFloat(misc.rows[0].value || 0),
                    lowStock: parseInt(lowMisc.rows[0].count)
                },
                total: {
                    count: parseInt(materials.rows[0].count) + parseInt(tools.rows[0].count) + parseInt(misc.rows[0].count),
                    totalValue: parseFloat(materials.rows[0].value || 0) + parseFloat(tools.rows[0].value || 0) + parseFloat(misc.rows[0].value || 0),
                    lowStock: parseInt(lowMaterials.rows[0].count) + parseInt(lowTools.rows[0].count) + parseInt(lowMisc.rows[0].count)
                }
            });
        } catch (err) {
            console.error('Error fetching inventory stats:', err);
            sendError(res, 500, 'Failed to fetch inventory statistics');
        }
    });
    
    return router;
};
