/**
 * BPERP Dashboard - Users & Permissions Module
 * Handles user authentication, management, and permissions
 */

import { showToast, debounce } from './common.js';
import { storage, STORAGE_KEYS } from './storage.js';

// ==================== STORAGE KEYS ====================
const USER_STORAGE_KEYS = {
    CURRENT_USER: 'bperp_current_user',
    AUTH_TOKEN: 'bperp_auth_token',
    USERS_LIST: 'bperp_users_list'
};

// ==================== USER ROLES ====================
export const USER_ROLES = {
    ADMINISTRATOR: 'Administrator',
    MACHINIST: 'Machinist',
    OPERATOR: 'Operator'
};

// ==================== TAB CATEGORIES ====================
export const TAB_CATEGORIES = {
    dashboard: 'Dashboard',
    workcenter: 'Workcenter',
    inventory: 'Inventory',
    sales: 'Sales',
    tasks: 'Tasks',
    settings: 'Settings'
};

// ==================== DEMO USERS (Offline Mode) ====================
const DEMO_USERS = [
    {
        id: 1,
        username: 'admin',
        name: 'Leland Bray',
        email: 'admin@bperp.local',
        role: 'Administrator',
        appearance_settings: {
            theme: 'automation',
            showGrid: true,
            showGlow: true,
            animations: true,
            transparency: 50
        },
        tab_permissions: {
            dashboard: true,
            workcenter: true,
            inventory: true,
            sales: true,
            tasks: true,
            settings: true
        },
        is_active: true
    },
    {
        id: 2,
        username: 'machinist1',
        name: 'John Smith',
        email: 'john.smith@bperp.local',
        role: 'Machinist',
        appearance_settings: {
            theme: 'industrial',
            showGrid: true,
            showGlow: true,
            animations: true,
            transparency: 50
        },
        tab_permissions: {
            dashboard: true,
            workcenter: true,
            inventory: true,
            sales: false,
            tasks: true,
            settings: false
        },
        is_active: true
    },
    {
        id: 3,
        username: 'operator1',
        name: 'Jane Doe',
        email: 'jane.doe@bperp.local',
        role: 'Operator',
        appearance_settings: {
            theme: 'automation',
            showGrid: true,
            showGlow: false,
            animations: true,
            transparency: 30
        },
        tab_permissions: {
            dashboard: true,
            workcenter: true,
            inventory: false,
            sales: false,
            tasks: true,
            settings: false
        },
        is_active: true
    }
];

// ==================== STATE ====================
let currentUser = null;
let authToken = null;
let isOfflineMode = false;

// ==================== INITIALIZATION ====================
export function init() {
    // Load saved session
    const savedUser = localStorage.getItem(USER_STORAGE_KEYS.CURRENT_USER);
    const savedToken = localStorage.getItem(USER_STORAGE_KEYS.AUTH_TOKEN);
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            authToken = savedToken;
        } catch (e) {
            console.warn('Could not restore user session:', e);
        }
    }
    
    // Initialize demo users in storage if not present
    if (!storage.has(USER_STORAGE_KEYS.USERS_LIST)) {
        storage.set(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS, true);
    }
}

// ==================== AUTHENTICATION ====================

/**
 * Login user
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<object>} User object
 */
export async function login(username, password) {
    try {
        // Try API first
        const response = await fetch(`${window.API_BASE}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                currentUser = data.user;
                authToken = data.token;
                isOfflineMode = false;
                
                // Save to localStorage
                localStorage.setItem(USER_STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
                localStorage.setItem(USER_STORAGE_KEYS.AUTH_TOKEN, authToken);
                
                return { success: true, user: currentUser };
            }
            return { success: false, error: data.error || 'Login failed' };
        }
        
        // Fall back to offline mode
        return loginOffline(username, password);
    } catch (error) {
        console.log('API unavailable, using offline mode');
        return loginOffline(username, password);
    }
}

/**
 * Offline login using demo users
 */
function loginOffline(username, password) {
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
    const user = users.find(u => u.username === username && u.is_active);
    
    if (!user) {
        return { success: false, error: 'Invalid username or password' };
    }
    
    // In offline mode, accept any password for demo
    currentUser = { ...user };
    authToken = 'offline_token_' + Date.now();
    isOfflineMode = true;
    
    // Save to localStorage
    localStorage.setItem(USER_STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    localStorage.setItem(USER_STORAGE_KEYS.AUTH_TOKEN, authToken);
    
    return { success: true, user: currentUser };
}

/**
 * Logout current user
 */
export async function logout() {
    try {
        if (!isOfflineMode && authToken) {
            await fetch(`${window.API_BASE}/users/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                }
            });
        }
    } catch (e) {
        console.warn('Logout API call failed:', e);
    }
    
    currentUser = null;
    authToken = null;
    
    localStorage.removeItem(USER_STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(USER_STORAGE_KEYS.AUTH_TOKEN);
    
    return { success: true };
}

