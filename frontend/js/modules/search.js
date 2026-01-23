/**
 * BPERP Dashboard - Search Module
 * Global search functionality across all tables
 */

import { showToast, DOMCache, formatDate, createModal, highlightItem } from './common.js';
import { storage, STORAGE_KEYS } from './storage.js';

// We'll get data from modules dynamically to ensure demo data is initialized
function getModuleData() {
    const data = {
        materials: [],
        tools: [],
        misc: [],
        customers: [],
        quotes: [],
        workOrders: []
    };
    
    // Get from inventory module if available
    if (window.BPERP?.inventory) {
        try {
            // Call the public getter if available, otherwise use storage
            data.materials = window.BPERP.inventory.getMaterials?.() || storage.get(STORAGE_KEYS.MATERIALS) || [];
            data.tools = window.BPERP.inventory.getTooling?.() || storage.get(STORAGE_KEYS.TOOLING) || [];
            data.misc = window.BPERP.inventory.getMiscItems?.() || storage.get(STORAGE_KEYS.MISC_ITEMS) || [];
        } catch (e) {
            console.warn('Could not get inventory data:', e);
        }
    } else {
        data.materials = storage.get(STORAGE_KEYS.MATERIALS) || [];
        data.tools = storage.get(STORAGE_KEYS.TOOLING) || [];
        data.misc = storage.get(STORAGE_KEYS.MISC_ITEMS) || [];
    }
    
    // Get from sales module if available
    if (window.BPERP?.sales) {
        try {
            data.customers = window.BPERP.sales.getCustomers?.() || storage.get(STORAGE_KEYS.CUSTOMERS) || [];
            data.quotes = window.BPERP.sales.getQuotes?.() || storage.get(STORAGE_KEYS.QUOTES) || [];
            data.workOrders = window.BPERP.sales.getWorkOrders?.() || storage.get(STORAGE_KEYS.WORK_ORDERS) || [];
        } catch (e) {
            console.warn('Could not get sales data:', e);
        }
    } else {
        data.customers = storage.get(STORAGE_KEYS.CUSTOMERS) || [];
        data.quotes = storage.get(STORAGE_KEYS.QUOTES) || [];
        data.workOrders = storage.get(STORAGE_KEYS.WORK_ORDERS) || [];
    }
    
    return data;
}

// ==================== SEARCH FUNCTION ====================
export function performGlobalSearch(query) {
    if (!query || query.trim() === '') {
        showToast('Please enter a search term', 'warning');
        return;
    }
    
    const searchTerm = query.toLowerCase().trim();
    console.log('BPERP: Searching for:', searchTerm);
    
    // Get data from all modules (this ensures demo data is loaded)
    const allData = getModuleData();
    console.log('BPERP: Data sources loaded:', {
        materials: allData.materials.length,
        tools: allData.tools.length,
        misc: allData.misc.length,
        customers: allData.customers.length,
        quotes: allData.quotes.length,
        workOrders: allData.workOrders.length
    });
    
    const results = {
        materials: [],
        tools: [],
        misc: [],
        customers: [],
        quotes: [],
        workOrders: []
    };
    
    // Search in materials
    allData.materials.forEach(material => {
        const searchFields = [
            material.name,
            material.partNumber,
            material.category,
            material.supplier,
            material.id?.toString()
        ].filter(Boolean);
        
        if (searchFields.some(field => field.toLowerCase().includes(searchTerm))) {
            results.materials.push(material);
        }
    });
    
    // Search in tools
    allData.tools.forEach(tool => {
        const searchFields = [
            tool.name,
            tool.partNumber,
            tool.category,
            tool.supplier,
            tool.id?.toString()
        ].filter(Boolean);
        
        if (searchFields.some(field => field.toLowerCase().includes(searchTerm))) {
            results.tools.push(tool);
        }
    });
    
    // Search in misc items
    allData.misc.forEach(item => {
        const searchFields = [
            item.name,
            item.partNumber,
            item.category,
            item.supplier,
            item.id?.toString()
        ].filter(Boolean);
        
        if (searchFields.some(field => field.toLowerCase().includes(searchTerm))) {
            results.misc.push(item);
        }
    });
    
    // Search in customers
    allData.customers.forEach(customer => {
        const searchFields = [
            customer.companyName,
            customer.primaryContact,
            customer.phone,
            customer.id?.toString()
        ].filter(Boolean);
        
        if (searchFields.some(field => field.toLowerCase().includes(searchTerm))) {
            results.customers.push(customer);
        }
    });
    
    // Search in quotes
    allData.quotes.forEach(quote => {
        const searchFields = [
            quote.quoteNumber,
            quote.customerName,
            quote.partNumber,
            quote.id?.toString()
        ].filter(Boolean);
        
        if (searchFields.some(field => field.toLowerCase().includes(searchTerm))) {
            results.quotes.push(quote);
        }
    });
    
    // Search in work orders
    allData.workOrders.forEach(wo => {
        const searchFields = [
            wo.woNumber,
            wo.customerName,
            wo.partNumber,
            wo.id?.toString()
        ].filter(Boolean);
        
        if (searchFields.some(field => field.toLowerCase().includes(searchTerm))) {
            results.workOrders.push(wo);
        }
    });
    
    console.log('BPERP: Search results:', results);
    displaySearchResults(query, results);
}

