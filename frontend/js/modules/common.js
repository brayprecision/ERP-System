/**
 * BPERP Dashboard - Common Utilities Module
 * Shared functions used across all modules
 */

// ==================== DEBOUNCE & THROTTLE ====================
export function debounce(fn, delay = 300) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function throttle(fn, limit = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==================== DOM CACHE ====================
class DOMCacheManager {
    constructor() {
        this.cache = new Map();
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        
        this.cache.set('dashboardContent', document.getElementById('dashboardContent'));
        this.cache.set('searchInput', document.getElementById('searchInput'));
        this.cache.set('sidebarNav', document.querySelector('.sidebar-nav'));
        
        // Cache all dropdown menus
        document.querySelectorAll('[class*="dropdown-menu"]').forEach((el, i) => {
            this.cache.set(`dropdown_${i}`, el);
        });
        
        this.initialized = true;
    }

    get(id) {
        if (!this.cache.has(id)) {
            const el = document.getElementById(id);
            if (el) this.cache.set(id, el);
            return el;
        }
        return this.cache.get(id);
    }

    query(selector) {
        const key = `query_${selector}`;
        if (!this.cache.has(key)) {
            const el = document.querySelector(selector);
            if (el) this.cache.set(key, el);
            return el;
        }
        return this.cache.get(key);
    }

    invalidate(id) {
        this.cache.delete(id);
    }

    clear() {
        this.cache.clear();
        this.initialized = false;
    }
}

export const DOMCache = new DOMCacheManager();

// ==================== DATE FORMATTING ====================
export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

export function getDaysUntil(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
}

export function getUrgencyColor(dateStr) {
    const daysUntil = getDaysUntil(dateStr);
    if (daysUntil === null) return 'gray';
    if (daysUntil < 0) return 'red';
    if (daysUntil <= 3) return 'yellow';
    return 'green';
}

// ==================== STATUS BADGES ====================
export function getStatusBadgeClass(status) {
    const badges = {
        'Not Started': 'bg-gray-600 text-gray-200',
        'In Progress': 'bg-blue-600 text-blue-100',
        'Complete': 'bg-green-600 text-green-100',
        'Completed': 'bg-green-600 text-green-100',
        'Issue': 'bg-red-600 text-red-100',
        'On Hold': 'bg-yellow-600 text-yellow-100',
        'Pending': 'bg-gray-600 text-gray-200',
        'Ordered': 'bg-blue-600 text-blue-100',
        'Shipped': 'bg-purple-600 text-purple-100',
        'Received': 'bg-green-600 text-green-100',
        'Cancelled': 'bg-red-600 text-red-100',
        'Won': 'bg-green-600 text-green-100',
        'Lost': 'bg-red-600 text-red-100',
        'Sent': 'bg-blue-600 text-blue-100',
        'New': 'bg-cyan-600 text-cyan-100',
        'Draft': 'bg-gray-600 text-gray-200'
    };
    return badges[status] || 'bg-gray-600 text-gray-200';
}

export function getPriorityBadgeClass(priority) {
    const badges = {
        'Urgent': 'bg-red-700 text-red-100',
        'High': 'bg-orange-600 text-orange-100',
        'Medium': 'bg-blue-600 text-blue-100',
        'Low': 'bg-gray-600 text-gray-200'
    };
    return badges[priority] || 'bg-gray-600 text-gray-200';
}

// ==================== TOAST NOTIFICATIONS ====================
let toastContainer = null;

export function showToast(message, type = 'success', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle';
    
    toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 transform translate-x-full transition-transform duration-300`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full');
    });
    
    // Animate out and remove
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ==================== MODAL UTILITIES ====================
export function createModal(id, content, options = {}) {
    // Remove existing modal if present
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-cardBg rounded-lg border border-gray-700 ${options.width || 'w-full max-w-md'} ${options.maxHeight || 'max-h-[90vh]'} overflow-y-auto">
            ${content}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click if enabled
    if (options.closeOnBackdrop !== false) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(id);
        });
    }
    
    return modal;
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.remove();
}

export function showConfirmModal(title, message, onConfirm, options = {}) {
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid ${options.icon || 'fa-exclamation-triangle'} mr-2 ${options.iconColor || 'text-yellow-400'}"></i>${title}
                </h3>
                <button onclick="BPERP.common.closeModal('confirmModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-gray-300 mb-6">${message}</p>
            <div class="flex space-x-3">
                <button onclick="BPERP.common.closeModal('confirmModal')" 
                    class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">
                    Cancel
                </button>
                <button id="confirmModalBtn" 
                    class="flex-1 ${options.confirmClass || 'bg-red-600 hover:bg-red-700'} text-white px-4 py-2 rounded">
                    ${options.confirmText || 'Confirm'}
                </button>
            </div>
        </div>
    `;
    
    createModal('confirmModal', content);
    
    document.getElementById('confirmModalBtn').addEventListener('click', () => {
        closeModal('confirmModal');
        if (onConfirm) onConfirm();
    });
}

// ==================== DELETE CONFIRMATION ====================
export function showDeleteConfirm(itemName, itemType, itemId, onDelete) {
    showConfirmModal(
        'Confirm Delete',
        `Are you sure you want to delete <strong class="text-white">${itemName}</strong>? This action cannot be undone.`,
        onDelete,
        { icon: 'fa-trash', iconColor: 'text-red-400', confirmText: 'Delete', confirmClass: 'bg-red-600 hover:bg-red-700' }
    );
}

// ==================== LOADING STATES ====================
export function showLoadingSpinner(container = null) {
    const target = container || DOMCache.get('dashboardContent');
    if (!target) return;
    
    target.innerHTML = `
        <div class="col-span-3 flex items-center justify-center py-20">
            <div class="text-center">
                <i class="fa-solid fa-spinner fa-spin text-4xl text-accentGreen mb-4"></i>
                <p class="text-gray-400">Loading...</p>
            </div>
        </div>
    `;
}

export function showLoadingSkeleton(container, rows = 5) {
    const target = container || DOMCache.get('dashboardContent');
    if (!target) return;
    
    const skeletonRows = Array(rows).fill().map(() => `
        <div class="animate-pulse flex space-x-4 p-4 bg-gray-800 rounded mb-2">
            <div class="rounded-full bg-gray-700 h-10 w-10"></div>
            <div class="flex-1 space-y-2 py-1">
                <div class="h-4 bg-gray-700 rounded w-3/4"></div>
                <div class="h-4 bg-gray-700 rounded w-1/2"></div>
            </div>
        </div>
    `).join('');
    
    target.innerHTML = `<div class="col-span-3">${skeletonRows}</div>`;
}

// ==================== BATCH DOM UPDATES ====================
export function batchDOMUpdate(updates) {
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        updates.forEach(update => {
            if (typeof update === 'function') {
                update();
            }
        });
    });
}

