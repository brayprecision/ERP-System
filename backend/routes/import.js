/**
 * Data Import API Routes for BPERP
 * Supports CSV and Excel file imports for customers, inventory, and other entities
 */

const express = require('express');
const multer = require('multer');
const Papa = require('papaparse');
const XLSX = require('xlsx');

module.exports = function(pool) {
    const router = express.Router();

    // Configure multer for file uploads (in-memory storage)
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limit
        },
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'text/csv',
                'text/plain',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ];
            if (allowedMimes.includes(file.mimetype) || 
                file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
                cb(null, true);
            } else {
                cb(new Error('Only CSV and Excel files are allowed'));
            }
        }
    });

    // ==================== FIELD MAPPINGS ====================
    
    /**
     * Define expected fields and their mappings for each entity type
     * Keys are normalized (lowercase, no spaces/underscores)
     */
    const FIELD_MAPPINGS = {
        customers: {
            required: ['name'],
            fields: {
                // Database field: [possible CSV column names]
                name: ['name', 'customername', 'customer', 'companyname', 'company'],
                address: ['address', 'streetaddress', 'street', 'location'],
                phone: ['phone', 'phonenumber', 'telephone', 'tel', 'contact'],
                terms: ['terms', 'paymentterms', 'payment'],
                notes: ['notes', 'comments', 'description']
            }
        },
        contacts: {
            required: ['name', 'customer_id'],
            fields: {
                name: ['name', 'contactname', 'fullname', 'contact'],
                email: ['email', 'emailaddress', 'mail'],
                phone: ['phone', 'phonenumber', 'telephone', 'tel', 'mobile'],
                role: ['role', 'title', 'jobtitle', 'position'],
                customer_id: ['customerid', 'customer', 'companyid']
            }
        },
        materials: {
            required: ['name'],
            fields: {
                name: ['name', 'materialname', 'itemname', 'description'],
                part_number: ['partnumber', 'partno', 'sku', 'itemnumber', 'itemno', 'pn'],
                category: ['category', 'type', 'group', 'class'],
                description: ['description', 'desc', 'notes'],
                qty_on_hand: ['qtyonhand', 'quantity', 'qty', 'stock', 'onhand', 'instock'],
                minimum_qty: ['minimumqty', 'minqty', 'reorderpoint', 'minstock'],
                unit: ['unit', 'uom', 'unitofmeasure'],
                supplier: ['supplier', 'vendor', 'manufacturer'],
                unit_price: ['unitprice', 'price', 'cost', 'unitcost'],
                location: ['location', 'bin', 'shelf', 'warehouse']
            }
        },
        tooling: {
            required: ['name'],
            fields: {
                name: ['name', 'toolname', 'itemname', 'description'],
                part_number: ['partnumber', 'partno', 'sku', 'itemnumber', 'pn'],
                category: ['category', 'type', 'tooltype'],
                description: ['description', 'desc', 'notes'],
                qty_on_hand: ['qtyonhand', 'quantity', 'qty', 'stock', 'onhand'],
                minimum_qty: ['minimumqty', 'minqty', 'reorderpoint'],
                unit: ['unit', 'uom'],
                supplier: ['supplier', 'vendor', 'manufacturer'],
                unit_price: ['unitprice', 'price', 'cost'],
                location: ['location', 'bin', 'crib'],
                condition: ['condition', 'status', 'state']
            }
        },
        workcenters: {
            required: ['name', 'type'],
            fields: {
                name: ['name', 'workcentername', 'stationname'],
                type: ['type', 'workcentertype', 'category'],
                description: ['description', 'desc', 'notes'],
                location: ['location', 'area'],
                capacity: ['capacity', 'slots', 'positions']
            }
        },
        machines: {
            required: ['name', 'type'],
            fields: {
                name: ['name', 'machinename', 'equipmentname'],
                machine_id: ['machineid', 'equipmentid', 'assetid', 'assettag'],
                type: ['type', 'machinetype', 'equipmenttype', 'category'],
                manufacturer: ['manufacturer', 'make', 'brand', 'oem'],
                model: ['model', 'modelnumber', 'modelno'],
                serial_number: ['serialnumber', 'serial', 'sn'],
                year_installed: ['yearinstalled', 'year', 'installyear', 'purchaseyear'],
                location: ['location', 'area', 'bay'],
                maintenance_interval_hours: ['maintenanceintervalhours', 'pmhours', 'servicehours'],
                maintenance_interval_days: ['maintenanceintervaldays', 'pmdays', 'servicedays'],
                notes: ['notes', 'comments', 'description']
            }
        }
    };

    // ==================== HELPER FUNCTIONS ====================

    /**
     * Normalize a column header for matching
     */
    function normalizeHeader(header) {
        return (header || '')
            .toLowerCase()
            .replace(/[_\s-]+/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    /**
     * Parse file content based on type
     */
    function parseFile(buffer, filename) {
        const ext = filename.toLowerCase().split('.').pop();
        
        if (ext === 'csv') {
            const text = buffer.toString('utf-8');
            const result = Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                transformHeader: h => h.trim()
            });
            return result.data;
        } else if (ext === 'xlsx' || ext === 'xls') {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            return XLSX.utils.sheet_to_json(firstSheet);
        }
        
        throw new Error('Unsupported file format');
    }

    /**
     * Map CSV/Excel columns to database fields
     */
    function mapColumns(data, entityType) {
        const mapping = FIELD_MAPPINGS[entityType];
        if (!mapping) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        if (data.length === 0) {
            return { mappedData: [], columnMap: {}, unmappedColumns: [] };
        }

        // Get headers from first row
        const headers = Object.keys(data[0]);
        const normalizedHeaders = headers.map(normalizeHeader);
        
        // Build column mapping
        const columnMap = {};
        const unmappedColumns = [];
        
        for (const header of headers) {
            const normalized = normalizeHeader(header);
            let mapped = false;
            
            for (const [dbField, aliases] of Object.entries(mapping.fields)) {
                if (aliases.includes(normalized)) {
                    columnMap[header] = dbField;
                    mapped = true;
                    break;
                }
            }
            
            if (!mapped) {
                unmappedColumns.push(header);
            }
        }

        // Transform data
        const mappedData = data.map((row, index) => {
            const mappedRow = { _rowNumber: index + 2 }; // +2 for 1-based + header row
            
            for (const [originalCol, dbField] of Object.entries(columnMap)) {
                let value = row[originalCol];
                
                // Type conversions
                if (value !== undefined && value !== null && value !== '') {
                    if (dbField.includes('qty') || dbField.includes('quantity') || 
                        dbField === 'capacity' || dbField.includes('interval') ||
                        dbField === 'year_installed') {
                        value = parseInt(value, 10) || 0;
                    } else if (dbField.includes('price') || dbField.includes('cost')) {
                        value = parseFloat(String(value).replace(/[$,]/g, '')) || 0;
                    } else {
                        value = String(value).trim();
                    }
                }
                
                mappedRow[dbField] = value;
            }
            
            return mappedRow;
        });

        return { mappedData, columnMap, unmappedColumns };
    }

    /**
     * Validate mapped data
     */
    function validateData(mappedData, entityType) {
        const mapping = FIELD_MAPPINGS[entityType];
        const errors = [];
        const validRows = [];

        for (const row of mappedData) {
            const rowErrors = [];
            
            // Check required fields
            for (const field of mapping.required) {
                if (!row[field] || (typeof row[field] === 'string' && !row[field].trim())) {
                    rowErrors.push(`Missing required field: ${field}`);
                }
            }

            if (rowErrors.length > 0) {
                errors.push({
                    row: row._rowNumber,
                    errors: rowErrors
                });
            } else {
                validRows.push(row);
            }
        }

        return { validRows, errors };
    }

    // ==================== PREVIEW ENDPOINT ====================

    /**
     * POST /api/import/preview
     * Preview import data without committing
     */
    router.post('/preview', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const entityType = req.body.entityType;
            if (!FIELD_MAPPINGS[entityType]) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Invalid entity type. Supported: ${Object.keys(FIELD_MAPPINGS).join(', ')}` 
                });
            }

            // Parse file
            const data = parseFile(req.file.buffer, req.file.originalname);
            
            if (data.length === 0) {
                return res.status(400).json({ success: false, error: 'File contains no data' });
            }

            // Map columns
            const { mappedData, columnMap, unmappedColumns } = mapColumns(data, entityType);
            
            // Validate
            const { validRows, errors } = validateData(mappedData, entityType);

            res.json({
                success: true,
                data: {
                    entityType,
                    filename: req.file.originalname,
                    totalRows: data.length,
                    validRows: validRows.length,
                    errorRows: errors.length,
                    columnMapping: columnMap,
                    unmappedColumns,
                    preview: validRows.slice(0, 10), // First 10 valid rows
                    errors: errors.slice(0, 20), // First 20 errors
                    requiredFields: FIELD_MAPPINGS[entityType].required,
                    availableFields: Object.keys(FIELD_MAPPINGS[entityType].fields)
                }
            });
        } catch (error) {
            console.error('Import preview error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== IMPORT ENDPOINTS ====================

    /**
     * POST /api/import/customers
     * Import customers from CSV/Excel
     */
    router.post('/customers', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const data = parseFile(req.file.buffer, req.file.originalname);
            const { mappedData, columnMap, unmappedColumns } = mapColumns(data, 'customers');
            const { validRows, errors } = validateData(mappedData, 'customers');

            if (validRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid rows to import',
                    validationErrors: errors
                });
            }

            // Import valid rows
            const imported = [];
            const importErrors = [];

            for (const row of validRows) {
                try {
                    const result = await pool.query(`
                        INSERT INTO customers (name, address, phone, terms, notes)
                        VALUES ($1, $2, $3, $4, $5)
                        ON CONFLICT DO NOTHING
                        RETURNING id, name
                    `, [row.name, row.address, row.phone, row.terms, row.notes]);

                    if (result.rows.length > 0) {
                        imported.push(result.rows[0]);
                    }
                } catch (err) {
                    importErrors.push({ row: row._rowNumber, error: err.message });
                }
            }

            res.json({
                success: true,
                data: {
                    imported: imported.length,
                    skipped: validRows.length - imported.length,
                    validationErrors: errors.length,
                    importErrors: importErrors.length,
                    details: {
                        importedRecords: imported.slice(0, 20),
                        validationErrors: errors.slice(0, 10),
                        importErrors: importErrors.slice(0, 10)
                    }
                }
            });
        } catch (error) {
            console.error('Import customers error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * POST /api/import/materials
     * Import materials/inventory from CSV/Excel
     */
    router.post('/materials', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const data = parseFile(req.file.buffer, req.file.originalname);
            const { mappedData } = mapColumns(data, 'materials');
            const { validRows, errors } = validateData(mappedData, 'materials');

            if (validRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid rows to import',
                    validationErrors: errors
                });
            }

            const imported = [];
            const importErrors = [];

            for (const row of validRows) {
                try {
                    const result = await pool.query(`
                        INSERT INTO materials (name, part_number, category, description, qty_on_hand, minimum_qty, unit, supplier, unit_price, location)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING id, name, part_number
                    `, [
                        row.name, row.part_number, row.category, row.description,
                        row.qty_on_hand || 0, row.minimum_qty || 0, row.unit || 'EA',
                        row.supplier, row.unit_price || 0, row.location
                    ]);

                    imported.push(result.rows[0]);
                } catch (err) {
                    importErrors.push({ row: row._rowNumber, error: err.message });
                }
            }

            res.json({
                success: true,
                data: {
                    imported: imported.length,
                    validationErrors: errors.length,
                    importErrors: importErrors.length,
                    details: {
                        importedRecords: imported.slice(0, 20),
                        validationErrors: errors.slice(0, 10),
                        importErrors: importErrors.slice(0, 10)
                    }
                }
            });
        } catch (error) {
            console.error('Import materials error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * POST /api/import/tooling
     * Import tooling from CSV/Excel
     */
    router.post('/tooling', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const data = parseFile(req.file.buffer, req.file.originalname);
            const { mappedData } = mapColumns(data, 'tooling');
            const { validRows, errors } = validateData(mappedData, 'tooling');

            if (validRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid rows to import',
                    validationErrors: errors
                });
            }

            const imported = [];
            const importErrors = [];

            for (const row of validRows) {
                try {
                    const result = await pool.query(`
                        INSERT INTO tooling (name, part_number, category, description, qty_on_hand, minimum_qty, unit, supplier, unit_price, location, condition)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        RETURNING id, name, part_number
                    `, [
                        row.name, row.part_number, row.category, row.description,
                        row.qty_on_hand || 0, row.minimum_qty || 0, row.unit || 'EA',
                        row.supplier, row.unit_price || 0, row.location, row.condition
                    ]);

                    imported.push(result.rows[0]);
                } catch (err) {
                    importErrors.push({ row: row._rowNumber, error: err.message });
                }
            }

            res.json({
                success: true,
                data: {
                    imported: imported.length,
                    validationErrors: errors.length,
                    importErrors: importErrors.length,
                    details: {
                        importedRecords: imported.slice(0, 20),
                        validationErrors: errors.slice(0, 10),
                        importErrors: importErrors.slice(0, 10)
                    }
                }
            });
        } catch (error) {
            console.error('Import tooling error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * POST /api/import/workcenters
     * Import workcenters from CSV/Excel
     */
    router.post('/workcenters', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const data = parseFile(req.file.buffer, req.file.originalname);
            const { mappedData } = mapColumns(data, 'workcenters');
            const { validRows, errors } = validateData(mappedData, 'workcenters');

            if (validRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid rows to import',
                    validationErrors: errors
                });
            }

            const imported = [];
            const importErrors = [];

            for (const row of validRows) {
                try {
                    const result = await pool.query(`
                        INSERT INTO workcenters (name, type, description, location, capacity, is_active)
                        VALUES ($1, $2, $3, $4, $5, TRUE)
                        RETURNING id, name, type
                    `, [row.name, row.type, row.description, row.location, row.capacity || 1]);

                    imported.push(result.rows[0]);
                } catch (err) {
                    importErrors.push({ row: row._rowNumber, error: err.message });
                }
            }

            res.json({
                success: true,
                data: {
                    imported: imported.length,
                    validationErrors: errors.length,
                    importErrors: importErrors.length,
                    details: {
                        importedRecords: imported.slice(0, 20),
                        validationErrors: errors.slice(0, 10),
                        importErrors: importErrors.slice(0, 10)
                    }
                }
            });
        } catch (error) {
            console.error('Import workcenters error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * POST /api/import/machines
     * Import machines from CSV/Excel
     */
    router.post('/machines', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const data = parseFile(req.file.buffer, req.file.originalname);
            const { mappedData } = mapColumns(data, 'machines');
            const { validRows, errors } = validateData(mappedData, 'machines');

            if (validRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid rows to import',
                    validationErrors: errors
                });
            }

            const imported = [];
            const importErrors = [];

            for (const row of validRows) {
                try {
                    const result = await pool.query(`
                        INSERT INTO machines (
                            name, machine_id, type, manufacturer, model, serial_number,
                            year_installed, location, maintenance_interval_hours, maintenance_interval_days,
                            notes, is_active
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)
                        RETURNING id, name, machine_id
                    `, [
                        row.name, row.machine_id, row.type, row.manufacturer, row.model,
                        row.serial_number, row.year_installed, row.location,
                        row.maintenance_interval_hours, row.maintenance_interval_days, row.notes
                    ]);

                    imported.push(result.rows[0]);
                } catch (err) {
                    importErrors.push({ row: row._rowNumber, error: err.message });
                }
            }

            res.json({
                success: true,
                data: {
                    imported: imported.length,
                    validationErrors: errors.length,
                    importErrors: importErrors.length,
                    details: {
                        importedRecords: imported.slice(0, 20),
                        validationErrors: errors.slice(0, 10),
                        importErrors: importErrors.slice(0, 10)
                    }
                }
            });
        } catch (error) {
            console.error('Import machines error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ==================== TEMPLATE ENDPOINTS ====================

    /**
     * GET /api/import/template/:entityType
     * Download a CSV template for the given entity type
     */
    router.get('/template/:entityType', (req, res) => {
        const entityType = req.params.entityType;
        const mapping = FIELD_MAPPINGS[entityType];

        if (!mapping) {
            return res.status(400).json({
                success: false,
                error: `Invalid entity type. Supported: ${Object.keys(FIELD_MAPPINGS).join(', ')}`
            });
        }

        // Create header row from field names
        const headers = Object.keys(mapping.fields);
        const csv = Papa.unparse({
            fields: headers,
            data: []
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${entityType}_template.csv"`);
        res.send(csv);
    });

    /**
     * GET /api/import/supported-types
     * List all supported import types and their fields
     */
    router.get('/supported-types', (req, res) => {
        const types = Object.entries(FIELD_MAPPINGS).map(([type, mapping]) => ({
            type,
            requiredFields: mapping.required,
            availableFields: Object.keys(mapping.fields),
            fieldAliases: mapping.fields
        }));

        res.json({ success: true, data: types });
    });

    return router;
};