/**
 * Get current logged in user
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
    return currentUser !== null;
}

/**
 * Check if current user is admin
 */
export function isAdmin() {
    return currentUser?.role === USER_ROLES.ADMINISTRATOR;
}

// ==================== PERMISSIONS ====================

/**
 * Check if current user has permission to access a tab category
 * @param {string} tabCategory - One of: dashboard, workcenter, inventory, sales, tasks, settings
 */
export function hasPermission(tabCategory) {
    if (!currentUser) return false;
    
    // Administrators always have full access
    if (currentUser.role === USER_ROLES.ADMINISTRATOR) return true;
    
    // Check tab permissions
    const permissions = currentUser.tab_permissions || {};
    return permissions[tabCategory] === true;
}

/**
 * Get all permissions for current user
 */
export function getPermissions() {
    if (!currentUser) return {};
    
    if (currentUser.role === USER_ROLES.ADMINISTRATOR) {
        return {
            dashboard: true,
            workcenter: true,
            inventory: true,
            sales: true,
            tasks: true,
            settings: true
        };
    }
    
    return currentUser.tab_permissions || {};
}

/**
 * Update user permissions (Admin only)
 */
export async function updateUserPermissions(userId, permissions) {
    if (!isAdmin()) {
        return { success: false, error: 'Admin access required' };
    }
    
    try {
        if (!isOfflineMode) {
            const response = await fetch(`${window.API_BASE}/users/${userId}/permissions`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ tab_permissions: permissions })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const user = data.data ?? data.user;
                    updateUserInCache(userId, { tab_permissions: permissions });
                    return { success: true, user };
                }
                return { success: false, error: data.error };
            }
        }
        
        // Offline mode
        return updateUserPermissionsOffline(userId, permissions);
    } catch (error) {
        return updateUserPermissionsOffline(userId, permissions);
    }
}

function updateUserPermissionsOffline(userId, permissions) {
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
    const index = users.findIndex(u => u.id === userId);
    
    if (index === -1) {
        return { success: false, error: 'User not found' };
    }
    
    users[index].tab_permissions = permissions;
    storage.set(USER_STORAGE_KEYS.USERS_LIST, users, true);
    
    // Update current user if it's the same
    if (currentUser && currentUser.id === userId) {
        currentUser.tab_permissions = permissions;
        localStorage.setItem(USER_STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    }
    
    return { success: true, user: users[index] };
}

// ==================== APPEARANCE SETTINGS ====================

/**
 * Get current user's appearance settings
 */
export function getAppearanceSettings() {
    if (!currentUser) {
        // Return defaults if not logged in
        return {
            theme: 'automation',
            showGrid: true,
            showGlow: true,
            animations: true,
            transparency: 50
        };
    }
    
    return currentUser.appearance_settings || {
        theme: 'automation',
        showGrid: true,
        showGlow: true,
        animations: true,
        transparency: 50
    };
}

/**
 * Update current user's appearance settings
 */
export async function updateAppearanceSettings(settings) {
    if (!currentUser) {
        return { success: false, error: 'Not logged in' };
    }
    
    try {
        if (!isOfflineMode) {
            const response = await fetch(`${window.API_BASE}/users/${currentUser.id}/appearance`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ appearance_settings: settings })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    currentUser.appearance_settings = settings;
                    localStorage.setItem(USER_STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
                    updateUserInCache(currentUser.id, { appearance_settings: settings });
                    return { success: true };
                }
            }
        }
        
        // Offline mode fallback
        return updateAppearanceSettingsOffline(settings);
    } catch (error) {
        return updateAppearanceSettingsOffline(settings);
    }
}

