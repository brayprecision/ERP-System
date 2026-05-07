// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawnSync } = require('child_process');
const { pool, initDb } = require('./db');
const fs = require('fs');
const path = require('path');

// Import rate limiters
const { apiLimiter, exportLimiter } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

// Database path - used for migrations and init
const dbPath = process.env.DB_PATH || path.join(__dirname, 'bperp.db');

// Run migrations before opening DB (for central server / NAS deployment)
// When the backend is forked from Electron, use the same executable + Node mode as this process.
// Hard-coded `node` would use system Node (often a different NODE_MODULE_VERSION than better-sqlite3 was built for).
const migrateScript = path.join(__dirname, 'migrations', 'migrate.js');
const migrateEnv = { ...process.env, DB_PATH: dbPath };
if (process.versions.electron) {
    migrateEnv.ELECTRON_RUN_AS_NODE = '1';
}
const migrateResult = spawnSync(process.execPath, [migrateScript, 'up'], {
    cwd: __dirname,
    env: migrateEnv,
    stdio: 'pipe',
    encoding: 'utf8'
});
if (migrateResult.status !== 0) {
    console.error('Migrations failed:', migrateResult.stderr || migrateResult.stdout);
    process.exit(1);
}
if (migrateResult.stdout) {
    console.log('Migrations:', migrateResult.stdout.trim());
}

// Database Connection Configuration
initDb(dbPath);

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

// Auth middleware for protected routes (must be after initDb)
const { requireAuth } = require('./middleware/auth')(pool);

// Import routes
const inventoryRoutes = require('./routes/inventory')(pool);
const customerRoutes = require('./routes/customers')(pool);
const leadRoutes = require('./routes/leads')(pool);
const quoteRoutes = require('./routes/quotes')(pool);
const workOrderRoutes = require('./routes/workorders')(pool);
const usersRoutes = require('./routes/users')(pool);

// Tasks module routes
const tasksRoutes = require('./routes/tasks')(pool);
const workcentersRoutes = require('./routes/workcenters')(pool);
const machinesRoutes = require('./routes/machines')(pool);
const maintenanceRoutes = require('./routes/maintenance')(pool);
const ordersRoutes = require('./routes/orders')(pool);
const laborRoutes = require('./routes/labor')(pool);

// Data import routes
const importRoutes = require('./routes/import')(pool);

// --- API ROUTES ---

// Mount routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/users', usersRoutes);

