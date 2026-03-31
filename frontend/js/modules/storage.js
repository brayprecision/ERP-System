/**
 * BPERP Dashboard - Storage Manager Module
 * Centralized localStorage management with caching and debounced writes
 */

import { debounce } from './common.js';

// ==================== STORAGE KEYS ====================
export const STORAGE_KEYS = {
    WORK_ORDERS: 'bperp_work_orders',
    ARCHIVED_WORK_ORDERS: 'bperp_archived_work_orders',
    CUSTOMERS: 'bperp_customers',
    ARCHIVED_CUSTOMERS: 'bperp_archived_customers',
    QUOTES: 'bperp_quotes',
    QUOTE_DOCUMENTS: 'bperp_quote_documents',
    WO_DOCUMENTS: 'bperp_wo_documents',
    MACHINES: 'bperp_machines',
    MAINTENANCE_HISTORY: 'bperp_maintenance_history',
    MATERIALS: 'bperp_materials',
    TOOLING: 'bperp_tooling',
    MISC_ITEMS: 'bperp_misc_items',
    PRODUCTS: 'bperp_products',
    PARTS: 'bperp_parts',
    MISC_TASKS: 'bperp_misc_tasks',
    USER_PREFERENCES: 'bperp_user_preferences',
    CACHED_SEARCH: 'bperp_cached_search',
    // User management
    CURRENT_USER: 'bperp_current_user',
    AUTH_TOKEN: 'bperp_auth_token',
    USERS_LIST: 'bperp_users_list',
    // Shop branding
    SHOP_BRANDING: 'bperp_shop_branding',
    // Local labor (offline / demo session — mirrors API shapes in laborLocal.js)
    LABOR_LOCAL: 'bperp_labor_local'
};

// ==================== STORAGE MANAGER CLASS ====================
class StorageManager {
    constructor() {
        this.cache = new Map();
        this.dirty = new Set();
        this.cacheExpiry = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default cache TTL
        
        // Debounced save function
        this.debouncedSave = debounce(() => this.flushDirty(), 100);
    }

    /**
     * Get data from cache or localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} - Parsed data or default value
     */
    get(key, defaultValue = null) {
        // Check if cache is valid
        if (this.cache.has(key)) {
            const expiry = this.cacheExpiry.get(key);
            if (!expiry || Date.now() < expiry) {
                return this.cache.get(key);
            }
            // Cache expired, remove it
            this.cache.delete(key);
            this.cacheExpiry.delete(key);
        }

        // Load from localStorage
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                const parsed = JSON.parse(stored);
                this.cache.set(key, parsed);
                this.cacheExpiry.set(key, Date.now() + this.defaultTTL);
                return parsed;
            }
        } catch (error) {
            console.error(`Error reading ${key} from localStorage:`, error);
        }

        return defaultValue;
    }

    /**
     * Set data in cache and queue for localStorage save
     * @param {string} key - Storage key
     * @param {*} value - Data to store
     * @param {boolean} immediate - Whether to save immediately
     */
    set(key, value, immediate = false) {
        this.cache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + this.defaultTTL);
        this.dirty.add(key);
        
        if (immediate) {
            this.flushDirty();
        } else {
            this.debouncedSave();
        }
    }

    /**
     * Update a specific item in an array stored at key
     * @param {string} key - Storage key
     * @param {number|string} id - Item ID
     * @param {object} updates - Updates to apply
     * @param {string} idField - Name of ID field (default: 'id')
     */
    updateItem(key, id, updates, idField = 'id') {
        const data = this.get(key, []);
        const index = data.findIndex(item => item[idField] === id);
        
        if (index !== -1) {
            data[index] = { ...data[index], ...updates };
            this.set(key, data);
            return data[index];
        }
        return null;
    }

    /**
     * Add an item to an array stored at key
     * @param {string} key - Storage key
     * @param {object} item - Item to add
     * @param {string} idField - Name of ID field for auto-increment
     */
    addItem(key, item, idField = 'id') {
        const data = this.get(key, []);
        
        // Auto-generate ID if not provided
        if (!item[idField]) {
            const maxId = Math.max(...data.map(d => d[idField] || 0), 0);
            item[idField] = maxId + 1;
        }
        
        data.push(item);
        this.set(key, data);
        return item;
    }

    /**
     * Remove an item from an array stored at key
     * @param {string} key - Storage key
     * @param {number|string} id - Item ID
     * @param {string} idField - Name of ID field
     */
    removeItem(key, id, idField = 'id') {
        const data = this.get(key, []);
        const filtered = data.filter(item => item[idField] !== id);
        this.set(key, filtered);
        return filtered.length < data.length;
    }

    /**
     * Flush all dirty keys to localStorage
     */
    flushDirty() {
        this.dirty.forEach(key => {
            try {
                const value = this.cache.get(key);
                if (value !== undefined) {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            } catch (error) {
                console.error(`Error saving ${key} to localStorage:`, error);
            }
        });
        this.dirty.clear();
    }

    /**
     * Invalidate cache for a specific key
     * @param {string} key - Storage key
     */
    invalidate(key) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
        this.cacheExpiry.clear();
        this.dirty.clear();
    }

    /**
     * Set cache TTL
     * @param {number} ttlMs - Time to live in milliseconds
     */
    setTTL(ttlMs) {
        this.defaultTTL = ttlMs;
    }

    /**
     * Check if key exists in storage
     * @param {string} key - Storage key
     */
    has(key) {
        return this.cache.has(key) || localStorage.getItem(key) !== null;
    }

    /**
     * Remove a key from storage
     * @param {string} key - Storage key
     */
    remove(key) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
        this.dirty.delete(key);
        localStorage.removeItem(key);
    }
}

