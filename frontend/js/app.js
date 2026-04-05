/**
 * BPERP Dashboard - Main Application Entry Point
 * Handles initialization, routing, and module coordination
 */

// ==================== CONFIGURATION ====================
const CONFIG = {
    // Use current origin so API works regardless of port (e.g. Electron with custom server.port)
    API_BASE: `${window.location.origin}/api`,
    ENABLE_OFFLINE_MODE: true,
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    AUTO_REFRESH_INTERVAL: 30000 // 30 seconds
};

// Import backup/restore functions from common
import { createBackup, restoreFromBackup } from './modules/common.js';
import { initLaborClockUI, refreshLaborClockUI } from './modules/laborClock.js';
import { getLaborPresence } from './modules/laborApi.js';

/** Cleared when leaving the Dashboard route */
let dashboardPresencePollInterval = null;

function clearDashboardPresencePoll() {
    if (dashboardPresencePollInterval) {
        clearInterval(dashboardPresencePollInterval);
        dashboardPresencePollInterval = null;
    }
}

function formatWorkflowStepLabel(key) {
    if (!key) return '—';
    return String(key).replace(/_/g, ' ');
}

function formatPresenceShort(iso) {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    } catch {
        return iso;
    }
}

async function refreshDashboardPresenceCard() {
    const el = document.getElementById('dashboardPresenceCard');
    if (!el) return;
    try {
        const rows = await getLaborPresence();
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
            el.innerHTML =
                '<p class="text-sm" style="color: var(--color-text-muted);">No one is clocked in right now.</p>';
            return;
        }
        el.innerHTML = `
            <div class="space-y-1">
                ${list
                    .map((p) => {
                        const seg = p.currentSegment;
                        const misc = p.currentMiscSegment;
                        const workLine = seg
                            ? `<span class="text-white font-medium">${seg.woNumber || `WO ${seg.workOrderId}`}</span> · <span style="color: var(--color-text-muted);">${formatWorkflowStepLabel(seg.workflowStepKey)}</span>${seg.lineItemId != null ? ` <span class="text-xs text-gray-500">(line ${seg.lineItemId})</span>` : ''}`
                            : misc
                              ? `<span class="text-white font-medium">Misc</span> · <span style="color: var(--color-text-muted);">${misc.miscTaskTitle || misc.miscTaskId || 'Task'}</span>`
                              : '<span style="color: var(--color-text-muted);">On shift — no active job timer</span>';
                        return `
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-2 border-b border-gray-700/60 last:border-0">
                        <div class="min-w-0">
                            <span class="font-medium text-white">${p.name || p.username}</span>
                            <span class="text-xs ml-2" style="color: var(--color-text-muted);">${p.role}</span>
                        </div>
                        <div class="text-sm min-w-0 break-words">${workLine}</div>
                        <div class="text-xs whitespace-nowrap" style="color: var(--color-text-muted);">Shift since ${formatPresenceShort(p.shiftStartedAt)}</div>
                    </div>`;
                    })
                    .join('')}
            </div>`;
    } catch (e) {
        console.warn('Dashboard presence:', e);
        el.innerHTML =
            '<p class="text-sm text-amber-500/90">Could not load who is clocked in.</p>';
    }
}

// Expose API_BASE globally for modules
window.API_BASE = CONFIG.API_BASE;

// ==================== GLOBAL NAMESPACE ====================
window.BPERP = {
    common: null,
    storage: null,
    inventory: null,
    sales: null,
    tasks: null,
    maintenance: null,
    users: null,
    config: CONFIG,
    navigate: null,
    isInitialized: false
};

// ==================== MODULE STORAGE ====================
const modules = {
    common: null,
    storage: null,
    inventory: null,
    sales: null,
    tasks: null,
    maintenance: null,
    users: null,
    timeTracking: null
};

// ==================== MODULE LOADER ====================
async function loadModules() {
    try {
        console.log('BPERP: Loading modules...');
        
        // Load common and storage first as they are dependencies
        const [common, storage] = await Promise.all([
            import('./modules/common.js'),
            import('./modules/storage.js')
        ]);
        
        modules.common = common;
        modules.storage = storage;
        
        // Expose common module immediately
        window.BPERP.common = common;
        window.BPERP.storage = storage;
        
        console.log('BPERP: Core modules loaded');
        
        // Load feature modules
        const [inventory, sales, tasks, maintenance, search, users, timeTracking] = await Promise.all([
            import('./modules/inventory.js'),
            import('./modules/sales.js'),
            import('./modules/tasks.js'),
            import('./modules/maintenance.js'),
            import('./modules/search.js'),
            import('./modules/users.js'),
            import('./modules/timeTracking.js')
        ]);
        
        modules.inventory = inventory;
        modules.sales = sales;
        modules.tasks = tasks;
        modules.maintenance = maintenance;
        modules.search = search;
        modules.users = users;
        modules.timeTracking = timeTracking;
        
        console.log('BPERP: Feature modules loaded');
        return true;
    } catch (error) {
        console.error('BPERP: Error loading modules:', error);
        showErrorMessage('Failed to load application modules. Error: ' + error.message);
        return false;
    }
}

function showErrorMessage(message) {
    const container = document.getElementById('dashboardContent');
    if (container) {
        container.innerHTML = `
            <div class="col-span-3 text-center py-20">
                <i class="fa-solid fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p class="text-gray-400 mb-2">${message}</p>
                <button onclick="location.reload()" class="bg-accentGreen text-white px-4 py-2 rounded mt-4 hover:bg-green-700">
                    <i class="fa-solid fa-refresh mr-2"></i>Reload Page
                </button>
            </div>
        `;
    }
}

// ==================== ROUTING ====================
const routes = {
    // Dashboard
    'dashboard': () => loadDashboard(),
    
    // Inventory
    'inventory-kanban': () => modules.inventory?.loadKanbanInventory(),
    'inventory-materials': () => modules.inventory?.loadMaterialInventory(),
    'inventory-tooling': () => modules.inventory?.loadToolingInventory(),
    'inventory-inspection': () => modules.inventory?.loadInspectionToolInventory(),
    'inventory-misc': () => modules.inventory?.loadMiscInventory(),
    'inventory-products': () => modules.inventory?.loadProductInventory(),
    'inventory-parts': () => modules.inventory?.loadPartsInventory(),
    
    // Workcenter
    'workcenter-wip': () => modules.sales?.loadWIPView(),
    
    // Sales
    'sales-customers': () => modules.sales?.loadCustomersView(),
    'sales-leads': () => modules.sales?.loadLeadsView(),
    'sales-quotes': () => modules.sales?.loadQuotesView(),
    'sales-archived-quotes': () => modules.sales?.loadArchiveView('quotes'),
    'sales-archived-work': () => modules.sales?.loadArchiveView('work'),
    
    // Tasks
    'tasks-all': () => modules.tasks?.loadAllTasks(),
    'tasks-ordering': () => modules.tasks?.loadOrderingTasks(),
    'tasks-programming': () => modules.tasks?.loadProgrammingTasks(),
    'tasks-processing': () => modules.tasks?.loadProcessingTasks(),
    'tasks-machining': () => modules.tasks?.loadMachiningTasks(),
    'tasks-postprocessing': () => modules.tasks?.loadPostProcessingTasks(),
    'tasks-inspection': () => modules.tasks?.loadInspectionTasks(),
    'tasks-shipping': () => modules.tasks?.loadShippingReceivingTasks(),
    'tasks-completed': () => modules.tasks?.loadCompletedWorkTasks(),
    'tasks-maintenance': () => modules.maintenance?.loadMaintenanceTasks(),
    'tasks-time-tracking': () => modules.timeTracking?.loadTimeTrackingView(),
    
    // Settings
    'settings-branding': () => ShopBranding.showSettings(),
    'settings-preferences': () => ThemeManager.showModal(),
    'settings-users': () => modules.users?.loadUsersView(),
    'settings-archive': () => modules.sales?.loadArchiveView('quotes'),
    'settings-backup': () => loadBackupRestoreView(),
    'settings-server': () => loadServerSettingsView(),
    'settings-about': () => void loadAboutAppView()
};

