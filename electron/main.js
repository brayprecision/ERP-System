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
    // Broken stdout/stderr (closed terminal, detached process) — not an app bug; do not exit.
    if (error && error.code === 'EPIPE') {
        try {
            fs.appendFileSync(
                path.join(os.tmpdir(), 'bperp-crash.log'),
                `[${new Date().toISOString()}] UNCAUGHT (ignored EPIPE): ${error.message}\n`
            );
        } catch (_) {}
        return;
    }
    try {
        console.error('UNCAUGHT EXCEPTION:', error.message, error.stack);
    } catch (_) {}
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
    try {
        console.error('UNHANDLED REJECTION:', msg);
    } catch (_) {}
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
    // Optional: `BPERP_OZONE_PLATFORM=x11 npm start` — some Wayland sessions break maximize/resize; forces X11/Wayland X11 mode.
    if ((process.env.BPERP_OZONE_PLATFORM || '').toLowerCase() === 'x11') {
        app.commandLine.appendSwitch('ozone-platform', 'x11');
    }
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
            maximized: true
        },
        server: {
            port: 3000,
            url: ''   // When set, connect to remote backend (NAS). Empty = standalone (local backend).
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
/** When false, next main window `close` completes the quit (no labor clock-out on exit — shift stays open). */
let allowMainWindowClose = false;

/** Base window title from renderer `document.title` (shop branding); we append version and mode. */
let lastRendererDocumentTitle = 'BPERP';

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
// Static UI is served by the Express backend from resources/frontend (extraResources), not from app.asar.

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
logStream.on('error', (err) => {
    try {
        console.error('Log stream error:', err.message);
    } catch (_) {}
});

function log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message} ${args.length ? JSON.stringify(args) : ''}`;
    try {
        console.log(logMessage);
    } catch (err) {
        // EPIPE when stdout is closed (e.g. terminal detached, headless) — not fatal for the app
        if (!err || err.code !== 'EPIPE') {
            try {
                fs.appendFileSync(logFile, `${logMessage} [console.log failed: ${err && err.message}]\n`);
            } catch (_) {}
        }
    }
    try {
        logStream.write(logMessage + '\n');
    } catch (err) {
        try {
            fs.appendFileSync(logFile, `${logMessage} [logStream failed: ${err && err.message}]\n`);
        } catch (_) {}
    }
}

/** Shared Help / tray “About” dialog (includes user data path for support). */
function showAboutDialog() {
    const serverUrl = (store.get('server.url') || '').trim();
    const modeLine = serverUrl
        ? `Mode: Network (UI loaded from server)\nServer URL: ${serverUrl}`
        : 'Mode: Standalone (bundled UI + local backend)';
    const detail = [
        `Version: ${app.getVersion()}`,
        `Packaged: ${app.isPackaged ? 'yes' : 'no'}`,
        modeLine,
        `Electron: ${process.versions.electron}`,
        `Node: ${process.versions.node}`,
        '',
        `User data: ${app.getPath('userData')}`,
        '',
        '© 2026 Bray Precision LLC'
    ].join('\n');
    const parentWin = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    dialog.showMessageBox(parentWin, {
        type: 'info',
        title: 'About BPERP',
        message: 'BPERP - Manufacturing ERP',
        detail
    });
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

/** Keeps shop name in the title while appending version and Standalone vs Network (Shop Branding sets document.title, which would otherwise replace our hint). */
function applyMainWindowTitle() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const v = app.getVersion();
    const remote = (store.get('server.url') || '').trim();
    const mode = remote ? 'Network · UI from server' : 'Standalone';
    const base = lastRendererDocumentTitle || 'BPERP';
    mainWindow.setTitle(`${base} · v${v} · ${mode}`);
}

/**
 * Keep min size within the monitor work area so the WM can maximize (fixed 1024×768 breaks on short panels).
 * Never set minWidth/minHeight equal to the full work width/height — that makes vertical (or horizontal) resize
 * impossible because the window cannot be shorter than the entire usable area.
 */
function getMainWindowMinSize() {
    try {
        const work = screen.getPrimaryDisplay().workAreaSize;
        const preferredW = Math.max(400, Math.min(1024, work.width));
        const preferredH = Math.max(400, Math.min(768, work.height));
        return {
            minWidth: Math.min(Math.max(1, work.width - 1), preferredW),
            minHeight: Math.min(Math.max(1, work.height - 1), preferredH)
        };
    } catch (e) {
        return { minWidth: 1024, minHeight: 768 };
    }
}

/** Linux (Cinnamon/X11): WM `maximize()` often sizes to the full screen, so the bottom sits under the panel. We fill `screen.workArea` with `setBounds` instead and treat that as "maximized" for persistence. */
const LINUX_WORK_AREA_MATCH_TOL = 8;

function linuxBoundsFillWorkArea(win) {
    if (process.platform !== 'linux' || !win || win.isDestroyed()) return false;
    const bounds = win.getBounds();
    const wa = screen.getDisplayMatching(bounds).workArea;
    return (
        Math.abs(bounds.x - wa.x) <= LINUX_WORK_AREA_MATCH_TOL &&
        Math.abs(bounds.y - wa.y) <= LINUX_WORK_AREA_MATCH_TOL &&
        Math.abs(bounds.width - wa.width) <= LINUX_WORK_AREA_MATCH_TOL &&
        Math.abs(bounds.height - wa.height) <= LINUX_WORK_AREA_MATCH_TOL
    );
}

function linuxApplyWorkAreaFill() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    }
    const wa = screen.getDisplayMatching(mainWindow.getBounds()).workArea;
    mainWindow.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height }, false);
    mainWindow.setMinimizable(true);
    mainWindow.setMaximizable(true);
    mainWindow.setResizable(true);
    store.set('window.maximized', true);
    if (isDev) {
        log('info', 'Linux: applied work-area fill', { workArea: wa });
    }
}

function linuxRestoreFromWorkAreaFill() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const w = store.get('window.width') || 1280;
    const h = store.get('window.height') || 800;
    mainWindow.setSize(w, h, false);
    mainWindow.center();
    mainWindow.setMinimizable(true);
    mainWindow.setMaximizable(true);
    mainWindow.setResizable(true);
    store.set('window.maximized', false);
}

// ==================== MAIN WINDOW ====================
function createMainWindow() {
    allowMainWindowClose = false;
    const windowConfig = store.get('window');
    const mins = getMainWindowMinSize();

    mainWindow = new BrowserWindow({
        width: windowConfig.width,
        height: windowConfig.height,
        minWidth: mins.minWidth,
        minHeight: mins.minHeight,
        show: false,
        frame: true,
        autoHideMenuBar: true,
        resizable: true,
        maximizable: true,
        minimizable: true,
        fullscreenable: true,
        icon: path.join(assetsPath, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load the frontend - from remote URL (NAS) or localhost (standalone)
    const serverUrl = store.get('server.url');
    if (serverUrl) {
        const url = serverUrl.replace(/\/$/, '') + `/?nocache=${Date.now()}`;
        mainWindow.loadURL(url);

        // Handle load failure (server unreachable)
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            if (event.isMainFrame && (errorCode === -2 || errorCode === -3 || errorCode === -6)) {
                // -2: ERR_FAILED, -3: ERR_ABORTED, -6: ERR_CONNECTION_REFUSED
                log('warn', 'Remote load failed:', errorCode, errorDescription);
                mainWindow.loadFile(path.join(__dirname, 'offline.html'));
            }
        });
        log('info', 'Loading from remote server:', url);
    } else {
        const serverPort = store.get('server.port');
        mainWindow.loadURL(`http://localhost:${serverPort}/?nocache=${Date.now()}`);
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        if (splashWindow) {
            splashWindow.close();
            splashWindow = null;
        }
        
        mainWindow.show();

        // Linux: WM often needs controls re-applied after the window is mapped (maximize button otherwise no-ops).
        if (process.platform === 'linux') {
            const m = getMainWindowMinSize();
            mainWindow.setMinimumSize(m.minWidth, m.minHeight);
            mainWindow.setMinimizable(true);
            mainWindow.setMaximizable(true);
            mainWindow.setResizable(true);
        }

        if (windowConfig.maximized) {
            mainWindow.maximize();
        }

        log('info', 'Main window ready and shown');
    });

    // Save window state on resize/move
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    
    // Handle maximize state (Linux: WM maximize() often draws under the panel — replace with work-area fill)
    mainWindow.on('maximize', () => {
        if (process.platform === 'linux') {
            setImmediate(() => {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                linuxApplyWorkAreaFill();
            });
        } else {
            store.set('window.maximized', true);
        }
    });

    mainWindow.on('unmaximize', () => {
        if (process.platform === 'linux') {
            // Run after linuxApplyWorkAreaFill's setBounds so we don't clear maximized during fill.
            setTimeout(() => {
                if (!mainWindow || mainWindow.isDestroyed()) return;
                if (!linuxBoundsFillWorkArea(mainWindow)) {
                    store.set('window.maximized', false);
                }
            }, 0);
        } else {
            store.set('window.maximized', false);
        }
    });

    // Close immediately — do not auto clock-out on quit (users may leave the app open while developing).
    mainWindow.on('close', (e) => {
        if (allowMainWindowClose) {
            isQuitting = true;
            return;
        }
        e.preventDefault();
        allowMainWindowClose = true;
        isQuitting = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.close();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('page-title-updated', (event, title) => {
        event.preventDefault();
        const t = title && String(title).trim() ? String(title).trim() : '';
        if (t) {
            lastRendererDocumentTitle = t;
        }
        applyMainWindowTitle();
    });

    mainWindow.webContents.on('did-finish-load', () => {
        applyMainWindowTitle();
    });

    // Dev tools in development mode
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    log('info', 'Main window created');
}

function saveWindowState() {
    if (!mainWindow || mainWindow.isMaximized()) return;
    if (process.platform === 'linux' && linuxBoundsFillWorkArea(mainWindow)) return;

    const bounds = mainWindow.getBounds();
    store.set('window.width', bounds.width);
    store.set('window.height', bounds.height);
    store.set('window.maximized', false);
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
            label: 'About BPERP',
            click: () => showAboutDialog()
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
/**
 * SQLite file for the forked backend. Empty string = let server.js use backend/bperp.db (dev clone).
 * Packaged installs must not write under resources/ (AppImage is read-only; Linux deb is often root-owned under /opt).
 */
function getResolvedDatabasePath() {
    const explicit = ((store.get('database') || {}).path || '').trim();
    if (explicit) {
        return explicit;
    }
    if (app.isPackaged) {
        return path.join(app.getPath('userData'), 'bperp.db');
    }
    return '';
}

function getBackendEnv() {
    return {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: store.get('server.port'),
        DB_PATH: getResolvedDatabasePath()
    };
}

/** POST /api/setup/init — must not hang forever (broken pipe / stuck server). */
const SETUP_INIT_TIMEOUT_MS = 45000;

function postSetupInitAdmin(targetUrl, adminPayload) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(targetUrl);
        const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');
        const body = JSON.stringify(adminPayload);
        const timeoutMs = SETUP_INIT_TIMEOUT_MS;

        const req = protocol.request(
            {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: '/api/setup/init',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                },
                timeout: timeoutMs
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const json = data ? JSON.parse(data) : {};
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(json);
                        } else {
                            reject(new Error(json.error || `HTTP ${res.statusCode}`));
                        }
                    } catch (e) {
                        reject(new Error('Invalid response from server'));
                    }
                });
            }
        );

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(
                new Error(
                    `Admin setup timed out after ${timeoutMs / 1000}s (no response from ${targetUrl})`
                )
            );
        });
        req.write(body);
        req.end();
    });
}