// ==================== SEARCH CACHE ====================
class SearchCache {
    constructor(maxSize = 100, ttlMs = 30000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttlMs = ttlMs;
    }

    generateKey(query, filters) {
        return JSON.stringify({ query: query.toLowerCase(), filters });
    }

    get(query, filters) {
        const key = this.generateKey(query, filters);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() < cached.expiry) {
            return cached.data;
        }
        
        this.cache.delete(key);
        return null;
    }

    set(query, filters, data) {
        const key = this.generateKey(query, filters);
        
        // Enforce max size with LRU-like behavior
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data,
            expiry: Date.now() + this.ttlMs
        });
    }

    clear() {
        this.cache.clear();
    }
}

// ==================== VIEW CACHE ====================
class ViewCache {
    constructor(ttlMs = 30000) {
        this.cache = new Map();
        this.ttlMs = ttlMs;
    }

    get(viewName) {
        const cached = this.cache.get(viewName);
        if (cached && Date.now() < cached.expiry) {
            return cached.html;
        }
        this.cache.delete(viewName);
        return null;
    }

    set(viewName, html) {
        this.cache.set(viewName, {
            html,
            expiry: Date.now() + this.ttlMs
        });
    }

    invalidate(viewName) {
        this.cache.delete(viewName);
    }

    clear() {
        this.cache.clear();
    }
}

// ==================== SINGLETON INSTANCES ====================
export const storage = new StorageManager();
export const searchCache = new SearchCache();
export const viewCache = new ViewCache();

// ==================== API REQUEST QUEUE ====================
class APIQueue {
    constructor(maxRetries = 3, retryDelay = 1000) {
        this.queue = [];
        this.processing = false;
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
        this.retryCount = new Map();
        this.isOnline = navigator.onLine;
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processQueue();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    async add(request) {
        return new Promise((resolve, reject) => {
            this.queue.push({ request, resolve, reject });
            if (!this.processing && this.isOnline) {
                this.processQueue();
            }
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0 || !this.isOnline) {
            return;
        }
        
        this.processing = true;
        
        while (this.queue.length > 0 && this.isOnline) {
            const { request, resolve, reject } = this.queue.shift();
            
            try {
                const result = await this.executeWithRetry(request);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }
        
        this.processing = false;
    }

    async executeWithRetry(request) {
        const requestId = JSON.stringify(request);
        let retries = this.retryCount.get(requestId) || 0;
        
        while (retries < this.maxRetries) {
            try {
                const response = await fetch(request.url, {
                    method: request.method || 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        ...request.headers
                    },
                    body: request.body ? JSON.stringify(request.body) : undefined
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                this.retryCount.delete(requestId);
                return await response.json();
            } catch (error) {
                retries++;
                this.retryCount.set(requestId, retries);
                
                if (retries >= this.maxRetries) {
                    this.retryCount.delete(requestId);
                    throw error;
                }
                
                // Exponential backoff
                await new Promise(r => setTimeout(r, this.retryDelay * Math.pow(2, retries - 1)));
            }
        }
    }

    clear() {
        this.queue = [];
        this.retryCount.clear();
    }
}

export const apiQueue = new APIQueue();

// ==================== STATE MANAGER ====================
class StateManager {
    constructor() {
        this.state = {};
        this.subscribers = new Map();
        this.history = [];
        this.maxHistory = 50;
    }

    get(key) {
        return this.state[key];
    }

    getAll() {
        return { ...this.state };
    }

    set(key, value, silent = false) {
        const oldValue = this.state[key];
        
        // Don't update if value is the same
        if (JSON.stringify(oldValue) === JSON.stringify(value)) {
            return;
        }
        
        // Save to history
        this.history.push({ key, oldValue, newValue: value, timestamp: Date.now() });
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        this.state[key] = value;
        
        if (!silent) {
            this.notify(key, value, oldValue);
        }
    }

    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            this.subscribers.get(key)?.delete(callback);
        };
    }

    notify(key, value, oldValue) {
        // Notify specific key subscribers
        this.subscribers.get(key)?.forEach(cb => {
            try {
                cb(value, oldValue);
            } catch (error) {
                console.error('State subscriber error:', error);
            }
        });
        
        // Notify wildcard subscribers
        this.subscribers.get('*')?.forEach(cb => {
            try {
                cb(key, value, oldValue);
            } catch (error) {
                console.error('State subscriber error:', error);
            }
        });
    }

    reset() {
        this.state = {};
        this.history = [];
    }
}

export const state = new StateManager();

// ==================== OFFLINE SYNC ====================
class OfflineSync {
    constructor() {
        this.pendingChanges = [];
        this.storageKey = 'bperp_pending_sync';
        this.loadPending();
        
        window.addEventListener('online', () => this.sync());
    }

    loadPending() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.pendingChanges = stored ? JSON.parse(stored) : [];
        } catch {
            this.pendingChanges = [];
        }
    }

    savePending() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.pendingChanges));
    }

    addChange(type, key, data) {
        this.pendingChanges.push({
            type,
            key,
            data,
            timestamp: Date.now()
        });
        this.savePending();
    }

    async sync() {
        if (!navigator.onLine || this.pendingChanges.length === 0) {
            return;
        }
        
        const changes = [...this.pendingChanges];
        this.pendingChanges = [];
        this.savePending();
        
        for (const change of changes) {
            try {
                // Attempt to sync each change
                // This would be customized based on your API
                console.log('Syncing:', change);
            } catch (error) {
                // Re-add failed changes
                this.pendingChanges.push(change);
            }
        }
        
        this.savePending();
    }

    hasPending() {
        return this.pendingChanges.length > 0;
    }
}

export const offlineSync = new OfflineSync();
