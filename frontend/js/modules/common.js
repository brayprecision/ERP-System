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
export function exportToCSV(data, filename, headers) {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
        headers.map(h => {
            const value = row[h] ?? '';
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(value).replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')
    );
    
    const csv = [csvHeaders, ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
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
