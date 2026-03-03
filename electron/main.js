/**
 * BPERP Desktop Application - Main Process
 * Electron main process handling window management and backend lifecycle
 */

const { app, BrowserWindow, ipcMain, shell, Menu, Tray, dialog, screen } = require('electron');
const path = require('path');
const { fork, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');

// ==================== EARLY ERROR HANDLERS ====================
// Must be registered BEFORE any initialization that could throw,
// so crashes during startup produce a visible error instead of silent exit.
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION:', error.message, error.stack);
    try {
        fs.appendFileSync(
            path.join(os.tmpdir(), 'bperp-crash.log'),
            `[${new Date().toISOString()}] UNCAUGHT: ${error.message}\n${error.stack}\n`
        );
    } catch (_) {}
    try {
        dialog.showErrorBox('Fatal Error', `${error.message}\n\nCrash log: ${path.join(os.tmpdir(), 'bperp-crash.log')}`);
    } catch (_) {}
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : '';
    console.error('UNHANDLED REJECTION:', msg);
    try {
        fs.appendFileSync(
            path.join(os.tmpdir(), 'bperp-crash.log'),
            `[${new Date().toISOString()}] REJECTION: ${msg}\n${stack}\n`
        );
    } catch (_) {}
    try {
        dialog.showErrorBox('Startup Error', `${msg}\n\nCrash log: ${path.join(os.tmpdir(), 'bperp-crash.log')}`);
    } catch (_) {}
});

// Linux-specific: Improve window manager integration
if (process.platform === 'linux') {
    // Use GTK3 for better integration with modern Linux desktops
    app.commandLine.appendSwitch('gtk-version', '3');
    // Disable GPU VSync errors (cosmetic, doesn't affect functionality)
    app.commandLine.appendSwitch('disable-gpu-vsync');
}

// Initialize config store
const store = new Store({
    name: 'bperp-config',
    defaults: {
        firstRun: true,
        database: {
            type: 'sqlite',
            path: ''
        },
        window: {
            width: 1280,
            height: 800,
            maximized: false
        },
        server: {
            port: 3000
        }
    }
});

// Global references
let mainWindow = null;
let splashWindow = null;
let setupWindow = null;
let backendProcess = null;
let tray = null;
let isQuitting = false;

// Paths
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const backendPath = isDev
    ? path.join(__dirname, '..', 'backend')
    : path.join(process.resourcesPath, 'backend');

// In packaged builds, native modules live in backend/node_modules inside extraResources.
// Add that path so require('better-sqlite3') resolves correctly from main process code.
if (!isDev) {
    const backendNodeModules = path.join(backendPath, 'node_modules');
    if (!module.paths.includes(backendNodeModules)) {
        module.paths.unshift(backendNodeModules);
    }
}
// Frontend is served by the backend, not loaded directly in production
const frontendPath = isDev
    ? path.join(__dirname, '..', 'frontend')
    : path.join(process.resourcesPath, 'app.asar', 'frontend');

// ==================== ASSET PATHS ====================
// In packaged builds, __dirname is inside app.asar where binary assets (icons)
// cannot be loaded. electron-builder unpacks them to app.asar.unpacked via asarUnpack.
const assetsPath = isDev
    ? path.join(__dirname, 'assets')
    : path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'assets');

// ==================== LOGGING ====================
const logFile = path.join(app.getPath('userData'), 'bperp.log');
fs.mkdirSync(path.dirname(logFile), { recursive: true });
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
logStream.on('error', (err) => console.error('Log stream error:', err.message));

