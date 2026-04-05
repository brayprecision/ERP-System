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

const KANBAN_TYPE_LABELS = {
    materials: 'Materials',
    tooling: 'Tooling',
    miscellaneous: 'Miscellaneous',
    products: 'Products',
    parts: 'Parts'
};

function escapeHtmlAttr(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

/** Returns safe http(s) href or null */
function normalizeUserUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    const candidates = [s];
    if (!/^https?:\/\//i.test(s)) {
        candidates.push(`https://${s.replace(/^\/+/, '')}`);
    }
    for (const c of candidates) {
        try {
            const u = new URL(c);
            if (u.protocol === 'http:' || u.protocol === 'https:') {
                return u.href;
            }
        } catch {
            /* try next */
        }
    }
    return null;
}

function getMinReorderQtyNumeric(item) {
    const n = parseFloat(item?.minReorderQty);
    if (!Number.isFinite(n) || n < 0) {
        return 0;
    }
    return n;
}

function getReorderCostAmount(item) {
    const unit = parseFloat(item?.unitPrice);
    const u = Number.isFinite(unit) && unit >= 0 ? unit : 0;
    return u * getMinReorderQtyNumeric(item);
}

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
    const rpRaw = Number(item.reorderPoint);
    const reorderPoint = Number.isFinite(rpRaw) && rpRaw > 0 ? rpRaw : 0;
    if (reorderPoint === 0) {
        return { status: 'No Kanban', color: 'gray', priority: 4 };
    }
    const qtyRaw = Number(item.quantityOnHand);
    const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0;
    if (qty === 0) {
        return { status: 'Critical', color: 'red', priority: 0 };
    }
    if (qty > reorderPoint) {
        return { status: 'Good', color: 'green', priority: 3 };
    }
    return { status: 'Low Stock', color: 'orange', priority: 1 };
}

function getUrgencyBadgeClass(urgency) {
    const classes = {
        'No Kanban': 'bg-gray-600 text-gray-100',
        'Critical': 'bg-red-600 text-red-100',
        'Low Stock': 'bg-orange-600 text-orange-100',
        'Good': 'bg-green-600 text-green-100'
    };
    return classes[urgency.status] || 'bg-gray-600 text-gray-200';
}