async function loadServerSettingsView() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    if (!window.electronAPI?.getServerUrl) {
        container.innerHTML = `
            <div class="col-span-3">
                <div class="card p-6">
                    <p class="text-gray-400">Server connection settings are only available in the desktop app.</p>
                </div>
            </div>
        `;
        return;
    }

    const currentUrl = await window.electronAPI.getServerUrl();
    const isNetworkMode = Boolean((currentUrl || '').trim());
    const networkModeNotice = isNetworkMode
        ? `
                <div class="mb-6 rounded-lg border border-amber-600/50 bg-amber-950/40 p-4 text-sm text-amber-100/95">
                    <p class="font-medium text-amber-200 mb-1">Network mode — UI comes from the server</p>
                    <p class="text-amber-100/80">The sidebar, pages, and JavaScript are loaded from the URL below, not from this installer. If items are missing (for example <strong class="text-amber-100">Products</strong> or <strong class="text-amber-100">Parts</strong> under Inventory), deploy the latest <code class="text-xs bg-black/30 px-1 rounded">frontend</code> folder from your repo onto the machine that runs the backend (alongside <code class="text-xs bg-black/30 px-1 rounded">backend</code>), then restart the BPERP server.</p>
                </div>`
        : `
                <div class="mb-6 rounded-lg border border-gray-600/50 bg-gray-800/40 p-4 text-sm text-gray-300">
                    <p class="font-medium text-gray-200 mb-1">Standalone mode</p>
                    <p class="text-gray-400">This app runs the bundled backend and serves the UI from your PC. If the UI looks outdated, install the latest BPERP build from your team.</p>
                </div>`;

    container.innerHTML = `
        <div class="col-span-3 space-y-6">
            <div class="card p-6">
                <div class="flex items-center mb-6">
                    <i class="fa-solid fa-server text-3xl mr-4 text-cyan-400"></i>
                    <div>
                        <h2 class="text-xl font-semibold text-white">Server Connection</h2>
                        <p class="text-gray-400 text-sm">Change the BPERP server URL (e.g. when NAS IP changes)</p>
                    </div>
                </div>
                ${networkModeNotice}
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-400 mb-2">Server URL</label>
                        <input type="text" id="serverUrlInput" class="form-input w-full" placeholder="http://192.168.1.100:3000" value="${(currentUrl || '').replace(/"/g, '&quot;')}">
                        <p class="text-xs text-gray-500 mt-1">e.g. http://nas.local:3000 or http://192.168.1.100:3000</p>
                    </div>
                    <div class="flex gap-3">
                        <button type="button" id="testServerBtn" class="btn btn-secondary">
                            <i class="fa-solid fa-link mr-2"></i>Test Connection
                        </button>
                        <button type="button" id="saveServerBtn" class="btn btn-primary">
                            <i class="fa-solid fa-save mr-2"></i>Save
                        </button>
                        <button type="button" id="clearServerBtn" class="btn bg-gray-600 hover:bg-gray-700 text-white">
                            <i class="fa-solid fa-times mr-2"></i>Clear (Standalone Mode)
                        </button>
                    </div>
                    <div id="serverStatus" class="text-sm hidden"></div>
                </div>
                <p class="text-xs text-gray-500 mt-4">Restart the app after changing the server URL.</p>
            </div>
        </div>
    `;

    const input = document.getElementById('serverUrlInput');
    const testBtn = document.getElementById('testServerBtn');
    const saveBtn = document.getElementById('saveServerBtn');
    const clearBtn = document.getElementById('clearServerBtn');
    const statusEl = document.getElementById('serverStatus');

    testBtn?.addEventListener('click', async () => {
        const url = input?.value?.trim() || '';
        if (!url) {
            modules.common?.showToast?.('Enter a server URL first', 'error');
            return;
        }
        testBtn.disabled = true;
        testBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Testing...';
        statusEl?.classList.add('hidden');
        try {
            const result = await window.electronAPI.testServerConnection(url);
            statusEl.classList.remove('hidden');
            if (result.success) {
                statusEl.textContent = '✓ Connection successful';
                statusEl.className = 'text-sm text-green-400';
            } else {
                statusEl.textContent = '✗ ' + (result.error || 'Connection failed');
                statusEl.className = 'text-sm text-red-400';
            }
        } catch (e) {
            statusEl.classList.remove('hidden');
            statusEl.textContent = '✗ ' + (e.message || 'Test failed');
            statusEl.className = 'text-sm text-red-400';
        }
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fa-solid fa-link mr-2"></i>Test Connection';
    });

    saveBtn?.addEventListener('click', async () => {
        const url = input?.value?.trim() || '';
        await window.electronAPI.setServerUrl(url);
        modules.common?.showToast?.('Server URL saved. Restart the app to connect.', 'success');
    });

    clearBtn?.addEventListener('click', async () => {
        await window.electronAPI.setServerUrl('');
        input.value = '';
        modules.common?.showToast?.('Cleared. Restart the app to use standalone mode.', 'success');
    });
}

async function loadAboutAppView() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    if (!window.electronAPI?.getAppInfo) {
        container.innerHTML = `
            <div class="col-span-3">
                <div class="card p-6">
                    <p class="text-gray-400">About this app is only available in the BPERP desktop application.</p>
                </div>
            </div>
        `;
        return;
    }

    let info;
    try {
        info = await window.electronAPI.getAppInfo();
    } catch (e) {
        container.innerHTML = `
            <div class="col-span-3">
                <div class="card p-6">
                    <p class="text-red-400">Could not load app information.</p>
                </div>
            </div>
        `;
        return;
    }

    const serverUrl = (info.serverUrl || '').trim();
    const network = Boolean(serverUrl);
    const modeLabel = network ? 'Network' : 'Standalone';
    const modeDesc = network
        ? 'Pages and scripts are loaded from the server URL below (not from the installed app files). If the UI looks outdated, deploy the latest <code class="text-xs bg-black/30 px-1 rounded">frontend</code> folder on that server, or clear Server URL and use Standalone to use the bundled UI.'
        : 'Pages and scripts come from this install (bundled frontend). The local backend runs on this PC.';

    const esc = (s) =>
        String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    container.innerHTML = `
        <div class="col-span-3 space-y-6">
            <div class="card p-6">
                <div class="flex items-center mb-6">
                    <i class="fa-solid fa-circle-info text-3xl mr-4 text-sky-400"></i>
                    <div>
                        <h2 class="text-xl font-semibold text-white">About this app</h2>
                        <p class="text-gray-400 text-sm">Version, deployment mode, and where the UI is loaded from</p>
                    </div>
                </div>
                <dl class="space-y-4 text-sm">
                    <div>
                        <dt class="text-gray-500 font-medium">App version</dt>
                        <dd class="text-white font-mono mt-1">${esc(info.version)}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500 font-medium">Packaged install</dt>
                        <dd class="text-gray-300 mt-1">${info.isPackaged ? 'Yes (installer or unpacked build)' : 'No (development run from repo)'}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500 font-medium">Mode</dt>
                        <dd class="text-gray-300 mt-1"><span class="text-white font-medium">${modeLabel}</span> — ${modeDesc}</dd>
                    </div>
                    ${network ? `
                    <div>
                        <dt class="text-gray-500 font-medium">Server URL (UI source)</dt>
                        <dd class="text-emerald-300/90 font-mono text-xs mt-1 break-all">${esc(serverUrl)}</dd>
                    </div>` : ''}
                    ${!network && info.sqliteDatabasePath ? `
                    <div>
                        <dt class="text-gray-500 font-medium">SQLite database (local backend)</dt>
                        <dd class="text-gray-400 font-mono text-xs mt-1 break-all">${esc(info.sqliteDatabasePath)}</dd>
                    </div>` : ''}
                    <div>
                        <dt class="text-gray-500 font-medium">Runtime</dt>
                        <dd class="text-gray-400 font-mono text-xs mt-1">Electron ${esc(info.electronVersion)} · Node ${esc(info.nodeVersion)}</dd>
                    </div>
                    <div>
                        <dt class="text-gray-500 font-medium">User data (settings persist here)</dt>
                        <dd class="text-gray-400 font-mono text-xs mt-1 break-all">${esc(info.userDataPath)}</dd>
                    </div>
                </dl>
                <p class="text-xs text-gray-500 mt-6">Uninstalling the app usually does not delete the user data folder above. The <strong class="text-gray-400">Server URL</strong> is stored there and survives reinstall.</p>
            </div>
        </div>
    `;
}