function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message} ${args.length ? JSON.stringify(args) : ''}`;
    console.log(logMessage);
    logStream.write(logMessage + '\n');
}

// ==================== SINGLE INSTANCE LOCK ====================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    log('info', 'Another instance is already running, quitting');
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// ==================== SPLASH SCREEN ====================
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
    
    log('info', 'Splash screen created');
}

// ==================== SETUP WIZARD ====================
function createSetupWindow() {
    setupWindow = new BrowserWindow({
        width: 700,
        height: 600,
        frame: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    setupWindow.loadFile(path.join(__dirname, 'setup-wizard', 'wizard.html'));
    setupWindow.setMenuBarVisibility(false);
    
    setupWindow.on('closed', () => {
        setupWindow = null;
    });
    
    log('info', 'Setup wizard window created');
}

// ==================== MAIN WINDOW ====================
function createMainWindow() {
    const windowConfig = store.get('window');
    
    mainWindow = new BrowserWindow({
        width: windowConfig.width,
        height: windowConfig.height,
        minWidth: 1024,
        minHeight: 768,
        show: false,
        frame: true,
        autoHideMenuBar: true,
        icon: path.join(assetsPath, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    // On Linux, ensure window respects taskbar/panel
    if (process.platform === 'linux') {
        mainWindow.setMaximizable(true);
    }

    // Load the frontend (cache-bust query param forces fresh fetch, avoids stale UI e.g. missing Products/Parts tabs)
    const serverPort = store.get('server.port');
    mainWindow.loadURL(`http://localhost:${serverPort}/?nocache=${Date.now()}`);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }
        
        mainWindow.show();
        
        if (windowConfig.maximized) {
            mainWindow.maximize();
        }
        
        log('info', 'Main window ready and shown');
    });

    // Save window state on resize/move
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    
    // Handle maximize state
    mainWindow.on('maximize', () => {
        store.set('window.maximized', true);
    });
    
    mainWindow.on('unmaximize', () => {
        store.set('window.maximized', false);
    });

    // Handle close - quit the app completely
    mainWindow.on('close', () => {
        isQuitting = true;
        app.quit();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Dev tools in development mode
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    log('info', 'Main window created');
}

function saveWindowState() {
    if (!mainWindow || mainWindow.isMaximized()) return;
    
    const bounds = mainWindow.getBounds();
    store.set('window.width', bounds.width);
    store.set('window.height', bounds.height);
}

// ==================== SYSTEM TRAY ====================
function createTray() {
    const iconPath = path.join(assetsPath, 'icon.ico');
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open BPERP',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Restart Backend',
            click: async () => {
                await stopBackend();
                await startBackend();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);
    
    tray.setToolTip('BPERP - Manufacturing ERP');
    tray.setContextMenu(contextMenu);
    
    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
    
    log('info', 'System tray created');
}

// ==================== BACKEND MANAGEMENT ====================
function getBackendEnv() {
    const dbConfig = store.get('database');

    return {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: store.get('server.port'),
        DB_PATH: dbConfig.path || ''
    };
}

function startBackend() {
    return new Promise((resolve, reject) => {
        log('info', 'Starting backend server...');
        
        const serverPath = path.join(backendPath, 'server.js');
        
        if (!fs.existsSync(serverPath)) {
            const error = `Backend server not found at: ${serverPath}`;
            log('error', error);
            reject(new Error(error));
            return;
        }
        
        // Use fork() to use Electron's bundled Node.js instead of system node
        backendProcess = fork(serverPath, [], {
            cwd: backendPath,
            env: getBackendEnv(),
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            silent: true
        });
        
        let started = false;
        const timeout = setTimeout(() => {
            if (!started) {
                log('error', 'Backend startup timeout');
                reject(new Error('Backend startup timeout'));
            }
        }, 30000);
        
        backendProcess.stdout.on('data', (data) => {
            const output = data.toString();
            log('backend', output.trim());
            
            if (output.includes('Server running') || output.includes('listening')) {
                started = true;
                clearTimeout(timeout);
                log('info', 'Backend server started successfully');
                resolve();
            }
        });
        
        backendProcess.stderr.on('data', (data) => {
            log('backend-error', data.toString().trim());
        });
        
        backendProcess.on('error', (error) => {
            log('error', 'Backend process error:', error.message);
            clearTimeout(timeout);
            reject(error);
        });
        
        backendProcess.on('exit', (code) => {
            log('info', `Backend process exited with code: ${code}`);
            backendProcess = null;
            
            // Restart if unexpected exit and not quitting
            if (code !== 0 && !isQuitting && mainWindow) {
                log('info', 'Attempting to restart backend...');
                setTimeout(() => startBackend(), 2000);
            }
        });
    });
}

function stopBackend() {
    return new Promise((resolve) => {
        if (!backendProcess) {
            resolve();
            return;
        }
        
        log('info', 'Stopping backend server...');
        
        backendProcess.on('exit', () => {
            backendProcess = null;
            resolve();
        });
        
        // Graceful shutdown — Windows does not support Unix signals,
        // so use taskkill on win32 and SIGTERM elsewhere.
        if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            try {
                execSync(`taskkill /pid ${backendProcess.pid} /T /F`);
            } catch (e) {
                // Process may have already exited
            }
        } else {
            backendProcess.kill('SIGTERM');

            // Force kill after timeout
            setTimeout(() => {
                if (backendProcess) {
                    backendProcess.kill('SIGKILL');
                }
            }, 5000);
        }
    });
}

