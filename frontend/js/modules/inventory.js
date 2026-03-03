/**
 * BPERP Dashboard - Inventory Module
 * Materials, Tooling, and Miscellaneous Items Management
 */

import { 
    debounce, showToast, showDeleteConfirm, showLoadingSpinner,
    formatDate, formatCurrency, DOMCache, createModal, closeModal,
    getStatusBadgeClass, exportToCSV, batchDOMUpdate, safeExecute
} from './common.js';
import { storage, STORAGE_KEYS, searchCache } from './storage.js';

// ==================== CONSTANTS ====================
const API_BASE = window.API_BASE || '/api';

const URGENCY_THRESHOLDS = {
    CRITICAL: 0,
    LOW: 0.25,
    MONITOR: 0.5
};

// ==================== STATE ====================
let inventoryState = {
    currentView: 'materials',
    filters: {
        search: '',
        status: '',
        sortBy: 'name',
        sortDir: 'asc'
    },
    cachedResults: null,
    cacheTimestamp: 0
};

// ==================== DEMO DATA ====================
function getDemoMaterials() {
    return [
        { id: 1, name: 'Aluminum 6061 Bar 2x4x144', partNumber: 'ALU-6061-2X4', category: 'Aluminum', quantityOnHand: 15, reorderPoint: 5, supplier: 'Metals Depot', unitPrice: 89.50, lastOrdered: '2025-01-10' },
        { id: 2, name: 'Steel 4140 Round 2" Dia x 12ft', partNumber: 'STL-4140-2RD', category: 'Steel', quantityOnHand: 3, reorderPoint: 5, supplier: 'Metal Supermarkets', unitPrice: 145.00, lastOrdered: '2025-01-05' },
        { id: 3, name: 'Brass C360 Hex 1" x 12ft', partNumber: 'BRS-C360-1HX', category: 'Brass', quantityOnHand: 8, reorderPoint: 3, supplier: 'Metals Depot', unitPrice: 67.25, lastOrdered: '2025-01-08' },
        { id: 4, name: 'Stainless 303 Bar 1x2x72', partNumber: 'SS-303-1X2', category: 'Stainless', quantityOnHand: 0, reorderPoint: 2, supplier: 'Industrial Metal Supply', unitPrice: 124.00, lastOrdered: '2024-12-20' }
    ];
}

function getDemoTooling() {
    return [
        { id: 1, name: '1/2" 4-Flute Carbide Endmill', partNumber: 'EM-050-4FL', category: 'Endmills', quantityOnHand: 12, reorderPoint: 5, supplier: 'MSC Industrial', unitPrice: 45.99 },
        { id: 2, name: '3/8" Carbide Drill', partNumber: 'DR-0375-CB', category: 'Drills', quantityOnHand: 2, reorderPoint: 5, supplier: 'Grainger', unitPrice: 28.50 },
        { id: 3, name: 'CNMG 432 Carbide Insert', partNumber: 'INS-CNMG432', category: 'Inserts', quantityOnHand: 24, reorderPoint: 10, supplier: 'Kennametal', unitPrice: 12.75 }
    ];
}

function getDemoMiscItems() {
    return [
        { id: 1, name: 'Cutting Fluid - 5 Gallon', partNumber: 'CF-05GAL', category: 'Fluids', quantityOnHand: 3, reorderPoint: 2, supplier: 'McMaster-Carr', unitPrice: 89.00 },
        { id: 2, name: 'Shop Towels - Box of 200', partNumber: 'ST-200BX', category: 'Supplies', quantityOnHand: 5, reorderPoint: 3, supplier: 'Grainger', unitPrice: 24.50 }
    ];
}

function getDemoProducts() {
    return [
        { id: 1, name: 'Widget Assembly A', partNumber: 'WGT-A-001', category: 'Assemblies', quantityOnHand: 10, reorderPoint: 5, supplier: 'Internal', unitPrice: 125.00, bom: [] },
        { id: 2, name: 'Fixture Kit B', partNumber: 'FIX-B-002', category: 'Kits', quantityOnHand: 3, reorderPoint: 2, supplier: 'Internal', unitPrice: 89.50, bom: [] }
    ];
}