// ==================== DISPLAY RESULTS ====================
function displaySearchResults(query, results) {
    const totalResults = results.materials.length + results.tools.length + results.misc.length + 
                        results.customers.length + results.quotes.length + results.workOrders.length;
    
    if (totalResults === 0) {
        showToast(`No results found for "${query}"`, 'warning');
        return;
    }
    
    let content = `
        <div class="max-h-96 overflow-y-auto">
            <div class="space-y-6">
    `;
    
    // Materials section
    if (results.materials.length > 0) {
        content += renderMaterialResults(results.materials);
    }
    
    // Tools section
    if (results.tools.length > 0) {
        content += renderToolResults(results.tools);
    }
    
    // Misc items section
    if (results.misc.length > 0) {
        content += renderMiscResults(results.misc);
    }
    
    // Customers section
    if (results.customers.length > 0) {
        content += renderCustomerResults(results.customers);
    }
    
    // Quotes section
    if (results.quotes.length > 0) {
        content += renderQuoteResults(results.quotes);
    }
    
    // Work orders section
    if (results.workOrders.length > 0) {
        content += renderWorkOrderResults(results.workOrders);
    }
    
    content += `
            </div>
        </div>
    `;
    
    createModal('searchResultsModal', `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-search mr-2 text-accentGreen"></i>Search Results
                </h3>
                <button onclick="BPERP.common.closeModal('searchResultsModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-sm text-gray-400 mb-4">Found <span class="text-accentGreen font-medium">${totalResults}</span> result(s) for "<span class="text-accentGreen">${query}</span>"</p>
            ${content}
        </div>
    `);
}