function loadBackupRestoreView() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-3 space-y-6">
            <div class="card p-6">
                <div class="flex items-center mb-6">
                    <i class="fa-solid fa-database text-3xl mr-4" style="color: var(--color-accent-primary);"></i>
                    <div>
                        <h2 class="text-xl font-semibold text-white">Backup & Restore</h2>
                        <p class="text-gray-400 text-sm">Manage your ERP data backups</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Backup Section -->
                    <div class="space-y-4">
                        <h3 class="text-lg font-medium text-white flex items-center">
                            <i class="fa-solid fa-download mr-2" style="color: var(--color-accent-primary);"></i>
                            Create Backup
                        </h3>
                        <p class="text-gray-400 text-sm">
                            Download a complete backup of all your ERP data including customers, quotes, work orders, inventory, and tasks.
                        </p>
                        <button data-action="create-backup" class="btn btn-primary w-full">
                            <i class="fa-solid fa-download mr-2"></i>Create Backup
                        </button>
                        <div class="text-xs text-gray-500">
                            <i class="fa-solid fa-info-circle mr-1"></i>
                            Backups are saved as JSON files and include a timestamp.
                        </div>
                    </div>

                    <!-- Restore Section -->
                    <div class="space-y-4">
                        <h3 class="text-lg font-medium text-white flex items-center">
                            <i class="fa-solid fa-upload mr-2" style="color: var(--color-accent-primary);"></i>
                            Restore from Backup
                        </h3>
                        <p class="text-gray-400 text-sm">
                            Restore your ERP data from a previously created backup file. This will replace all current data.
                        </p>
                        <div class="space-y-3">
                            <input type="file" id="backupFileInput" accept=".json" class="hidden">
                            <button data-action="select-backup-file" class="btn btn-secondary w-full">
                                <i class="fa-solid fa-file-import mr-2"></i>Select Backup File
                            </button>
                            <button data-action="restore-backup" class="btn btn-primary w-full" disabled id="restoreBtn">
                                <i class="fa-solid fa-upload mr-2"></i>Restore Data
                            </button>
                        </div>
                        <div class="text-xs text-red-400">
                            <i class="fa-solid fa-exclamation-triangle mr-1"></i>
                            Warning: This action cannot be undone. Make sure to backup current data first.
                        </div>
                    </div>
                </div>

                <!-- Backup History/Info -->
                <div class="mt-8 pt-6 border-t border-gray-700">
                    <h4 class="text-sm font-medium text-gray-400 mb-3">Backup Information</h4>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div class="bg-gray-800/50 p-3 rounded">
                            <div class="text-gray-400">Data Types Backed Up</div>
                            <div class="text-white font-medium">Customers, Quotes, Work Orders, Settings → Archive, Inventory, Tasks</div>
                        </div>
                        <div class="bg-gray-800/50 p-3 rounded">
                            <div class="text-gray-400">File Format</div>
                            <div class="text-white font-medium">JSON</div>
                        </div>
                        <div class="bg-gray-800/50 p-3 rounded">
                            <div class="text-gray-400">Last Backup</div>
                            <div class="text-white font-medium" id="lastBackupDate">Never</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Reset Demo Data Section -->
            <div class="card p-6">
                <div class="flex items-center mb-4">
                    <i class="fa-solid fa-flask text-2xl mr-3 text-yellow-500"></i>
                    <div>
                        <h3 class="text-lg font-medium text-white">Demo Data</h3>
                        <p class="text-gray-400 text-sm">Reset to fresh demo data for testing workflows</p>
                    </div>
                </div>
                <p class="text-gray-400 text-sm mb-4">
                    This will reset all quotes, work orders, and documents to the initial demo state. 
                    Includes sample quotes at various stages (New, Sent, Won, Lost) and work orders 
                    at different workflow stages. Useful for testing the complete quote-to-invoice workflow.
                </p>
                <button data-action="reset-demo-data" class="btn bg-yellow-600 hover:bg-yellow-700 text-white">
                    <i class="fa-solid fa-rotate-right mr-2"></i>Reset All Sales Data to Demo
                </button>
                <div class="text-xs text-yellow-400 mt-2">
                    <i class="fa-solid fa-info-circle mr-1"></i>
                    Includes 11 demo quotes (3 New, 3 Sent, 2 Won, 3 Lost), work orders, and sample documents.
                </div>
            </div>
        </div>
    `;

    setupBackupRestoreHandlers();
}

function setupBackupRestoreHandlers() {
    // Create backup
    document.addEventListener('click', function backupHandler(e) {
        if (e.target.closest('[data-action="create-backup"]')) {
            if (window.BPERP?.common?.createBackup) {
                window.BPERP.common.createBackup();
                updateLastBackupDate();
            } else {
                console.error('Backup function not available');
                modules.common?.showToast('Backup function not available', 'error');
            }
            backupHandler = null; // Remove listener
        }
    });

    // Select backup file
    document.addEventListener('click', function selectFileHandler(e) {
        if (e.target.closest('[data-action="select-backup-file"]')) {
            const fileInput = document.getElementById('backupFileInput');
            if (fileInput) {
                fileInput.click();
            }
            selectFileHandler = null; // Remove listener
        }
    });

    // Handle file selection
    const fileInput = document.getElementById('backupFileInput');
    const restoreBtn = document.getElementById('restoreBtn');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                restoreBtn.disabled = false;
                restoreBtn.innerHTML = `<i class="fa-solid fa-upload mr-2"></i>Restore from "${file.name}"`;
            } else {
                restoreBtn.disabled = true;
                restoreBtn.innerHTML = `<i class="fa-solid fa-upload mr-2"></i>Restore Data`;
            }
        });
    }

    // Restore backup
    document.addEventListener('click', function restoreHandler(e) {
        if (e.target.closest('[data-action="restore-backup"]')) {
            const fileInput = document.getElementById('backupFileInput');
            if (fileInput && fileInput.files[0]) {
                if (window.BPERP?.common?.restoreFromBackup) {
                    window.BPERP.common.restoreFromBackup(fileInput)
                        .then(() => {
                            // Reset file input and button
                            fileInput.value = '';
                            restoreBtn.disabled = true;
                            restoreBtn.innerHTML = `<i class="fa-solid fa-upload mr-2"></i>Restore Data`;
                        })
                        .catch(() => {
                            // Error already handled in restoreFromBackup
                        });
                } else {
                    console.error('Restore function not available');
                    modules.common?.showToast('Restore function not available', 'error');
                }
            }
            restoreHandler = null; // Remove listener
        }
    });
    
    // Reset demo data
    document.addEventListener('click', function resetDemoHandler(e) {
        if (e.target.closest('[data-action="reset-demo-data"]')) {
            if (confirm('This will reset all quotes, work orders, and documents to demo data. Your current data will be lost. Continue?')) {
                if (window.BPERP?.sales?.resetAllSalesToDemo) {
                    window.BPERP.sales.resetAllSalesToDemo();
                    modules.common?.showToast('All sales data reset to demo', 'success');
                    // Navigate to quotes to see the demo data
                    navigate('sales-quotes');
                } else if (window.BPERP?.sales?.resetWorkOrdersToDemo) {
                    // Fallback to old function if new one not available
                    window.BPERP.sales.resetWorkOrdersToDemo();
                    modules.common?.showToast('Work orders reset to demo data', 'success');
                    navigate('tasks-completed');
                } else {
                    console.error('Reset function not available');
                    modules.common?.showToast('Reset function not available', 'error');
                }
            }
            resetDemoHandler = null; // Remove listener
        }
    });
}

function updateLastBackupDate() {
    const lastBackupEl = document.getElementById('lastBackupDate');
    if (lastBackupEl) {
        lastBackupEl.textContent = new Date().toLocaleString();
    }
}

// showSettingsPlaceholder removed - replaced by users.loadUsersView()

// Map routes to tab categories for permission checking
const routeToCategory = {
    'dashboard': 'dashboard',
    'inventory-kanban': 'inventory',
    'inventory-products': 'inventory',
    'inventory-parts': 'inventory',
    'inventory-materials': 'inventory',
    'inventory-tooling': 'inventory',
    'inventory-misc': 'inventory',
    'workcenter-wip': 'workcenter',
    'sales-customers': 'sales',
    'sales-leads': 'sales',
    'sales-quotes': 'sales',
    'sales-archived-quotes': 'sales',
    'sales-archived-work': 'sales',
    'tasks-all': 'tasks',
    'tasks-ordering': 'tasks',
    'tasks-programming': 'tasks',
    'tasks-processing': 'tasks',
    'tasks-machining': 'tasks',
    'tasks-postprocessing': 'tasks',
    'tasks-inspection': 'tasks',
    'tasks-shipping': 'tasks',
    'tasks-completed': 'tasks',
    'tasks-maintenance': 'tasks',
    'tasks-time-tracking': 'tasks',
    'settings-branding': 'settings',
    'settings-preferences': 'settings',
    'settings-users': 'settings',
    'settings-archive': 'settings',
    'settings-backup': 'settings',
    'settings-server': 'settings',
    'settings-about': 'settings'
};

function checkRoutePermission(route) {
    // If user module is not loaded or user is not logged in, allow all routes
    if (!modules.users?.isLoggedIn?.()) {
        return true;
    }
    
    const category = routeToCategory[route];
    if (!category) return true;
    
    // Check permission
    return modules.users.hasPermission(category);
}

function navigate(route) {
    if (!window.BPERP.isInitialized) {
        console.warn('BPERP: App not initialized yet');
        return;
    }

    if (route !== 'dashboard') {
        clearDashboardPresencePoll();
    }

    const tasksClockBar = document.getElementById('tasksLaborClockBar');
    if (tasksClockBar) {
        const showContextLaborClock =
            route.startsWith('tasks-') || route === 'workcenter-wip';
        tasksClockBar.classList.toggle('hidden', !showContextLaborClock);
        if (showContextLaborClock) {
            import('./modules/laborClock.js').then((m) => m.refreshLaborClockUI?.());
        }
    }
    
    // Check permission before navigating
    if (!checkRoutePermission(route)) {
        modules.common?.showToast('You do not have permission to access this section', 'error');
        return;
    }
    
    const handler = routes[route];
    if (handler) {
        try {
            // Deactivate modules when navigating away from them
            // This prevents auto-refresh from running on inactive modules
            // tasks-maintenance (Machines) is served by maintenance.js, not tasks.js — still deactivate tasks
            if (!route.startsWith('tasks-') || route === 'tasks-maintenance' || route === 'tasks-time-tracking') {
                modules.tasks?.deactivate?.();
            }
            if (route !== 'tasks-time-tracking') {
                modules.timeTracking?.deactivate?.();
            }
            if (!route.startsWith('sales-') && route !== 'settings-archive') {
                modules.sales?.deactivate?.();
            }
            
            handler();
            updateSidebarActiveState(route);
            updatePageTitle(route);
        } catch (error) {
            console.error('BPERP: Navigation error:', error);
            modules.common?.showToast('Navigation error', 'error');
        }
    } else {
        console.warn('BPERP: Unknown route:', route);
    }
}

/**
 * Update sidebar visibility based on user permissions
 */
function updateSidebarPermissions() {
    if (!modules.users?.isLoggedIn?.()) {
        // Show all if not logged in
        document.querySelectorAll('[data-permission-category]').forEach(el => {
            el.style.display = '';
        });
        return;
    }
    
    const permissions = modules.users.getPermissions();
    
    // Update each section based on permission category
    document.querySelectorAll('[data-permission-category]').forEach(el => {
        const category = el.dataset.permissionCategory;
        if (permissions[category] === false) {
            el.style.display = 'none';
        } else {
            el.style.display = '';
        }
    });
    
    // Update user display in sidebar footer
    const user = modules.users.getCurrentUser();
    if (user) {
        const userNameEl = document.getElementById('currentUserName');
        const userRoleEl = document.getElementById('currentUserRole');
        if (userNameEl) userNameEl.textContent = user.name;
        if (userRoleEl) userRoleEl.textContent = user.role;
    }

    refreshLaborClockUI();
}

function updateSidebarActiveState(route) {
    // Remove all active states
    document.querySelectorAll('[data-route]').forEach(el => {
        el.classList.remove('bg-gray-700', 'text-accentGreen', 'active');
        el.classList.add('text-gray-400');
    });
    
    // Add active state to current route
    const activeEl = document.querySelector(`[data-route="${route}"]`);
    if (activeEl) {
        activeEl.classList.add('bg-gray-700', 'text-accentGreen', 'active');
        activeEl.classList.remove('text-gray-400');
        
        // If this item is in a dropdown, make sure the dropdown is open
        const parentDropdown = activeEl.closest('.sidebar-dropdown');
        if (parentDropdown) {
            const trigger = parentDropdown.querySelector('.sidebar-dropdown-trigger');
            const menu = parentDropdown.querySelector('.sidebar-dropdown-menu');
            const chevron = trigger?.querySelector('.dropdown-chevron');
            
            if (menu && menu.classList.contains('hidden')) {
                menu.classList.remove('hidden');
                if (chevron) chevron.classList.add('rotate-180');
            }
        }
    }
}

function updatePageTitle(route) {
    const titleEl = document.getElementById('pageTitle');
    if (!titleEl) return;
    
    const titles = {
        'dashboard': 'Dashboard',
        'inventory-kanban': 'Kanban',
        'inventory-products': 'Products Inventory',
        'inventory-parts': 'Parts Inventory',
        'inventory-materials': 'Materials Inventory',
        'inventory-tooling': 'Tooling Inventory',
        'inventory-inspection': 'Inspection tool inventory',
        'inventory-misc': 'Miscellaneous Items',
        'workcenter-wip': 'Work In Progress',
        'sales-customers': 'Customers',
        'sales-leads': 'Leads',
        'sales-quotes': 'Quotes',
        'sales-archived-quotes': 'Archived Quotes',
        'sales-archived-work': 'Archived Work Orders',
        'tasks-all': 'All Tasks',
        'tasks-ordering': 'Ordering Tasks',
        'tasks-programming': 'Programming Tasks',
        'tasks-processing': 'Material Processing',
        'tasks-machining': 'Machining Tasks',
        'tasks-postprocessing': 'Post Processing Tasks',
        'tasks-inspection': 'Inspection Tasks',
        'tasks-shipping': 'Shipping & Receiving',
        'tasks-completed': 'Completed Work',
        'tasks-maintenance': 'Machines',
        'tasks-time-tracking': 'Time Tracking',
        'settings-branding': 'Shop Branding',
        'settings-users': 'Users & Permissions',
        'settings-archive': 'Archive',
        'settings-backup': 'Backup & Restore',
        'settings-server': 'Server Connection',
        'settings-about': 'About this app',
        'settings-preferences': 'Preferences'
    };
    
    titleEl.textContent = titles[route] || 'Dashboard';
}

// ==================== DASHBOARD ====================
function loadDashboard() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    clearDashboardPresencePoll();
    
    let workOrders = [];
    try {
        workOrders = modules.sales?.getWorkOrders() || [];
    } catch (e) {
        console.warn('Could not get work orders:', e);
    }
    
    const activeWOs = workOrders.filter(wo => wo.completionPercentage < 100);
    
    container.innerHTML = `
        <div class="col-span-3">
            <h2 class="text-2xl font-bold text-white mb-6">Dashboard</h2>

            <!-- Who is clocked in -->
            <div class="card p-6 mb-6" style="background: var(--color-card-bg, #1f2937);">
                <h3 class="text-lg font-medium text-white mb-3">
                    <i class="fa-solid fa-users-viewfinder mr-2" style="color: var(--color-accent-primary);"></i>On the floor
                </h3>
                <p class="text-xs mb-3" style="color: var(--color-text-muted);">Users currently on shop shift and their active job timer (if any).</p>
                <div id="dashboardPresenceCard">
                    <p class="text-sm" style="color: var(--color-text-muted);">Loading…</p>
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div class="card p-6 mb-6">
                <h3 class="text-lg font-medium text-white mb-4">Quick Actions</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button data-route="workcenter-wip" class="card p-4 text-center transition-colors">
                        <i class="fa-solid fa-clipboard-list text-2xl mb-2 block" style="color: var(--color-info);"></i>
                        <p class="text-sm" style="color: var(--color-text-secondary);">Work In Progress</p>
                    </button>
                    <button data-route="tasks-all" class="card p-4 text-center transition-colors">
                        <i class="fa-solid fa-tasks text-2xl mb-2 block" style="color: var(--color-accent-secondary);"></i>
                        <p class="text-sm" style="color: var(--color-text-secondary);">All Tasks</p>
                    </button>
                    <button data-route="inventory-kanban" class="card p-4 text-center transition-colors">
                        <i class="fa-solid fa-table-columns text-2xl mb-2 block" style="color: var(--color-warning);"></i>
                        <p class="text-sm" style="color: var(--color-text-secondary);">Kanban</p>
                    </button>
                    <button data-route="tasks-maintenance" class="card p-4 text-center transition-colors">
                        <i class="fa-solid fa-wrench text-2xl mb-2 block" style="color: var(--color-error);"></i>
                        <p class="text-sm" style="color: var(--color-text-secondary);">Maintenance</p>
                    </button>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="card p-6">
                <h3 class="text-lg font-medium text-white mb-4">Recent Work Orders</h3>
                <div class="space-y-2">
                    ${activeWOs.slice(0, 5).map(wo => {
                        const urgencyColor = modules.common?.getUrgencyColor(wo.dueDate) || 'gray';
                        const dueDate = modules.common?.formatDate(wo.dueDate) || wo.dueDate;
                        return `
                            <div class="flex justify-between items-center p-3 rounded-lg border-l-4" style="background: var(--color-dark-bg); border-color: var(--color-${urgencyColor === 'red' ? 'error' : urgencyColor === 'yellow' ? 'warning' : 'success'});">
                                <div>
                                    <span class="font-medium text-white">${wo.woNumber}</span>
                                    <span class="ml-2" style="color: var(--color-text-muted);">${wo.partNumber}</span>
                                </div>
                                <div class="flex items-center space-x-4">
                                    <div class="w-24 rounded-full h-2" style="background: var(--color-border);">
                                        <div class="h-2 rounded-full" style="width: ${wo.completionPercentage}%; background: var(--color-accent-primary);"></div>
                                    </div>
                                    <span class="text-sm" style="color: var(--color-text-muted);">${dueDate}</span>
                                </div>
                            </div>
                        `;
                    }).join('') || '<p class="text-center py-4" style="color: var(--color-text-muted);">No active work orders</p>'}
                </div>
            </div>
        </div>
    `;

    void refreshDashboardPresenceCard();
    dashboardPresencePollInterval = setInterval(() => {
        if (document.getElementById('dashboardPresenceCard')) {
            void refreshDashboardPresenceCard();
        } else {
            clearDashboardPresencePoll();
        }
    }, CONFIG.AUTO_REFRESH_INTERVAL);
}

// ==================== QUICK ADD DROPDOWN ====================
function setupQuickAddDropdown() {
    console.log('BPERP: Setting up Quick Add dropdown...');
    
    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
        const btn = document.getElementById('quickAddBtn');
        const dropdown = document.getElementById('quickAddDropdown');
        const backdrop = document.getElementById('quickAddBackdrop');
        
        console.log('BPERP: Quick Add elements found:', { btn: !!btn, dropdown: !!dropdown, backdrop: !!backdrop });
        
        if (!btn || !dropdown) {
            console.warn('BPERP: Quick Add elements not found in DOM');
            return;
        }
        
        console.log('BPERP: Dropdown initial state:', {
            hasHiddenClass: dropdown.classList.contains('hidden'),
            display: dropdown.style.display,
            computedDisplay: window.getComputedStyle(dropdown).display
        });
        
        const showDropdown = () => {
            console.log('BPERP: Showing dropdown with inline styles');
            // Show backdrop and dropdown first
            if (backdrop) {
                backdrop.style.display = 'block';
                console.log('BPERP: Backdrop shown');
            }
            dropdown.style.display = 'block';
            console.log('BPERP: Dropdown displayed');
            
            // Force reflow to ensure dimensions are calculated
            const height1 = dropdown.offsetHeight;
            console.log('BPERP: Dropdown offsetHeight:', height1);
            
            // Calculate center position using fixed width (w-72 = 288px)
            const dropdownWidth = 288;
            const dropdownHeight = dropdown.offsetHeight || 400; // fallback height
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const left = Math.max(20, (windowWidth - dropdownWidth) / 2);
            const top = Math.max(20, (windowHeight - dropdownHeight) / 2);
            
            console.log('BPERP: Window dimensions:', { windowWidth, windowHeight });
            console.log('BPERP: Positioning dropdown at', { left, top, width: dropdownWidth, height: dropdownHeight });
            dropdown.style.left = `${left}px`;
            dropdown.style.top = `${top}px`;
            console.log('BPERP: Dropdown positioned and displayed');
        };
        
        const hideDropdown = () => {
            console.log('BPERP: Hiding dropdown');
            dropdown.style.display = 'none';
            if (backdrop) backdrop.style.display = 'none';
        };
        
        // Main button click handler
        btn.addEventListener('click', (e) => {
            console.log('BPERP: Quick Add button clicked');
            console.log('BPERP: Dropdown display style:', dropdown.style.display);
            e.preventDefault();
            e.stopPropagation();
            
            if (dropdown.style.display === 'none') {
                console.log('BPERP: Dropdown is hidden, showing it');
                showDropdown();
            } else {
                console.log('BPERP: Dropdown is visible, hiding it');
                hideDropdown();
            }
        });
        
        // Close dropdown when clicking backdrop
        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                console.log('BPERP: Backdrop clicked');
                e.preventDefault();
                hideDropdown();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== btn && !e.target.closest('[data-action]') && dropdown.style.display !== 'none') {
                hideDropdown();
            }
        });
        
        // Close dropdown after action is selected
        dropdown.querySelectorAll('[data-action]').forEach(item => {
            item.addEventListener('click', (e) => {
                console.log('BPERP: Action selected:', e.target.dataset.action);
                hideDropdown();
            });
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dropdown.style.display !== 'none') {
                hideDropdown();
            }
        });
        
        // Close button
        const closeBtn = document.getElementById('quickAddCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                console.log('BPERP: Close button clicked');
                e.preventDefault();
                hideDropdown();
            });
        }
        
        console.log('BPERP: Quick Add dropdown setup complete');
    }, 100);
}

// ==================== ALERTS BELL ====================
function setupAlertsBell() {
    const bellBtn = document.querySelector('[role="button"]');
    const bellIcon = document.querySelector('[role="button"] .fa-bell');
    
    if (!bellIcon) {
        // Find by the actual button in header
        const headerButtons = document.querySelectorAll('header button');
        const actualBell = Array.from(headerButtons).find(btn => {
            return btn.querySelector('.fa-bell');
        });
        
        if (actualBell) {
            actualBell.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showAlertsModal();
            });
        }
    }
}

function showAlertsModal() {
    // Create alerts modal
    const modal = document.createElement('div');
    modal.id = 'alertsModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onclick="this.parentElement.remove()"></div>
        <div class="bg-cardBg border border-gray-700 rounded-xl shadow-2xl max-w-md w-96 max-h-96 overflow-y-auto z-50">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0 bg-cardBg">
                <h3 class="text-white font-medium"><i class="fa-solid fa-bell text-yellow-400 mr-2"></i>Notifications</h3>
                <button onclick="document.getElementById('alertsModal').remove()" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <!-- Alerts List -->
            <div class="divide-y divide-gray-700">
                <div class="px-6 py-4 hover:bg-gray-800 transition-colors">
                    <div class="flex items-start gap-3">
                        <i class="fa-solid fa-exclamation-circle text-red-500 mt-1"></i>
                        <div class="flex-1">
                            <p class="text-white font-medium text-sm">Work Order WO-2024-001 Overdue</p>
                            <p class="text-gray-400 text-xs mt-1">Due date was 2 days ago</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-4 hover:bg-gray-800 transition-colors">
                    <div class="flex items-start gap-3">
                        <i class="fa-solid fa-clock text-yellow-500 mt-1"></i>
                        <div class="flex-1">
                            <p class="text-white font-medium text-sm">Quote QT-2024-045 Due Today</p>
                            <p class="text-gray-400 text-xs mt-1">Customer waiting for response</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 py-4 hover:bg-gray-800 transition-colors">
                    <div class="flex items-start gap-3">
                        <i class="fa-solid fa-check-circle text-green-500 mt-1"></i>
                        <div class="flex-1">
                            <p class="text-white font-medium text-sm">Material for WO-2024-038 Arrived</p>
                            <p class="text-gray-400 text-xs mt-1">Lot #ML-2024-156 in receiving</p>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-700 text-center">
                <button onclick="document.getElementById('alertsModal').remove()" class="text-accentGreen text-sm hover:text-green-400">
                    View All Notifications
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ==================== SIDEBAR DROPDOWNS ====================
function setupSidebarDropdowns() {
    console.log('BPERP: Setting up sidebar dropdowns...');
    
    const dropdownTriggers = document.querySelectorAll('.sidebar-dropdown-trigger');
    
    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const dropdownName = trigger.dataset.dropdown;
            const menu = document.querySelector(`[data-dropdown-menu="${dropdownName}"]`);
            const chevron = trigger.querySelector('.dropdown-chevron');
            
            if (!menu) return;
            
            // Check if this dropdown is currently open
            const isOpen = !menu.classList.contains('hidden');
            
            // Close all other dropdowns first
            document.querySelectorAll('.sidebar-dropdown-menu').forEach(otherMenu => {
                otherMenu.classList.add('hidden');
            });
            document.querySelectorAll('.dropdown-chevron').forEach(otherChevron => {
                otherChevron.classList.remove('rotate-180');
            });
            
            // Toggle this dropdown
            if (!isOpen) {
                menu.classList.remove('hidden');
                if (chevron) chevron.classList.add('rotate-180');
            }
        });
    });
    
    console.log('BPERP: Sidebar dropdowns ready');
}

// ==================== EVENT DELEGATION ====================
function setupGlobalEventDelegation() {
    // Navigation clicks
    document.addEventListener('click', (e) => {
        const routeTarget = e.target.closest('[data-route]');
        if (routeTarget) {
            e.preventDefault();
            navigate(routeTarget.dataset.route);
        }
    });
}

// ==================== INITIALIZATION ====================
async function initializeApp() {
    console.log('BPERP: Starting initialization...');
    
    // Load modules
    const loaded = await loadModules();
    if (!loaded) {
        return;
    }
    
    try {
        // Expose modules globally
        window.BPERP = {
            common: {
                ...modules.common,
                createBackup: createBackup,
                restoreFromBackup: restoreFromBackup
            },
            storage: modules.storage,
            inventory: modules.inventory,
            sales: modules.sales,
            tasks: modules.tasks,
            maintenance: modules.maintenance,
            search: modules.search,
            users: modules.users,
            timeTracking: modules.timeTracking,
            config: CONFIG,
            navigate,
            isInitialized: false
        };
        
        // Initialize users module
        if (modules.users?.init) modules.users.init();
        
        // Initialize DOM cache
        if (modules.common?.DOMCache?.init) {
            modules.common.DOMCache.init();
        }
        
        // Setup global event delegation first
        setupGlobalEventDelegation();
        
        // Setup sidebar dropdowns
        setupSidebarDropdowns();
        
        // Setup module event delegation
        if (modules.common?.setupEventDelegation) {
            modules.common.setupEventDelegation();
        }
        
        // Register module action handlers
        if (modules.common?.registerActionHandler) {
            const register = modules.common.registerActionHandler;
            
            if (modules.inventory?.registerActionHandlers) {
                modules.inventory.registerActionHandlers(register);
            }
            if (modules.sales?.registerActionHandlers) {
                modules.sales.registerActionHandlers(register);
            }
            if (modules.tasks?.registerActionHandlers) {
                modules.tasks.registerActionHandlers(register);
            }
            if (modules.maintenance?.registerActionHandlers) {
                modules.maintenance.registerActionHandlers(register);
            }
        }
        
        // Initialize modules
        if (modules.inventory?.init) modules.inventory.init();
        if (modules.sales?.init) modules.sales.init();
        if (modules.tasks?.init) modules.tasks.init();
        if (modules.maintenance?.init) modules.maintenance.init();
        // Note: users module init is called earlier
        
        // Preload demo data so search works immediately
        console.log('BPERP: Preloading demo data...');
        try {
            // These calls ensure demo data is loaded into storage
            modules.inventory?.getMaterials?.();
            modules.inventory?.getTooling?.();
            modules.inventory?.getMiscItems?.();
            modules.sales?.getCustomers?.();
            modules.sales?.getQuotes?.();
            modules.sales?.getWorkOrders?.();
            modules.sales?.getLeads?.();
            console.log('BPERP: Demo data preloaded');
        } catch (e) {
            console.warn('BPERP: Could not preload some demo data:', e);
        }
        
        // Mark as initialized
        window.BPERP.isInitialized = true;

        initLaborClockUI();
        
        // Load initial view (dashboard)
        loadDashboard();
        updateSidebarActiveState('dashboard');
        
        // Setup Quick Add dropdown
        setupQuickAddDropdown();
        
        // Setup Alerts bell
        setupAlertsBell();
        
        // Setup logout button
        setupLogoutButton();
        
        // Setup global search
        if (modules.search?.setupGlobalSearch) {
            modules.search.setupGlobalSearch();
        }
        
        // Setup offline indicator
        setupOfflineIndicator();
        
        // Initialize theme manager
        ThemeManager.init();
        
        // Initialize shop branding
        ShopBranding.init();
        
        // Show desktop-only Settings entries when running in Electron
        const serverNav = document.getElementById('settingsServerNav');
        if (serverNav && window.electronAPI) {
            serverNav.style.display = '';
        }
        const aboutNav = document.getElementById('settingsAboutNav');
        if (aboutNav && window.electronAPI?.getAppInfo) {
            aboutNav.style.display = '';
        }
        
        // Check if user is logged in, if not show login modal
        if (modules.users?.isLoggedIn?.()) {
            // User is already logged in, apply their settings
            const userSettings = modules.users.getAppearanceSettings();
            if (userSettings) {
                ThemeManager.applyTheme(userSettings.theme || 'automation');
                ThemeManager.applyDisplayOptions(userSettings);
                ThemeManager.applyTransparency(userSettings.transparency || 50);
            }
            updateSidebarPermissions();
        } else {
            // Show login modal and wait for login
            modules.users?.showLoginModal?.((user) => {
                // Apply user's appearance settings
                const userSettings = user.appearance_settings || {};
                ThemeManager.applyTheme(userSettings.theme || 'automation');
                ThemeManager.applyDisplayOptions(userSettings);
                ThemeManager.applyTransparency(userSettings.transparency || 50);
                
                // Update sidebar permissions
                updateSidebarPermissions();
                
                // Reload dashboard to reflect user state
                loadDashboard();
            });
        }
        
        console.log('BPERP: Application initialized successfully');
    } catch (error) {
        console.error('BPERP: Initialization error:', error);
        showErrorMessage('Application initialization failed: ' + error.message);
    }
}

function setupOfflineIndicator() {
    const updateOnlineStatus = () => {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.toggle('hidden', navigator.onLine);
        }
    };
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to log out?')) {
                await modules.users?.logout?.();
                modules.common?.showToast?.('Logged out successfully', 'success');
                
                // Show login modal again
                modules.users?.showLoginModal?.((user) => {
                    // Apply user's appearance settings
                    const userSettings = user.appearance_settings || {};
                    ThemeManager.applyTheme(userSettings.theme || 'automation');
                    ThemeManager.applyDisplayOptions(userSettings);
                    ThemeManager.applyTransparency(userSettings.transparency || 50);
                    
                    // Update sidebar permissions
                    updateSidebarPermissions();
                    
                    // Reload dashboard
                    loadDashboard();
                });
            }
        });
    }
}

// ==================== THEME MANAGEMENT ====================
const ThemeManager = {
    STORAGE_KEY: 'bperp_theme_preferences',
    
    defaults: {
        theme: 'automation',
        showGrid: true,
        showGlow: true,
        animations: true,
        transparency: 50  // 50 = Solid (right side of slider)
    },
    
    init() {
        // Load saved preferences
        const prefs = this.getPreferences();
        this.applyTheme(prefs.theme);
        this.applyDisplayOptions(prefs);
        this.applyTransparency(prefs.transparency);
        this.setupModal();
        this.updateThemeSelector(prefs.theme);
    },
    
    getPreferences() {
        try {
            // First check if user is logged in and has appearance settings
            if (modules.users?.isLoggedIn?.() && modules.users?.getAppearanceSettings) {
                const userSettings = modules.users.getAppearanceSettings();
                if (userSettings && Object.keys(userSettings).length > 0) {
                    return { ...this.defaults, ...userSettings };
                }
            }
            
            // Fall back to localStorage
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                return { ...this.defaults, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Could not load theme preferences:', e);
        }
        return { ...this.defaults };
    },
    
    savePreferences(prefs) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
            
            // Also save to user profile if logged in
            if (modules.users?.isLoggedIn?.() && modules.users?.updateAppearanceSettings) {
                modules.users.updateAppearanceSettings(prefs)
                    .then(result => {
                        if (result.success) {
                            console.log('BPERP: Appearance settings saved to user profile');
                        }
                    })
                    .catch(e => console.warn('Could not save to user profile:', e));
            }
        } catch (e) {
            console.warn('Could not save theme preferences:', e);
        }
    },
    
    applyTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        console.log('BPERP: Applied theme:', themeName);
    },
    
    applyDisplayOptions(prefs) {
        document.documentElement.setAttribute('data-no-grid', !prefs.showGrid);
        document.documentElement.setAttribute('data-no-glow', !prefs.showGlow);
        document.documentElement.setAttribute('data-reduce-motion', !prefs.animations);
    },
    
    applyTransparency(sliderValue) {
        // Slider: 0 = Glass (max transparency), 50 = Solid (no transparency)
        // Invert the value: transparency = 50 - sliderValue
        const transparencyLevel = 50 - sliderValue;
        const opacity = 1 - (transparencyLevel / 100);
        
        // Apply transparency to cards, sidebar, header
        document.documentElement.style.setProperty('--panel-opacity', opacity);
        
        // Set data attribute for CSS selectors
        if (transparencyLevel > 0) {
            document.documentElement.setAttribute('data-transparency', transparencyLevel);
        } else {
            document.documentElement.removeAttribute('data-transparency');
        }
        
        // Update transparency value display (show actual transparency percentage)
        const valueDisplay = document.getElementById('transparency-value');
        if (valueDisplay) {
            valueDisplay.textContent = `${transparencyLevel}%`;
        }
    },
    
    setupModal() {
        const modal = document.getElementById('themeModal');
        const closeBtn = document.getElementById('closeThemeModal');
        const saveBtn = document.getElementById('saveTheme');
        const resetBtn = document.getElementById('resetTheme');
        const transparencySlider = document.getElementById('pref-transparency');
        
        if (!modal) return;
        
        // Close button
        closeBtn?.addEventListener('click', () => this.hideModal());
        
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideModal();
        });
        
        // Theme option clicks
        document.querySelectorAll('.theme-option[data-theme]').forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;
                this.applyTheme(theme);
                this.updateThemeSelector(theme);
            });
        });
        
        // Transparency slider live preview
        transparencySlider?.addEventListener('input', (e) => {
            this.applyTransparency(parseInt(e.target.value));
        });
        
        // Save button
        saveBtn?.addEventListener('click', () => {
            const activeTheme = document.querySelector('.theme-option.active')?.dataset.theme || 'automation';
            const prefs = {
                theme: activeTheme,
                showGrid: document.getElementById('pref-grid')?.checked ?? true,
                showGlow: document.getElementById('pref-glow')?.checked ?? true,
                animations: document.getElementById('pref-animations')?.checked ?? true,
                transparency: parseInt(document.getElementById('pref-transparency')?.value || 0)
            };
            
            this.savePreferences(prefs);
            this.applyDisplayOptions(prefs);
            this.hideModal();
            modules.common?.showToast?.('Preferences saved!', 'success');
        });
        
        // Reset button
        resetBtn?.addEventListener('click', () => {
            this.applyTheme(this.defaults.theme);
            this.updateThemeSelector(this.defaults.theme);
            this.applyDisplayOptions(this.defaults);
            this.applyTransparency(this.defaults.transparency);
            
            // Update checkboxes and slider
            const gridCheckbox = document.getElementById('pref-grid');
            const glowCheckbox = document.getElementById('pref-glow');
            const animCheckbox = document.getElementById('pref-animations');
            const transparencySlider = document.getElementById('pref-transparency');
            if (gridCheckbox) gridCheckbox.checked = true;
            if (glowCheckbox) glowCheckbox.checked = true;
            if (animCheckbox) animCheckbox.checked = true;
            if (transparencySlider) transparencySlider.value = 0;
        });
    },
    
    updateThemeSelector(themeName) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.toggle('active', option.dataset.theme === themeName);
        });
    },
    
    showModal() {
        const modal = document.getElementById('themeModal');
        if (modal) {
            // Load current preferences into form
            const prefs = this.getPreferences();
            this.updateThemeSelector(prefs.theme);
            
            const gridCheckbox = document.getElementById('pref-grid');
            const glowCheckbox = document.getElementById('pref-glow');
            const animCheckbox = document.getElementById('pref-animations');
            const transparencySlider = document.getElementById('pref-transparency');
            if (gridCheckbox) gridCheckbox.checked = prefs.showGrid;
            if (glowCheckbox) glowCheckbox.checked = prefs.showGlow;
            if (animCheckbox) animCheckbox.checked = prefs.animations;
            if (transparencySlider) {
                transparencySlider.value = prefs.transparency || 0;
                this.applyTransparency(prefs.transparency || 0);
            }
            
            modal.style.display = 'flex';
        }
    },
    
    hideModal() {
        const modal = document.getElementById('themeModal');
        if (modal) {
            modal.style.display = 'none';
            // Revert to saved theme and transparency if cancelled
            const prefs = this.getPreferences();
            this.applyTheme(prefs.theme);
            this.applyTransparency(prefs.transparency || 0);
        }
    }
};

// Expose ThemeManager globally
window.ThemeManager = ThemeManager;

// ==================== SHOP BRANDING MANAGEMENT ====================
const ShopBranding = {
    STORAGE_KEY: 'bperp_shop_branding',
    
    defaults: {
        shopName: 'Your Shop Name',
        tagline: 'Manufacturing ERP',
        logoUrl: 'assets/modern-logo.png',
        logoData: null  // Base64 data for custom uploaded logos
    },
    
    init() {
        // Load and apply saved branding
        const branding = this.getBranding();
        this.applyBranding(branding);
        
        // Setup click handler for brand area
        const brandArea = document.getElementById('shopBrandArea');
        if (brandArea) {
            brandArea.addEventListener('click', () => {
                // Only allow admins to change branding
                if (modules.users?.isAdmin?.() || !modules.users?.isLoggedIn?.()) {
                    this.showSettings();
                } else {
                    modules.common?.showToast?.('Only administrators can change shop branding', 'info');
                }
            });
        }
    },
    
    getBranding() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                return { ...this.defaults, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Could not load shop branding:', e);
        }
        return { ...this.defaults };
    },
    
    saveBranding(branding) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(branding));
            this.applyBranding(branding);
            return true;
        } catch (e) {
            console.warn('Could not save shop branding:', e);
            return false;
        }
    },
    
    applyBranding(branding) {
        // Update shop name
        const nameEl = document.getElementById('shopName');
        if (nameEl) nameEl.textContent = branding.shopName || this.defaults.shopName;
        
        // Update tagline
        const taglineEl = document.getElementById('shopTagline');
        if (taglineEl) taglineEl.textContent = branding.tagline || this.defaults.tagline;
        
        // Update logo
        const logoEl = document.getElementById('shopLogo');
        if (logoEl) {
            if (branding.logoData) {
                logoEl.src = branding.logoData;
            } else if (branding.logoUrl) {
                logoEl.src = branding.logoUrl;
            } else {
                logoEl.src = this.defaults.logoUrl;
            }
            logoEl.alt = branding.shopName || 'Shop Logo';
        }
        
        // Update page title
        document.title = `${branding.shopName || 'BPERP'} - Manufacturing ERP`;
    },
    
    showSettings() {
        const container = document.getElementById('dashboardContent');
        if (!container) return;
        
        const branding = this.getBranding();
        const currentLogo = branding.logoData || branding.logoUrl || this.defaults.logoUrl;
        
        container.innerHTML = `
            <div class="col-span-3 space-y-6">
                <!-- Header -->
                <div class="flex items-center">
                    <i class="fa-solid fa-store text-3xl mr-4" style="color: var(--color-accent-primary);"></i>
                    <div>
                        <h2 class="text-xl font-semibold text-white">Shop Branding</h2>
                        <p class="text-gray-400 text-sm">Customize your shop's name and logo</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Branding Form -->
                    <div class="card p-6">
                        <h3 class="text-lg font-medium text-white mb-4">
                            <i class="fa-solid fa-pen mr-2" style="color: var(--color-accent-primary);"></i>
                            Shop Information
                        </h3>
                        
                        <form id="brandingForm" class="space-y-4">
                            <div>
                                <label class="block text-gray-400 text-sm mb-1">Shop Name</label>
                                <input type="text" id="brandingShopName" value="${branding.shopName || ''}" 
                                       placeholder="Enter your shop name"
                                       class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none">
                                <p class="text-gray-500 text-xs mt-1">This appears in the sidebar and browser tab</p>
                            </div>
                            
                            <div>
                                <label class="block text-gray-400 text-sm mb-1">Tagline</label>
                                <input type="text" id="brandingTagline" value="${branding.tagline || ''}" 
                                       placeholder="Manufacturing ERP"
                                       class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none">
                                <p class="text-gray-500 text-xs mt-1">Short description shown below shop name</p>
                            </div>
                            
                            <div>
                                <label class="block text-gray-400 text-sm mb-2">Shop Logo</label>
                                <div class="flex items-start gap-4">
                                    <div class="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0" style="background: var(--color-dark-bg);">
                                        <img id="logoPreview" src="${currentLogo}" alt="Logo Preview" class="w-full h-full object-contain">
                                    </div>
                                    <div class="flex-1 space-y-2">
                                        <input type="file" id="logoFileInput" accept="image/*" class="hidden">
                                        <button type="button" id="uploadLogoBtn" class="btn btn-secondary w-full">
                                            <i class="fa-solid fa-upload mr-2"></i>Upload Logo
                                        </button>
                                        <button type="button" id="resetLogoBtn" class="btn btn-secondary w-full text-sm">
                                            <i class="fa-solid fa-undo mr-2"></i>Reset to Default
                                        </button>
                                        <p class="text-gray-500 text-xs">Recommended: Square image, 200x200px or larger</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="pt-4 border-t border-gray-700 flex gap-3">
                                <button type="submit" class="btn btn-primary flex-1">
                                    <i class="fa-solid fa-save mr-2"></i>Save Changes
                                </button>
                                <button type="button" id="resetAllBrandingBtn" class="btn btn-secondary">
                                    <i class="fa-solid fa-rotate-left mr-2"></i>Reset All
                                </button>
                            </div>
                        </form>
                    </div>
                    
                    <!-- Preview -->
                    <div class="card p-6">
                        <h3 class="text-lg font-medium text-white mb-4">
                            <i class="fa-solid fa-eye mr-2" style="color: var(--color-accent-primary);"></i>
                            Live Preview
                        </h3>
                        
                        <div class="rounded-lg p-4" style="background: var(--color-dark-bg);">
                            <p class="text-gray-500 text-xs mb-3 uppercase tracking-wide">Sidebar Header Preview</p>
                            <div class="flex items-center gap-3 p-3 rounded-lg" style="background: var(--color-card-bg); border: 1px solid var(--color-border);">
                                <img id="previewLogo" src="${currentLogo}" alt="Preview" class="w-12 h-12 object-contain rounded-lg">
                                <div>
                                    <h4 id="previewName" class="font-bold text-white">${branding.shopName || this.defaults.shopName}</h4>
                                    <p id="previewTagline" class="text-xs text-gray-500">${branding.tagline || this.defaults.tagline}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mt-6 p-4 rounded-lg" style="background: rgba(var(--color-info-rgb), 0.1); border: 1px solid var(--color-info);">
                            <h4 class="text-sm font-medium text-white mb-2">
                                <i class="fa-solid fa-info-circle mr-2" style="color: var(--color-info);"></i>
                                Tips for Best Results
                            </h4>
                            <ul class="text-sm text-gray-400 space-y-1">
                                <li>• Use a square logo (1:1 aspect ratio)</li>
                                <li>• PNG with transparent background works best</li>
                                <li>• Keep shop name concise for sidebar display</li>
                                <li>• Branding is saved locally to this browser</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupBrandingHandlers();
    },
    
    setupBrandingHandlers() {
        const form = document.getElementById('brandingForm');
        const shopNameInput = document.getElementById('brandingShopName');
        const taglineInput = document.getElementById('brandingTagline');
        const fileInput = document.getElementById('logoFileInput');
        const uploadBtn = document.getElementById('uploadLogoBtn');
        const resetLogoBtn = document.getElementById('resetLogoBtn');
        const resetAllBtn = document.getElementById('resetAllBrandingBtn');
        
        // Live preview updates
        const updatePreview = () => {
            const previewName = document.getElementById('previewName');
            const previewTagline = document.getElementById('previewTagline');
            if (previewName) previewName.textContent = shopNameInput.value || this.defaults.shopName;
            if (previewTagline) previewTagline.textContent = taglineInput.value || this.defaults.tagline;
        };
        
        shopNameInput?.addEventListener('input', updatePreview);
        taglineInput?.addEventListener('input', updatePreview);
        
        // Upload logo button
        uploadBtn?.addEventListener('click', () => fileInput?.click());
        
        // Handle file selection
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                modules.common?.showToast?.('Please select an image file', 'error');
                return;
            }
            
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                modules.common?.showToast?.('Logo must be less than 2MB', 'error');
                return;
            }
            
            // Read and convert to base64
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                
                // Update preview
                const logoPreview = document.getElementById('logoPreview');
                const previewLogo = document.getElementById('previewLogo');
                if (logoPreview) logoPreview.src = base64;
                if (previewLogo) previewLogo.src = base64;
                
                // Store temporarily (will be saved on form submit)
                fileInput.dataset.base64 = base64;
                
                modules.common?.showToast?.('Logo uploaded - click Save to apply', 'success');
            };
            reader.readAsDataURL(file);
        });
        
        // Reset logo to default
        resetLogoBtn?.addEventListener('click', () => {
            const logoPreview = document.getElementById('logoPreview');
            const previewLogo = document.getElementById('previewLogo');
            if (logoPreview) logoPreview.src = this.defaults.logoUrl;
            if (previewLogo) previewLogo.src = this.defaults.logoUrl;
            if (fileInput) {
                fileInput.value = '';
                delete fileInput.dataset.base64;
            }
            modules.common?.showToast?.('Logo reset - click Save to apply', 'info');
        });
        
        // Reset all branding
        resetAllBtn?.addEventListener('click', () => {
            if (confirm('Reset all branding to default values?')) {
                localStorage.removeItem(this.STORAGE_KEY);
                this.applyBranding(this.defaults);
                this.showSettings(); // Refresh the form
                modules.common?.showToast?.('Branding reset to defaults', 'success');
            }
        });
        
        // Form submission
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const branding = {
                shopName: shopNameInput.value.trim() || this.defaults.shopName,
                tagline: taglineInput.value.trim() || this.defaults.tagline,
                logoUrl: this.defaults.logoUrl,
                logoData: fileInput?.dataset.base64 || this.getBranding().logoData || null
            };
            
            if (this.saveBranding(branding)) {
                modules.common?.showToast?.('Shop branding saved!', 'success');
            } else {
                modules.common?.showToast?.('Failed to save branding', 'error');
            }
        });
    }
};

// Expose ShopBranding globally
window.ShopBranding = ShopBranding;

// ==================== START APPLICATION ====================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// ==================== LEGACY COMPATIBILITY ====================
// Expose functions globally for onclick handlers in HTML
window.loadDashboard = loadDashboard;
window.navigate = navigate;

// Export for ES modules
export { navigate, loadDashboard, CONFIG };