// Tasks module routes
app.use('/api/tasks', tasksRoutes);
app.use('/api/workcenters', workcentersRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/labor', laborRoutes);

// Data import routes
app.use('/api/import', importRoutes);

// 1. Get Quote Stats (For the "Quotes in March" card)
app.get('/api/quotes/stats', requireAuth, async (req, res) => {
    try {
        // Run three queries in parallel to count statuses
        const won = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Won'");
        const lost = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Lost'");
        const sent = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Sent'");
        const revenue = await pool.query("SELECT SUM(total_amount) FROM quotes WHERE status = 'Won'");

        res.json({
            success: true,
            data: {
                won: parseInt(won.rows[0].count),
                lost: parseInt(lost.rows[0].count),
                sent: parseInt(sent.rows[0].count),
                revenue: parseFloat(revenue.rows[0].sum || 0)
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// 2. Get Win Rate (For the "Win Rate" card)
app.get('/api/quotes/win-rate', requireAuth, async (req, res) => {
    try {
        const total = await pool.query("SELECT COUNT(*) FROM quotes");
        const won = await pool.query("SELECT COUNT(*) FROM quotes WHERE status = 'Won'");
        
        const totalCount = parseInt(total.rows[0].count);
        const wonCount = parseInt(won.rows[0].count);
        
        // Avoid division by zero
        const rate = totalCount === 0 ? 0 : Math.round((wonCount / totalCount) * 100);

        res.json({ success: true, data: { winRate: rate } });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// 3. Get Inventory Alerts (For the "Inventory Alerts" card)
app.get('/api/inventory/alerts', requireAuth, async (req, res) => {
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
        
        // Check products (if table exists)
        try {
            const products = await pool.query(
                "SELECT id, name, qty_on_hand, minimum_qty, 'product' as category FROM products WHERE qty_on_hand <= minimum_qty ORDER BY (qty_on_hand::float / NULLIF(minimum_qty, 0)) ASC LIMIT 5"
            );
            alerts.push(...products.rows);
        } catch (e) { /* products table may not exist yet */ }
        
        // Check parts (if table exists)
        try {
            const parts = await pool.query(
                "SELECT id, name, qty_on_hand, minimum_qty, 'part' as category FROM parts WHERE qty_on_hand <= minimum_qty ORDER BY (qty_on_hand::float / NULLIF(minimum_qty, 0)) ASC LIMIT 5"
            );
            alerts.push(...parts.rows);
        } catch (e) { /* parts table may not exist yet */ }
        
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
        
        res.json({ success: true, data: formattedAlerts });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Server Error" });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup status - used by setup wizard to check if admin creation is needed (no auth)
app.get('/api/setup/status', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(result.rows[0]?.count || 0);
        res.json({ setupComplete: userCount > 0 });
    } catch (err) {
        // If users table doesn't exist yet, setup not complete
        res.json({ setupComplete: false });
    }
});

// ==================== SETUP ROUTES (First-run only) ====================

const bcrypt = require('bcrypt');

/**
 * POST /api/setup/init - Initialize the application with first admin user
 * This endpoint only works when no users exist in the database
 */
app.post('/api/setup/init', async (req, res) => {
    try {
        const { username, name, email, password } = req.body;
        
        // Validate required fields
        if (!username || !name || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username, name, and password are required' 
            });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ 
                success: false, 
                error: 'Password must be at least 8 characters' 
            });
        }
        
        // Check if any users already exist
        const existingUsers = await pool.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(existingUsers.rows[0].count);
        
        if (userCount > 0) {
            return res.status(403).json({ 
                success: false, 
                error: 'Setup already completed. Users already exist in the database.' 
            });
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);
        
        // Get admin default permissions
        let tabPermissions = {
            dashboard: true,
            workcenter: true,
            inventory: true,
            sales: true,
            tasks: true,
            settings: true
        };
        
        try {
            const defaultPerms = await pool.query(
                "SELECT tab_permissions FROM role_defaults WHERE role = 'Administrator'"
            );
            if (defaultPerms.rows.length > 0) {
                tabPermissions = defaultPerms.rows[0].tab_permissions;
            }
        } catch (e) {
            console.log('role_defaults table may not exist yet, using default permissions');
        }
        
        // Create admin user
        const result = await pool.query(`
            INSERT INTO users (username, name, email, password_hash, role, tab_permissions, is_active)
            VALUES ($1, $2, $3, $4, 'Administrator', $5, TRUE)
            RETURNING id, username, name, email, role, tab_permissions, is_active, created_at
        `, [username, name, email || null, passwordHash, JSON.stringify(tabPermissions)]);
        
        console.log(`Initial admin user created: ${username}`);
        
        res.status(201).json({ 
            success: true, 
            message: 'Initial admin user created successfully',
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Setup init error:', err);
        if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
            return res.status(400).json({ success: false, error: 'Username or email already exists' });
        }
        res.status(500).json({ success: false, error: 'Server error: ' + err.message });
    }
});

/**
 * GET /api/setup/status - Check if initial setup is needed
 */
app.get('/api/setup/status', async (req, res) => {
    try {
        // Check if users table exists and has any users
        let needsSetup = true;
        
        try {
            const result = await pool.query('SELECT COUNT(*) FROM users');
            needsSetup = parseInt(result.rows[0].count) === 0;
        } catch (e) {
            // Table doesn't exist, definitely needs setup
            needsSetup = true;
        }
        
        res.json({ 
            success: true,
            data: { 
                needsSetup,
                version: '1.0.0-beta.1'
            }
        });
    } catch (err) {
        console.error('Setup status error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ==================== EXPORT ROUTES ====================

// Ensure export directories exist
// In production (packaged app), use a writable location outside the app bundle
const isProduction = process.env.NODE_ENV === 'production' || __dirname.includes('.mount_') || __dirname.includes('app.asar');
const exportsBase = isProduction 
    ? path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.bperp-data')
    : path.join(__dirname, '..', 'exports');
const exportsDir = exportsBase;
const csvDir = path.join(exportsDir, 'csv');
const backupsDir = path.join(exportsDir, 'backups');

try {
    if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true });
    }
    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }
    console.log(`Export directories ready: ${exportsDir}`);
} catch (err) {
    console.error('Warning: Could not create export directories:', err.message);
}

// Export customers to CSV
app.get('/api/export/customers', requireAuth, exportLimiter, async (req, res) => {
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
app.get('/api/export/quotes', requireAuth, exportLimiter, async (req, res) => {
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
app.get('/api/export/work-orders', requireAuth, exportLimiter, async (req, res) => {
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
app.get('/api/export/inventory/materials', requireAuth, exportLimiter, async (req, res) => {
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
app.get('/api/export/inventory/tooling', requireAuth, exportLimiter, async (req, res) => {
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
app.get('/api/export/inventory/misc', requireAuth, exportLimiter, async (req, res) => {
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

// Export inventory (products) to CSV
app.get('/api/export/inventory/products', requireAuth, exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY name');
        const headers = ['id', 'name', 'part_number', 'category', 'qty_on_hand', 'minimum_qty', 'supplier', 'unit_price', 'last_ordered'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `products_inventory_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Products inventory exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export products error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Export inventory (parts) to CSV
app.get('/api/export/inventory/parts', requireAuth, exportLimiter, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM parts ORDER BY name');
        const headers = ['id', 'name', 'part_number', 'category', 'source', 'qty_on_hand', 'minimum_qty', 'supplier', 'unit_price', 'last_ordered'];
        const csvData = convertToCSV(result.rows, headers);

        const filename = `parts_inventory_${new Date().toISOString().split('T')[0]}.csv`;
        const filepath = path.join(csvDir, filename);

        fs.writeFileSync(filepath, csvData, 'utf8');

        res.json({
            success: true,
            message: 'Parts inventory exported successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/csv/${filename}`
        });
    } catch (err) {
        console.error('Export parts error:', err);
        res.status(500).json({ success: false, error: 'Export failed' });
    }
});

// Create backup
app.post('/api/backup/create', requireAuth, exportLimiter, async (req, res) => {
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
                sales_leads: await safeQuery('SELECT * FROM sales_leads'),
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

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `bperp_backup_${timestamp}.json`;
        const filepath = path.join(backupsDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');

        // Copy the live SQLite file as a binary backup alongside the JSON export
        const dbFilename = `bperp_backup_${timestamp}.db`;
        const dbFilepath = path.join(backupsDir, dbFilename);
        let dbDownloadUrl = null;
        try {
            fs.copyFileSync(dbPath, dbFilepath);
            dbDownloadUrl = `/exports/backups/${dbFilename}`;
        } catch (copyErr) {
            console.warn('Could not copy SQLite DB file for backup:', copyErr.message);
        }

        res.json({
            success: true,
            message: 'Backup created successfully',
            filename: filename,
            filepath: filepath,
            downloadUrl: `/exports/backups/${filename}`,
            dbFilename: dbFilename,
            dbDownloadUrl: dbDownloadUrl
        });
    } catch (err) {
        console.error('Backup creation error:', err);
        res.status(500).json({ success: false, error: 'Backup failed' });
    }
});

// Restore from backup
app.post('/api/backup/restore', requireAuth, async (req, res) => {
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

// Serve frontend static files
// In production (packaged app), frontend is in resources/frontend
const frontendPath = isProduction
    ? path.join(__dirname, '..', 'frontend')  // resources/frontend when backend is in resources/backend
    : path.join(__dirname, '..', 'frontend'); // Same relative path in dev
console.log(`Serving frontend from: ${frontendPath}`);

// Serve index.html with no-cache to prevent stale UI (Products/Parts tabs, etc.)
const serveIndexWithNoCache = (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(indexPath);
    } else {
        res.status(500).send(`Frontend not found at: ${indexPath}`);
    }
};
app.get('/', serveIndexWithNoCache);
app.get('/index.html', serveIndexWithNoCache);

app.use(express.static(frontendPath, {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

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

// Start the Server - bind to 0.0.0.0 so NAS accepts connections from workstations
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (accessible from network)`);
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