function getDemoParts() {
    return [
        { id: 1, name: 'Bracket - Steel', partNumber: 'BRK-ST-01', category: 'Hardware', source: 'purchased', quantityOnHand: 50, reorderPoint: 20, supplier: 'Fastenal', unitPrice: 4.25 },
        { id: 2, name: 'Shaft - 1/2" x 6"', partNumber: 'SFT-050-6', category: 'Components', source: 'manufactured', quantityOnHand: 25, reorderPoint: 10, supplier: 'Internal', unitPrice: 12.00 },
        { id: 3, name: 'Bushing - Bronze', partNumber: 'BSH-BZ-01', category: 'Hardware', source: 'purchased', quantityOnHand: 30, reorderPoint: 15, supplier: 'McMaster-Carr', unitPrice: 8.50 }
    ];
}

// ==================== DATA ACCESS ====================
export function getMaterials() {
    let data = storage.get(STORAGE_KEYS.MATERIALS);
    if (!data) {
        data = getDemoMaterials();
        storage.set(STORAGE_KEYS.MATERIALS, data);
    }
    return data;
}

export function getTooling() {
    let data = storage.get(STORAGE_KEYS.TOOLING);
    if (!data) {
        data = getDemoTooling();
        storage.set(STORAGE_KEYS.TOOLING, data);
    }
    return data;
}

export function getMiscItems() {
    let data = storage.get(STORAGE_KEYS.MISC_ITEMS);
    if (!data) {
        data = getDemoMiscItems();
        storage.set(STORAGE_KEYS.MISC_ITEMS, data);
    }
    return data;
}

export function getProducts() {
    let data = storage.get(STORAGE_KEYS.PRODUCTS);
    if (!data) {
        data = getDemoProducts();
        storage.set(STORAGE_KEYS.PRODUCTS, data);
    }
    return data;
}

export function getParts() {
    let data = storage.get(STORAGE_KEYS.PARTS);
    if (!data) {
        data = getDemoParts();
        storage.set(STORAGE_KEYS.PARTS, data);
    }
    return data;
}

// ==================== URGENCY CALCULATIONS ====================
function getUrgencyStatus(item) {
    const ratio = item.quantityOnHand / (item.reorderPoint || 1);
    if (ratio <= URGENCY_THRESHOLDS.CRITICAL) return { status: 'Critical', color: 'red', priority: 0 };
    if (ratio <= URGENCY_THRESHOLDS.LOW) return { status: 'Low Stock', color: 'orange', priority: 1 };
    if (ratio <= URGENCY_THRESHOLDS.MONITOR) return { status: 'Monitor', color: 'yellow', priority: 2 };
    return { status: 'Good', color: 'green', priority: 3 };
}

function getUrgencyBadgeClass(urgency) {
    const classes = {
        'Critical': 'bg-red-600 text-red-100',
        'Low Stock': 'bg-orange-600 text-orange-100',
        'Monitor': 'bg-yellow-600 text-yellow-100',
        'Good': 'bg-green-600 text-green-100'
    };
    return classes[urgency.status] || 'bg-gray-600 text-gray-200';
}

// ==================== FILTERING & SORTING ====================
function filterAndSortItems(items, filters) {
    // Check cache
    const cacheKey = JSON.stringify({ items: items.length, filters });
    const cached = searchCache.get(cacheKey, {});
    if (cached) return cached;

    let filtered = [...items];

    // Search filter
    if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(item => 
            item.name?.toLowerCase().includes(search) ||
            item.partNumber?.toLowerCase().includes(search) ||
            item.supplier?.toLowerCase().includes(search) ||
            item.category?.toLowerCase().includes(search)
        );
    }

    // Status filter
    if (filters.status) {
        filtered = filtered.filter(item => {
            const urgency = getUrgencyStatus(item);
            return urgency.status === filters.status;
        });
    }

    // Sorting
    const sortKey = filters.sortBy || 'name';
    const sortDir = filters.sortDir === 'desc' ? -1 : 1;
    
    filtered.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        
        // Handle different types
        if (typeof valA === 'string') {
            return sortDir * valA.localeCompare(valB);
        }
        if (typeof valA === 'number') {
            return sortDir * (valA - valB);
        }
        return 0;
    });

    // Cache results
    searchCache.set(cacheKey, {}, filtered);
    
    return filtered;
}