export function createTableFromFragment(rows, tableClass = '') {
    const fragment = document.createDocumentFragment();
    const table = document.createElement('table');
    table.className = tableClass || 'w-full text-sm text-left';
    
    const tbody = document.createElement('tbody');
    rows.forEach(rowHtml => {
        const tr = document.createElement('tr');
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    fragment.appendChild(table);
    return fragment;
}

// ==================== SAFE EXECUTION ====================
export function safeExecute(fn, fallback = null, context = 'Unknown') {
    try {
        const result = fn();
        if (result instanceof Promise) {
            return result.catch(error => {
                console.error(`Error in async ${context}:`, error);
                showToast('An error occurred. Please try again.', 'error');
                if (fallback) return fallback();
                return null;
            });
        }
        return result;
    } catch (error) {
        console.error(`Error in ${context}:`, error);
        showToast('An error occurred. Please try again.', 'error');
        if (fallback) return fallback();
        return null;
    }
}

// ==================== URL & CURRENCY FORMATTING ====================
export function formatCurrency(amount, currency = 'USD') {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(num);
}

// ==================== VALIDATION HELPERS ====================
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone) {
    return /^[\d\s\-\(\)+]+$/.test(phone);
}

export function isEmpty(value) {
    return value === null || value === undefined || value === '' || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
}

// ==================== HIGHLIGHT UTILITIES ====================
export function highlightItem(itemId, type = 'row') {
    // Small delay to ensure DOM is rendered after navigation
    setTimeout(() => {
        // Find the element with matching data-item-id
        const element = document.querySelector(`[data-item-id="${itemId}"]`);
        
        if (element) {
            // Scroll the element into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add highlight class
            element.classList.add('search-highlight');
            
            // Remove highlight after animation completes
            setTimeout(() => {
                element.classList.remove('search-highlight');
            }, 3000);
        } else {
            console.warn('BPERP: Could not find element to highlight:', itemId);
        }
    }, 150);
}

// ==================== FORM UTILITIES ====================
export function getFormData(formElement) {
    const formData = new FormData(formElement);
    const data = {};
    for (const [key, value] of formData.entries()) {
        data[key] = value;
    }
    return data;
}

export function setFormData(formElement, data) {
    Object.entries(data).forEach(([key, value]) => {
        const field = formElement.elements[key];
        if (field) {
            if (field.type === 'checkbox') {
                field.checked = Boolean(value);
            } else {
                field.value = value || '';
            }
        }
    });
}

// ==================== EXPORT UTILITIES ====================
export async function exportToCSV(data, filename, headers, endpoint) {
    try {
        let response;
        let blob;
        let downloadUrl;

        if (endpoint) {
            // Use server-side export
            const authToken = localStorage.getItem('bperp_auth_token');
            const headers = authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
            response = await fetch(`${window.API_BASE}${endpoint}`, { headers });
            if (!response.ok) {
                throw new Error(`Export failed: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Export failed');
            }

            // Download the file from the server
            downloadUrl = result.downloadUrl;
            showToast(result.message, 'success');

            // Create download link
            const a = document.createElement('a');
            a.href = `${window.location.origin}${downloadUrl}`;
            a.download = result.filename;
            a.click();
        } else {
            // Fallback to client-side export (for demo data)
            if (!data || data.length === 0) {
                showToast('No data to export', 'error');
                return;
            }

            // Auto-generate headers if not provided
            let csvHeaders;
            if (!headers || headers.length === 0) {
                // Get all unique keys from the data
                const allKeys = new Set();
                data.forEach(row => {
                    if (typeof row === 'object' && row !== null) {
                        Object.keys(row).forEach(key => allKeys.add(key));
                    }
                });
                csvHeaders = Array.from(allKeys);
            } else {
                csvHeaders = headers;
            }

            const csvRows = data.map(row =>
                csvHeaders.map(h => {
                    let value = '';
                    if (row && typeof row === 'object') {
                        value = row[h] ?? '';
                    }

                    // Handle nested objects and arrays
                    if (typeof value === 'object' && value !== null) {
                        value = JSON.stringify(value);
                    }

                    // Convert to string and handle null/undefined
                    const stringValue = String(value || '');

                    // Escape quotes and wrap in quotes if contains comma, newline, or quote
                    const escaped = stringValue.replace(/"/g, '""');
                    if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
                        return `"${escaped}"`;
                    }
                    return escaped;
                }).join(',')
            );

            const csv = [csvHeaders.join(','), ...csvRows].join('\n');

            // Add UTF-8 BOM for Excel/Google Sheets compatibility
            const BOM = '\uFEFF';
            const csvWithBOM = BOM + csv;

            blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();

            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Export error:', error);
        showToast('Export failed: ' + error.message, 'error');
    }
}

// ==================== BACKUP/RESTORE UTILITIES ====================
export async function createBackup() {
    // Collect localStorage data to include in backup
    const localStorageData = {
        quotes: JSON.parse(localStorage.getItem('bperp_quotes') || 'null'),
        quote_documents: JSON.parse(localStorage.getItem('bperp_quote_documents') || 'null'),
        work_orders: JSON.parse(localStorage.getItem('bperp_work_orders') || 'null'),
        wo_documents: JSON.parse(localStorage.getItem('bperp_wo_documents') || 'null'),
        archived_work_orders: JSON.parse(localStorage.getItem('bperp_archived_work_orders') || 'null'),
        customers: JSON.parse(localStorage.getItem('bperp_customers') || 'null'),
        materials: JSON.parse(localStorage.getItem('bperp_materials') || 'null'),
        tooling: JSON.parse(localStorage.getItem('bperp_tooling') || 'null'),
        misc_items: JSON.parse(localStorage.getItem('bperp_misc_items') || 'null'),
        misc_tasks: JSON.parse(localStorage.getItem('bperp_misc_tasks') || 'null'),
            // User profiles (includes appearance settings and permissions)
            users_list: JSON.parse(localStorage.getItem('bperp_users_list') || 'null'),
            // Theme preferences
            theme_preferences: JSON.parse(localStorage.getItem('bperp_theme_preferences') || 'null'),
            // Shop branding (logo, name, tagline)
            shop_branding: JSON.parse(localStorage.getItem('bperp_shop_branding') || 'null'),
            // Current user session (for reference, not for restore)
            current_user: JSON.parse(localStorage.getItem('bperp_current_user') || 'null')
        };
    
    try {
        // Try API first (includes database data)
        const authToken = localStorage.getItem('bperp_auth_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        };
        const response = await fetch(`${window.API_BASE}/backup/create`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ localStorage: localStorageData })
        });

        if (!response.ok) {
            throw new Error(`Server backup failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Server backup failed');
        }

        // Download the backup file from the server
        const a = document.createElement('a');
        a.href = `${window.location.origin}${result.downloadUrl}`;
        a.download = result.filename;
        a.click();

        showToast(result.message, 'success');
    } catch (error) {
        console.log('Server backup unavailable, creating client-side backup:', error.message);
        
        // Fallback: Create backup entirely client-side
        try {
            const backupData = {
                timestamp: new Date().toISOString(),
                version: 'BPERP-v1.2-offline',
                source: 'client-side',
                database: null, // No database access in offline mode
                localStorage: localStorageData
            };
            
            // Create and download the backup file
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const filename = `bperp_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('Backup created successfully (offline mode)', 'success');
        } catch (offlineError) {
            console.error('Failed to create offline backup:', offlineError);
            showToast('Failed to create backup: ' + offlineError.message, 'error');
        }
    }
}

export async function restoreFromBackup(fileInput) {
    const file = fileInput.files[0];
    if (!file) {
        showToast('Please select a backup file', 'error');
        throw new Error('No file selected');
    }

    try {
        // Read and parse the backup file
        const fileContent = await file.text();
        const backupData = JSON.parse(fileContent);
        
        // Validate backup structure
        if (!backupData.timestamp || !backupData.version) {
            throw new Error('Invalid backup file format');
        }
        
        // Confirm with user
        const confirmRestore = confirm(
            `Restore backup from ${new Date(backupData.timestamp).toLocaleString()}?\n\n` +
            `Version: ${backupData.version}\n\n` +
            `This will replace all current local data. This action cannot be undone.`
        );
        
        if (!confirmRestore) {
            throw new Error('Restore cancelled by user');
        }
        
        // Restore localStorage data
        if (backupData.localStorage) {
            const storageKeys = {
                quotes: 'bperp_quotes',
                quote_documents: 'bperp_quote_documents',
                work_orders: 'bperp_work_orders',
                wo_documents: 'bperp_wo_documents',
                archived_work_orders: 'bperp_archived_work_orders',
                customers: 'bperp_customers',
                materials: 'bperp_materials',
                tooling: 'bperp_tooling',
                misc_items: 'bperp_misc_items',
                misc_tasks: 'bperp_misc_tasks',
                users_list: 'bperp_users_list',
                theme_preferences: 'bperp_theme_preferences',
                shop_branding: 'bperp_shop_branding'
            };
            
            for (const [key, storageKey] of Object.entries(storageKeys)) {
                if (backupData.localStorage[key] !== null && backupData.localStorage[key] !== undefined) {
                    localStorage.setItem(storageKey, JSON.stringify(backupData.localStorage[key]));
                    console.log(`Restored ${key} to localStorage`);
                }
            }
        }
        
        // If database data exists, we can also populate localStorage from it (for offline mode)
        if (backupData.database) {
            // Restore users from database backup if localStorage version is empty
            if (backupData.database.users && !backupData.localStorage?.users_list) {
                // Remove password hashes before storing in localStorage for security
                const safeUsers = backupData.database.users.map(user => ({
                    ...user,
                    password_hash: undefined
                }));
                localStorage.setItem('bperp_users_list', JSON.stringify(safeUsers));
                console.log('Restored users from database backup');
            }
            
            // Restore other database tables to localStorage if not already present
            const dbToStorage = {
                customers: 'bperp_customers',
                materials: 'bperp_materials',
                tooling: 'bperp_tooling',
                misc_items: 'bperp_misc_items'
            };
            
            for (const [dbKey, storageKey] of Object.entries(dbToStorage)) {
                if (backupData.database[dbKey] && !localStorage.getItem(storageKey)) {
                    localStorage.setItem(storageKey, JSON.stringify(backupData.database[dbKey]));
                    console.log(`Restored ${dbKey} from database backup`);
                }
            }
        }
        
        showToast('Backup restored successfully! Reloading...', 'success');
        
        // Reload the page after a short delay to apply restored data
        setTimeout(() => {
            window.location.reload();
        }, 1500);
        
        return { success: true };

    } catch (error) {
        console.error('Failed to restore backup:', error);
        if (error.message !== 'Restore cancelled by user') {
            showToast('Failed to restore backup: ' + error.message, 'error');
        }
        throw error;
    }
}

// ==================== EVENT DELEGATION SETUP ====================
const actionHandlers = new Map();

export function registerActionHandler(action, handler) {
    actionHandlers.set(action, handler);
}

export function setupEventDelegation() {
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const handler = actionHandlers.get(action);
        
        if (handler) {
            e.preventDefault();
            e.stopPropagation();
            handler(target, e);
        }
    });
}

// ==================== MASTER TIMER ====================
class MasterTimer {
    constructor() {
        this.callbacks = new Map();
        this.interval = null;
        this.tick = 0;
    }

    register(id, callback, intervalSeconds) {
        this.callbacks.set(id, { callback, interval: intervalSeconds, lastRun: 0 });
        this.ensureRunning();
    }

    unregister(id) {
        this.callbacks.delete(id);
        if (this.callbacks.size === 0) {
            this.stop();
        }
    }

    ensureRunning() {
        if (!this.interval && this.callbacks.size > 0) {
            this.interval = setInterval(() => this.onTick(), 1000);
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    onTick() {
        this.tick++;
        this.callbacks.forEach((config, id) => {
            if (this.tick - config.lastRun >= config.interval) {
                config.lastRun = this.tick;
                safeExecute(config.callback, null, `Timer: ${id}`);
            }
        });
    }
}

export const masterTimer = new MasterTimer();

// Note: Initialization is handled by app.js
// Do not auto-initialize here to avoid conflicts