// ==================== FILTERING & SORTING ====================
function filterAndSortItems(items, filters) {
    // Check cache (include view — same item count + filters was returning wrong tab's rows)
    const cacheKey = JSON.stringify({
        view: inventoryState.currentView,
        items: items.length,
        filters
    });
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
            item.category?.toLowerCase().includes(search) ||
            item.reorderLink?.toLowerCase().includes(search)
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

function getKanbanSourceItems() {
    const merged = [
        ...getMaterials().map((i) => ({ ...i, _inventoryCategory: 'materials' })),
        ...getTooling().map((i) => ({ ...i, _inventoryCategory: 'tooling' })),
        ...getMiscItems().map((i) => ({ ...i, _inventoryCategory: 'miscellaneous' })),
        ...getProducts().map((i) => ({ ...i, _inventoryCategory: 'products' })),
        ...getParts().map((i) => ({ ...i, _inventoryCategory: 'parts' }))
    ];
    return merged.filter((item) => {
        const u = getUrgencyStatus(item);
        return u.status === 'Low Stock' || u.status === 'Critical';
    });
}

// ==================== RENDER FUNCTIONS ====================
function renderInventoryTable(items, type, options = {}) {
    const isKanban = options.kanban === true;
    const container = DOMCache.get('dashboardContent');
    if (!container) return;

    const filtered = filterAndSortItems(items, inventoryState.filters);
    const rowInventoryType = (item) =>
        isKanban && item._inventoryCategory ? item._inventoryCategory : type.toLowerCase();
    const emptyColspan = isKanban ? 11 : 9;
    
    // Build table using DocumentFragment for performance
    const tableHtml = `
        <div class="col-span-3 card p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-medium" style="color: var(--color-accent-primary);">
                    <i class="fa-solid ${isKanban ? 'fa-columns' : 'fa-boxes'} mr-2"></i>${isKanban ? 'Kanban' : `${type} Inventory`}
                    <span class="text-xs" style="color: var(--color-text-muted);">${isKanban ? `(Low stock & critical · ${filtered.length} items)` : `(${filtered.length} items)`}</span>
                </h3>
                <div class="flex space-x-2">
                    ${isKanban ? `
                    <button data-action="export-kanban" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                        <i class="fa-solid fa-download mr-1"></i>Export
                    </button>
                    ` : `
                    <button data-action="export-inventory" data-type="${type.toLowerCase()}" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                        <i class="fa-solid fa-download mr-1"></i>Export
                    </button>
                    <button data-action="add-inventory" data-type="${type.toLowerCase()}" class="btn btn-primary text-sm">
                        <i class="fa-solid fa-plus mr-1"></i>Add ${type.slice(0, -1)}
                    </button>
                    `}
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
                    <option value="No Kanban" ${inventoryState.filters.status === 'No Kanban' ? 'selected' : ''}>No Kanban</option>
                    <option value="Critical" ${inventoryState.filters.status === 'Critical' ? 'selected' : ''}>Critical</option>
                    <option value="Low Stock" ${inventoryState.filters.status === 'Low Stock' ? 'selected' : ''}>Low Stock</option>
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
                            ${isKanban ? '<th class="px-4 py-3">Type</th>' : ''}
                            <th class="px-4 py-3">Category</th>
                            <th class="px-4 py-3">Qty</th>
                            <th class="px-4 py-3">Reorder Pt</th>
                            ${isKanban ? '<th class="px-4 py-3">Min Reorder Qty</th>' : ''}
                            <th class="px-4 py-3">Status</th>
                            <th class="px-4 py-3">Supplier</th>
                            <th class="px-4 py-3 text-center w-14" title="Reorder link"><i class="fa-solid fa-link text-gray-500"></i></th>
                            <th class="px-4 py-3">${isKanban ? 'Reorder Cost' : 'Unit Price'}</th>
                            <th class="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length > 0 ? filtered.map(item => {
                            const urgency = getUrgencyStatus(item);
                            const invType = rowInventoryType(item);
                            const typeLabel = KANBAN_TYPE_LABELS[invType] || invType;
                            const reorderHref = normalizeUserUrl(item.reorderLink);
                            const reorderBtn = reorderHref
                                ? `<button type="button" data-action="open-reorder-link" data-url="${escapeHtmlAttr(reorderHref)}" class="p-1.5 rounded hover:bg-gray-600 transition-colors text-sky-400" title="Open reorder link"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`
                                : `<span class="text-gray-600">—</span>`;
                            const minR = getMinReorderQtyNumeric(item);
                            const priceCell = isKanban
                                ? formatCurrency(getReorderCostAmount(item))
                                : formatCurrency(item.unitPrice);
                            return `
                                <tr data-item-id="${item.id}">
                                    <td class="px-4 py-3">
                                        <div class="font-medium text-white">${item.name}</div>
                                        <div class="text-xs" style="color: var(--color-text-muted);">${item.partNumber || '-'}</div>
                                    </td>
                                    ${isKanban ? `<td class="px-4 py-3" style="color: var(--color-text-secondary);">${typeLabel}</td>` : ''}
                                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${item.category || '-'}</td>
                                    <td class="px-4 py-3 font-medium ${urgency.color === 'red' ? 'text-red-400' : urgency.color === 'orange' ? 'text-orange-400' : urgency.color === 'green' ? 'text-green-400' : urgency.color === 'gray' ? 'text-gray-400' : 'text-white'}">${item.quantityOnHand}</td>
                                    <td class="px-4 py-3" style="color: var(--color-text-muted);">${item.reorderPoint || '-'}</td>
                                    ${isKanban ? `<td class="px-4 py-3" style="color: var(--color-text-secondary);">${minR}</td>` : ''}
                                    <td class="px-4 py-3">
                                        <span class="badge ${getUrgencyBadgeClass(urgency)}">${urgency.status}</span>
                                    </td>
                                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${item.supplier || '-'}</td>
                                    <td class="px-4 py-3 text-center align-middle">${reorderBtn}</td>
                                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${priceCell}</td>
                                    <td class="px-4 py-3">
                                        <div class="flex space-x-2">
                                            <button data-action="edit-inventory" data-type="${invType}" data-id="${item.id}" style="color: var(--color-info);" class="hover:opacity-80" title="Edit">
                                                <i class="fa-solid fa-edit"></i>
                                            </button>
                                            <button data-action="delete-inventory" data-type="${invType}" data-id="${item.id}" data-name="${item.name}" style="color: var(--color-error);" class="hover:opacity-80" title="Delete">
                                                <i class="fa-solid fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('') : `<tr><td colspan="${emptyColspan}" class="text-center py-8" style="color: var(--color-text-muted);">No items found</td></tr>`}
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
        case 'kanban': loadKanbanInventory(); break;
        case 'materials': loadMaterialInventory(); break;
        case 'tooling': loadToolingInventory(); break;
        case 'misc': loadMiscInventory(); break;
        case 'products': loadProductInventory(); break;
        case 'parts': loadPartsInventory(); break;
        case 'inspection': loadInspectionToolInventory(); break;
    }
}