// ==================== RENDER FUNCTIONS ====================
function renderInventoryTable(items, type) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;

    const filtered = filterAndSortItems(items, inventoryState.filters);
    
    // Build table using DocumentFragment for performance
    const tableHtml = `
        <div class="col-span-3 card p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-medium" style="color: var(--color-accent-primary);">
                    <i class="fa-solid fa-boxes mr-2"></i>${type} Inventory
                    <span class="text-xs" style="color: var(--color-text-muted);">(${filtered.length} items)</span>
                </h3>
                <div class="flex space-x-2">
                    <button data-action="export-inventory" data-type="${type.toLowerCase()}" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                        <i class="fa-solid fa-download mr-1"></i>Export
                    </button>
                    <button data-action="add-inventory" data-type="${type.toLowerCase()}" class="btn btn-primary text-sm">
                        <i class="fa-solid fa-plus mr-1"></i>Add ${type.slice(0, -1)}
                    </button>
                </div>
            </div>
            
            <!-- Filters - Single Line -->
            <div class="flex items-center gap-2 mb-4 p-2 rounded-lg" style="background: var(--color-dark-bg); border: 1px solid var(--color-border);">
                <div class="flex items-center gap-1 flex-1 min-w-0">
                    <i class="fa-solid fa-search text-gray-400 text-sm"></i>
                    <input type="text" id="inventorySearch" placeholder="Search items..."
                        value="${inventoryState.filters.search}"
                        class="bg-transparent border-0 outline-none text-sm text-white placeholder-gray-400 flex-1 min-w-0">
                </div>
                <select id="inventoryStatusFilter" class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 min-w-[100px]">
                    <option value="">All Status</option>
                    <option value="Critical" ${inventoryState.filters.status === 'Critical' ? 'selected' : ''}>Critical</option>
                    <option value="Low Stock" ${inventoryState.filters.status === 'Low Stock' ? 'selected' : ''}>Low Stock</option>
                    <option value="Monitor" ${inventoryState.filters.status === 'Monitor' ? 'selected' : ''}>Monitor</option>
                    <option value="Good" ${inventoryState.filters.status === 'Good' ? 'selected' : ''}>Good</option>
                </select>
                <select id="inventorySortBy" class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 min-w-[120px]">
                    <option value="name" ${inventoryState.filters.sortBy === 'name' ? 'selected' : ''}>Sort: Name</option>
                    <option value="quantityOnHand" ${inventoryState.filters.sortBy === 'quantityOnHand' ? 'selected' : ''}>Sort: Quantity</option>
                    <option value="unitPrice" ${inventoryState.filters.sortBy === 'unitPrice' ? 'selected' : ''}>Sort: Price</option>
                    <option value="supplier" ${inventoryState.filters.sortBy === 'supplier' ? 'selected' : ''}>Sort: Supplier</option>
                </select>
                <button data-action="clear-inventory-filters" class="text-xs px-2 py-1 rounded hover:bg-gray-600 transition-colors" style="color: var(--color-accent-primary);">
                    <i class="fa-solid fa-times mr-1"></i>Clear
                </button>
            </div>
            
            <!-- Table -->
            <div class="table-container">
                <table class="table w-full text-sm text-left">
                    <thead>
                        <tr>
                            <th class="px-4 py-3">Name / Part#</th>
                            <th class="px-4 py-3">Category</th>
                            <th class="px-4 py-3">Qty</th>
                            <th class="px-4 py-3">Reorder Pt</th>
                            <th class="px-4 py-3">Status</th>
                            <th class="px-4 py-3">Supplier</th>
                            <th class="px-4 py-3">Unit Price</th>
                            <th class="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(item => {
                            const urgency = getUrgencyStatus(item);
                            return `
                                <tr data-item-id="${item.id}">
                                    <td class="px-4 py-3">
                                        <div class="font-medium text-white">${item.name}</div>
                                        <div class="text-xs" style="color: var(--color-text-muted);">${item.partNumber || '-'}</div>
                                    </td>
                                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${item.category || '-'}</td>
                                    <td class="px-4 py-3 font-medium ${urgency.color === 'red' ? 'text-red-400' : urgency.color === 'orange' ? 'text-orange-400' : 'text-white'}">${item.quantityOnHand}</td>
                                    <td class="px-4 py-3" style="color: var(--color-text-muted);">${item.reorderPoint || '-'}</td>
                                    <td class="px-4 py-3">
                                        <span class="badge ${getUrgencyBadgeClass(urgency)}">${urgency.status}</span>
                                    </td>
                                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${item.supplier || '-'}</td>
                                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${formatCurrency(item.unitPrice)}</td>
                                    <td class="px-4 py-3">
                                        <div class="flex space-x-2">
                                            <button data-action="edit-inventory" data-type="${type.toLowerCase()}" data-id="${item.id}" style="color: var(--color-info);" class="hover:opacity-80" title="Edit">
                                                <i class="fa-solid fa-edit"></i>
                                            </button>
                                            <button data-action="delete-inventory" data-type="${type.toLowerCase()}" data-id="${item.id}" data-name="${item.name}" style="color: var(--color-error);" class="hover:opacity-80" title="Delete">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('') : '<tr><td colspan="8" class="text-center py-8" style="color: var(--color-text-muted);">No items found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    container.innerHTML = tableHtml;
    setupInventoryFilters();
}