// ==================== RENDER RESULT SECTIONS ====================
function renderMaterialResults(materials) {
    let html = `
        <div class="bg-gray-800 p-4 rounded-lg">
            <h4 class="text-accentGreen font-medium mb-3 text-sm">
                <i class="fa-solid fa-cube mr-2"></i>Materials (${materials.length})
            </h4>
            <div class="space-y-2">
    `;
    
    materials.forEach(material => {
        let urgencyClass = 'text-green-500';
        const qty = material.quantityOnHand || material.qtyOnHand || 0;
        const reorder = material.reorderPoint || material.minimumQty || 1;
        if (qty <= reorder * 0.5) {
            urgencyClass = 'text-red-500';
        } else if (qty <= reorder) {
            urgencyClass = 'text-yellow-500';
        }
        
        html += `
            <div class="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                <div class="flex-1">
                    <p class="text-gray-300"><strong>${material.name}</strong></p>
                    <p class="text-xs text-gray-500">${material.category || material.type || 'N/A'} • ${material.partNumber || material.shape || ''} • Stock: <span class="${urgencyClass}">${qty}</span></p>
                </div>
                <button onclick="BPERP.search.goToMaterial('${material.id}')" class="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-600/20 rounded text-xs">
                    <i class="fa-solid fa-arrow-right mr-1"></i>View
                </button>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}

function renderToolResults(tools) {
    let html = `
        <div class="bg-gray-800 p-4 rounded-lg">
            <h4 class="text-accentGreen font-medium mb-3 text-sm">
                <i class="fa-solid fa-wrench mr-2"></i>Tools (${tools.length})
            </h4>
            <div class="space-y-2">
    `;
    
    tools.forEach(tool => {
        const qty = tool.quantityOnHand || tool.qtyOnHand || 0;
        html += `
            <div class="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                <div class="flex-1">
                    <p class="text-gray-300"><strong>${tool.name}</strong></p>
                    <p class="text-xs text-gray-500">${tool.category || tool.type || 'N/A'} • Stock: ${qty}</p>
                </div>
                <button onclick="BPERP.search.goToTool('${tool.id}')" class="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-600/20 rounded text-xs">
                    <i class="fa-solid fa-arrow-right mr-1"></i>View
                </button>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}

function renderMiscResults(misc) {
    let html = `
        <div class="bg-gray-800 p-4 rounded-lg">
            <h4 class="text-accentGreen font-medium mb-3 text-sm">
                <i class="fa-solid fa-box mr-2"></i>Miscellaneous Items (${misc.length})
            </h4>
            <div class="space-y-2">
    `;
    
    misc.forEach(item => {
        const qty = item.quantityOnHand || item.qtyOnHand || 0;
        html += `
            <div class="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                <div class="flex-1">
                    <p class="text-gray-300"><strong>${item.name}</strong></p>
                    <p class="text-xs text-gray-500">${item.category || 'General'} • Stock: ${qty}</p>
                </div>
                <button onclick="BPERP.search.goToMisc('${item.id}')" class="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-600/20 rounded text-xs">
                    <i class="fa-solid fa-arrow-right mr-1"></i>View
                </button>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}

function renderCustomerResults(customers) {
    let html = `
        <div class="bg-gray-800 p-4 rounded-lg">
            <h4 class="text-accentGreen font-medium mb-3 text-sm">
                <i class="fa-solid fa-building mr-2"></i>Customers (${customers.length})
            </h4>
            <div class="space-y-2">
    `;
    
    customers.forEach(customer => {
        html += `
            <div class="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                <div class="flex-1">
                    <p class="text-gray-300"><strong>${customer.companyName}</strong></p>
                    <p class="text-xs text-gray-500">${customer.primaryContact || 'N/A'} • ${customer.phone || 'N/A'}</p>
                </div>
                <button onclick="BPERP.search.goToCustomer(${customer.id})" class="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-600/20 rounded text-xs">
                    <i class="fa-solid fa-arrow-right mr-1"></i>View
                </button>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}

function renderQuoteResults(quotes) {
    let html = `
        <div class="bg-gray-800 p-4 rounded-lg">
            <h4 class="text-accentGreen font-medium mb-3 text-sm">
                <i class="fa-solid fa-file-invoice mr-2"></i>Quotes (${quotes.length})
            </h4>
            <div class="space-y-2">
    `;
    
    quotes.forEach(quote => {
        html += `
            <div class="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                <div class="flex-1">
                    <p class="text-gray-300"><strong>${quote.quoteNumber}</strong></p>
                    <p class="text-xs text-gray-500">${quote.customerName} • ${quote.partNumber} • Qty: ${quote.quantity}</p>
                </div>
                <button onclick="BPERP.search.goToQuote(${quote.id})" class="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-600/20 rounded text-xs">
                    <i class="fa-solid fa-arrow-right mr-1"></i>View
                </button>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}

function renderWorkOrderResults(workOrders) {
    let html = `
        <div class="bg-gray-800 p-4 rounded-lg">
            <h4 class="text-accentGreen font-medium mb-3 text-sm">
                <i class="fa-solid fa-clipboard-list mr-2"></i>Work Orders (${workOrders.length})
            </h4>
            <div class="space-y-2">
    `;
    
    workOrders.forEach(wo => {
        html += `
            <div class="flex justify-between items-center p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                <div class="flex-1">
                    <p class="text-gray-300"><strong>${wo.woNumber}</strong></p>
                    <p class="text-xs text-gray-500">${wo.customerName} • ${wo.partNumber} • Qty: ${wo.quantity} • Due: ${formatDate(wo.dueDate)}</p>
                </div>
                <button onclick="BPERP.search.goToWorkOrder(${wo.id})" class="text-blue-400 hover:text-blue-300 px-3 py-1 bg-blue-600/20 rounded text-xs">
                    <i class="fa-solid fa-arrow-right mr-1"></i>View
                </button>
            </div>
        `;
    });
    
    html += `</div></div>`;
    return html;
}

// ==================== NAVIGATION FUNCTIONS ====================
export function goToMaterial(materialId) {
    console.log('BPERP: Navigating to material:', materialId);
    window.BPERP?.common?.closeModal('searchResultsModal');
    window.BPERP?.navigate?.('inventory-materials');
    highlightItem(materialId);
    showToast('Material located in Materials Inventory', 'success');
}

export function goToTool(toolId) {
    console.log('BPERP: Navigating to tool:', toolId);
    window.BPERP?.common?.closeModal('searchResultsModal');
    window.BPERP?.navigate?.('inventory-tooling');
    highlightItem(toolId);
    showToast('Tool located in Tooling Inventory', 'success');
}

export function goToMisc(miscId) {
    console.log('BPERP: Navigating to misc item:', miscId);
    window.BPERP?.common?.closeModal('searchResultsModal');
    window.BPERP?.navigate?.('inventory-misc');
    highlightItem(miscId);
    showToast('Item located in Miscellaneous Inventory', 'success');
}

export function goToCustomer(customerId) {
    console.log('BPERP: Navigating to customer:', customerId);
    window.BPERP?.common?.closeModal('searchResultsModal');
    window.BPERP?.navigate?.('sales-customers');
    highlightItem(customerId);
    showToast('Customer located in Customers view', 'success');
}

export function goToQuote(quoteId) {
    console.log('BPERP: Navigating to quote:', quoteId);
    window.BPERP?.common?.closeModal('searchResultsModal');
    window.BPERP?.navigate?.('sales-quotes');
    highlightItem(quoteId);
    showToast('Quote located in Quotes view', 'success');
}

export function goToWorkOrder(woId) {
    console.log('BPERP: Navigating to work order:', woId);
    window.BPERP?.common?.closeModal('searchResultsModal');
    window.BPERP?.navigate?.('sales-wip');
    highlightItem(woId);
    showToast('Work Order located in Work In Progress view', 'success');
}

// ==================== SETUP ====================
export function setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) {
        console.warn('BPERP: Global search input not found');
        return;
    }
    
    console.log('BPERP: Setting up global search...');
    
    // Handle Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performGlobalSearch(searchInput.value);
        }
    });
    
    // Add a search button handler (optional)
    console.log('BPERP: Global search ready');
}