// ==================== PUBLIC FUNCTIONS ====================
export function loadKanbanInventory() {
    inventoryState.currentView = 'kanban';
    if (inventoryState.filters.status === 'Good' || inventoryState.filters.status === 'No Kanban') {
        inventoryState.filters.status = '';
    }
    showLoadingSpinner();

    safeExecute(() => {
        const items = getKanbanSourceItems();
        renderInventoryTable(items, 'Kanban', { kanban: true });
    }, () => {
        showToast('Error loading Kanban', 'error');
    }, 'loadKanbanInventory');
}

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

// ==================== INSPECTION TOOL INVENTORY (API) ====================

function calibrationStatusBadge(tool) {
    const due = tool.nextCalibrationDue;
    if (!due) {
        return { text: 'No due date', cls: 'bg-gray-600 text-gray-100' };
    }
    const d = new Date(due);
    if (Number.isNaN(d.getTime())) {
        return { text: 'Invalid date', cls: 'bg-gray-600 text-gray-100' };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    const diff = Math.round((dd - today) / 86400000);
    if (diff < 0) return { text: 'Overdue', cls: 'bg-red-600 text-red-100' };
    if (diff <= 30) return { text: 'Due soon', cls: 'bg-amber-600 text-amber-100' };
    return { text: 'OK', cls: 'bg-green-600 text-green-100' };
}

function getDemoInspectionTools() {
    return [];
}

export function getInspectionTools() {
    let data = storage.get(STORAGE_KEYS.INSPECTION_TOOLS);
    if (!data || !Array.isArray(data)) {
        data = getDemoInspectionTools();
        storage.set(STORAGE_KEYS.INSPECTION_TOOLS, data);
    }
    return data;
}

function recomputeNextDueLocal(lastCalibrationDate, calibrationIntervalDays) {
    if (!lastCalibrationDate || calibrationIntervalDays == null) return null;
    const interval = parseInt(calibrationIntervalDays, 10);
    if (!Number.isFinite(interval) || interval <= 0) return null;
    const last = new Date(String(lastCalibrationDate).trim());
    if (Number.isNaN(last.getTime())) return null;
    const next = new Date(last);
    next.setDate(next.getDate() + interval);
    return next.toISOString().split('T')[0];
}

function getCalibrationLeadDaysLocal() {
    return 30;
}

/** Tools needing calibration within lead days or overdue (for reminder table + misc-task sync). */
function computeLocalCalibrationReminderRows(tools) {
    const lead = getCalibrationLeadDaysLocal();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = [];
    for (const t of tools) {
        const due = t.nextCalibrationDue;
        if (!due) continue;
        const d = new Date(due);
        if (Number.isNaN(d.getTime())) continue;
        d.setHours(0, 0, 0, 0);
        const daysUntil = Math.round((d - today) / 86400000);
        if (daysUntil <= lead) {
            rows.push({
                inspectionToolId: t.id,
                toolName: t.name,
                title: `Calibrate: ${t.name}`,
                dueDate: due
            });
        }
    }
    rows.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    return rows;
}

function nextInspectionToolId() {
    const items = getInspectionTools();
    return Math.max(0, ...items.map((t) => t.id || 0)) + 1;
}

function filterInspectionToolsForView(items) {
    const q = (inventoryState.filters.search || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => {
        const hay = [
            t.name,
            t.assetTag,
            t.manufacturer,
            t.model,
            t.serialNumber,
            t.location
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return hay.includes(q);
    });
}

function syncLocalCalibrationMiscTasks() {
    const tools = getInspectionTools();
    const reminders = computeLocalCalibrationReminderRows(tools);
    let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
    let added = 0;
    for (const r of reminders) {
        const exists = miscTasks.some(
            (t) =>
                t.source === 'inspection_calibration' &&
                t.linkedInspectionToolId === r.inspectionToolId &&
                t.status !== 'Completed'
        );
        if (!exists) {
            miscTasks.push({
                id: Date.now() + Math.floor(Math.random() * 10000),
                title: r.title,
                description: 'Calibration reminder from Inspection inventory',
                category: 'Other',
                priority: 'Medium',
                assignedTo: '',
                dueDate: r.dueDate,
                estimatedDuration: '',
                status: 'Not Started',
                type: 'miscellaneous',
                source: 'inspection_calibration',
                linkedInspectionToolId: r.inspectionToolId,
                createdAt: new Date().toISOString(),
                isRecurring: false,
                recurrence: null
            });
            added++;
        }
    }
    storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
    return added;
}

function completeLocalMiscTasksForInspectionTool(toolId) {
    let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
    let changed = false;
    miscTasks = miscTasks.map((t) => {
        if (
            t.source === 'inspection_calibration' &&
            t.linkedInspectionToolId === toolId &&
            t.status !== 'Completed'
        ) {
            changed = true;
            return {
                ...t,
                status: 'Completed',
                completedAt: new Date().toISOString()
            };
        }
        return t;
    });
    if (changed) storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
}

function saveInspectionToolRecord(record) {
    const items = getInspectionTools();
    const idx = items.findIndex((x) => x.id === record.id);
    if (idx === -1) {
        items.push(record);
    } else {
        items[idx] = record;
    }
    storage.set(STORAGE_KEYS.INSPECTION_TOOLS, items);
    searchCache.clear();
}

export function loadInspectionToolInventory() {
    inventoryState.currentView = 'inspection';
    showLoadingSpinner();

    const container = DOMCache.get('dashboardContent');
    if (!container) return;

    safeExecute(() => {
        const tools = filterInspectionToolsForView(getInspectionTools());
        const reminders = computeLocalCalibrationReminderRows(tools);

        const rows = (tools || []).map((t) => {
            const badge = calibrationStatusBadge(t);
            return `
                <tr data-item-id="${t.id}">
                    <td class="px-4 py-3">
                        <div class="font-medium text-white">${escapeHtml(t.name)}</div>
                        <div class="text-xs" style="color: var(--color-text-muted);">${escapeHtml(t.assetTag || '—')}</div>
                    </td>
                    <td class="px-4 py-3 text-sm" style="color: var(--color-text-secondary);">${escapeHtml(t.manufacturer || '—')}</td>
                    <td class="px-4 py-3 text-sm" style="color: var(--color-text-secondary);">${t.nextCalibrationDue ? formatDate(t.nextCalibrationDue) : '—'}</td>
                    <td class="px-4 py-3"><span class="badge ${badge.cls}">${badge.text}</span></td>
                    <td class="px-4 py-3">
                        <div class="flex gap-2">
                            <button type="button" data-action="open-inspection-tool" data-id="${t.id}" class="text-cyan-400 hover:opacity-80" title="Profile">
                                <i class="fa-solid fa-id-card"></i>
                            </button>
                            <button type="button" data-action="delete-inspection-tool" data-id="${t.id}" data-name="${escapeHtmlAttr(t.name)}" class="text-red-400 hover:opacity-80" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        const reminderRows = (reminders || []).length
            ? reminders
                  .map(
                      (r) => `
                <tr>
                    <td class="px-4 py-2 text-sm text-white">${escapeHtml(r.toolName || '—')}</td>
                    <td class="px-4 py-2 text-sm" style="color: var(--color-text-muted);">${escapeHtml(r.title || '')}</td>
                    <td class="px-4 py-2 text-sm">${r.dueDate ? formatDate(r.dueDate) : '—'}</td>
                    <td class="px-4 py-2">
                        <button type="button" data-action="open-inspection-tool" data-id="${r.inspectionToolId}" class="text-xs text-cyan-400 hover:underline">Open tool</button>
                    </td>
                </tr>`
                  )
                  .join('')
            : `<tr><td colspan="4" class="px-4 py-3 text-sm text-gray-500">No open calibration reminders.</td></tr>`;

        container.innerHTML = `
            <div class="col-span-3 space-y-6">
                <div class="flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                            <i class="fa-solid fa-microscope text-cyan-400"></i>
                            Inspection tool inventory
                        </h2>
                        <p class="text-sm text-gray-500 mt-1">Stored in this browser (localStorage). Use <strong>Sync reminders</strong> to add due/overdue items as misc tasks on All Tasks.</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" data-action="sync-calibration-reminders" class="px-3 py-2 rounded bg-gray-700 text-white text-sm hover:bg-gray-600">
                            <i class="fa-solid fa-rotate mr-1"></i>Sync reminders
                        </button>
                        <button type="button" data-action="add-inspection-tool" class="px-3 py-2 rounded bg-accentGreen text-white text-sm hover:bg-green-700">
                            <i class="fa-solid fa-plus mr-1"></i>Add tool
                        </button>
                    </div>
                </div>

                <div class="card p-4">
                    <h3 class="text-sm font-medium text-amber-400 mb-3"><i class="fa-solid fa-bell mr-2"></i>Open calibration reminders</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="text-left text-xs uppercase text-gray-500 border-b border-gray-700">
                                    <th class="px-4 py-2">Tool</th>
                                    <th class="px-4 py-2">Task</th>
                                    <th class="px-4 py-2">Due</th>
                                    <th class="px-4 py-2"></th>
                                </tr>
                            </thead>
                            <tbody>${reminderRows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="card p-4">
                    <div class="flex flex-wrap gap-4 mb-4">
                        <input type="search" id="inventorySearch" placeholder="Search name, tag, manufacturer…" value="${escapeHtmlAttr(inventoryState.filters.search)}"
                            class="flex-1 min-w-[200px] bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 text-sm">
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="text-left text-xs uppercase text-gray-500 border-b border-gray-700">
                                    <th class="px-4 py-3">Tool</th>
                                    <th class="px-4 py-3">Manufacturer</th>
                                    <th class="px-4 py-3">Next calibration</th>
                                    <th class="px-4 py-3">Status</th>
                                    <th class="px-4 py-3 w-24"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.length ? rows : `<tr><td colspan="5" class="text-center py-8 text-gray-500">No inspection tools yet. Add a tool to begin.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        setupInventoryFilters();
    }, () => {
        showToast('Error loading inspection inventory', 'error');
    }, 'loadInspectionToolInventory');
}

function showInspectionToolModal(tool) {
    const persisted = tool && tool.id && getInspectionTools().some((x) => x.id === tool.id);
    const t = persisted
        ? getInspectionTools().find((x) => x.id === tool.id) || tool
        : tool || {};
    const docs = t.documents || [];

    const docRows = docs.length
        ? docs
              .map(
                  (d) => `
        <tr>
            <td class="px-2 py-1 text-sm text-white">${escapeHtml(d.title)}</td>
            <td class="px-2 py-1 text-xs text-gray-400">${escapeHtml(d.documentType)}</td>
            <td class="px-2 py-1 text-right">
                <button type="button" data-action="download-inspection-doc" data-tool-id="${t.id}" data-doc-id="${d.id}" data-filename="${escapeHtmlAttr(d.originalFilename)}" class="text-sky-400 text-xs mr-2">Download</button>
                <button type="button" data-action="delete-inspection-doc" data-tool-id="${t.id}" data-doc-id="${d.id}" class="text-red-400 text-xs">Remove</button>
            </td>
        </tr>`
              )
              .join('')
        : '<tr><td colspan="3" class="text-gray-500 py-2">No documents yet.</td></tr>';

    const content = `
        <div class="p-6 max-h-[85vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-microscope mr-2 text-cyan-400"></i>${persisted ? 'Inspection tool profile' : 'Add inspection tool'}
                </h3>
                <button type="button" onclick="BPERP.common.closeModal('inspectionToolModal')" class="text-gray-400 hover:text-white"><i class="fa-solid fa-times"></i></button>
            </div>
            <form id="inspectionToolForm" class="space-y-3">
                ${persisted ? `<input type="hidden" name="id" value="${t.id}">` : ''}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Name *</label>
                        <input name="name" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr(t.name || '')}">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Asset tag</label>
                        <input name="assetTag" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr(t.assetTag || '')}">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Manufacturer</label>
                        <input name="manufacturer" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr(t.manufacturer || '')}">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Model</label>
                        <input name="model" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr(t.model || '')}">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Serial number</label>
                        <input name="serialNumber" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr(t.serialNumber || '')}">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Location</label>
                        <input name="location" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr(t.location || '')}">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm text-gray-400 mb-1">Traceability note</label>
                        <input name="traceabilityNote" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr(t.traceabilityNote || '')}">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Last calibration (YYYY-MM-DD)</label>
                        <input name="lastCalibrationDate" type="date" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${escapeHtmlAttr((t.lastCalibrationDate || '').slice(0, 10))}">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Calibration interval (days)</label>
                        <input name="calibrationIntervalDays" type="number" min="1" step="1" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" value="${t.calibrationIntervalDays != null ? escapeHtmlAttr(String(t.calibrationIntervalDays)) : ''}">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm text-gray-400 mb-1">Notes</label>
                        <textarea name="notes" rows="2" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">${escapeHtml(t.notes || '')}</textarea>
                    </div>
                </div>
                ${persisted ? `
                <div class="border-t border-gray-700 pt-4 mt-4">
                    <h4 class="text-sm font-medium text-gray-300 mb-2">Documents (stored in this browser)</h4>
                    <p class="text-xs text-gray-500 mb-2">PDF or images, max 10 MB each. Large files count toward browser storage limits.</p>
                    <div class="flex flex-wrap gap-2 mb-2">
                        <input type="file" id="inspectionDocFile" accept=".pdf,image/*" class="text-sm text-gray-400">
                        <select id="inspectionDocType" class="bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600">
                            <option value="calibration_cert">Calibration certificate</option>
                            <option value="traceability">Traceability</option>
                            <option value="other">Other</option>
                        </select>
                        <input type="text" id="inspectionDocTitle" placeholder="Title" class="flex-1 min-w-[120px] bg-gray-700 text-white rounded px-2 py-1 text-sm border border-gray-600">
                        <button type="button" data-action="upload-inspection-doc" data-tool-id="${t.id}" class="px-3 py-1 rounded bg-sky-600 text-white text-sm">Upload</button>
                    </div>
                    <table class="w-full text-sm">
                        <thead><tr class="text-left text-xs text-gray-500"><th class="py-1">Title</th><th class="py-1">Type</th><th class="py-1 text-right">Actions</th></tr></thead>
                        <tbody>${docRows}</tbody>
                    </table>
                </div>` : ''}
                <div class="flex gap-2 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('inspectionToolModal')" class="flex-1 bg-gray-600 text-white py-2 rounded">Cancel</button>
                    <button type="submit" class="flex-1 bg-accentGreen text-white py-2 rounded">${persisted ? 'Save' : 'Create'}</button>
                </div>
            </form>
        </div>`;

    createModal('inspectionToolModal', content, { width: 'w-full max-w-2xl' });

    const form = document.getElementById('inspectionToolForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const payload = {
                name: (fd.get('name') || '').trim(),
                assetTag: (fd.get('assetTag') || '').trim() || null,
                manufacturer: (fd.get('manufacturer') || '').trim() || null,
                model: (fd.get('model') || '').trim() || null,
                serialNumber: (fd.get('serialNumber') || '').trim() || null,
                location: (fd.get('location') || '').trim() || null,
                traceabilityNote: (fd.get('traceabilityNote') || '').trim() || null,
                notes: (fd.get('notes') || '').trim() || null,
                lastCalibrationDate: (fd.get('lastCalibrationDate') || '').trim() || null,
                calibrationIntervalDays: (() => {
                    const v = fd.get('calibrationIntervalDays');
                    if (v === '' || v == null) return null;
                    const n = parseInt(v, 10);
                    return Number.isFinite(n) ? n : null;
                })()
            };

            if (!payload.name) {
                showToast('Name is required', 'warning');
                return;
            }

            const nextDue = recomputeNextDueLocal(payload.lastCalibrationDate, payload.calibrationIntervalDays);
            const prev = persisted ? getInspectionTools().find((x) => x.id === t.id) : null;
            const id = persisted ? t.id : nextInspectionToolId();
            const record = {
                ...payload,
                id,
                nextCalibrationDue: nextDue,
                documents: Array.isArray(prev?.documents) ? [...prev.documents] : []
            };

            const calChanged =
                persisted &&
                (payload.lastCalibrationDate !== (prev?.lastCalibrationDate ?? null) ||
                    payload.calibrationIntervalDays !== (prev?.calibrationIntervalDays ?? null));
            if (calChanged) {
                completeLocalMiscTasksForInspectionTool(id);
            }

            saveInspectionToolRecord(record);
            showToast(persisted ? 'Tool updated' : 'Tool created', 'success');
            closeModal('inspectionToolModal');
            loadInspectionToolInventory();
        });
    }
}

// ==================== CRUD OPERATIONS ====================
export function showAddInventoryModal(type) {
    if (type === 'products') {
        showAddProductModal();
        return;
    }
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
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Min reorder qty</label>
                        <input type="number" name="minReorderQty" min="0" step="any" value="0" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Unit Price</label>
                        <input type="number" name="unitPrice" min="0" step="0.01" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Reorder link (optional)</label>
                    <input type="url" name="reorderLink" placeholder="https://..." autocomplete="url" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
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
        {
            const m = parseFloat(data.minReorderQty);
            data.minReorderQty = Number.isFinite(m) && m >= 0 ? m : 0;
        }
        data.reorderLink = (data.reorderLink || '').trim();
        
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
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" value="${item.quantityOnHand || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" value="${item.reorderPoint || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Min reorder qty</label>
                        <input type="number" name="minReorderQty" min="0" step="any" value="${escapeHtmlAttr(String(item.minReorderQty != null ? item.minReorderQty : 0))}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Unit Price</label>
                        <input type="number" name="unitPrice" min="0" step="0.01" value="${item.unitPrice || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Reorder link (optional)</label>
                    <input type="url" name="reorderLink" placeholder="https://..." autocomplete="url" value="${escapeHtmlAttr(item.reorderLink || '')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
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
        {
            const m = parseFloat(data.minReorderQty);
            data.minReorderQty = Number.isFinite(m) && m >= 0 ? m : 0;
        }
        data.reorderLink = (data.reorderLink || '').trim();
        
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
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Reorder link (optional)</label>
                    <input type="url" name="reorderLink" placeholder="https://..." autocomplete="url" value="${escapeHtmlAttr(item.reorderLink || '')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" value="${item.quantityOnHand || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" value="${item.reorderPoint || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Min reorder qty</label>
                        <input type="number" name="minReorderQty" min="0" step="any" value="${escapeHtmlAttr(String(item.minReorderQty != null ? item.minReorderQty : 0))}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
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
        {
            const m = parseFloat(data.minReorderQty);
            data.minReorderQty = Number.isFinite(m) && m >= 0 ? m : 0;
        }
        data.source = data.source || 'purchased';
        data.reorderLink = (data.reorderLink || '').trim();
        storage.updateItem(key, data.id, data);
        closeModal('inventoryModal');
        showToast('Part updated successfully', 'success');
        searchCache.clear();
        refreshCurrentView();
    });
}

export function showAddProductModal() {
    showProductFormModal({ key: STORAGE_KEYS.PRODUCTS, isAdd: true });
}

function showEditProductModal(item, key) {
    showProductFormModal({ item, key, isAdd: false });
}

function showProductFormModal({ item, key, isAdd }) {
    const d = isAdd
        ? {
              name: '',
              partNumber: '',
              category: '',
              supplier: '',
              quantityOnHand: 0,
              reorderPoint: 0,
              minReorderQty: 0,
              unitPrice: 0,
              reorderLink: '',
              bom: []
          }
        : item;
    const bom = d.bom || [];
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
                    <i class="fa-solid ${isAdd ? 'fa-plus-circle mr-2 text-accentGreen' : 'fa-edit mr-2 text-blue-400'}"></i>${isAdd ? 'Add Product' : 'Edit Product'}
                </h3>
                <button onclick="BPERP.common.closeModal('inventoryModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="inventoryForm" class="space-y-4">
                ${isAdd ? '' : `<input type="hidden" name="id" value="${d.id}">`}
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Name *</label>
                        <input type="text" name="name" required value="${(d.name || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Part Number</label>
                        <input type="text" name="partNumber" value="${(d.partNumber || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Category</label>
                        <input type="text" name="category" value="${(d.category || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Supplier</label>
                        <input type="text" name="supplier" value="${(d.supplier || '').replace(/"/g, '&quot;')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Reorder link (optional)</label>
                    <input type="url" name="reorderLink" placeholder="https://..." autocomplete="url" value="${escapeHtmlAttr(d.reorderLink || '')}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Quantity</label>
                        <input type="number" name="quantityOnHand" min="0" value="${d.quantityOnHand || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Reorder Point</label>
                        <input type="number" name="reorderPoint" min="0" value="${d.reorderPoint || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Min reorder qty</label>
                        <input type="number" name="minReorderQty" min="0" step="any" value="${escapeHtmlAttr(String(d.minReorderQty != null ? d.minReorderQty : 0))}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Unit Price</label>
                        <input type="number" name="unitPrice" min="0" step="0.01" value="${d.unitPrice || 0}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
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
                    <button type="submit" class="flex-1 ${isAdd ? 'bg-accentGreen hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded">${isAdd ? 'Add Product' : 'Save Changes'}</button>
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
    
    const bomTbodyInit = document.getElementById('productBomTableBody');
    bomTbodyInit?.querySelectorAll('[data-action="remove-bom-part"]').forEach(btn => {
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
        data.quantityOnHand = parseInt(data.quantityOnHand) || 0;
        data.reorderPoint = parseInt(data.reorderPoint) || 0;
        data.unitPrice = parseFloat(data.unitPrice) || 0;
        {
            const m = parseFloat(data.minReorderQty);
            data.minReorderQty = Number.isFinite(m) && m >= 0 ? m : 0;
        }
        data.reorderLink = (data.reorderLink || '').trim();
        data.bom = bomData;
        if (isAdd) {
            delete data.id;
            storage.addItem(key, data);
            closeModal('inventoryModal');
            showToast('Product added successfully', 'success');
        } else {
            data.id = parseInt(data.id);
            storage.updateItem(key, data.id, data);
            closeModal('inventoryModal');
            showToast('Product updated successfully', 'success');
        }
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

export async function exportKanbanInventory() {
    const source = getKanbanSourceItems();
    const filtered = filterAndSortItems(source, inventoryState.filters);
    if (!filtered.length) {
        showToast('No data to export', 'error');
        return;
    }
    const rows = filtered.map((item) => ({
        Type: KANBAN_TYPE_LABELS[item._inventoryCategory] || item._inventoryCategory,
        Name: item.name,
        PartNumber: item.partNumber,
        Category: item.category,
        Quantity: item.quantityOnHand,
        ReorderPoint: item.reorderPoint,
        Status: getUrgencyStatus(item).status,
        Supplier: item.supplier,
        ReorderLink: item.reorderLink || '',
        MinReorderQty: getMinReorderQtyNumeric(item),
        UnitPrice: item.unitPrice,
        ReorderCost: getReorderCostAmount(item)
    }));
    await exportToCSV(rows, 'kanban_inventory', null, null);
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

    registerFn('export-kanban', () => {
        exportKanbanInventory();
    });

    registerFn('open-reorder-link', (target) => {
        const href = normalizeUserUrl(target.dataset.url);
        if (!href) {
            showToast('Invalid reorder link', 'error');
            return;
        }
        window.open(href, '_blank', 'noopener,noreferrer');
    });
    
    registerFn('clear-inventory-filters', () => {
        clearFilters();
    });

    registerFn('open-inspection-tool', (target) => {
        const id = parseInt(target.dataset.id, 10);
        if (!Number.isFinite(id)) return;
        const tool = getInspectionTools().find((x) => x.id === id);
        if (!tool) {
            showToast('Tool not found', 'error');
            return;
        }
        showInspectionToolModal(tool);
    });

    registerFn('add-inspection-tool', () => {
        showInspectionToolModal(null);
    });

    registerFn('delete-inspection-tool', (target) => {
        const id = parseInt(target.dataset.id, 10);
        const name = target.dataset.name || 'this tool';
        showDeleteConfirm(name, 'inspection tool', String(id), () => {
            const items = getInspectionTools().filter((t) => t.id !== id);
            storage.set(STORAGE_KEYS.INSPECTION_TOOLS, items);
            let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
            miscTasks = miscTasks.filter((t) => t.linkedInspectionToolId !== id);
            storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
            searchCache.clear();
            showToast('Tool deleted', 'success');
            loadInspectionToolInventory();
        });
    });

    registerFn('sync-calibration-reminders', () => {
        const added = syncLocalCalibrationMiscTasks();
        showToast(
            added > 0
                ? `Added ${added} calibration task(s) to All Tasks (misc)`
                : 'No new calibration tasks needed (or they already exist)',
            'success'
        );
        loadInspectionToolInventory();
    });

    registerFn('upload-inspection-doc', (target) => {
        const toolId = parseInt(target.dataset.toolId, 10);
        const fileInput = document.getElementById('inspectionDocFile');
        const titleEl = document.getElementById('inspectionDocTitle');
        const typeEl = document.getElementById('inspectionDocType');
        const file = fileInput?.files?.[0];
        if (!file) {
            showToast('Choose a file first', 'warning');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('File too large (max 10 MB)', 'error');
            return;
        }
        const tool = getInspectionTools().find((x) => x.id === toolId);
        if (!tool) {
            showToast('Tool not found', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const docs = Array.isArray(tool.documents) ? tool.documents : [];
            const nextDocId = docs.length ? Math.max(...docs.map((d) => d.id || 0)) + 1 : 1;
            docs.push({
                id: nextDocId,
                title: (titleEl?.value || file.name).trim(),
                documentType: typeEl?.value || 'other',
                originalFilename: file.name,
                mimeType: file.type || 'application/octet-stream',
                fileSize: file.size,
                fileData: reader.result,
                uploadedAt: new Date().toISOString()
            });
            saveInspectionToolRecord({ ...tool, documents: docs });
            if (fileInput) fileInput.value = '';
            showToast('Document attached', 'success');
            closeModal('inspectionToolModal');
            showInspectionToolModal(getInspectionTools().find((x) => x.id === toolId));
        };
        reader.onerror = () => showToast('Could not read file', 'error');
        reader.readAsDataURL(file);
    });

    registerFn('download-inspection-doc', (target) => {
        const toolId = parseInt(target.dataset.toolId, 10);
        const docId = parseInt(target.dataset.docId, 10);
        const filename = target.dataset.filename || 'document';
        const tool = getInspectionTools().find((x) => x.id === toolId);
        const doc = tool?.documents?.find((d) => d.id === docId);
        if (!doc?.fileData) {
            showToast('Document not found', 'error');
            return;
        }
        const a = document.createElement('a');
        a.href = doc.fileData;
        a.download = filename;
        a.click();
    });

    registerFn('delete-inspection-doc', (target) => {
        const toolId = parseInt(target.dataset.toolId, 10);
        const docId = parseInt(target.dataset.docId, 10);
        showDeleteConfirm('this document', 'document', String(docId), () => {
            const tool = getInspectionTools().find((x) => x.id === toolId);
            if (!tool) return;
            const docs = (tool.documents || []).filter((d) => d.id !== docId);
            saveInspectionToolRecord({ ...tool, documents: docs });
            showToast('Document removed', 'success');
            closeModal('inspectionToolModal');
            showInspectionToolModal(getInspectionTools().find((x) => x.id === toolId));
        });
    });
}

// ==================== INITIALIZATION ====================
export function init() {
    // Register action handlers if the common module is available
    if (window.BPERP?.common?.registerActionHandler) {
        registerActionHandlers(window.BPERP.common.registerActionHandler);
    }
}