// ==================== FILTER HANDLERS ====================
const debouncedSearch = debounce((value) => {
    inventoryState.filters.search = value;
    searchCache.clear(); // Clear cache when search changes
    refreshCurrentView();
}, 300);

function setupInventoryFilters() {
    const searchInput = document.getElementById('inventorySearch');
    const statusFilter = document.getElementById('inventoryStatusFilter');
    const sortFilter = document.getElementById('inventorySortBy');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            inventoryState.filters.status = e.target.value;
            refreshCurrentView();
        });
    }

    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            inventoryState.filters.sortBy = e.target.value;
            refreshCurrentView();
        });
    }
}

function refreshCurrentView() {
    switch (inventoryState.currentView) {
        case 'materials': loadMaterialInventory(); break;
        case 'tooling': loadToolingInventory(); break;
        case 'misc': loadMiscInventory(); break;
        case 'products': loadProductInventory(); break;
        case 'parts': loadPartsInventory(); break;
    }
}

// ==================== PUBLIC FUNCTIONS ====================
export function loadMaterialInventory() {
    inventoryState.currentView = 'materials';
    showLoadingSpinner();
    
    safeExecute(() => {
        const materials = getMaterials();
        renderInventoryTable(materials, 'Materials');
    }, () => {
        showToast('Error loading materials', 'error');
    }, 'loadMaterialInventory');
}

export function loadToolingInventory() {
    inventoryState.currentView = 'tooling';
    showLoadingSpinner();
    
    safeExecute(() => {
        const tooling = getTooling();
        renderInventoryTable(tooling, 'Tooling');
    }, () => {
        showToast('Error loading tooling', 'error');
    }, 'loadToolingInventory');
}

export function loadMiscInventory() {
    inventoryState.currentView = 'misc';
    showLoadingSpinner();
    
    safeExecute(() => {
        const misc = getMiscItems();
        renderInventoryTable(misc, 'Miscellaneous');
    }, () => {
        showToast('Error loading misc items', 'error');
    }, 'loadMiscInventory');
}