function updateAppearanceSettingsOffline(settings) {
    if (!currentUser) return { success: false, error: 'Not logged in' };
    
    currentUser.appearance_settings = settings;
    localStorage.setItem(USER_STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    
    // Update in users list too
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
    const index = users.findIndex(u => u.id === currentUser.id);
    if (index !== -1) {
        users[index].appearance_settings = settings;
        storage.set(USER_STORAGE_KEYS.USERS_LIST, users, true);
    }
    
    return { success: true };
}

// ==================== USER MANAGEMENT (Admin) ====================

/**
 * Get all users (Admin only)
 */
export async function getAllUsers() {
    try {
        if (!isOfflineMode) {
            const response = await fetch(`${window.API_BASE}/users`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.ok) {
                const json = await response.json();
                const users = json.data ?? json;
                storage.set(USER_STORAGE_KEYS.USERS_LIST, users, true);
                return users;
            }
        }
    } catch (e) {
        console.log('Using cached/demo users');
    }
    
    return storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
}

/**
 * Create new user (Admin only)
 */
export async function createUser(userData) {
    if (!isAdmin()) {
        return { success: false, error: 'Admin access required' };
    }
    
    try {
        if (!isOfflineMode) {
            const response = await fetch(`${window.API_BASE}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const user = data.data ?? data.user;
                    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, []);
                    users.push(user);
                    storage.set(USER_STORAGE_KEYS.USERS_LIST, users, true);
                    return { success: true, user };
                }
                return { success: false, error: data.error };
            }
        }
        
        // Offline mode
        return createUserOffline(userData);
    } catch (error) {
        return createUserOffline(userData);
    }
}

function createUserOffline(userData) {
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
    
    // Check for duplicate username
    if (users.find(u => u.username === userData.username)) {
        return { success: false, error: 'Username already exists' };
    }
    
    // Get default permissions for role
    const defaultPermissions = getRoleDefaults(userData.role || 'Operator');
    
    const newUser = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        username: userData.username,
        name: userData.name,
        email: userData.email || null,
        role: userData.role || 'Operator',
        appearance_settings: {
            theme: 'automation',
            showGrid: true,
            showGlow: true,
            animations: true,
            transparency: 50
        },
        tab_permissions: defaultPermissions,
        is_active: true
    };
    
    users.push(newUser);
    storage.set(USER_STORAGE_KEYS.USERS_LIST, users, true);
    
    return { success: true, user: newUser };
}

/**
 * Update user (Admin only for others, users can update themselves)
 */
export async function updateUser(userId, updates) {
    const isSelf = currentUser && currentUser.id === userId;
    
    if (!isSelf && !isAdmin()) {
        return { success: false, error: 'Permission denied' };
    }
    
    try {
        if (!isOfflineMode) {
            const response = await fetch(`${window.API_BASE}/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(updates)
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const user = data.data ?? data.user;
                    updateUserInCache(userId, updates);
                    return { success: true, user };
                }
                return { success: false, error: data.error };
            }
        }
        
        // Offline mode
        return updateUserOffline(userId, updates);
    } catch (error) {
        return updateUserOffline(userId, updates);
    }
}

