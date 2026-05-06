// Sales leads API — soft delete + archive + admin permanent delete
const express = require('express');
const router = express.Router();
const { validateBody, schemas } = require('../middleware/validation');

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

const transformLead = (row) => ({
    id: row.id,
    name: row.name,
    segment: row.segment,
    location: row.location,
    phone: row.phone,
    email: row.email,
    industry: row.industry,
    notes: row.notes,
    priorityTarget: row.priority_target === 1 || row.priority_target === true,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null
});

module.exports = (pool) => {
    const { requireAuth, requireAdmin } = require('../middleware/auth')(pool);
    router.use(requireAuth);

    /** GET /archived — must be before /:id */
    router.get('/archived', async (req, res) => {
        try {
            const { page = 1, limit = 100 } = req.query;
            const lim = parseInt(limit, 10) || 100;
            const pg = parseInt(page, 10) || 1;
            const offset = (pg - 1) * lim;

            const countResult = await pool.query(
                'SELECT COUNT(*) as count FROM sales_leads WHERE deleted_at IS NOT NULL'
            );
            const total = parseInt(countResult.rows[0].count, 10);

            const result = await pool.query(
                `SELECT * FROM sales_leads WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT $1 OFFSET $2`,
                [lim, offset]
            );

            const leads = result.rows.map((row) => transformLead(row));

            res.json({
                success: true,
                data: leads,
                pagination: {
                    page: pg,
                    limit: lim,
                    total,
                    totalPages: Math.ceil(total / lim) || 0
                }
            });
        } catch (err) {
            console.error('Error fetching archived leads:', err);
            sendError(res, 500, 'Failed to fetch archived leads');
        }
    });

    /** GET / — active leads */
    router.get('/', async (req, res) => {
        try {
            const { search, page = 1, limit = 500 } = req.query;
            const lim = Math.min(parseInt(limit, 10) || 500, 2000);
            const pg = parseInt(page, 10) || 1;
            const offset = (pg - 1) * lim;

            let sql = `
                SELECT * FROM sales_leads
                WHERE deleted_at IS NULL
            `;
            const params = [];
            let paramIndex = 1;

            if (search && String(search).trim()) {
                const term = `%${String(search).trim()}%`;
                sql += ` AND (
                    name LIKE $${paramIndex} OR
                    IFNULL(segment, '') LIKE $${paramIndex} OR
                    IFNULL(location, '') LIKE $${paramIndex} OR
                    IFNULL(industry, '') LIKE $${paramIndex} OR
                    IFNULL(notes, '') LIKE $${paramIndex} OR
                    IFNULL(phone, '') LIKE $${paramIndex} OR
                    IFNULL(email, '') LIKE $${paramIndex}
                )`;
                params.push(term);
                paramIndex++;
            }

            const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
            const countResult = await pool.query(countSql, params);
            const total = parseInt(countResult.rows[0].count, 10);

            sql += ` ORDER BY sort_order ASC, name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(lim, offset);

            const result = await pool.query(sql, params);
            const leads = result.rows.map((row) => transformLead(row));

            res.json({
                success: true,
                data: leads,
                pagination: {
                    page: pg,
                    limit: lim,
                    total,
                    totalPages: Math.ceil(total / lim) || 0
                }
            });
        } catch (err) {
            console.error('Error fetching leads:', err);
            sendError(res, 500, 'Failed to fetch leads');
        }
    });

    /** GET /:id */
    router.get('/:id', async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (Number.isNaN(id)) return sendError(res, 400, 'Invalid id');

            const result = await pool.query(
                'SELECT * FROM sales_leads WHERE id = $1 AND deleted_at IS NULL',
                [id]
            );
            if (result.rows.length === 0) {
                return sendError(res, 404, 'Lead not found');
            }
            sendSuccess(res, transformLead(result.rows[0]));
        } catch (err) {
            console.error('Error fetching lead:', err);
            sendError(res, 500, 'Failed to fetch lead');
        }
    });

    /** POST / */
    router.post('/', validateBody(schemas.leadCreate), async (req, res) => {
        try {
            const {
                name,
                segment,
                location,
                phone,
                email,
                industry,
                notes,
                priorityTarget,
                sortOrder
            } = req.validatedBody;

            const priority = priorityTarget ? 1 : 0;
            const sort = sortOrder != null ? sortOrder : 999999;

            const result = await pool.query(
                `INSERT INTO sales_leads (name, segment, location, phone, email, industry, notes, priority_target, sort_order, is_active, created_at, updated_at, deleted_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, datetime('now'), datetime('now'), NULL)
                 RETURNING *`,
                [
                    name.trim(),
                    segment ?? null,
                    location ?? null,
                    phone ?? null,
                    email ?? null,
                    industry ?? null,
                    notes ?? null,
                    priority,
                    sort
                ]
            );

            sendSuccess(res, transformLead(result.rows[0]), 'Lead created successfully');
        } catch (err) {
            console.error('Error creating lead:', err);
            sendError(res, 500, 'Failed to create lead');
        }
    });

    /** PUT /:id */
    router.put('/:id', validateBody(schemas.leadUpdate), async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (Number.isNaN(id)) return sendError(res, 400, 'Invalid id');

            const existing = await pool.query(
                'SELECT * FROM sales_leads WHERE id = $1 AND deleted_at IS NULL',
                [id]
            );
            if (existing.rows.length === 0) {
                return sendError(res, 404, 'Lead not found');
            }

            const cur = existing.rows[0];
            const b = req.validatedBody;

            const name = b.name !== undefined ? b.name.trim() : cur.name;
            const segment = b.segment !== undefined ? b.segment : cur.segment;
            const location = b.location !== undefined ? b.location : cur.location;
            const phone = b.phone !== undefined ? b.phone : cur.phone;
            const email = b.email !== undefined ? b.email : cur.email;
            const industry = b.industry !== undefined ? b.industry : cur.industry;
            const notes = b.notes !== undefined ? b.notes : cur.notes;
            const priorityTarget =
                b.priorityTarget !== undefined ? (b.priorityTarget ? 1 : 0) : cur.priority_target;
            const sortOrder = b.sortOrder !== undefined ? b.sortOrder : cur.sort_order;

            const result = await pool.query(
                `UPDATE sales_leads SET
                    name = $1, segment = $2, location = $3, phone = $4, email = $5,
                    industry = $6, notes = $7, priority_target = $8, sort_order = $9,
                    updated_at = datetime('now')
                WHERE id = $10 AND deleted_at IS NULL
                RETURNING *`,
                [
                    name,
                    segment,
                    location,
                    phone,
                    email,
                    industry,
                    notes,
                    priorityTarget,
                    sortOrder,
                    id
                ]
            );

            sendSuccess(res, transformLead(result.rows[0]), 'Lead updated successfully');
        } catch (err) {
            console.error('Error updating lead:', err);
            sendError(res, 500, 'Failed to update lead');
        }
    });

    /** DELETE /:id/permanent — before generic DELETE /:id */
    router.delete('/:id/permanent', requireAdmin, async (req, res) => {
        try {
            const leadId = parseInt(req.params.id, 10);
            if (Number.isNaN(leadId)) return sendError(res, 400, 'Invalid id');

            const check = await pool.query(
                'SELECT id FROM sales_leads WHERE id = $1 AND deleted_at IS NOT NULL',
                [leadId]
            );
            if (check.rows.length === 0) {
                return sendError(res, 404, 'Archived lead not found');
            }

            await pool.query('DELETE FROM sales_leads WHERE id = $1 AND deleted_at IS NOT NULL', [leadId]);

            sendSuccess(res, { id: leadId }, 'Lead permanently deleted');
        } catch (err) {
            console.error('Error permanently deleting lead:', err);
            sendError(res, 500, 'Failed to permanently delete lead');
        }
    });

    /** DELETE /:id — soft delete */
    router.delete('/:id', async (req, res) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (Number.isNaN(id)) return sendError(res, 400, 'Invalid id');

            const result = await pool.query(
                `UPDATE sales_leads SET deleted_at = datetime('now'), is_active = 0, updated_at = datetime('now')
                 WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
                [id]
            );

            if (result.rows.length === 0) {
                return sendError(res, 404, 'Lead not found');
            }

            sendSuccess(res, { id }, 'Lead archived successfully');
        } catch (err) {
            console.error('Error deleting lead:', err);
            sendError(res, 500, 'Failed to archive lead');
        }
    });

    return router;
};