// ==================== IPC HANDLERS ====================
function setupIpcHandlers() {
    // Config
    ipcMain.handle('get-config', () => {
        return store.store;
    });
    
    ipcMain.handle('set-config', (event, config) => {
        Object.keys(config).forEach(key => {
            store.set(key, config[key]);
        });
        return true;
    });
    
    ipcMain.handle('get-config-value', (event, key) => {
        return store.get(key);
    });
    
    ipcMain.handle('set-config-value', (event, key, value) => {
        store.set(key, value);
        return true;
    });
    
    // Database - SQLite path testing
    ipcMain.handle('test-db-connection', async (event, config) => {
        const dbPath = config.path || config;
        log('info', 'Testing database path: ' + dbPath);

        try {
            const Database = require('better-sqlite3');
            const dir = require('path').dirname(dbPath);

            // Ensure parent directory exists
            if (!fs.existsSync(dir)) {
                return { success: false, error: `Directory does not exist: ${dir}` };
            }

            // Test opening the database
            const testDb = new Database(dbPath);
            testDb.pragma('journal_mode = WAL');
            testDb.exec('SELECT 1');
            testDb.close();

            log('info', 'Database path test successful');
            return { success: true };
        } catch (error) {
            log('error', 'Database path test failed: ' + error.message);
            return { success: false, error: error.message };
        }
    });

    // Browse for database path (NAS folder)
    ipcMain.handle('browse-database-path', async () => {
        const result = await dialog.showOpenDialog({
            title: 'Select Database Location',
            properties: ['openDirectory'],
            buttonLabel: 'Select Folder'
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { canceled: true, path: '' };
        }

        const selectedDir = result.filePaths[0];
        const dbPath = path.join(selectedDir, 'bperp.db');
        return { canceled: false, path: dbPath };
    });

    // Test database path accessibility
    ipcMain.handle('test-database-path', async (event, dbPath) => {
        log('info', 'Testing database path: ' + dbPath);

        try {
            const dir = path.dirname(dbPath);

            // Check directory exists
            if (!fs.existsSync(dir)) {
                return { success: false, error: `Directory does not exist: ${dir}` };
            }

            // Check directory is writable
            try {
                fs.accessSync(dir, fs.constants.W_OK);
            } catch (e) {
                return { success: false, error: `Directory is not writable: ${dir}` };
            }

            // Try opening/creating the database
            const Database = require('better-sqlite3');
            const testDb = new Database(dbPath);
            testDb.pragma('journal_mode = WAL');
            testDb.exec('SELECT 1');
            testDb.close();

            log('info', 'Database path test successful');
            return { success: true };
        } catch (error) {
            log('error', 'Database path test failed: ' + error.message);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('run-migrations', async () => {
        return new Promise((resolve) => {
            const migratePath = path.join(backendPath, 'migrations', 'migrate.js');
            // Use fork() to use Electron's bundled Node.js
            const migrate = fork(migratePath, ['up'], {
                cwd: backendPath,
                env: getBackendEnv(),
                silent: true
            });
            
            let output = '';
            migrate.stdout.on('data', (data) => {
                output += data.toString();
            });
            migrate.stderr.on('data', (data) => {
                output += data.toString();
            });
            
            migrate.on('exit', (code) => {
                resolve({ success: code === 0, output });
            });
        });
    });
    
    // System
    ipcMain.handle('get-version', () => {
        return app.getVersion();
    });
    
    ipcMain.handle('get-logs', () => {
        try {
            const logs = fs.readFileSync(logFile, 'utf8');
            return logs.split('\n').slice(-100).join('\n'); // Last 100 lines
        } catch {
            return '';
        }
    });
    
    ipcMain.handle('open-external', (event, url) => {
        shell.openExternal(url);
    });
    
    ipcMain.handle('open-logs-folder', () => {
        shell.openPath(app.getPath('userData'));
    });
    
    // Lifecycle
    ipcMain.handle('quit-app', () => {
        isQuitting = true;
        app.quit();
    });
    
    ipcMain.handle('minimize-app', () => {
        if (mainWindow) mainWindow.minimize();
    });
    
    ipcMain.handle('maximize-app', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });
    
    ipcMain.handle('is-maximized', () => {
        return mainWindow ? mainWindow.isMaximized() : false;
    });
    
    // Setup wizard completion
    ipcMain.handle('complete-setup', async (event, config) => {
        // Save configuration
        store.set('database', config.database);
        
        log('info', 'Setup configuration received');
        log('info', 'Database type: ' + config.database.type);
        
        // Close setup window
        if (setupWindow) {
            setupWindow.close();
        }
        
        // Show splash screen
        createSplashWindow();
        
        // Start backend and main window
        try {
            log('info', 'Starting backend server...');
            await startBackend();
            
            // Wait a moment for the server to be fully ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Create initial admin user if provided
            if (config.admin && config.admin.username && config.admin.password) {
                log('info', 'Creating initial admin user...');
                const serverPort = store.get('server.port');
                
                try {
                    const http = require('http');
                    const adminData = JSON.stringify({
                        username: config.admin.username,
                        name: config.admin.name || config.admin.username,
                        email: config.admin.email || null,
                        password: config.admin.password
                    });
                    
                    const result = await new Promise((resolve, reject) => {
                        const req = http.request({
                            hostname: 'localhost',
                            port: serverPort,
                            path: '/api/setup/init',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Content-Length': Buffer.byteLength(adminData)
                            }
                        }, (res) => {
                            let data = '';
                            res.on('data', chunk => data += chunk);
                            res.on('end', () => {
                                try {
                                    const json = JSON.parse(data);
                                    if (res.statusCode >= 200 && res.statusCode < 300) {
                                        resolve(json);
                                    } else {
                                        reject(new Error(json.error || 'Failed to create admin user'));
                                    }
                                } catch (e) {
                                    reject(new Error('Invalid response from server'));
                                }
                            });
                        });
                        
                        req.on('error', reject);
                        req.write(adminData);
                        req.end();
                    });
                    
                    log('info', 'Admin user created successfully: ' + config.admin.username);
                } catch (adminError) {
                    // If setup already completed (users exist), this is fine
                    if (adminError.message.includes('already')) {
                        log('info', 'Users already exist, skipping admin creation');
                    } else {
                        log('warn', 'Failed to create admin user: ' + adminError.message);
                        // Continue anyway - user can be created manually
                    }
                }
            }
            
            // Mark setup as complete
            store.set('firstRun', false);
            
            createMainWindow();
            return { success: true };
        } catch (error) {
            log('error', 'Failed to start after setup: ' + error.message);
            
            // Close splash if open
            if (splashWindow) {
                splashWindow.close();
                splashWindow = null;
            }
            
            // Reset firstRun so user can try again
            store.set('firstRun', true);
            
            // Show error dialog
            dialog.showErrorBox(
                'Startup Error',
                `Failed to start BPERP:\n\n${error.message}\n\nThis usually means the database file is not accessible.\n\nPlease ensure the NAS path is reachable and your database path is correct.`
            );
            
            // Show setup wizard again
            createSetupWindow();
            
            return { success: false, error: error.message };
        }
    });
    
    // Check if first run
    ipcMain.handle('is-first-run', () => {
        return store.get('firstRun');
    });
    
    log('info', 'IPC handlers registered');
}

// ==================== APPLICATION MENU ====================
function createAppMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Backup Data',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.executeJavaScript(
                                'window.BPERP?.common?.createBackup?.()'
                            );
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
                    click: () => {
                        isQuitting = true;
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => {
                        shell.openExternal('https://docs.brayprecision.com/bperp');
                    }
                },
                {
                    label: 'View Logs',
                    click: () => {
                        shell.openPath(app.getPath('userData'));
                    }
                },
                { type: 'separator' },
                {
                    label: 'About BPERP',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About BPERP',
                            message: 'BPERP - Manufacturing ERP',
                            detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\n\n© 2026 Bray Precision LLC`
                        });
                    }
                }
            ]
        }
    ];

    // Add dev tools in development
    if (isDev) {
        template[2].submenu.push(
            { type: 'separator' },
            { role: 'toggleDevTools' }
        );
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ==================== APP LIFECYCLE ====================
app.whenReady().then(async () => {
    log('info', 'Application starting...');
    log('info', `Version: ${app.getVersion()}`);
    log('info', `User data path: ${app.getPath('userData')}`);
    log('info', `Development mode: ${isDev}`);
    
    // Setup IPC handlers first
    setupIpcHandlers();
    
    // Create app menu
    createAppMenu();
    
    // Create system tray (non-fatal if icon is missing)
    try {
        createTray();
    } catch (e) {
        log('warn', 'Tray creation failed, continuing without tray: ' + e.message);
    }
    
    // Check if first run
    const isFirstRun = store.get('firstRun');
    
    if (isFirstRun) {
        log('info', 'First run detected, showing setup wizard');
        createSetupWindow();
    } else {
        // Show splash and start normally
        createSplashWindow();
        
        try {
            await startBackend();
            createMainWindow();
        } catch (error) {
            log('error', 'Failed to start:', error.message);
            
            if (splashWindow) {
                splashWindow.close();
            }
            
            dialog.showErrorBox(
                'Startup Error',
                `Failed to start BPERP:\n\n${error.message}\n\nPlease check the logs at:\n${logFile}`
            );
            
            app.quit();
        }
    }
});

app.on('window-all-closed', () => {
    // On macOS, keep app running in background (standard behavior)
    // On other platforms, quit if main window was never created (e.g. setup wizard closed)
    // but stay alive for tray mode once the main window has been established
    if (process.platform !== 'darwin' && !mainWindow) {
        app.quit();
    }
});

app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
        if (!store.get('firstRun')) {
            createMainWindow();
        }
    } else if (mainWindow) {
        mainWindow.show();
    }
});

app.on('before-quit', async () => {
    isQuitting = true;
    log('info', 'Application quitting...');
    await stopBackend();
});

// Error handlers are registered at the top of this file (before initialization)
// so they catch crashes that occur during module load.
