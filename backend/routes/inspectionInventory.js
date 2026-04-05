/**
 * Inspection tool inventory (gages / metrology) — CRUD, PDF attachments, calibration reminders.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const { validateBody, validateParams, validateQuery, schemas } = require('../middleware/validation');
const {
    recomputeNextDue,
    completeOpenCalibrationTasksForTool,
    syncCalibrationReminders,
    CALIBRATION_TASK_TYPE,
    parseTaskData
} = require('../services/calibrationReminders');

function getUploadsDir() {
    const base = process.env.INSPECTION_TOOL_UPLOADS_DIR || path.join(__dirname, '..', 'uploads', 'inspection-tools');
    return base;
}

function ensureUploadsDir() {
    const dir = getUploadsDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function transformAsset(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        assetTag: row.asset_tag,
        manufacturer: row.manufacturer,
        model: row.model,
        serialNumber: row.serial_number,
        location: row.location,
        traceabilityNote: row.traceability_note,
        notes: row.notes,
        lastCalibrationDate: row.last_calibration_date,
        calibrationIntervalDays: row.calibration_interval_days,
        nextCalibrationDue: row.next_calibration_due,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdBy: row.created_by
    };
}

function transformDocument(row) {
    if (!row) return null;
    return {
        id: row.id,
        inspectionToolId: row.inspection_tool_id,
        title: row.title,
        documentType: row.document_type,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        fileSize: row.file_size,
        uploadedAt: row.uploaded_at,
        uploadedBy: row.uploaded_by
    };
}

module.exports = function (pool) {
    const router = express.Router();
    const { requireAuth } = require('../middleware/auth')(pool);
    router.use(requireAuth);

    ensureUploadsDir();

    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ok =
                /^application\/pdf$/i.test(file.mimetype) ||
                /^image\/(jpeg|png|webp)$/i.test(file.mimetype);
            if (ok) cb(null, true);
            else cb(new Error('Only PDF and images (JPEG, PNG, WebP) are allowed'));
        }
    });

    // ---------- List tools ----------
    router.get('/tools', validateQuery(schemas.inspectionToolListQuery), async (req, res) => {
        try {
            const q = req.validatedQuery || {};
            const search = (q.search || '').trim();
            const dueSoon = q.dueSoon === 'true';

            let sql = 'SELECT * FROM inspection_tool_assets WHERE 1=1';
            const params = [];

            if (search) {
                const term = `%${search}%`;
                sql += ` AND (
                    name LIKE $1 OR COALESCE(asset_tag,'') LIKE $1 OR COALESCE(manufacturer,'') LIKE $1
                    OR COALESCE(model,'') LIKE $1 OR COALESCE(serial_number,'') LIKE $1
                )`;
                params.push(term);
            }

            if (dueSoon) {
                const lead = parseInt(process.env.CALIBRATION_REMINDER_DAYS || '30', 10) || 30;
                sql += ` AND next_calibration_due IS NOT NULL AND TRIM(next_calibration_due) != ''
                    AND date(next_calibration_due) <= date('now', '+${lead} days')`;
            }

            sql += ' ORDER BY name ASC';

            const result = await pool.query(sql, params);
            res.json({ success: true, data: result.rows.map(transformAsset) });
        } catch (err) {
            console.error('inspection-inventory list error:', err);
            res.status(500).json({ success: false, error: 'Failed to list inspection tools' });
        }
    });

    // ---------- Single tool + documents ----------
    router.get('/tools/:id', validateParams(schemas.idParam), async (req, res) => {
        try {
            const { id } = req.params;
            const asset = await pool.query('SELECT * FROM inspection_tool_assets WHERE id = $1', [id]);
            if (asset.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Inspection tool not found' });
            }
            const docs = await pool.query(
                'SELECT * FROM inspection_tool_documents WHERE inspection_tool_id = $1 ORDER BY uploaded_at DESC',
                [id]
            );
            res.json({
                success: true,
                data: {
                    ...transformAsset(asset.rows[0]),
                    documents: docs.rows.map(transformDocument)
                }
            });
        } catch (err) {
            console.error('inspection-inventory get error:', err);
            res.status(500).json({ success: false, error: 'Failed to load inspection tool' });
        }
    });

    // ---------- Create ----------
    router.post('/tools', validateBody(schemas.inspectionToolCreate), async (req, res) => {
        try {
            const b = req.body;
            let nextDue = recomputeNextDue(b.lastCalibrationDate, b.calibrationIntervalDays);
            if (b.lastCalibrationDate && !nextDue) {
                nextDue = null;
            }

            const result = await pool.query(
                `
                INSERT INTO inspection_tool_assets (
                    name, asset_tag, manufacturer, model, serial_number, location,
                    traceability_note, notes, last_calibration_date, calibration_interval_days,
                    next_calibration_due, created_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, datetime('now'), datetime('now'))
                RETURNING *
            `,
                [
                    b.name,
                    b.assetTag ?? null,
                    b.manufacturer ?? null,
                    b.model ?? null,
                    b.serialNumber ?? null,
                    b.location ?? null,
                    b.traceabilityNote ?? null,
                    b.notes ?? null,
                    b.lastCalibrationDate ?? null,
                    b.calibrationIntervalDays ?? null,
                    nextDue,
                    req.user?.id ?? null
                ]
            );

            const row = result.rows[0];
            await syncCalibrationReminders(pool);

            res.status(201).json({ success: true, data: transformAsset(row) });
        } catch (err) {
            console.error('inspection-inventory create error:', err);
            res.status(500).json({ success: false, error: 'Failed to create inspection tool' });
        }
    });

    // ---------- Update ----------
    router.put('/tools/:id', validateParams(schemas.idParam), validateBody(schemas.inspectionToolUpdate), async (req, res) => {
        try {
            const { id } = req.params;
            const existing = await pool.query('SELECT * FROM inspection_tool_assets WHERE id = $1', [id]);
            if (existing.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Inspection tool not found' });
            }

            const cur = existing.rows[0];
            const b = req.body;

            const name = b.name !== undefined ? b.name : cur.name;
            const assetTag = b.assetTag !== undefined ? b.assetTag : cur.asset_tag;
            const manufacturer = b.manufacturer !== undefined ? b.manufacturer : cur.manufacturer;
            const model = b.model !== undefined ? b.model : cur.model;
            const serialNumber = b.serialNumber !== undefined ? b.serialNumber : cur.serial_number;
            const location = b.location !== undefined ? b.location : cur.location;
            const traceabilityNote = b.traceabilityNote !== undefined ? b.traceabilityNote : cur.traceability_note;
            const notes = b.notes !== undefined ? b.notes : cur.notes;
            const lastCal =
                b.lastCalibrationDate !== undefined ? b.lastCalibrationDate : cur.last_calibration_date;
            const interval =
                b.calibrationIntervalDays !== undefined
                    ? b.calibrationIntervalDays
                    : cur.calibration_interval_days;

            let nextDue = recomputeNextDue(lastCal, interval);
            if (lastCal && interval == null) {
                nextDue = cur.next_calibration_due;
            }

            const calibrationRecorded =
                b.lastCalibrationDate !== undefined || b.calibrationIntervalDays !== undefined;

            await pool.query(
                `
                UPDATE inspection_tool_assets SET
                    name = $1, asset_tag = $2, manufacturer = $3, model = $4, serial_number = $5,
                    location = $6, traceability_note = $7, notes = $8,
                    last_calibration_date = $9, calibration_interval_days = $10, next_calibration_due = $11,
                    updated_at = datetime('now')
                WHERE id = $12
            `,
                [
                    name,
                    assetTag,
                    manufacturer,
                    model,
                    serialNumber,
                    location,
                    traceabilityNote,
                    notes,
                    lastCal,
                    interval,
                    nextDue,
                    id
                ]
            );

            if (calibrationRecorded) {
                await completeOpenCalibrationTasksForTool(pool, id);
            }

            await syncCalibrationReminders(pool);

            const updated = await pool.query('SELECT * FROM inspection_tool_assets WHERE id = $1', [id]);
            res.json({ success: true, data: transformAsset(updated.rows[0]) });
        } catch (err) {
            console.error('inspection-inventory update error:', err);
            res.status(500).json({ success: false, error: 'Failed to update inspection tool' });
        }
    });

    // ---------- Delete tool ----------
    router.delete('/tools/:id', validateParams(schemas.idParam), async (req, res) => {
        try {
            const { id } = req.params;
            const docs = await pool.query(
                'SELECT * FROM inspection_tool_documents WHERE inspection_tool_id = $1',
                [id]
            );
            const uploadDir = ensureUploadsDir();
            for (const d of docs.rows) {
                const fp = path.join(uploadDir, d.stored_filename);
                try {
                    if (fs.existsSync(fp)) fs.unlinkSync(fp);
                } catch (e) {
                    console.warn('Could not delete file', fp, e.message);
                }
            }

            const del = await pool.query('DELETE FROM inspection_tool_assets WHERE id = $1 RETURNING id', [id]);
            if (del.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Inspection tool not found' });
            }

            await completeOpenCalibrationTasksForTool(pool, id);

            res.json({ success: true, message: 'Inspection tool deleted' });
        } catch (err) {
            console.error('inspection-inventory delete error:', err);
            res.status(500).json({ success: false, error: 'Failed to delete inspection tool' });
        }
    });

    // ---------- Upload document ----------
    router.post(
        '/tools/:id/documents',
        validateParams(schemas.idParam),
        (req, res, next) => {
            upload.single('file')(req, res, (err) => {
                if (err) {
                    return res.status(400).json({ success: false, error: err.message || 'Upload failed' });
                }
                next();
            });
        },
        async (req, res) => {
            try {
                const { id } = req.params;
                const tool = await pool.query('SELECT id FROM inspection_tool_assets WHERE id = $1', [id]);
                if (tool.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'Inspection tool not found' });
                }

                const file = req.file;
                if (!file || !file.buffer) {
                    return res.status(400).json({ success: false, error: 'File is required (field name: file)' });
                }

                const title = (req.body.title || file.originalname || 'Document').trim().slice(0, 200);
                const documentType = ['calibration_cert', 'traceability', 'other'].includes(req.body.documentType)
                    ? req.body.documentType
                    : 'other';

                const ext = path.extname(file.originalname || '') || (file.mimetype.includes('pdf') ? '.pdf' : '');
                const storedFilename = `${crypto.randomUUID()}${ext}`;
                const uploadDir = ensureUploadsDir();
                const dest = path.join(uploadDir, storedFilename);
                fs.writeFileSync(dest, file.buffer);

                const ins = await pool.query(
                    `
                    INSERT INTO inspection_tool_documents (
                        inspection_tool_id, title, document_type, original_filename, stored_filename,
                        mime_type, file_size, uploaded_by, uploaded_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))
                    RETURNING *
                `,
                    [
                        id,
                        title,
                        documentType,
                        file.originalname || 'file',
                        storedFilename,
                        file.mimetype,
                        file.size,
                        req.user?.id ?? null
                    ]
                );

                res.status(201).json({ success: true, data: transformDocument(ins.rows[0]) });
            } catch (err) {
                console.error('inspection-inventory document upload error:', err);
                res.status(500).json({ success: false, error: 'Failed to upload document' });
            }
        }
    );

    // ---------- Download document file ----------
    router.get(
        '/tools/:id/documents/:docId/file',
        validateParams(schemas.inspectionToolDocParams),
        async (req, res) => {
            try {
                const { id, docId } = req.params;
                const r = await pool.query(
                    'SELECT * FROM inspection_tool_documents WHERE id = $1 AND inspection_tool_id = $2',
                    [docId, id]
                );
                if (r.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'Document not found' });
                }
                const doc = r.rows[0];
                const uploadDir = ensureUploadsDir();
                const fp = path.join(uploadDir, doc.stored_filename);
                if (!fs.existsSync(fp)) {
                    return res.status(404).json({ success: false, error: 'File missing on server' });
                }

                const mime = doc.mime_type || 'application/octet-stream';
                res.setHeader('Content-Type', mime);
                res.setHeader(
                    'Content-Disposition',
                    `inline; filename="${encodeURIComponent(doc.original_filename || 'document')}"`
                );
                return res.sendFile(path.resolve(fp));
            } catch (err) {
                console.error('inspection-inventory file download error:', err);
                res.status(500).json({ success: false, error: 'Failed to download file' });
            }
        }
    );

    // ---------- Delete document ----------
    router.delete(
        '/tools/:id/documents/:docId',
        validateParams(schemas.inspectionToolDocParams),
        async (req, res) => {
            try {
                const { id, docId } = req.params;
                const r = await pool.query(
                    'SELECT * FROM inspection_tool_documents WHERE id = $1 AND inspection_tool_id = $2',
                    [docId, id]
                );
                if (r.rows.length === 0) {
                    return res.status(404).json({ success: false, error: 'Document not found' });
                }
                const doc = r.rows[0];
                const uploadDir = ensureUploadsDir();
                const fp = path.join(uploadDir, doc.stored_filename);
                try {
                    if (fs.existsSync(fp)) fs.unlinkSync(fp);
                } catch (e) {
                    console.warn('unlink document file', e.message);
                }

                await pool.query('DELETE FROM inspection_tool_documents WHERE id = $1', [docId]);
                res.json({ success: true, message: 'Document removed' });
            } catch (err) {
                console.error('inspection-inventory document delete error:', err);
                res.status(500).json({ success: false, error: 'Failed to delete document' });
            }
        }
    );

    // ---------- Sync reminders (manual) ----------
    router.post('/sync-calibration-reminders', async (req, res) => {
        try {
            const result = await syncCalibrationReminders(pool);
            res.json({ success: true, data: result });
        } catch (err) {
            console.error('sync calibration reminders error:', err);
            res.status(500).json({ success: false, error: 'Failed to sync calibration reminders' });
        }
    });

    // ---------- Calibration reminders list (open tasks + tool info) ----------
    router.get('/calibration-reminders', async (req, res) => {
        try {
            const tasksRes = await pool.query(
                `
                SELECT * FROM tasks
                WHERE deleted_at IS NULL AND type = $1 AND status != 'Complete'
                ORDER BY due_date IS NULL, due_date ASC
            `,
                [CALIBRATION_TASK_TYPE]
            );

            const reminders = [];
            for (const row of tasksRes.rows) {
                const data = parseTaskData(row.task_data);
                if (data.kind !== 'calibration_reminder' || data.inspectionToolId == null) continue;

                const toolRes = await pool.query(
                    'SELECT id, name, asset_tag, next_calibration_due FROM inspection_tool_assets WHERE id = $1',
                    [data.inspectionToolId]
                );
                const tool = toolRes.rows[0];
                reminders.push({
                    taskId: row.id,
                    title: row.title,
                    status: row.status,
                    dueDate: row.due_date,
                    priority: row.priority,
                    inspectionToolId: data.inspectionToolId,
                    toolName: tool ? tool.name : null,
                    assetTag: tool ? tool.asset_tag : null,
                    nextCalibrationDue: tool ? tool.next_calibration_due : null
                });
            }

            res.json({ success: true, data: reminders });
        } catch (err) {
            console.error('calibration-reminders list error:', err);
            res.status(500).json({ success: false, error: 'Failed to load calibration reminders' });
        }
    });

    return router;
};
