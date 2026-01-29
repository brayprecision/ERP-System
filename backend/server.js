// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Import rate limiters
const { apiLimiter, exportLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - restrict origins in production
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*', // Set CORS_ORIGIN env var in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Limit request body size

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Database Connection Configuration
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'airshop',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to database:', err.stack);
    } else {
        console.log('Connected to PostgreSQL database');
        release();
    }
});

// Import routes
const inventoryRoutes = require('./routes/inventory')(pool);
const customerRoutes = require('./routes/customers')(pool);
const quoteRoutes = require('./routes/quotes')(pool);
const workOrderRoutes = require('./routes/workorders')(pool);
const usersRoutes = require('./routes/users')(pool);

// Tasks module routes (now using PostgreSQL)
const tasksRoutes = require('./routes/tasks')(pool);
const workcentersRoutes = require('./routes/workcenters')(pool);
const machinesRoutes = require('./routes/machines')(pool);
const maintenanceRoutes = require('./routes/maintenance')(pool);
const ordersRoutes = require('./routes/orders')(pool);

// Data import routes
const importRoutes = require('./routes/import')(pool);

// --- API ROUTES ---

// Mount routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/users', usersRoutes);

// Tasks module routes (now using PostgreSQL)
app.use('/api/tasks', tasksRoutes);
app.use('/api/workcenters', workcentersRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/orders', ordersRoutes);

// Data import routes
app.use('/api/import', importRoutes);

// 1. Get Quote Stats (For the "Quotes in March" card)
app.get('/api/quotes/stats', async (req, res) => {
    try {
        // Run three queries in parallel to count statuses
        const won = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Won'");
        const lost = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Lost'");
        const sent = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Sent'");
        const revenue = await pool.query("SELECT SUM(total_amount) FROM quotes WHERE status = 'Won'");

        res.json({
            won: parseInt(won.rows[0].count),
            lost: parseInt(lost.rows[0].count),
            sent: parseInt(sent.rows[0].count),
            revenue: parseFloat(revenue.rows[0].sum || 0)
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// 2. Get Win Rate (For the "Win Rate" card)
app.get('/api/quotes/win-rate', async (req, res) => {
    try {
        const total = await pool.query("SELECT COUNT(*) FROM quotes");
        const won = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Won'");
        
        const totalCount = parseInt(total.rows[0].count);
        const wonCount = parseInt(won.rows[0].count);
        
        // Avoid division by zero
        const rate = totalCount === 0 ? 0 : Math.round((wonCount / totalCount) * 100);

        res.json({ winRate: rate });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// 3. Get Inventory Alerts (For the "Inventory Alerts" card)
app.get('/api/inventory/alerts', async (req, res) => {
    try {
        // Fetch items where stock is below minimum from all inventory tables
        const alerts = [];
        
        // Check materials
        const materials = await pool.query(
            "SELECT id, name, qty_on_hand, minimum_qty, 'material' as category FROM materials WHERE qty_on_hand <= minimum_qty ORDER BY (qty_on_hand::float / NULLIF(minimum_qty, 0)) ASC LIMIT 5"
        );
        alerts.push(...materials.rows);
        
        // Check tooling
        const tools = await pool.query(
            "SELECT id, name, qty_on_hand, minimum_qty, 'tool' as category FROM tooling WHERE qty_on_hand <= minimum_qty ORDER BY (qty_on_hand::float / NULLIF(minimum_qty, 0)) ASC LIMIT 5"
        );
        alerts.push(...tools.rows);
        
        // Check misc items
        const misc = await pool.query(
            "SELECT id, name, qty_on_hand, minimum_qty, 'misc' as category FROM misc_items WHERE qty_on_hand <= minimum_qty ORDER BY (qty_on_hand::float / NULLIF(minimum_qty, 0)) ASC LIMIT 5"
        );
        alerts.push(...misc.rows);
        
        // Sort all alerts by urgency and limit to 5
        alerts.sort((a, b) => {
            const ratioA = a.minimum_qty > 0 ? a.qty_on_hand / a.minimum_qty : 999;
            const ratioB = b.minimum_qty > 0 ? b.qty_on_hand / b.minimum_qty : 999;
            return ratioA - ratioB;
        });
        
        // Transform for frontend compatibility
        const formattedAlerts = alerts.slice(0, 5).map(alert => ({
            id: alert.id,
            name: alert.name,
            stock_level: alert.qty_on_hand,
            minimum_qty: alert.minimum_qty,
            category: alert.category
        }));
        
        res.json(formattedAlerts);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== EXPORT ROUTES ====================

// Ensure export directories exist
const exportsDir = path.join(__dirname, '..', 'exports');
const csvDir = path.join(exportsDir, 'csv');
const backupsDir = path.join(exportsDir, 'backups');

if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
}
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
}

// Export customers to CSV
app.get('/api/export/customers', exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM customers ORDER BY name');
        const headers = ['id', 'name', 'address', 'phone', 'terms', 'openWOCount'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `customers_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Customers exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export customers error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Export quotes to CSV
app.get('/api/export/quotes', exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quotes ORDER BY quote_number');
        const headers = ['id', 'quote_number', 'customer_id', 'customer_name', 'part_number', 'description', 'quantity', 'status', 'requested_date', 'due_date', 'total_amount', 'sent_at'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `quotes_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Quotes exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export quotes error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Export work orders to CSV
app.get('/api/export/work-orders', exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM work_orders ORDER BY wo_number');
        const headers = ['id', 'wo_number', 'customer_id', 'customer_name', 'due_date', 'status', 'notes', 'completion_percentage'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `work-orders_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Work orders exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export work orders error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Export inventory (materials) to CSV
app.get('/api/export/inventory/materials', exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM materials ORDER BY name');
        const headers = ['id', 'name', 'part_number', 'category', 'qty_on_hand', 'minimum_qty', 'supplier', 'unit_price', 'last_ordered'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `materials_inventory_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Materials inventory exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export materials error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Export inventory (tooling) to CSV
app.get('/api/export/inventory/tooling', exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tooling ORDER BY name');
        const headers = ['id', 'name', 'part_number', 'category', 'qty_on_hand', 'minimum_qty', 'supplier', 'unit_price', 'last_ordered'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `tooling_inventory_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Tooling inventory exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export tooling error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Export inventory (misc items) to CSV
app.get('/api/export/inventory/misc', exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM misc_items ORDER BY name');
        const headers = ['id', 'name', 'part_number', 'category', 'qty_on_hand', 'minimum_qty', 'supplier', 'unit_price', 'last_ordered'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `misc_inventory_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Miscellaneous inventory exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export misc items error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Create backup
app.post('/api/backup/create', exportLimiter, async (req, res) => {
    try {
        // Get localStorage data passed from frontend (if available)
        const localStorageData = req.body.localStorage || {};
        
        // Collect all database data including archived work orders and quote-related tables
        // Helper to safely query tables that may not exist yet
        const safeQuery = async (query) => {
            try {
                return (await pool.query(query)).rows;
            } catch (e) {
                console.warn('Table not found for backup:', e.message);
                return [];
            }
        };
        
        const backupData = {
            timestamp: new Date().toISOString(),
            version: 'BPERP-v1.2',
            database: {
                customers: await safeQuery('SELECT * FROM customers'),
                contacts: await safeQuery('SELECT * FROM contacts'),
                quotes: await safeQuery('SELECT * FROM quotes'),
                quote_items: await safeQuery('SELECT * FROM quote_items'),
                quote_documents: await safeQuery('SELECT * FROM quote_documents'),
                work_orders: await safeQuery('SELECT * FROM work_orders'),
                work_order_archive: await safeQuery('SELECT * FROM work_order_archive'),
                wo_checklist: await safeQuery('SELECT * FROM wo_checklist'),
                materials: await safeQuery('SELECT * FROM materials'),
                tooling: await safeQuery('SELECT * FROM tooling'),
                misc_items: await safeQuery('SELECT * FROM misc_items'),
                tasks: await safeQuery('SELECT * FROM tasks'),
                // User profiles (includes appearance_settings and tab_permissions)
                users: await safeQuery('SELECT id, username, name, email, password_hash, role, appearance_settings, tab_permissions, is_active, last_login, created_at FROM users'),
                role_defaults: await safeQuery('SELECT * FROM role_defaults')
            },
            // Include localStorage data for offline/demo mode support
            localStorage: {
                quotes: localStorageData.quotes || null,
                quote_documents: localStorageData.quote_documents || null,
                work_orders: localStorageData.work_orders || null,
                wo_documents: localStorageData.wo_documents || null,
                archived_work_orders: localStorageData.archived_work_orders || null,
                customers: localStorageData.customers || null,
                materials: localStorageData.materials || null,
                tooling: localStorageData.tooling || null,
                misc_items: localStorageData.misc_items || null,
                misc_tasks: localStorageData.misc_tasks || null,
                // User profiles for offline mode
                users_list: localStorageData.users_list || null,
                // Theme and branding
                theme_preferences: localStorageData.theme_preferences || null,
                shop_branding: localStorageData.shop_branding || null
            }
        };

        const filename = `bperp_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(backupsDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');

        res.json({
            success: true,
            message: 'Backup created successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/backups/${filename}`
        });
    } catch (err) {
        console.error('Backup creation error:', err);
        res.status(500).json({ success: false, error: 'Backup failed' });
    }
});

// Restore from backup
app.post('/api/backup/restore', async (req, res) => {
    try {
        // This would require file upload handling - for now return not implemented
        res.status(501).json({
            success: false,
            error: 'Restore functionality requires file upload implementation'
        });
    } catch (err) {
        console.error('Backup restore error:', err);
        res.status(500).json({ success: false, error: 'Restore failed' });
    }
});

// Serve export files
app.use('/exports', express.static(path.join(__dirname, '..', 'exports')));

// Helper function to convert data to CSV
function convertToCSV(data, headers) {
    if (!data || data.length === 0) return '';

    const csvRows = data.map(row =>
        headers.map(header => {
            let value = row[header] ?? '';

            // Handle nested objects and arrays
            if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value);
            }

            // Convert to string and handle null/undefined
            const stringValue = String(value || '');

            // Escape quotes and wrap in quotes if contains comma, newline, or quote
            if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',')
    );

    // Add UTF-8 BOM for Excel/Google Sheets compatibility
    const BOM = '\uFEFF';
    return BOM + [headers.join(','), ...csvRows].join('\n');
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found' 
    });
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Export directories:`);
    console.log(`  CSV exports: ${csvDir}`);
    console.log(`  Backups: ${backupsDir}`);
    console.log('\n=== BPERP API Endpoints ===\n');
    
    console.log('INVENTORY:');
    console.log('  /api/inventory/materials     - CRUD for materials');
    console.log('  /api/inventory/tooling       - CRUD for tooling');
    console.log('  /api/inventory/misc          - CRUD for misc items');
    console.log('  /api/inventory/all           - All inventory combined');
    console.log('  /api/inventory/stats         - Inventory statistics');
    
    console.log('\nCUSTOMERS:');
    console.log('  /api/customers               - CRUD for customers');
    console.log('  /api/customers/:id/contacts  - Manage customer contacts');
    console.log('  /api/customers/:id/archived-work-orders - View archived WOs');
    
    console.log('\nQUOTES:');
    console.log('  /api/quotes                  - CRUD for quotes');
    console.log('  /api/quotes/rfqs             - Open RFQs (New, In Progress)');
    console.log('  /api/quotes/sent             - Sent quotes (Sent, Won, Lost)');
    console.log('  /api/quotes/:id/items        - Quote line items');
    console.log('  /api/quotes/:id/documents    - Quote documents');
    console.log('  /api/quotes/:id/send         - Mark quote as sent');
    console.log('  /api/quotes/:id/duplicate    - Duplicate a quote');
    console.log('  /api/quotes/:id/convert-to-wo - Convert to work order');
    
    console.log('\nWORK ORDERS:');
    console.log('  /api/work-orders             - CRUD for work orders');
    console.log('  /api/work-orders/wip         - Work in progress');
    console.log('  /api/work-orders/:id/checklist - WO checklist items');
    console.log('  /api/work-orders/:id/checklist/audit - Checklist audit log');
    console.log('  /api/work-orders/stats/summary - WO statistics');
    
    console.log('\nTASKS:');
    console.log('  /api/tasks                   - CRUD for all tasks');
    console.log('  /api/tasks/stats             - Task statistics');
    console.log('  /api/tasks/my-tasks          - Get user\'s tasks');
    console.log('  /api/tasks/:id/status        - Update task status');
    console.log('  /api/tasks/:id/assign        - Assign/reassign task');
    console.log('  /api/tasks/:id/issue         - Report issue on task');
    
    console.log('\nWORKCENTERS:');
    console.log('  /api/workcenters             - CRUD for workcenters');
    console.log('  /api/workcenters/:id/queue   - Workcenter job queue');
    console.log('  /api/workcenters/:id/queue/reorder - Reorder queue');
    
    console.log('\nMACHINES:');
    console.log('  /api/machines                - CRUD for machines');
    console.log('  /api/machines/:id/status     - Update machine status');
    console.log('  /api/machines/:id/log-runtime - Log runtime hours');
    console.log('  /api/machines/:id/reset-maintenance - Reset counters');
    
    console.log('\nMAINTENANCE:');
    console.log('  /api/maintenance/tasks       - CRUD for maintenance tasks');
    console.log('  /api/maintenance/tasks/:id/start - Start maintenance');
    console.log('  /api/maintenance/tasks/:id/complete - Complete maintenance');
    console.log('  /api/maintenance/tasks/:id/defer - Defer maintenance');
    console.log('  /api/maintenance/definitions - Task definitions/templates');
    console.log('  /api/maintenance/history     - Maintenance history log');
    console.log('  /api/maintenance/stats       - Maintenance statistics');
    
    console.log('\nORDERS (Purchase, Shipping, Receiving, Inspection):');
    console.log('  /api/orders/purchase-orders  - CRUD for purchase orders');
    console.log('  /api/orders/purchase-orders/:id/mark-ordered - Mark PO as ordered');
    console.log('  /api/orders/purchase-orders/:id/items/:itemId/receive - Receive item');
    console.log('  /api/orders/inspections      - Inspection tasks');
    console.log('  /api/orders/shipping         - Shipping tasks');
    console.log('  /api/orders/receiving        - Receiving tasks');
    
    console.log('\nUSERS & PERMISSIONS:');
    console.log('  /api/users/login             - User login');
    console.log('  /api/users/logout            - User logout');
    console.log('  /api/users/me                - Get current user');
    console.log('  /api/users/validate          - Validate session token');
    console.log('  /api/users                   - CRUD for users (Admin only)');
    console.log('  /api/users/:id/permissions   - Update user tab permissions');
    console.log('  /api/users/:id/appearance    - Update user appearance settings');
    console.log('  /api/users/roles/defaults    - Get role default permissions');
    console.log('  /api/users/activity/log      - Get user activity log');
    
    console.log('\nDATA IMPORT:');
    console.log('  /api/import/preview          - Preview import without saving');
    console.log('  /api/import/customers        - Import customers from CSV/Excel');
    console.log('  /api/import/materials        - Import materials from CSV/Excel');
    console.log('  /api/import/tooling          - Import tooling from CSV/Excel');
    console.log('  /api/import/workcenters      - Import workcenters from CSV/Excel');
    console.log('  /api/import/machines         - Import machines from CSV/Excel');
    console.log('  /api/import/template/:type   - Download CSV template');
    console.log('  /api/import/supported-types  - List supported import types');
});