export function loadProductInventory() {
    inventoryState.currentView = 'products';
    showLoadingSpinner();
    
    safeExecute(() => {
        const products = getProducts();
        renderInventoryTable(products, 'Products');
    }, () => {
        showToast('Error loading products', 'error');
    }, 'loadProductInventory');
}

export function loadPartsInventory() {
    inventoryState.currentView = 'parts';
    showLoadingSpinner();
    
    safeExecute(() => {
        const parts = getParts();
        renderInventoryTable(parts, 'Parts');
    }, () => {
        showToast('Error loading parts', 'error');
    }, 'loadPartsInventory');
}

// ==================== CRUD OPERATIONS ====================
export function showAddInventoryModal(type) {
    // Capitalize and singularize the type for display
    const displayType = type.charAt(0).toUpperCase() + type.slice(1).replace(/s$/, '');
    const sourceField = type === 'parts' ? `
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Source</label>
                        <select name="source" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="purchased">Purchased</option>
                            <option value="manufactured">Manufactured</option>
                        </select>
                    </div>` : '';
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-plus-circle mr-2 text-accentGreen"></i>Add ${displayType}
                </h3>
                <button onclick="BPERP.common.closeModal('inventoryModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="inventoryForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Name *</label>
                        <input type="text" name="name" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Part Number</label>
                        <input type="text" name="partNumber" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Category</label>
                        <input type="text" name="category" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    ${sourceField}
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Supplier</label>
                        <input type="text" name="supplier" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Unit Price</label>
                        <input type="number" name="unitPrice" min="0" step="0.01" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('inventoryModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-accentGreen text-white px-4 py-2 rounded hover:bg-green-700">Add ${displayType}</button>
                </div>
            </form>
        </div>
    `;
    
    createModal('inventoryModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('inventoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // Convert numeric fields
        data.quantityOnHand = parseInt(data.quantityOnHand) || 0;
        data.reorderPoint = parseInt(data.reorderPoint) || 0;
        data.unitPrice = parseFloat(data.unitPrice) || 0;
        
        addInventoryItem(type, data);
    });
}

function addInventoryItem(type, data) {
    const keyMap = {
        'materials': STORAGE_KEYS.MATERIALS,
        'tooling': STORAGE_KEYS.TOOLING,
        'miscellaneous': STORAGE_KEYS.MISC_ITEMS,
        'misc': STORAGE_KEYS.MISC_ITEMS,
        'products': STORAGE_KEYS.PRODUCTS,
        'parts': STORAGE_KEYS.PARTS
    };
    
    const key = keyMap[type];
    if (!key) return;
    
    if (type === 'products') data.bom = data.bom || [];
    if (type === 'parts') data.source = data.source || 'purchased';
    
    storage.addItem(key, data);
    closeModal('inventoryModal');
    showToast('Item added successfully', 'success');
    searchCache.clear();
    refreshCurrentView();
}

export function editInventoryItem(type, id) {
    const keyMap = {
        'materials': STORAGE_KEYS.MATERIALS,
        'tooling': STORAGE_KEYS.TOOLING,
        'miscellaneous': STORAGE_KEYS.MISC_ITEMS,
        'misc': STORAGE_KEYS.MISC_ITEMS,
        'products': STORAGE_KEYS.PRODUCTS,
        'parts': STORAGE_KEYS.PARTS
    };
    
    const key = keyMap[type];
    if (!key) return;
    
    const items = storage.get(key, []);
    const item = items.find(i => i.id === parseInt(id));
    if (!item) {
        showToast('Item not found', 'error');
        return;
    }
    
    if (type === 'products') {
        showEditProductModal(item, key);
        return;
    }
    
    if (type === 'parts') {
        showEditPartModal(item, key);
        return;
    }
    
    showEditInventoryModalGeneric(item, key, type);
}

function showEditInventoryModalGeneric(item, key, type) {
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2 text-blue-400"></i>Edit ${type}
                </h3>
                <button onclick="BPERP.common.closeModal('inventoryModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="inventoryForm" class="space-y-4">
                <input type="hidden" name="id" value="${item.id}">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Name *</label>
                        <input type="text" name="name" required value="${item.name || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Part Number</label>
                        <input type="text" name="partNumber" value="${item.partNumber || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Category</label>
                        <input type="text" name="category" value="${item.category || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Supplier</label>
                        <input type="text" name="supplier" value="${item.supplier || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" value="${item.quantityOnHand || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" value="${item.reorderPoint || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Unit Price</label>
                        <input type="number" name="unitPrice" min="0" step="0.01" value="${item.unitPrice || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('inventoryModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    
    createModal('inventoryModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('inventoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        data.id = parseInt(data.id);
        data.quantityOnHand = parseInt(data.quantityOnHand) || 0;
        data.reorderPoint = parseInt(data.reorderPoint) || 0;
        data.unitPrice = parseFloat(data.unitPrice) || 0;
        
        storage.updateItem(key, data.id, data);
        closeModal('inventoryModal');
        showToast('Item updated successfully', 'success');
        searchCache.clear();
        refreshCurrentView();
    });
}

function showEditPartModal(item, key) {
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2 text-blue-400"></i>Edit Part
                </h3>
                <button onclick="BPERP.common.closeModal('inventoryModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="inventoryForm" class="space-y-4">
                <input type="hidden" name="id" value="${item.id}">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Name *</label>
                        <input type="text" name="name" required value="${(item.name || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Part Number</label>
                        <input type="text" name="partNumber" value="${(item.partNumber || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Category</label>
                        <input type="text" name="category" value="${(item.category || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Source</label>
                        <select name="source" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="purchased" ${(item.source || 'purchased') === 'purchased' ? 'selected' : ''}>Purchased</option>
                            <option value="manufactured" ${(item.source || 'purchased') === 'manufactured' ? 'selected' : ''}>Manufactured</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Supplier</label>
                        <input type="text" name="supplier" value="${(item.supplier || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" value="${item.quantityOnHand || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" value="${item.reorderPoint || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Unit Price</label>
                        <input type="number" name="unitPrice" min="0" step="0.01" value="${item.unitPrice || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('inventoryModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    createModal('inventoryModal', content, { width: 'w-full max-w-lg' });
    document.getElementById('inventoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.id = parseInt(data.id);
        data.quantityOnHand = parseInt(data.quantityOnHand) || 0;
        data.reorderPoint = parseInt(data.reorderPoint) || 0;
        data.unitPrice = parseFloat(data.unitPrice) || 0;
        data.source = data.source || 'purchased';
        storage.updateItem(key, data.id, data);
        closeModal('inventoryModal');
        showToast('Part updated successfully', 'success');
        searchCache.clear();
        refreshCurrentView();
    });
}

function showEditProductModal(item, key) {
    const bom = item.bom || [];
    const bomRows = bom.map(b => `
        <tr data-part-id="${b.partId}">
            <td class="px-3 py-2 text-sm text-white">${(b.partName || '').replace(/</g, '&lt;')}</td>
            <td class="px-3 py-2 text-sm text-gray-400">${(b.partNumber || '-').replace(/</g, '&lt;')}</td>
            <td class="px-3 py-2 text-sm text-white">${b.quantityPerAssembly}</td>
            <td class="px-3 py-2">
                <button type="button" data-action="remove-bom-part" data-part-id="${b.partId}" class="text-red-400 hover:text-red-300" title="Remove">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2 text-blue-400"></i>Edit Product
                </h3>
                <button onclick="BPERP.common.closeModal('inventoryModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="inventoryForm" class="space-y-4">
                <input type="hidden" name="id" value="${item.id}">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Name *</label>
                        <input type="text" name="name" required value="${(item.name || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Part Number</label>
                        <input type="text" name="partNumber" value="${(item.partNumber || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Category</label>
                        <input type="text" name="category" value="${(item.category || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Supplier</label>
                        <input type="text" name="supplier" value="${(item.supplier || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" value="${item.quantityOnHand || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" value="${item.reorderPoint || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Unit Price</label>
                        <input type="number" name="unitPrice" min="0" step="0.01" value="${item.unitPrice || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="mt-4">
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-sm text-gray-400">Bill of Materials</label>
                        <button type="button" id="addBomPartBtn" class="text-sm text-emerald-400 hover:text-emerald-300">
                            <i class="fa-solid fa-plus mr-1"></i>Add Part
                        </button>
                    </div>
                    <div class="rounded-lg border border-gray-600 overflow-hidden" style="background: var(--color-dark-bg);">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="border-b border-gray-600">
                                    <th class="px-3 py-2 text-left text-gray-400">Part</th>
                                    <th class="px-3 py-2 text-left text-gray-400">Part #</th>
                                    <th class="px-3 py-2 text-left text-gray-400">Qty/Assembly</th>
                                    <th class="px-3 py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody id="productBomTableBody">
                                ${bomRows || '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">No parts in BOM</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('inventoryModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    createModal('inventoryModal', content, { width: 'w-full max-w-2xl' });
    
    const bomData = [...bom];
    
    function renderBomTable() {
        const tbody = document.getElementById('productBomTableBody');
        if (!tbody) return;
        if (bomData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">No parts in BOM</td></tr>';
            return;
        }
        tbody.innerHTML = bomData.map(b => `
            <tr data-part-id="${b.partId}">
                <td class="px-3 py-2 text-sm text-white">${(b.partName || '').replace(/</g, '&lt;')}</td>
                <td class="px-3 py-2 text-sm text-gray-400">${(b.partNumber || '-').replace(/</g, '&lt;')}</td>
                <td class="px-3 py-2 text-sm text-white">${b.quantityPerAssembly}</td>
                <td class="px-3 py-2">
                    <button type="button" data-action="remove-bom-part" data-part-id="${b.partId}" class="text-red-400 hover:text-red-300" title="Remove">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        tbody.querySelectorAll('[data-action="remove-bom-part"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const partId = parseInt(btn.dataset.partId);
                const idx = bomData.findIndex(b => b.partId === partId);
                if (idx >= 0) bomData.splice(idx, 1);
                renderBomTable();
            });
        });
    }
    
    document.getElementById('addBomPartBtn')?.addEventListener('click', () => {
        const parts = getParts();
        const usedIds = new Set(bomData.map(b => b.partId));
        const available = parts.filter(p => !usedIds.has(p.id));
        if (available.length === 0) {
            showToast('No more parts available to add', 'info');
            return;
        }
        const options = available.map(p => 
            `<option value="${p.id}" data-name="${(p.name || '').replace(/"/g, '&quot;')}" data-pn="${(p.partNumber || '').replace(/"/g, '&quot;')}">${(p.name || '').replace(/</g, '&lt;')} (${(p.partNumber || '-').replace(/</g, '&lt;')})</option>`
        ).join('');
        const addContent = `
            <div class="p-4">
                <h4 class="text-white font-medium mb-3">Add Part to BOM</h4>
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Part</label>
                        <select id="bomPartSelect" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            ${options}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity per Assembly</label>
                        <input type="number" id="bomPartQty" min="0.001" step="0.01" value="1" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <button type="button" id="bomPartCancel" class="flex-1 bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="button" id="bomPartAdd" class="flex-1 bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700">Add</button>
                </div>
            </div>
        `;
        createModal('bomAddModal', addContent, { width: 'w-full max-w-md' });
        document.getElementById('bomPartAdd')?.addEventListener('click', () => {
            const select = document.getElementById('bomPartSelect');
            const qty = parseFloat(document.getElementById('bomPartQty')?.value) || 1;
            if (!select) return;
            const opt = select.options[select.selectedIndex];
            const partId = parseInt(select.value);
            const partName = opt?.dataset.name || opt?.textContent || '';
            const partNumber = opt?.dataset.pn || '';
            bomData.push({ partId, partName, partNumber, quantityPerAssembly: qty });
            closeModal('bomAddModal');
            renderBomTable();
        });
        document.getElementById('bomPartCancel')?.addEventListener('click', () => closeModal('bomAddModal'));
    });
    
    tbody?.querySelectorAll('[data-action="remove-bom-part"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const partId = parseInt(btn.dataset.partId);
            const idx = bomData.findIndex(b => b.partId === partId);
            if (idx >= 0) bomData.splice(idx, 1);
            renderBomTable();
        });
    });
    
    document.getElementById('inventoryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.id = parseInt(data.id);
        data.quantityOnHand = parseInt(data.quantityOnHand) || 0;
        data.reorderPoint = parseInt(data.reorderPoint) || 0;
        data.unitPrice = parseFloat(data.unitPrice) || 0;
        data.bom = bomData;
        storage.updateItem(key, data.id, data);
        closeModal('inventoryModal');
        showToast('Product updated successfully', 'success');
        searchCache.clear();
        refreshCurrentView();
    });
}

export function deleteInventoryItem(type, id, name) {
    showDeleteConfirm(name, type, id, () => {
        const keyMap = {
            'materials': STORAGE_KEYS.MATERIALS,
            'tooling': STORAGE_KEYS.TOOLING,
            'miscellaneous': STORAGE_KEYS.MISC_ITEMS,
            'misc': STORAGE_KEYS.MISC_ITEMS,
            'products': STORAGE_KEYS.PRODUCTS,
            'parts': STORAGE_KEYS.PARTS
        };
        
        const key = keyMap[type];
        if (!key) return;
        
        storage.removeItem(key, parseInt(id));
        showToast('Item deleted successfully', 'success');
        searchCache.clear();
        refreshCurrentView();
    });
}

export async function exportInventory(type) {
    const endpointMap = {
        'materials': '/export/inventory/materials',
        'tooling': '/export/inventory/tooling',
        'miscellaneous': '/export/inventory/misc',
        'misc': '/export/inventory/misc',
        'products': '/export/inventory/products',
        'parts': '/export/inventory/parts'
    };

    const endpoint = endpointMap[type];
    if (!endpoint) return;

    await exportToCSV(null, `${type}_inventory`, null, endpoint);
}

export function clearFilters() {
    inventoryState.filters = {
        search: '',
        status: '',
        sortBy: 'name',
        sortDir: 'asc'
    };
    searchCache.clear();

    // Reset form fields
    const searchInput = document.getElementById('inventorySearch');
    const statusFilter = document.getElementById('inventoryStatusFilter');
    const sortFilter = document.getElementById('inventorySortBy');

    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    if (sortFilter) sortFilter.value = 'name';

    refreshCurrentView();
}

// ==================== ACTION HANDLERS ====================
export function registerActionHandlers(registerFn) {
    registerFn('add-inventory', (target) => {
        showAddInventoryModal(target.dataset.type);
    });
    
    registerFn('edit-inventory', (target) => {
        editInventoryItem(target.dataset.type, target.dataset.id);
    });
    
    registerFn('delete-inventory', (target) => {
        deleteInventoryItem(target.dataset.type, target.dataset.id, target.dataset.name);
    });
    
    registerFn('export-inventory', (target) => {
        exportInventory(target.dataset.type);
    });
    
    registerFn('clear-inventory-filters', () => {
        clearFilters();
    });
}

// ==================== INITIALIZATION ====================
export function init() {
    // Register action handlers if the common module is available
    if (window.BPERP?.common?.registerActionHandler) {
        registerActionHandlers(window.BPERP.common.registerActionHandler);
    }
}
