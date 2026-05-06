// Customers API Routes for BPERP Sales Module
const express = require('express');
const router = express.Router();
const { validateBody, schemas } = require('../middleware/validation');

// Validation helpers (kept for contact validation within customer create)
const validateCustomer = (data, isUpdate = false) => {
    const errors = [];
    
    if (!isUpdate && (!data.name || data.name.trim().length === 0)) {
        errors.push({ field: 'name', message: 'Company name is required' });
    } else if (data.name && data.name.length > 200) {
        errors.push({ field: 'name', message: 'Company name must be less than 200 characters' });
    }
    
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push({ field: 'email', message: 'Please enter a valid email address' });
    }
    
    return { isValid: errors.length === 0, errors };
};

const validateContact = (data) => {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Contact name is required' });
    }
    
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push({ field: 'email', message: 'Please enter a valid email address' });
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

// Transform row to camelCase
const transformCustomer = (row) => ({
    id: row.id,
    name: row.name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    country: row.country,
    phone: row.phone,
    fax: row.fax,
    website: row.website,
    defaultTerms: row.default_terms,
    taxId: row.tax_id,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null
});

const transformContact = (row) => ({
    id: row.id,
    customerId: row.customer_id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    isPrimary: row.is_primary,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

module.exports = (pool) => {
    const { requireAuth, requireAdmin } = require('../middleware/auth')(pool);
    router.use(requireAuth);

    // ==================== CUSTOMERS ====================
    
    // GET all customers with optional filters
    router.get('/', async (req, res) => {
        try {
            const { search, isActive, hasOpenWorkOrders, page = 1, limit = 50 } = req.query;
            
            let query = `
                SELECT c.*, 
                    COALESCE(wo_count.count, 0) as open_work_order_count,
                    COALESCE(q_count.total, 0) as total_quotes,
                    COALESCE(q_count.won, 0) as won_quotes
                FROM customers c
                LEFT JOIN (
                    SELECT customer_id, COUNT(*) as count 
                    FROM work_orders 
                    WHERE status NOT IN ('Complete', 'Shipped', 'Cancelled') AND deleted_at IS NULL
                    GROUP BY customer_id
                ) wo_count ON c.id = wo_count.customer_id
                LEFT JOIN (
                    SELECT customer_id, 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'Won') as won
                    FROM quotes WHERE deleted_at IS NULL
                    GROUP BY customer_id
                ) q_count ON c.id = q_count.customer_id
                WHERE c.deleted_at IS NULL
            `;
            
            const params = [];
            let paramIndex = 1;
            
            if (search) {
                query += ` AND (c.name ILIKE $${paramIndex} OR c.city ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }
            
            if (isActive !== undefined) {
                query += ` AND c.is_active = $${paramIndex}`;
                params.push(isActive === 'true');
                paramIndex++;
            }
            
            if (hasOpenWorkOrders === 'true') {
                query += ` AND COALESCE(wo_count.count, 0) > 0`;
            }
            
            // Count for pagination
            const countQuery = query.replace(/SELECT c\.\*.*?FROM customers c/, 'SELECT COUNT(DISTINCT c.id) FROM customers c');
            const countResult = await pool.query(countQuery, params);
            const total = parseInt(countResult.rows[0].count);
            
            // Add sorting and pagination
            query += ` ORDER BY c.name ASC`;
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            
            const result = await pool.query(query, params);
            
            const customers = result.rows.map(row => ({
                ...transformCustomer(row),
                openWorkOrderCount: parseInt(row.open_work_order_count),
                totalQuotes: parseInt(row.total_quotes),
                wonQuotes: parseInt(row.won_quotes)
            }));
            
            res.json({
                success: true,
                data: customers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (err) {
            console.error('Error fetching customers:', err);
            sendError(res, 500, 'Failed to fetch customers');
        }
    });

    // GET soft-deleted customers (archive) — must be registered before GET /:id
    router.get('/archived', async (req, res) => {
        try {
            const { page = 1, limit = 100 } = req.query;
            const lim = parseInt(limit, 10) || 100;
            const pg = parseInt(page, 10) || 1;
            const offset = (pg - 1) * lim;

            const countResult = await pool.query(
                'SELECT COUNT(*) as count FROM customers WHERE deleted_at IS NOT NULL'
            );
            const total = parseInt(countResult.rows[0].count, 10);

            const result = await pool.query(
                `SELECT * FROM customers WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT $1 OFFSET $2`,
                [lim, offset]
            );

            const customers = result.rows.map((row) => transformCustomer(row));

            res.json({
                success: true,
                data: customers,
                pagination: {
                    page: pg,
                    limit: lim,
                    total,
                    totalPages: Math.ceil(total / lim) || 0
                }
            });
        } catch (err) {
            console.error('Error fetching archived customers:', err);
            sendError(res, 500, 'Failed to fetch archived customers');
        }
    });
    
    // GET single customer with details
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Get customer
            const customerResult = await pool.query(
                'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL',
                [id]
            );
            
            if (customerResult.rows.length === 0) {
                return sendError(res, 404, 'Customer not found');
            }
            
            const customer = transformCustomer(customerResult.rows[0]);
            
            // Get contacts
            const contactsResult = await pool.query(
                'SELECT * FROM contacts WHERE customer_id = $1 AND is_active = TRUE ORDER BY is_primary DESC, name ASC',
                [id]
            );
            customer.contacts = contactsResult.rows.map(transformContact);
            
            // Get open work orders
            const woResult = await pool.query(`
                SELECT id, wo_number, part_number, quantity, due_date, status, completion_percentage
                FROM work_orders 
                WHERE customer_id = $1 AND status NOT IN ('Complete', 'Shipped', 'Cancelled') AND deleted_at IS NULL
                ORDER BY due_date ASC
            `, [id]);
            
            customer.openWorkOrders = woResult.rows.map(row => ({
                id: row.id,
                woNumber: row.wo_number,
                partNumber: row.part_number,
                quantity: row.quantity,
                dueDate: row.due_date,
                status: row.status,
                completionPercentage: row.completion_percentage
            }));
            customer.openWorkOrderCount = customer.openWorkOrders.length;
            
            sendSuccess(res, customer);
        } catch (err) {
            console.error('Error fetching customer:', err);
            sendError(res, 500, 'Failed to fetch customer');
        }
    });
    
    // GET customer's archived work orders
    router.get('/:id/archived-work-orders', async (req, res) => {
        try {
            const { id } = req.params;
            const { dateFrom, dateTo, page = 1, limit = 20 } = req.query;
            
            let query = `
                SELECT * FROM work_orders 
                WHERE customer_id = $1 AND status IN ('Complete', 'Shipped') AND deleted_at IS NULL
            `;
            const params = [id];
            let paramIndex = 2;
            
            if (dateFrom) {
                query += ` AND completed_date >= $${paramIndex}`;
                params.push(dateFrom);
                paramIndex++;
            }
            
            if (dateTo) {
                query += ` AND completed_date <= $${paramIndex}`;
                params.push(dateTo);
                paramIndex++;
            }
            
            query += ` ORDER BY completed_date DESC`;
            
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit), offset);
            
            const result = await pool.query(query, params);
            
            const workOrders = result.rows.map(row => ({
                id: row.id,
                woNumber: row.wo_number,
                partNumber: row.part_number,
                quantity: row.quantity,
                dueDate: row.due_date,
                completedDate: row.completed_date,
                status: row.status,
                customerPo: row.customer_po,
                quotedPrice: parseFloat(row.quoted_price || 0)
            }));
            
            sendSuccess(res, workOrders);
        } catch (err) {
            console.error('Error fetching archived work orders:', err);
            sendError(res, 500, 'Failed to fetch archived work orders');
        }
    });
    
    // POST create new customer
    router.post('/', validateBody(schemas.customer), async (req, res) => {
        try {
            const {
                name, addressLine1, addressLine2, city, state, zipCode,
                country, phone, fax, website, defaultTerms, taxId, notes,
                contacts 
            } = req.validatedBody;
            
            // Insert customer
            const customerResult = await pool.query(`
                INSERT INTO customers (name, address_line1, address_line2, city, state, zip_code, 
                    country, phone, fax, website, default_terms, tax_id, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                name.trim(), addressLine1, addressLine2, city, state, zipCode,
                country || 'USA', phone, fax, website, defaultTerms || 'NET 30', taxId, notes
            ]);
            
            const customer = transformCustomer(customerResult.rows[0]);
            
            // Insert contacts if provided
            if (contacts && contacts.length > 0) {
                customer.contacts = [];
                for (const contact of contacts) {
                        const contactResult = await pool.query(`
                            INSERT INTO contacts (customer_id, name, role, email, phone, mobile, is_primary)
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING *
                        `, [customer.id, contact.name, contact.role || null, contact.email || null, contact.phone || null, contact.mobile || null, contact.isPrimary || false]);
                        customer.contacts.push(transformContact(contactResult.rows[0]));
                }
            }
            
            sendSuccess(res, customer, 'Customer created successfully');
        } catch (err) {
            console.error('Error creating customer:', err);
            sendError(res, 500, 'Failed to create customer');
        }
    });
    
    // PUT update customer
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            // Check if exists
            const existing = await pool.query('SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL', [id]);
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Customer not found');
            }
            
            const validation = validateCustomer(req.body, true);
            if (!validation.isValid) {
                return sendError(res, 400, 'Validation failed', validation.errors);
            }
            
            const current = existing.rows[0];
            const {
                name = current.name,
                addressLine1 = current.address_line1,
                addressLine2 = current.address_line2,
                city = current.city,
                state = current.state,
                zipCode = current.zip_code,
                country = current.country,
                phone = current.phone,
                fax = current.fax,
                website = current.website,
                defaultTerms = current.default_terms,
                taxId = current.tax_id,
                notes = current.notes,
                isActive = current.is_active
            } = req.body;
            
            const result = await pool.query(`
                UPDATE customers SET 
                    name = $1, address_line1 = $2, address_line2 = $3, city = $4, state = $5,
                    zip_code = $6, country = $7, phone = $8, fax = $9, website = $10,
                    default_terms = $11, tax_id = $12, notes = $13, is_active = $14, updated_at = NOW()
                WHERE id = $15
                RETURNING *
            `, [name, addressLine1, addressLine2, city, state, zipCode, country, phone, fax, 
                website, defaultTerms, taxId, notes, isActive, id]);
            
            sendSuccess(res, transformCustomer(result.rows[0]), 'Customer updated successfully');
        } catch (err) {
            console.error('Error updating customer:', err);
            sendError(res, 500, 'Failed to update customer');
        }
    });
    
    // DELETE customer (soft delete)
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const result = await pool.query(
                'UPDATE customers SET deleted_at = NOW(), is_active = FALSE WHERE id = $1 AND deleted_at IS NULL RETURNING id',
                [id]
            );
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Customer not found');
            }
            
            sendSuccess(res, { id: parseInt(id) }, 'Customer deleted successfully');
        } catch (err) {
            console.error('Error deleting customer:', err);
            sendError(res, 500, 'Failed to delete customer');
        }
    });

    // Permanently delete a soft-deleted customer (Administrator only) — must be before DELETE /:id if paths overlap; here path is distinct
    router.delete('/:id/permanent', requireAdmin, async (req, res) => {
        try {
            const customerId = parseInt(req.params.id, 10);
            if (Number.isNaN(customerId)) {
                return sendError(res, 400, 'Invalid customer id');
            }

            const check = await pool.query(
                'SELECT id FROM customers WHERE id = $1 AND deleted_at IS NOT NULL',
                [customerId]
            );
            if (check.rows.length === 0) {
                return sendError(res, 404, 'Archived customer not found');
            }

            await pool.query('UPDATE shipping_tasks SET customer_id = NULL WHERE customer_id = $1', [customerId]);
            await pool.query('UPDATE shipping_tasks SET work_order_id = NULL WHERE work_order_id IN (SELECT id FROM work_orders WHERE customer_id = $1)', [customerId]);
            await pool.query('UPDATE work_order_archive SET customer_id = NULL WHERE customer_id = $1', [customerId]);
            await pool.query('DELETE FROM tasks WHERE work_order_id IN (SELECT id FROM work_orders WHERE customer_id = $1)', [customerId]);
            await pool.query('DELETE FROM work_orders WHERE customer_id = $1', [customerId]);
            await pool.query('DELETE FROM quotes WHERE customer_id = $1', [customerId]);
            await pool.query('DELETE FROM contacts WHERE customer_id = $1', [customerId]);
            await pool.query('DELETE FROM customers WHERE id = $1 AND deleted_at IS NOT NULL', [customerId]);

            sendSuccess(res, { id: customerId }, 'Customer permanently deleted');
        } catch (err) {
            console.error('Error permanently deleting customer:', err);
            sendError(res, 500, 'Failed to permanently delete customer');
        }
    });
    
    // ==================== CONTACTS ====================
    
    // GET contacts for a customer
    router.get('/:customerId/contacts', async (req, res) => {
        try {
            const { customerId } = req.params;
            
            const result = await pool.query(
                'SELECT * FROM contacts WHERE customer_id = $1 AND is_active = TRUE ORDER BY is_primary DESC, name ASC',
                [customerId]
            );
            
            sendSuccess(res, result.rows.map(transformContact));
        } catch (err) {
            console.error('Error fetching contacts:', err);
            sendError(res, 500, 'Failed to fetch contacts');
        }
    });
    
    // POST add contact to customer
    router.post('/:customerId/contacts', validateBody(schemas.contact), async (req, res) => {
        try {
            const { customerId } = req.params;
            const { name, role, email, phone, mobile, isPrimary, notes } = req.validatedBody;
            
            // Check customer exists
            const customerCheck = await pool.query('SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL', [customerId]);
            if (customerCheck.rows.length === 0) {
                return sendError(res, 404, 'Customer not found');
            }
            
            
            // If setting as primary, unset other primary contacts
            if (isPrimary) {
                await pool.query('UPDATE contacts SET is_primary = FALSE WHERE customer_id = $1', [customerId]);
            }
            
            const result = await pool.query(`
                INSERT INTO contacts (customer_id, name, role, email, phone, mobile, is_primary, notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [customerId, name.trim(), role, email, phone, mobile, isPrimary || false, notes]);
            
            sendSuccess(res, transformContact(result.rows[0]), 'Contact added successfully');
        } catch (err) {
            console.error('Error adding contact:', err);
            sendError(res, 500, 'Failed to add contact');
        }
    });
    
    // PUT update contact
    router.put('/:customerId/contacts/:contactId', async (req, res) => {
        try {
            const { customerId, contactId } = req.params;
            
            const existing = await pool.query(
                'SELECT * FROM contacts WHERE id = $1 AND customer_id = $2',
                [contactId, customerId]
            );
            
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Contact not found');
            }
            
            const current = existing.rows[0];
            const {
                name = current.name,
                role = current.role,
                email = current.email,
                phone = current.phone,
                mobile = current.mobile,
                isPrimary = current.is_primary,
                notes = current.notes
            } = req.body;
            
            // If setting as primary, unset other primary contacts
            if (isPrimary && !current.is_primary) {
                await pool.query('UPDATE contacts SET is_primary = FALSE WHERE customer_id = $1', [customerId]);
            }
            
            const result = await pool.query(`
                UPDATE contacts SET 
                    name = $1, role = $2, email = $3, phone = $4, mobile = $5, 
                    is_primary = $6, notes = $7, updated_at = NOW()
                WHERE id = $8
                RETURNING *
            `, [name, role, email, phone, mobile, isPrimary, notes, contactId]);
            
            sendSuccess(res, transformContact(result.rows[0]), 'Contact updated successfully');
        } catch (err) {
            console.error('Error updating contact:', err);
            sendError(res, 500, 'Failed to update contact');
        }
    });
    
    // DELETE contact (soft delete)
    router.delete('/:customerId/contacts/:contactId', async (req, res) => {
        try {
            const { customerId, contactId } = req.params;
            
            const result = await pool.query(
                'UPDATE contacts SET is_active = FALSE WHERE id = $1 AND customer_id = $2 RETURNING id',
                [contactId, customerId]
            );
            
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Contact not found');
            }
            
            sendSuccess(res, { id: parseInt(contactId) }, 'Contact deleted successfully');
        } catch (err) {
            console.error('Error deleting contact:', err);
            sendError(res, 500, 'Failed to delete contact');
        }
    });
    
    return router;
};