function updateUserOffline(userId, updates) {
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
    const index = users.findIndex(u => u.id === userId);
    
    if (index === -1) {
        return { success: false, error: 'User not found' };
    }
    
    // Apply updates
    const updatedUser = { ...users[index], ...updates };
    users[index] = updatedUser;
    storage.set(USER_STORAGE_KEYS.USERS_LIST, users, true);
    
    // Update current user if it's the same
    if (currentUser && currentUser.id === userId) {
        Object.assign(currentUser, updates);
        localStorage.setItem(USER_STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    }
    
    return { success: true, user: updatedUser };
}

/**
 * Delete user (Admin only)
 */
export async function deleteUser(userId) {
    if (!isAdmin()) {
        return { success: false, error: 'Admin access required' };
    }
    
    if (currentUser && currentUser.id === userId) {
        return { success: false, error: 'Cannot delete your own account' };
    }
    
    try {
        if (!isOfflineMode) {
            const response = await fetch(`${window.API_BASE}/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (response.ok) {
                deleteUserFromCache(userId);
                return { success: true };
            }
        }
        
        // Offline mode
        return deleteUserOffline(userId);
    } catch (error) {
        return deleteUserOffline(userId);
    }
}

function deleteUserOffline(userId) {
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
    const filtered = users.filter(u => u.id !== userId);
    
    if (filtered.length === users.length) {
        return { success: false, error: 'User not found' };
    }
    
    storage.set(USER_STORAGE_KEYS.USERS_LIST, filtered, true);
    return { success: true };
}

// ==================== HELPER FUNCTIONS ====================

function updateUserInCache(userId, updates) {
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, []);
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
        users[index] = { ...users[index], ...updates };
        storage.set(USER_STORAGE_KEYS.USERS_LIST, users, true);
    }
}

function deleteUserFromCache(userId) {
    const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, []);
    const filtered = users.filter(u => u.id !== userId);
    storage.set(USER_STORAGE_KEYS.USERS_LIST, filtered, true);
}

function getRoleDefaults(role) {
    const defaults = {
        Administrator: {
            dashboard: true,
            workcenter: true,
            inventory: true,
            sales: true,
            tasks: true,
            settings: true
        },
        Machinist: {
            dashboard: true,
            workcenter: true,
            inventory: true,
            sales: false,
            tasks: true,
            settings: false
        },
        Operator: {
            dashboard: true,
            workcenter: true,
            inventory: false,
            sales: false,
            tasks: true,
            settings: false
        }
    };
    
    return defaults[role] || defaults.Operator;
}

// ==================== UI RENDERING ====================

/**
 * Load Users & Permissions management view
 */
export async function loadUsersView() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;
    
    if (!isAdmin()) {
        container.innerHTML = `
            <div class="col-span-3">
                <div class="card p-6 text-center">
                    <i class="fa-solid fa-lock text-5xl mb-4" style="color: var(--color-error);"></i>
                    <h2 class="text-xl font-semibold text-white mb-2">Access Denied</h2>
                    <p class="text-gray-400">Only administrators can access user management.</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Show loading
    container.innerHTML = `
        <div class="col-span-3 text-center py-12">
            <i class="fa-solid fa-spinner fa-spin text-4xl" style="color: var(--color-accent-primary);"></i>
            <p class="text-gray-400 mt-4">Loading users...</p>
        </div>
    `;
    
    const users = await getAllUsers();
    
    container.innerHTML = `
        <div class="col-span-3 space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fa-solid fa-users-gear text-3xl mr-4" style="color: var(--color-accent-primary);"></i>
                    <div>
                        <h2 class="text-xl font-semibold text-white">Users & Permissions</h2>
                        <p class="text-gray-400 text-sm">Manage user accounts and tab access</p>
                    </div>
                </div>
                <button data-action="add-user" class="btn btn-primary">
                    <i class="fa-solid fa-user-plus mr-2"></i>Add User
                </button>
            </div>
            
            <!-- Users List -->
            <div class="card">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="text-left p-4 text-gray-400 font-medium">User</th>
                            <th class="text-left p-4 text-gray-400 font-medium">Role</th>
                            <th class="text-left p-4 text-gray-400 font-medium">Tab Access</th>
                            <th class="text-left p-4 text-gray-400 font-medium">Status</th>
                            <th class="text-right p-4 text-gray-400 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => renderUserRow(user)).join('')}
                    </tbody>
                </table>
            </div>
            
            <!-- Role Legend -->
            <div class="card p-6">
                <h3 class="text-lg font-medium text-white mb-4">Role Descriptions</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="p-4 rounded-lg" style="background: var(--color-dark-bg);">
                        <div class="flex items-center mb-2">
                            <i class="fa-solid fa-shield-halved text-red-400 mr-2"></i>
                            <span class="text-white font-medium">Administrator</span>
                        </div>
                        <p class="text-gray-400 text-sm">Full access to all tabs. Can manage users, permissions, and system settings.</p>
                    </div>
                    <div class="p-4 rounded-lg" style="background: var(--color-dark-bg);">
                        <div class="flex items-center mb-2">
                            <i class="fa-solid fa-gear text-blue-400 mr-2"></i>
                            <span class="text-white font-medium">Machinist</span>
                        </div>
                        <p class="text-gray-400 text-sm">Access to workcenter, inventory, and tasks. No access to sales or settings by default.</p>
                    </div>
                    <div class="p-4 rounded-lg" style="background: var(--color-dark-bg);">
                        <div class="flex items-center mb-2">
                            <i class="fa-solid fa-user text-green-400 mr-2"></i>
                            <span class="text-white font-medium">Operator</span>
                        </div>
                        <p class="text-gray-400 text-sm">Basic access to dashboard, workcenter, and tasks only.</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupUsersEventHandlers();
}

function renderUserRow(user) {
    const isCurrentUser = currentUser && currentUser.id === user.id;
    const roleColors = {
        Administrator: 'text-red-400',
        Machinist: 'text-blue-400',
        Operator: 'text-green-400'
    };
    const roleIcons = {
        Administrator: 'fa-shield-halved',
        Machinist: 'fa-gear',
        Operator: 'fa-user'
    };
    
    const permissions = user.tab_permissions || {};
    const permissionBadges = Object.entries(permissions)
        .filter(([_, allowed]) => allowed)
        .map(([tab, _]) => `<span class="inline-block px-2 py-0.5 text-xs rounded mr-1 mb-1" style="background: var(--color-accent-primary); color: white;">${tab}</span>`)
        .join('');
    
    return `
        <tr class="border-b border-gray-700/50 hover:bg-gray-800/30 ${isCurrentUser ? 'bg-gray-800/20' : ''}">
            <td class="p-4">
                <div class="flex items-center">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background: var(--color-accent-primary);">
                        <span class="text-white font-medium">${user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                        <div class="text-white font-medium">${user.name} ${isCurrentUser ? '<span class="text-xs text-gray-400">(you)</span>' : ''}</div>
                        <div class="text-gray-400 text-sm">${user.username}</div>
                    </div>
                </div>
            </td>
            <td class="p-4">
                <span class="${roleColors[user.role] || 'text-gray-400'}">
                    <i class="fa-solid ${roleIcons[user.role] || 'fa-user'} mr-1"></i>
                    ${user.role}
                </span>
            </td>
            <td class="p-4">
                <div class="flex flex-wrap">
                    ${user.role === 'Administrator' ? '<span class="text-gray-400 text-sm italic">All tabs (admin)</span>' : permissionBadges || '<span class="text-gray-500 text-sm">None</span>'}
                </div>
            </td>
            <td class="p-4">
                ${user.is_active 
                    ? '<span class="inline-flex items-center px-2 py-1 rounded text-xs" style="background: rgba(34, 197, 94, 0.2); color: rgb(34, 197, 94);"><i class="fa-solid fa-circle text-xs mr-1"></i>Active</span>'
                    : '<span class="inline-flex items-center px-2 py-1 rounded text-xs" style="background: rgba(239, 68, 68, 0.2); color: rgb(239, 68, 68);"><i class="fa-solid fa-circle text-xs mr-1"></i>Inactive</span>'
                }
            </td>
            <td class="p-4 text-right">
                <button data-action="edit-user" data-user-id="${user.id}" class="text-gray-400 hover:text-white p-2" title="Edit User">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button data-action="edit-permissions" data-user-id="${user.id}" class="text-gray-400 hover:text-blue-400 p-2" title="Edit Permissions" ${user.role === 'Administrator' ? 'disabled' : ''}>
                    <i class="fa-solid fa-key"></i>
                </button>
                ${!isCurrentUser ? `
                    <button data-action="delete-user" data-user-id="${user.id}" class="text-gray-400 hover:text-red-400 p-2" title="Delete User">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
}

function setupUsersEventHandlers() {
    // Add user
    document.querySelectorAll('[data-action="add-user"]').forEach(btn => {
        btn.addEventListener('click', () => showUserModal());
    });
    
    // Edit user
    document.querySelectorAll('[data-action="edit-user"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.dataset.userId);
            const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
            const user = users.find(u => u.id === userId);
            if (user) showUserModal(user);
        });
    });
    
    // Edit permissions
    document.querySelectorAll('[data-action="edit-permissions"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.dataset.userId);
            const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
            const user = users.find(u => u.id === userId);
            if (user) showPermissionsModal(user);
        });
    });
    
    // Delete user
    document.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = parseInt(btn.dataset.userId);
            const users = storage.get(USER_STORAGE_KEYS.USERS_LIST, DEMO_USERS);
            const user = users.find(u => u.id === userId);
            
            if (user && confirm(`Are you sure you want to delete user "${user.name}"?`)) {
                const result = await deleteUser(userId);
                if (result.success) {
                    showToast('User deleted successfully', 'success');
                    loadUsersView(); // Refresh
                } else {
                    showToast(result.error || 'Failed to delete user', 'error');
                }
            }
        });
    });
}

/**
 * Show user add/edit modal
 */
function showUserModal(user = null) {
    const isEdit = !!user;
    const modal = document.createElement('div');
    modal.id = 'userModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onclick="document.getElementById('userModal').remove()"></div>
        <div class="bg-cardBg border border-gray-700 rounded-xl shadow-2xl w-full max-w-md z-50 mx-4">
            <div class="px-6 py-4 border-b border-gray-700">
                <h3 class="text-white font-medium">
                    <i class="fa-solid fa-${isEdit ? 'user-pen' : 'user-plus'} mr-2" style="color: var(--color-accent-primary);"></i>
                    ${isEdit ? 'Edit User' : 'Add New User'}
                </h3>
            </div>
            <form id="userForm" class="p-6 space-y-4">
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Username</label>
                    <input type="text" name="username" value="${user?.username || ''}" 
                           class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none"
                           ${isEdit ? 'readonly' : 'required'}>
                </div>
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Full Name</label>
                    <input type="text" name="name" value="${user?.name || ''}" 
                           class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none"
                           required>
                </div>
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Email</label>
                    <input type="email" name="email" value="${user?.email || ''}" 
                           class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none">
                </div>
                ${!isEdit ? `
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">Password</label>
                        <input type="password" name="password" 
                               class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none"
                               required>
                    </div>
                ` : `
                    <div>
                        <label class="block text-gray-400 text-sm mb-1">New Password (leave blank to keep current)</label>
                        <input type="password" name="password" 
                               class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none">
                    </div>
                `}
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Role</label>
                    <select name="role" class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none">
                        <option value="Operator" ${user?.role === 'Operator' ? 'selected' : ''}>Operator</option>
                        <option value="Machinist" ${user?.role === 'Machinist' ? 'selected' : ''}>Machinist</option>
                        <option value="Administrator" ${user?.role === 'Administrator' ? 'selected' : ''}>Administrator</option>
                    </select>
                </div>
                ${isEdit ? `
                    <div class="flex items-center">
                        <input type="checkbox" name="is_active" id="userActive" ${user?.is_active ? 'checked' : ''} class="mr-2">
                        <label for="userActive" class="text-gray-400 text-sm">Active</label>
                    </div>
                ` : ''}
                <div class="flex justify-end space-x-3 pt-4">
                    <button type="button" onclick="document.getElementById('userModal').remove()" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create User'}</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            role: formData.get('role')
        };
        
        if (!isEdit) {
            data.username = formData.get('username');
            data.password = formData.get('password');
        } else {
            if (formData.get('password')) {
                data.password = formData.get('password');
            }
            data.is_active = formData.get('is_active') === 'on';
        }
        
        let result;
        if (isEdit) {
            result = await updateUser(user.id, data);
        } else {
            result = await createUser(data);
        }
        
        if (result.success) {
            showToast(`User ${isEdit ? 'updated' : 'created'} successfully`, 'success');
            document.getElementById('userModal').remove();
            loadUsersView(); // Refresh
        } else {
            showToast(result.error || 'Operation failed', 'error');
        }
    });
}

/**
 * Show permissions edit modal
 */
function showPermissionsModal(user) {
    if (user.role === 'Administrator') {
        showToast('Administrators always have full access', 'info');
        return;
    }
    
    const permissions = user.tab_permissions || {};
    
    const modal = document.createElement('div');
    modal.id = 'permissionsModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" onclick="document.getElementById('permissionsModal').remove()"></div>
        <div class="bg-cardBg border border-gray-700 rounded-xl shadow-2xl w-full max-w-md z-50 mx-4">
            <div class="px-6 py-4 border-b border-gray-700">
                <h3 class="text-white font-medium">
                    <i class="fa-solid fa-key mr-2" style="color: var(--color-accent-primary);"></i>
                    Edit Permissions for ${user.name}
                </h3>
                <p class="text-gray-400 text-sm mt-1">Role: ${user.role}</p>
            </div>
            <form id="permissionsForm" class="p-6 space-y-4">
                <p class="text-gray-400 text-sm mb-4">Select which tabs this user can access:</p>
                
                ${Object.entries(TAB_CATEGORIES).map(([key, label]) => `
                    <label class="flex items-center p-3 rounded hover:bg-gray-800/50 cursor-pointer">
                        <input type="checkbox" name="${key}" ${permissions[key] ? 'checked' : ''} 
                               class="w-5 h-5 rounded border-gray-600 text-accentGreen focus:ring-accentGreen mr-3">
                        <span class="text-white">${label}</span>
                    </label>
                `).join('')}
                
                <div class="flex justify-end space-x-3 pt-4 border-t border-gray-700">
                    <button type="button" onclick="document.getElementById('permissionsModal').remove()" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Permissions</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('permissionsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPermissions = {};
        Object.keys(TAB_CATEGORIES).forEach(key => {
            const checkbox = e.target.querySelector(`[name="${key}"]`);
            newPermissions[key] = checkbox ? checkbox.checked : false;
        });
        
        const result = await updateUserPermissions(user.id, newPermissions);
        
        if (result.success) {
            showToast('Permissions updated successfully', 'success');
            document.getElementById('permissionsModal').remove();
            loadUsersView(); // Refresh
        } else {
            showToast(result.error || 'Failed to update permissions', 'error');
        }
    });
}

// ==================== LOGIN MODAL ====================

/**
 * Show login modal
 */
export function showLoginModal(onSuccess = null) {
    // Remove existing modal if any
    const existing = document.getElementById('loginModal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm"></div>
        <div class="bg-cardBg border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm z-50 mx-4">
            <div class="px-6 py-5 border-b border-gray-700 text-center">
                <img src="assets/bperp-icon.ico" alt="BPERP" class="w-12 h-12 mx-auto mb-3">
                <h3 class="text-white text-lg font-semibold">Welcome to BPERP</h3>
                <p class="text-gray-400 text-sm mt-1">Sign in to continue</p>
            </div>
            <form id="loginForm" class="p-6 space-y-4">
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Username</label>
                    <input type="text" name="username" placeholder="Enter username"
                           class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none"
                           required autofocus>
                </div>
                <div>
                    <label class="block text-gray-400 text-sm mb-1">Password</label>
                    <input type="password" name="password" placeholder="Enter password"
                           class="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-accentGreen focus:outline-none"
                           required>
                </div>
                <div id="loginError" class="text-red-400 text-sm hidden"></div>
                <button type="submit" class="btn btn-primary w-full">
                    <i class="fa-solid fa-sign-in-alt mr-2"></i>Sign In
                </button>
                <p class="text-gray-500 text-xs text-center mt-4" id="loginHint">
                    ${typeof window !== 'undefined' && window.platform?.isElectron
                        ? 'Sign in with the username you created during setup'
                        : 'Demo: Use "admin", "machinist1", or "operator1" with any password'}
                </p>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Signing in...';
        
        const result = await login(username, password);
        
        if (result.success) {
            document.getElementById('loginModal').remove();
            showToast(`Welcome, ${result.user.name}!`, 'success');
            if (onSuccess) onSuccess(result.user);
        } else {
            const errorEl = document.getElementById('loginError');
            errorEl.textContent = result.error || 'Login failed';
            errorEl.classList.remove('hidden');
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-sign-in-alt mr-2"></i>Sign In';
        }
    });
}

// ==================== EXPORTS ====================
export { USER_STORAGE_KEYS };
