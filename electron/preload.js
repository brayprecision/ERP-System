/**
 * BPERP Desktop Application - Preload Script
 * Provides a secure bridge between the main process and renderer
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // ==================== CONFIGURATION ====================
    
    /**
     * Get the full configuration object
     * @returns {Promise<Object>} Configuration object
     */
    getConfig: () => ipcRenderer.invoke('get-config'),
    
    /**
     * Set multiple configuration values
     * @param {Object} config - Configuration object to merge
     * @returns {Promise<boolean>} Success status
     */
    setConfig: (config) => ipcRenderer.invoke('set-config', config),
    
    /**
     * Get a specific configuration value
     * @param {string} key - Configuration key (dot notation supported)
     * @returns {Promise<any>} Configuration value
     */
    getConfigValue: (key) => ipcRenderer.invoke('get-config-value', key),
    
    /**
     * Set a specific configuration value
     * @param {string} key - Configuration key (dot notation supported)
     * @param {any} value - Value to set
     * @returns {Promise<boolean>} Success status
     */
    setConfigValue: (key, value) => ipcRenderer.invoke('set-config-value', key, value),
    
    // ==================== DATABASE ====================

    /**
     * Test database connection (SQLite path)
     * @param {Object|string} config - Database path or config object with .path
     * @returns {Promise<{success: boolean, error?: string}>} Connection result
     */
    testConnection: (config) => ipcRenderer.invoke('test-db-connection', config),

    /**
     * Browse for database folder (opens native dialog)
     * @returns {Promise<{canceled: boolean, path: string}>} Selected path
     */
    browseDatabasePath: () => ipcRenderer.invoke('browse-database-path'),

    /**
     * Test database path accessibility and write permissions
     * @param {string} dbPath - Full path to the database file
     * @returns {Promise<{success: boolean, error?: string}>} Test result
     */
    testDatabasePath: (dbPath) => ipcRenderer.invoke('test-database-path', dbPath),

    /**
     * Run database migrations
     * @returns {Promise<{success: boolean, output: string}>} Migration result
     */
    runMigrations: () => ipcRenderer.invoke('run-migrations'),
    
    // ==================== SYSTEM ====================
    
    /**
     * Get application version
     * @returns {Promise<string>} Version string
     */
    getVersion: () => ipcRenderer.invoke('get-version'),
    
    /**
     * Get recent application logs
     * @returns {Promise<string>} Log content
     */
    getLogs: () => ipcRenderer.invoke('get-logs'),
    
    /**
     * Open a URL in the default browser
     * @param {string} url - URL to open
     */
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    /**
     * Open the logs folder in file explorer
     */
    openLogsFolder: () => ipcRenderer.invoke('open-logs-folder'),
    
    // ==================== WINDOW CONTROLS ====================
    
    /**
     * Quit the application
     */
    quit: () => ipcRenderer.invoke('quit-app'),
    
    /**
     * Minimize the main window
     */
    minimize: () => ipcRenderer.invoke('minimize-app'),
    
    /**
     * Toggle maximize/restore the main window
     */
    maximize: () => ipcRenderer.invoke('maximize-app'),
    
    /**
     * Check if window is maximized
     * @returns {Promise<boolean>} Maximized state
     */
    isMaximized: () => ipcRenderer.invoke('is-maximized'),
    
    // ==================== SETUP WIZARD ====================
    
    /**
     * Check if this is the first run (setup needed)
     * @returns {Promise<boolean>} First run status
     */
    isFirstRun: () => ipcRenderer.invoke('is-first-run'),
    
    /**
     * Complete the setup wizard and start the application
     * @param {Object} config - Setup configuration
     * @param {Object} config.database - Database settings
     * @returns {Promise<{success: boolean, error?: string}>} Completion result
     */
    completeSetup: (config) => ipcRenderer.invoke('complete-setup', config),
    
    // ==================== EVENTS ====================
    
    /**
     * Listen for backend status updates
     * @param {Function} callback - Callback function
     */
    onBackendStatus: (callback) => {
        ipcRenderer.on('backend-status', (event, status) => callback(status));
    },
    
    /**
     * Listen for update available notifications
     * @param {Function} callback - Callback function
     */
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (event, info) => callback(info));
    },
    
    /**
     * Remove all listeners for a channel
     * @param {string} channel - Channel name
     */
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
    /**
     * Operating system platform
     */
    os: process.platform,
    
    /**
     * OS architecture
     */
    arch: process.arch,
    
    /**
     * Check if running in Electron
     */
    isElectron: true,
    
    /**
     * Check if running in development mode
     */
    isDev: process.env.NODE_ENV === 'development'
});

// Log that preload script is ready
console.log('BPERP: Preload script loaded');
console.log('BPERP: electronAPI exposed:', typeof window !== 'undefined' ? 'checking...' : 'no window');

// Verify exposure after a short delay
setTimeout(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('BPERP: electronAPI confirmed available');
        console.log('BPERP: Available methods:', Object.keys(window.electronAPI));
    } else {
        console.error('BPERP: electronAPI NOT available after preload!');
    }
}, 100);