function startBackend() {
    return new Promise((resolve, reject) => {
        log('info', 'Starting backend server...');
        const dbPathForLog = getResolvedDatabasePath() || path.join(backendPath, 'bperp.db');
        log('info', `SQLite database file: ${dbPathForLog}`);

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
        let startupSettled = false;

        function failStartup(message) {
            if (startupSettled) return;
            startupSettled = true;
            clearTimeout(timeout);
            log('error', message);
            reject(new Error(message));
        }

        const timeout = setTimeout(() => {
            if (!started) {
                failStartup(
                    'Backend startup timeout (no "Server running" on stdout). ' +
                    'If the log shows better-sqlite3 / NODE_MODULE_VERSION, run from repo root: npm run rebuild:backend'
                );
            }
        }, 30000);

        backendProcess.stdout.on('data', (data) => {
            const output = data.toString();
            log('backend', output.trim());

            if (output.includes('Server running') || output.includes('listening')) {
                started = true;
                startupSettled = true;
                clearTimeout(timeout);
                log('info', 'Backend server started successfully');
                resolve();
            }
        });

        backendProcess.stderr.on('data', (data) => {
            const text = data.toString();
            log('backend-error', text.trim());
            // Fail fast: migration or native module errors never reach stdout
            if (
                !started &&
                (text.includes('ERR_DLOPEN_FAILED') ||
                    text.includes('NODE_MODULE_VERSION') ||
                    text.includes('Migrations failed') ||
                    text.includes('better_sqlite3'))
            ) {
                failStartup(
                    'Backend failed to start (native SQLite module or migration). ' +
                    'Rebuild for Electron: from repo root run npm run rebuild:backend, then npm start.'
                );
            }
        });

        backendProcess.on('error', (error) => {
            log('error', 'Backend process error:', error.message);
            failStartup(error.message);
        });

        backendProcess.on('exit', (code) => {
            log('info', `Backend process exited with code: ${code}`);
            backendProcess = null;

            if (!started && code !== 0) {
                failStartup(
                    `Backend exited with code ${code} before listening. ` +
                    'If you use npm install in backend/ with system Node, run: npm run rebuild:backend (repo root) so better-sqlite3 matches Electron.'
                );
                return;
            }

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
    
    // Server URL (for remote/NAS mode)
    ipcMain.handle('get-server-url', () => store.get('server.url') || '');
    ipcMain.handle('set-server-url', (event, url) => {
        store.set('server.url', (url || '').trim());
        applyMainWindowTitle();
        return true;
    });
    ipcMain.handle('retry-connection', () => {
        if (mainWindow) {
            const serverUrl = store.get('server.url');
            if (serverUrl) {
                const url = serverUrl.replace(/\/$/, '') + `/?nocache=${Date.now()}`;
                mainWindow.loadURL(url);
            }
        }
    });
    ipcMain.handle('reopen-setup', () => {
        store.set('firstRun', true);
        if (mainWindow) {
            mainWindow.close();
            mainWindow = null;
        }
        createSetupWindow();
    });
    ipcMain.handle('test-server-connection', async (event, url) => {
        const baseUrl = (url || store.get('server.url') || '').trim().replace(/\/$/, '');
        if (!baseUrl) return { success: false, error: 'No server URL provided' };
        try {
            const urlObj = new URL(baseUrl);
            const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');
            const res = await new Promise((resolve, reject) => {
                const req = protocol.request({
                    hostname: urlObj.hostname,
                    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                    path: '/api/health',
                    method: 'GET',
                    timeout: 5000
                }, resolve);
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('Connection timed out')); });
                req.end();
            });
            if (res.statusCode === 200) {
                return { success: true };
            }
            return { success: false, error: `Server returned ${res.statusCode}` };
        } catch (err) {
            log('warn', 'Server connection test failed:', err.message);
            return { success: false, error: err.message };
        }
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

    ipcMain.handle('get-app-info', () => {
        const serverUrl = (store.get('server.url') || '').trim();
        const info = {
            version: app.getVersion(),
            isPackaged: app.isPackaged,
            userDataPath: app.getPath('userData'),
            serverUrl,
            electronVersion: process.versions.electron,
            nodeVersion: process.versions.node
        };
        if (!serverUrl) {
            info.sqliteDatabasePath =
                getResolvedDatabasePath() || path.join(backendPath, 'bperp.db');
        }
        return info;
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

    /** Legacy: auto clock-out on quit is disabled; kept for older renderers that still invoke it. */
    ipcMain.handle('labor-clock-out-done', () => true);
    
    ipcMain.handle('minimize-app', () => {
        if (mainWindow) mainWindow.minimize();
    });
    
    ipcMain.handle('maximize-app', () => {
        if (!mainWindow) return;
        if (process.platform === 'linux') {
            mainWindow.setMaximizable(true);
            mainWindow.setResizable(true);
            if (linuxBoundsFillWorkArea(mainWindow) || mainWindow.isMaximized()) {
                if (mainWindow.isMaximized()) {
                    mainWindow.unmaximize();
                }
                linuxRestoreFromWorkAreaFill();
            } else {
                linuxApplyWorkAreaFill();
            }
            return;
        }
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    
    ipcMain.handle('is-maximized', () => {
        if (!mainWindow) return false;
        if (process.platform === 'linux') {
            return linuxBoundsFillWorkArea(mainWindow) || mainWindow.isMaximized();
        }
        return mainWindow.isMaximized();
    });
    
    // Setup wizard completion (standalone or remote/NAS mode)
    ipcMain.handle('complete-setup', async (event, setupConfig) => {
        const mode = setupConfig.mode || 'network';
        const serverUrl = (setupConfig.server?.url || '').trim().replace(/\/$/, '');

        if (mode === 'network' && !serverUrl) {
            return { success: false, error: 'Server URL is required for network mode' };
        }

        if (mode === 'network') {
            store.set('server.url', serverUrl);
        } else {
            store.set('server.url', '');
        }
        log('info', `Setup configuration received, mode: ${mode}` + (serverUrl ? `, server: ${serverUrl}` : ''));

        if (setupWindow) {
            setupWindow.close();
        }

        createSplashWindow();

        try {
            // Standalone mode: start the local backend first
            if (mode === 'standalone') {
                log('info', 'Standalone mode: starting local backend...');
                await startBackend();
            }

            // Create initial admin user if provided (setup not already complete)
            if (setupConfig.admin && setupConfig.admin.username && setupConfig.admin.password) {
                const targetUrl = mode === 'standalone'
                    ? `http://localhost:${store.get('server.port')}`
                    : serverUrl;
                log('info', `POST /api/setup/init → ${targetUrl} (timeout ${SETUP_INIT_TIMEOUT_MS / 1000}s)`);

                try {
                    await postSetupInitAdmin(targetUrl, {
                        username: setupConfig.admin.username,
                        name: setupConfig.admin.name || setupConfig.admin.username,
                        email: setupConfig.admin.email || null,
                        password: setupConfig.admin.password
                    });
                    log('info', 'Admin user created successfully');
                } catch (adminError) {
                    if (adminError.message && adminError.message.includes('already')) {
                        log('info', 'Users already exist, skipping admin creation');
                    } else {
                        log('warn', 'Failed to create admin user: ' + adminError.message);
                    }
                }
            }

            store.set('firstRun', false);
            createMainWindow();
            return { success: true };
        } catch (error) {
            log('error', 'Setup failed: ' + error.message);
            if (splashWindow) {
                splashWindow.close();
                splashWindow = null;
            }
            store.set('firstRun', true);
            const errorContext = mode === 'standalone'
                ? 'Failed to start local BPERP server.'
                : 'Failed to connect to BPERP. Ensure the server is running on your NAS.';
            dialog.showErrorBox('Setup Error', `${errorContext}\n\n${error.message}`);
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
                    click: () => showAboutDialog()
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
        if (process.env.BPERP_DEBUG_SETUP === '1' && setupWindow) {
            setupWindow.webContents.once('did-finish-load', () => {
                setupWindow.webContents.openDevTools({ mode: 'detach' });
            });
            log('info', 'BPERP_DEBUG_SETUP=1: opening setup wizard DevTools after load');
        }
    } else {
        // Show splash and start normally
        createSplashWindow();
        
        const serverUrl = store.get('server.url');
        if (serverUrl) {
            // Remote mode: connect to NAS, no local backend
            log('info', 'Remote mode: connecting to', serverUrl);
            createMainWindow();
        } else {
            // Standalone mode: start local backend
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
    // Only stop backend in standalone mode (no remote server URL)
    if (!store.get('server.url')) {
        await stopBackend();
    }
});

// Error handlers are registered at the top of this file (before initialization)
// so they catch crashes that occur during module load.
