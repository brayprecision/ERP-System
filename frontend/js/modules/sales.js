/**
 * BPERP Dashboard - Sales Module
 * Customers, Quotes, and Work In Progress Management
 */

import { 
    debounce, showToast, showDeleteConfirm, showLoadingSpinner,
    formatDate, formatCurrency, DOMCache, createModal, closeModal,
    getStatusBadgeClass, getUrgencyColor, safeExecute, masterTimer, exportToCSV
} from './common.js';
import { storage, STORAGE_KEYS, searchCache, state } from './storage.js';

// ==================== CONSTANTS ====================
const API_BASE = window.API_BASE || '/api';

// ==================== STATE ====================
let salesState = {
    currentView: 'customers',
    expandedCustomers: new Set(),
    expandedWorkOrders: new Set(),
    expandedLineItems: new Set(),  // Track expanded line items: "woId-itemId"
    filters: {
        search: '',
        status: ''
    }
};

// ==================== DEMO DATA ====================
function getDemoCustomers() {
    return [
        { id: 1, name: 'Acme Manufacturing', address: '123 Industrial Way, Chicago, IL 60601', phone: '(312) 555-1234', terms: 'NET 30', openWOCount: 2, contacts: [
            { id: 1, name: 'John Smith', role: 'Purchasing Manager', email: 'jsmith@acme.com', phone: '(312) 555-1234', isPrimary: true },
            { id: 2, name: 'Jane Doe', role: 'Engineer', email: 'jdoe@acme.com', phone: '(312) 555-1235', isPrimary: false }
        ]},
        { id: 2, name: 'Precision Parts Inc', address: '456 Tech Blvd, Detroit, MI 48201', phone: '(313) 555-5678', terms: 'NET 45', openWOCount: 1, contacts: [
            { id: 1, name: 'Bob Wilson', role: 'Owner', email: 'bob@precisionparts.com', phone: '(313) 555-5678', isPrimary: true }
        ]},
        { id: 3, name: 'Global Aerospace', address: '789 Aviation Dr, Seattle, WA 98101', phone: '(206) 555-9012', terms: 'NET 60', openWOCount: 0, contacts: []}
    ];
}

function getDemoQuotes() {
    const today = new Date();
    return [
        { id: 1, quoteNumber: 'Q-2025-001', customerId: 1, customerName: 'Acme Manufacturing', partNumber: 'PLT-4001', description: 'Custom Plate Assembly', quantity: 100, status: 'New', requestedDate: new Date(today.getTime() - 2*24*60*60*1000).toISOString(), dueDate: new Date(today.getTime() + 7*24*60*60*1000).toISOString(), totalPrice: 4500.00, sentAt: null },
        { id: 2, quoteNumber: 'Q-2025-002', customerId: 2, customerName: 'Precision Parts Inc', partNumber: 'SHF-2001', description: 'Precision Shaft', quantity: 50, status: 'Sent', requestedDate: new Date(today.getTime() - 5*24*60*60*1000).toISOString(), dueDate: new Date(today.getTime() + 3*24*60*60*1000).toISOString(), totalPrice: 2750.00, sentAt: new Date(today.getTime() - 3*24*60*60*1000).toISOString() },
        { id: 3, quoteNumber: 'Q-2025-003', customerId: 1, customerName: 'Acme Manufacturing', partNumber: 'BRKT-1001', description: 'Mounting Bracket', quantity: 200, status: 'Won', requestedDate: new Date(today.getTime() - 10*24*60*60*1000).toISOString(), dueDate: new Date(today.getTime() - 2*24*60*60*1000).toISOString(), totalPrice: 3200.00, sentAt: new Date(today.getTime() - 8*24*60*60*1000).toISOString() }
    ];
}

function getDemoWorkOrders() {
    const today = new Date();
    return [
        { 
            id: 1, woNumber: 'WO-2025-001', customerId: 1, customerName: 'Acme Manufacturing',
            dueDate: new Date(today.getTime() + 7*24*60*60*1000).toISOString(),
            status: 'In Progress', notes: 'Rush order - priority customer',
            lineItems: [
                {
                    id: 1, partNumber: 'PLT-4001', description: 'Mounting Plate', quantity: 100, material: '6061 Aluminum',
                    completionPercentage: 30,
                    checklist: getDefaultChecklist().map((item, i) => ({ ...item, isCompleted: i < 3 }))
                },
                {
                    id: 2, partNumber: 'PLT-4002', description: 'Cover Plate', quantity: 100, material: '6061 Aluminum',
                    completionPercentage: 20,
                    checklist: getDefaultChecklist().map((item, i) => ({ ...item, isCompleted: i < 2 }))
                }
            ]
        },
        { 
            id: 2, woNumber: 'WO-2025-002', customerId: 1, customerName: 'Acme Manufacturing',
            dueDate: new Date(today.getTime() + 2*24*60*60*1000).toISOString(),
            status: 'In Progress', notes: '',
            lineItems: [
                {
                    id: 1, partNumber: 'BRKT-1001-A', description: 'L-Bracket Assembly', quantity: 75, material: '4140 Steel',
                    completionPercentage: 40,
                    checklist: getDefaultChecklist().map((item, i) => ({ ...item, isCompleted: i < 4 }))
                }
            ]
        },
        { 
            id: 3, woNumber: 'WO-2025-003', customerId: 2, customerName: 'Precision Parts Inc',
            dueDate: new Date(today.getTime() + 5*24*60*60*1000).toISOString(),
            status: 'In Progress', notes: 'First article required',
            lineItems: [
                {
                    id: 1, partNumber: 'SHF-2001', description: 'Drive Shaft', quantity: 12, material: '17-4 Stainless',
                    completionPercentage: 10,
                    checklist: getDefaultChecklist().map((item, i) => ({ ...item, isCompleted: i < 1 }))
                },
                {
                    id: 2, partNumber: 'SHF-2002', description: 'Idler Shaft', quantity: 12, material: '17-4 Stainless',
                    completionPercentage: 10,
                    checklist: getDefaultChecklist().map((item, i) => ({ ...item, isCompleted: i < 1 }))
                },
                {
                    id: 3, partNumber: 'GER-001', description: 'Spur Gear', quantity: 24, material: '4340 Steel',
                    completionPercentage: 0,
                    checklist: getDefaultChecklist()
                }
            ]
        },
        { 
            id: 4, woNumber: 'WO-2025-004', customerId: 2, customerName: 'Precision Parts Inc',
            dueDate: new Date(today.getTime() - 1*24*60*60*1000).toISOString(),
            status: 'In Progress', notes: 'OVERDUE - expedite',
            lineItems: [
                {
                    id: 1, partNumber: 'HSG-001', description: 'Motor Housing', quantity: 50, material: 'A356 Aluminum',
                    completionPercentage: 70,
                    checklist: getDefaultChecklist().map((item, i) => ({ ...item, isCompleted: i < 7 }))
                }
            ]
        }
    ];
}

function getDefaultChecklist() {
    return [
        { id: 1, stepOrder: 1, stepName: 'Part Programmed', stepKey: 'part_programmed', isCompleted: false },
        { id: 2, stepOrder: 2, stepName: 'Material Ordered', stepKey: 'material_ordered', isCompleted: false },
        { id: 3, stepOrder: 3, stepName: 'Tooling Ordered', stepKey: 'tooling_ordered', isCompleted: false },
        { id: 4, stepOrder: 4, stepName: 'Material Received', stepKey: 'material_received', isCompleted: false },
        { id: 5, stepOrder: 5, stepName: 'Tooling Received', stepKey: 'tooling_received', isCompleted: false },
        { id: 6, stepOrder: 6, stepName: 'Material Sawn/Processed', stepKey: 'material_processed', isCompleted: false },
        { id: 7, stepOrder: 7, stepName: 'Machining Complete', stepKey: 'machining_complete', isCompleted: false },
        { id: 8, stepOrder: 8, stepName: 'Post Processing Complete', stepKey: 'post_processing', isCompleted: false },
        { id: 9, stepOrder: 9, stepName: 'Inspection Complete', stepKey: 'inspection_complete', isCompleted: false },
        { id: 10, stepOrder: 10, stepName: 'Ready For Shipment', stepKey: 'ready_for_shipment', isCompleted: false },
        { id: 11, stepOrder: 11, stepName: 'Invoicing Complete', stepKey: 'invoicing_complete', isCompleted: false }
    ];
}

// Calculate WO completion percentage based on line items
function calculateWOCompletion(wo) {
    if (!wo.lineItems || wo.lineItems.length === 0) {
        // Legacy single-part format
        if (wo.checklist) {
            const completed = wo.checklist.filter(s => s.isCompleted).length;
            return Math.round((completed / wo.checklist.length) * 100);
        }
        return wo.completionPercentage || 0;
    }
    const totalCompletion = wo.lineItems.reduce((sum, item) => {
        const itemCompletion = calculateLineItemCompletion(item);
        return sum + itemCompletion;
    }, 0);
    return Math.round(totalCompletion / wo.lineItems.length);
}

function calculateLineItemCompletion(lineItem) {
    if (!lineItem.checklist) return lineItem.completionPercentage || 0;
    const completed = lineItem.checklist.filter(s => s.isCompleted).length;
    return Math.round((completed / lineItem.checklist.length) * 100);
}

// Get next workflow step for a line item
export function getNextWorkflowStepForLineItem(lineItem) {
    const checklist = lineItem.checklist || getDefaultChecklist();
    const nextStep = checklist.find(step => !step.isCompleted);
    return nextStep || checklist[checklist.length - 1];
}

// ==================== DATA ACCESS ====================
export function getCustomers() {
    let data = storage.get(STORAGE_KEYS.CUSTOMERS);
    if (!data) {
        data = getDemoCustomers();
        storage.set(STORAGE_KEYS.CUSTOMERS, data);
    }
    return data;
}

export function getQuotes() {
    let data = storage.get(STORAGE_KEYS.QUOTES);
    if (!data) {
        data = getDemoQuotes();
        storage.set(STORAGE_KEYS.QUOTES, data);
    }
    return data;
}

export function getWorkOrders() {
    let data = storage.get(STORAGE_KEYS.WORK_ORDERS);
    if (!data) {
        data = getDemoWorkOrders();
        storage.set(STORAGE_KEYS.WORK_ORDERS, data);
    }
    return data;
}

export function saveWorkOrders(workOrders) {
    storage.set(STORAGE_KEYS.WORK_ORDERS, workOrders);
}

// ==================== WORKFLOW HELPERS ====================
// Get the next incomplete workflow step for a work order
// For multi-part WOs, returns the earliest step across all line items
export function getNextWorkflowStep(wo) {
    // Handle new multi-part structure
    if (wo.lineItems && wo.lineItems.length > 0) {
        let earliestStep = null;
        let earliestOrder = Infinity;
        
        for (const item of wo.lineItems) {
            const checklist = item.checklist || getDefaultChecklist();
            for (const step of checklist) {
                if (!step.isCompleted && step.stepOrder < earliestOrder) {
                    earliestStep = step;
                    earliestOrder = step.stepOrder;
                }
            }
        }
        return earliestStep;
    }
    
    // Legacy single-part structure
    const checklist = wo.checklist || getDefaultChecklist();
    for (const item of checklist) {
        if (!item.isCompleted) {
            return item;
        }
    }
    return null;
}

export function getWOUrgencyColor(dueDate) {
    return getUrgencyColor(dueDate);
}

// ==================== BATCH OPERATIONS ====================
export function batchUpdateWorkOrders(updates) {
    const workOrders = getWorkOrders();
    let modified = false;
    
    updates.forEach(({ id, changes }) => {
        const index = workOrders.findIndex(wo => wo.id === id);
        if (index !== -1) {
            workOrders[index] = { ...workOrders[index], ...changes };
            modified = true;
        }
    });
    
    if (modified) {
        storage.set(STORAGE_KEYS.WORK_ORDERS, workOrders);
    }
    
    return workOrders;
}

export function updateChecklistStep(woId, stepId, updates, lineItemId = null) {
    const workOrders = getWorkOrders();
    const woIndex = workOrders.findIndex(wo => wo.id === woId);
    
    if (woIndex === -1) return null;
    
    const wo = workOrders[woIndex];
    
    // Handle multi-part work orders (new structure)
    if (wo.lineItems && wo.lineItems.length > 0) {
        // Find the line item
        const itemIndex = lineItemId 
            ? wo.lineItems.findIndex(item => item.id === lineItemId)
            : 0; // Default to first item if not specified
        
        if (itemIndex === -1) return null;
        
        const lineItem = wo.lineItems[itemIndex];
        const checklist = lineItem.checklist || getDefaultChecklist();
        const stepIndex = checklist.findIndex(s => s.id === stepId);
        
        if (stepIndex === -1) return null;
        
        // Update step
        checklist[stepIndex] = { ...checklist[stepIndex], ...updates };
        
        // Recalculate line item completion
        const completed = checklist.filter(s => s.isCompleted).length;
        lineItem.completionPercentage = Math.round((completed / checklist.length) * 100);
        lineItem.checklist = checklist;
        
        wo.lineItems[itemIndex] = lineItem;
    } else {
        // Legacy single-part structure
        const checklist = wo.checklist || getDefaultChecklist();
        const stepIndex = checklist.findIndex(s => s.id === stepId);
        
        if (stepIndex === -1) return null;
        
        checklist[stepIndex] = { ...checklist[stepIndex], ...updates };
        
        const completed = checklist.filter(s => s.isCompleted).length;
        wo.completionPercentage = Math.round((completed / checklist.length) * 100);
        wo.checklist = checklist;
    }
    
    workOrders[woIndex] = wo;
    saveWorkOrders(workOrders);
    
    return wo;
}

// Get all line items at a specific workflow step across all work orders
export function getLineItemsByWorkflowStep(stepKey) {
    const workOrders = getWorkOrders();
    const results = [];
    
    workOrders.forEach(wo => {
        if (wo.lineItems && wo.lineItems.length > 0) {
            wo.lineItems.forEach(item => {
                const checklist = item.checklist || getDefaultChecklist();
                const nextStep = checklist.find(step => !step.isCompleted);
                
                if (nextStep && nextStep.stepKey === stepKey) {
                    results.push({
                        woId: wo.id,
                        woNumber: wo.woNumber,
                        customerId: wo.customerId,
                        customerName: wo.customerName,
                        dueDate: wo.dueDate,
                        lineItemId: item.id,
                        partNumber: item.partNumber,
                        description: item.description,
                        quantity: item.quantity,
                        material: item.material,
                        completionPercentage: item.completionPercentage,
                        checklist: checklist,
                        currentStep: nextStep
                    });
                }
            });
        } else {
            // Legacy single-part
            const checklist = wo.checklist || getDefaultChecklist();
            const nextStep = checklist.find(step => !step.isCompleted);
            
            if (nextStep && nextStep.stepKey === stepKey) {
                results.push({
                    woId: wo.id,
                    woNumber: wo.woNumber,
                    customerId: wo.customerId,
                    customerName: wo.customerName,
                    dueDate: wo.dueDate,
                    lineItemId: null,
                    partNumber: wo.partNumber,
                    description: wo.description || '',
                    quantity: wo.quantity,
                    material: wo.material || '',
                    completionPercentage: wo.completionPercentage || 0,
                    checklist: checklist,
                    currentStep: nextStep
                });
            }
        }
    });
    
    // Sort by due date (most urgent first)
    return results.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

// ==================== VIEW FUNCTIONS ====================
export function loadCustomersView() {
    salesState.currentView = 'customers';
    showLoadingSpinner();
    
    safeExecute(() => {
        const customers = getCustomers();
        renderCustomersView(customers);
    }, () => {
        showToast('Error loading customers', 'error');
    }, 'loadCustomersView');
}

function renderCustomersView(customers) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    // Filter customers
    let filtered = customers;
    if (salesState.filters.search) {
        const search = salesState.filters.search.toLowerCase();
        filtered = customers.filter(c => 
            c.name?.toLowerCase().includes(search) ||
            c.contacts?.some(con => con.name?.toLowerCase().includes(search))
        );
    }
    
    const customerRows = filtered.map(customer => {
        const primaryContact = customer.contacts?.find(c => c.isPrimary) || customer.contacts?.[0];
        const isExpanded = salesState.expandedCustomers.has(customer.id);
        
        return `
            <tr class="border-b border-gray-700 hover:bg-gray-800 cursor-pointer" data-action="toggle-customer" data-id="${customer.id}">
                <td class="px-4 py-3">
                    <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} mr-2 text-gray-500"></i>
                    <span class="font-medium text-white">${customer.name}</span>
                </td>
                <td class="px-4 py-3 text-gray-300">${primaryContact?.name || '-'}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${customer.openWOCount > 0 ? 'bg-blue-600 text-blue-100' : 'bg-gray-600 text-gray-200'}">
                        ${customer.openWOCount || 0} Open WOs
                    </span>
                </td>
                <td class="px-4 py-3 text-gray-300">${customer.terms || 'NET 30'}</td>
                <td class="px-4 py-3">
                    <button data-action="edit-customer" data-id="${customer.id}" class="text-blue-400 hover:text-blue-300 mr-2">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button data-action="delete-customer" data-id="${customer.id}" data-name="${customer.name}" class="text-red-400 hover:text-red-300">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
            ${isExpanded ? renderCustomerDetails(customer) : ''}
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="col-span-3 card p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-medium" style="color: var(--color-accent-primary);">
                    <i class="fa-solid fa-building mr-2"></i>Customers
                    <span class="text-xs" style="color: var(--color-text-muted);">(${filtered.length} customers)</span>
                </h3>
                <div class="flex space-x-2">
                    <button data-action="export-customers" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                        <i class="fa-solid fa-download mr-1"></i>Export
                    </button>
                    <button data-action="add-customer" class="btn btn-primary text-sm">
                        <i class="fa-solid fa-plus mr-1"></i>Add Customer
                    </button>
                </div>
            </div>
            
            <div class="mb-4">
                <input type="text" id="customerSearch" placeholder="Search customers..." 
                    value="${salesState.filters.search}"
                    class="w-full bg-gray-700 text-sm text-gray-300 rounded px-3 py-2 border border-gray-600">
            </div>
            
            <div class="table-container">
                <table class="table w-full text-sm text-left">
                    <thead>
                        <tr>
                            <th class="px-4 py-3">Company</th>
                            <th class="px-4 py-3">Primary Contact</th>
                            <th class="px-4 py-3">Open WOs</th>
                            <th class="px-4 py-3">Terms</th>
                            <th class="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${customerRows || '<tr><td colspan="5" class="text-center py-8" style="color: var(--color-text-muted);">No customers found</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    setupCustomerSearch();
}

function renderCustomerDetails(customer) {
    const workOrders = getWorkOrders().filter(wo => wo.customerId === customer.id);
    
    return `
        <tr class="bg-gray-900">
            <td colspan="5" class="px-8 py-4">
                <div class="grid grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-sm font-medium text-gray-400 mb-2"><i class="fa-solid fa-file-lines mr-2"></i>Open Work Orders</h4>
                        ${workOrders.length > 0 ? workOrders.map(wo => `
                            <div class="bg-gray-800 p-2 rounded mb-1 text-xs flex justify-between">
                                <span>${wo.woNumber} - ${wo.partNumber}</span>
                                <span class="text-${wo.urgencyColor}-400">${formatDate(wo.dueDate)}</span>
                            </div>
                        `).join('') : '<div class="text-xs text-gray-500">No open work orders</div>'}
                    </div>
                    <div>
                        <h4 class="text-sm font-medium text-gray-400 mb-2"><i class="fa-solid fa-users mr-2"></i>Contacts</h4>
                        ${customer.contacts?.length > 0 ? customer.contacts.map(c => `
                            <div class="bg-gray-800 p-2 rounded mb-1 text-xs">
                                <div class="font-medium">${c.name} ${c.isPrimary ? '<span class="text-accentGreen">(Primary)</span>' : ''}</div>
                                <div class="text-gray-500">${c.role || ''}</div>
                                <div><a href="mailto:${c.email}" class="text-blue-400">${c.email}</a> | ${c.phone || ''}</div>
                            </div>
                        `).join('') : '<div class="text-xs text-gray-500">No contacts</div>'}
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function setupCustomerSearch() {
    const searchInput = document.getElementById('customerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            salesState.filters.search = e.target.value;
            loadCustomersView();
        }, 300));
    }
}

// ==================== QUOTES VIEW ====================
export function loadQuotesView() {
    salesState.currentView = 'quotes';
    showLoadingSpinner();
    
    safeExecute(() => {
        const quotes = getQuotes();
        renderQuotesView(quotes);
    }, () => {
        showToast('Error loading quotes', 'error');
    }, 'loadQuotesView');
}

function renderQuotesView(quotes) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    const openRFQs = quotes.filter(q => !q.sentAt && q.status !== 'Won' && q.status !== 'Lost');
    const sentQuotes = quotes.filter(q => q.sentAt || q.status === 'Won' || q.status === 'Lost');
    
    const renderQuoteRow = (quote) => `
        <tr class="border-b border-gray-700 hover:bg-gray-800">
            <td class="px-4 py-3 font-medium text-white">${quote.quoteNumber}</td>
            <td class="px-4 py-3 text-gray-300">${quote.customerName}</td>
            <td class="px-4 py-3 text-gray-300">${quote.partNumber}</td>
            <td class="px-4 py-3 text-gray-300">${quote.quantity}</td>
            <td class="px-4 py-3 text-gray-400">${formatDate(quote.requestedDate)}</td>
            <td class="px-4 py-3 text-${getUrgencyColor(quote.dueDate)}-400">${formatDate(quote.dueDate)}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(quote.status)}">${quote.status}</span>
            </td>
            <td class="px-4 py-3">
                <button data-action="edit-quote" data-id="${quote.id}" class="text-blue-400 hover:text-blue-300 mr-2">
                    <i class="fa-solid fa-edit"></i>
                </button>
                <button data-action="convert-quote" data-id="${quote.id}" class="text-green-400 hover:text-green-300 mr-2" title="Convert to WO">
                    <i class="fa-solid fa-arrow-right-to-bracket"></i>
                </button>
            </td>
        </tr>
    `;
    
    container.innerHTML = `
        <div class="col-span-3 space-y-6">
            <div class="card p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-sm font-medium" style="color: var(--color-accent-primary);">
                        <i class="fa-solid fa-file-invoice mr-2"></i>Open RFQs
                        <span class="text-xs" style="color: var(--color-text-muted);">(${openRFQs.length})</span>
                    </h3>
                    <div class="flex space-x-2">
                        <button data-action="export-quotes" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                            <i class="fa-solid fa-download mr-1"></i>Export
                        </button>
                        <button data-action="add-quote" class="btn btn-primary text-sm">
                            <i class="fa-solid fa-plus mr-1"></i>New Quote
                        </button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="table w-full text-sm text-left">
                        <thead>
                            <tr>
                                <th class="px-4 py-3">Quote #</th>
                                <th class="px-4 py-3">Customer</th>
                                <th class="px-4 py-3">Part #</th>
                                <th class="px-4 py-3">Qty</th>
                                <th class="px-4 py-3">Requested</th>
                                <th class="px-4 py-3">Due</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>${openRFQs.map(renderQuoteRow).join('') || '<tr><td colspan="8" class="text-center py-4" style="color: var(--color-text-muted);">No open RFQs</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
            
            <div class="card p-6">
                <h3 class="text-gray-400 text-sm font-medium mb-4">
                    <i class="fa-solid fa-paper-plane mr-2 text-blue-400"></i>Sent Quotes
                    <span class="text-xs text-gray-500">(${sentQuotes.length})</span>
                </h3>
                <div class="table-container">
                    <table class="table w-full text-sm text-left">
                        <thead>
                            <tr>
                                <th class="px-4 py-3">Quote #</th>
                                <th class="px-4 py-3">Customer</th>
                                <th class="px-4 py-3">Part #</th>
                                <th class="px-4 py-3">Qty</th>
                                <th class="px-4 py-3">Requested</th>
                                <th class="px-4 py-3">Due</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>${sentQuotes.map(renderQuoteRow).join('') || '<tr><td colspan="8" class="text-center py-4" style="color: var(--color-text-muted);">No sent quotes</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ==================== WIP VIEW ====================
export function loadWIPView() {
    salesState.currentView = 'wip';
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders().filter(wo => {
            const completion = calculateWOCompletion(wo);
            return completion < 100;
        });
        renderWIPView(workOrders);
    }, () => {
        showToast('Error loading work orders', 'error');
    }, 'loadWIPView');
}

function renderWIPView(workOrders) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    const woCards = workOrders.map(wo => {
        const isExpanded = salesState.expandedWorkOrders.has(wo.id);
        const urgencyColor = getUrgencyColor(wo.dueDate);
        const overallCompletion = calculateWOCompletion(wo);
        const lineItems = wo.lineItems || [];
        const partCount = lineItems.length || 1;
        
        // For legacy single-part work orders
        if (!wo.lineItems || wo.lineItems.length === 0) {
            const legacyLineItem = {
                id: 1,
                partNumber: wo.partNumber || 'N/A',
                description: wo.description || '',
                quantity: wo.quantity || 0,
                material: wo.material || '',
                completionPercentage: wo.completionPercentage || 0,
                checklist: wo.checklist || getDefaultChecklist()
            };
            wo.lineItems = [legacyLineItem];
        }
        
        return `
            <div class="card mb-4 border-l-4 border-l-${urgencyColor}-500" style="background: var(--color-card-bg);">
                <!-- Work Order Header -->
                <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/30 transition-colors" 
                     data-action="toggle-wo" data-id="${wo.id}">
                    <div class="flex items-center gap-4">
                        <button class="text-gray-500">
                            <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} transition-transform"></i>
                        </button>
                        <div>
                            <span class="font-bold text-lg" style="color: var(--color-accent-primary);">${wo.woNumber}</span>
                            <span class="text-gray-400 ml-3">${wo.customerName}</span>
                            <span class="text-xs ml-3 px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                                ${partCount} part${partCount > 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="text-right">
                            <div class="text-xs text-gray-500">Due Date</div>
                            <div class="text-${urgencyColor}-400 font-medium">${formatDate(wo.dueDate)}</div>
                        </div>
                        <div class="w-48">
                            <div class="flex justify-between text-xs mb-1">
                                <span style="color: var(--color-text-muted);">Overall Progress</span>
                                <span style="color: var(--color-accent-primary);">${overallCompletion}%</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-3">
                                <div class="h-3 rounded-full transition-all" 
                                     style="width: ${overallCompletion}%; background: linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-secondary));"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${isExpanded ? renderWOLineItems(wo) : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="col-span-3">
            <div class="card p-4 mb-6">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium" style="color: var(--color-accent-primary);">
                        <i class="fa-solid fa-clipboard-list mr-2"></i>Work In Progress
                        <span class="text-sm ml-2" style="color: var(--color-text-muted);">(${workOrders.length} active orders)</span>
                    </h3>
                    <div class="flex space-x-2">
                        <button data-action="export-work-orders" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                            <i class="fa-solid fa-download mr-1"></i>Export
                        </button>
                        <button data-action="refresh-wip" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                            <i class="fa-solid fa-refresh mr-1"></i>Refresh
                        </button>
                        <button data-action="add-wo" class="btn btn-primary text-sm">
                            <i class="fa-solid fa-plus mr-1"></i>New Work Order
                        </button>
                    </div>
                </div>
                
                <div class="flex gap-6 mt-4 text-xs">
                    <span><i class="fa-solid fa-circle text-green-500 mr-1"></i>On Schedule</span>
                    <span><i class="fa-solid fa-circle text-yellow-500 mr-1"></i>Due Within 3 Days</span>
                    <span><i class="fa-solid fa-circle text-red-500 mr-1"></i>Overdue</span>
                </div>
            </div>
            
            ${woCards || '<div class="card p-12 text-center" style="color: var(--color-text-muted);"><i class="fa-solid fa-clipboard-check text-5xl mb-4"></i><p>No active work orders</p></div>'}
        </div>
    `;
}

// Render line items (parts) for a work order
function renderWOLineItems(wo) {
    const lineItems = wo.lineItems || [];
    
    return `
        <div class="border-t" style="border-color: var(--color-border); background: var(--color-dark-bg);">
            ${lineItems.map((item, idx) => {
                const isPartExpanded = salesState.expandedLineItems?.has(`${wo.id}-${item.id}`) || false;
                const itemCompletion = calculateLineItemCompletion(item);
                
                return `
                    <div class="border-b last:border-b-0" style="border-color: var(--color-border);">
                        <!-- Line Item Header -->
                        <div class="flex items-center justify-between p-4 pl-12 cursor-pointer hover:bg-gray-800/20"
                             data-action="toggle-line-item" data-wo-id="${wo.id}" data-item-id="${item.id}">
                            <div class="flex items-center gap-4">
                                <button class="text-gray-600">
                                    <i class="fa-solid fa-chevron-${isPartExpanded ? 'down' : 'right'} text-sm"></i>
                                </button>
                                <div>
                                    <span class="font-semibold text-white">${item.partNumber}</span>
                                    <span class="text-gray-400 ml-2">${item.description || ''}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-6">
                                <div class="text-center">
                                    <div class="text-xs text-gray-500">Qty</div>
                                    <div class="text-white font-medium">${item.quantity}</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-xs text-gray-500">Material</div>
                                    <div class="text-gray-300 text-sm">${item.material || '-'}</div>
                                </div>
                                <div class="w-32">
                                    <div class="flex justify-between text-xs mb-1">
                                        <span class="text-gray-500">Progress</span>
                                        <span style="color: var(--color-accent-secondary);">${itemCompletion}%</span>
                                    </div>
                                    <div class="w-full bg-gray-700 rounded-full h-2">
                                        <div class="h-2 rounded-full transition-all" 
                                             style="width: ${itemCompletion}%; background: var(--color-accent-secondary);"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${isPartExpanded ? renderLineItemChecklist(wo.id, item) : ''}
                    </div>
                `;
            }).join('')}
            
            <!-- Add Part Button -->
            <div class="p-3 pl-12">
                <button data-action="add-line-item" data-wo-id="${wo.id}" 
                        class="text-sm px-3 py-1 rounded border border-dashed hover:bg-gray-800/50 transition-colors"
                        style="color: var(--color-text-muted); border-color: var(--color-border);">
                    <i class="fa-solid fa-plus mr-1"></i>Add Part
                </button>
            </div>
        </div>
    `;
}

// Render checklist for a specific line item (part)
function renderLineItemChecklist(woId, lineItem) {
    const checklist = lineItem.checklist || getDefaultChecklist();
    
    const getStepStatus = (item) => {
        if (item.hasIssue) return { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'fa-exclamation-triangle', border: 'border-red-500/30' };
        if (item.isCompleted) return { bg: 'bg-green-500/10', text: 'text-green-400', icon: 'fa-check', border: 'border-green-500/30' };
        if (item.inProgress) return { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'fa-spinner', border: 'border-blue-500/30' };
        return { bg: 'bg-gray-800', text: 'text-gray-400', icon: '', border: 'border-gray-700' };
    };
    
    return `
        <div class="p-4 pl-20" style="background: rgba(0,0,0,0.2);">
            <h5 class="text-xs font-medium mb-3" style="color: var(--color-text-muted);">
                <i class="fa-solid fa-list-check mr-2"></i>Workflow Steps for ${lineItem.partNumber}
            </h5>
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-2">
                ${checklist.map(step => {
                    const status = getStepStatus(step);
                    return `
                        <div class="flex items-center gap-2 p-2 rounded border ${status.bg} ${status.border}">
                            ${step.hasIssue ? `
                                <i class="fa-solid fa-exclamation-triangle text-red-400" 
                                   title="${step.issueType || 'Issue'}: ${step.issueDescription || ''}"></i>
                            ` : step.isCompleted ? `
                                <i class="fa-solid fa-check text-green-400"></i>
                            ` : step.inProgress ? `
                                <i class="fa-solid fa-spinner fa-spin text-blue-400"></i>
                            ` : `
                                <input type="checkbox" 
                                    data-action="complete-step" 
                                    data-wo-id="${woId}" 
                                    data-item-id="${lineItem.id}" 
                                    data-step-id="${step.id}" 
                                    data-step-name="${step.stepName}"
                                    class="w-4 h-4 cursor-pointer" 
                                    style="accent-color: var(--color-accent-primary);">
                            `}
                            <span class="text-sm ${status.text} flex-grow">${step.stepName}</span>
                            ${step.hasIssue ? `
                                <span class="text-xs text-red-400" title="${step.issueDescription || ''}">
                                    ${step.issueSeverity === 'High' ? '🔴' : step.issueSeverity === 'Medium' ? '🟠' : '🟡'}
                                </span>
                            ` : step.isCompleted && step.completedAt ? `
                                <span class="text-xs" style="color: var(--color-text-muted);">${formatDate(step.completedAt)}</span>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ==================== ARCHIVED WORK VIEW ====================
export function loadArchivedWorkView() {
    salesState.currentView = 'archived';
    showLoadingSpinner();
    
    safeExecute(() => {
        const container = DOMCache.get('dashboardContent');
        if (!container) return;
        
        // Get all work orders and filter for completed ones
        const allWorkOrders = getWorkOrders();
        const archivedWOs = allWorkOrders.filter(wo => wo.completionPercentage === 100 || wo.status === 'Completed');
        
        // Also get from archived storage
        const archivedStorage = storage.get(STORAGE_KEYS.ARCHIVED_WORK_ORDERS) || [];
        const allArchived = [...archivedWOs, ...archivedStorage].sort((a, b) => 
            new Date(b.completedAt || b.updatedAt || b.createdAt) - new Date(a.completedAt || a.updatedAt || a.createdAt)
        );
        
        const archivedRows = allArchived.map(wo => {
            const completedDate = wo.completedAt || wo.updatedAt || wo.dueDate;
            return `
                <tr class="hover:bg-gray-800/50">
                    <td class="px-4 py-3">
                        <span class="font-medium text-white">${wo.woNumber}</span>
                    </td>
                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${wo.customerName}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${wo.partNumber}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${wo.quantity}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-muted);">${formatDate(wo.dueDate)}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-muted);">${formatDate(completedDate)}</td>
                    <td class="px-4 py-3">
                        <span class="badge bg-green-600 text-green-100">Completed</span>
                    </td>
                    <td class="px-4 py-3">
                        <button data-action="view-archived-wo" data-id="${wo.id}" class="text-blue-400 hover:text-blue-300 text-sm">
                            <i class="fa-solid fa-eye mr-1"></i>View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="col-span-3">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-sm font-medium" style="color: var(--color-accent-primary);">
                        <i class="fa-solid fa-archive mr-2"></i>Archived Work Orders
                        <span class="text-xs" style="color: var(--color-text-muted);">(${allArchived.length} completed)</span>
                    </h3>
                    <div class="flex space-x-2">
                        <button data-action="export-archived" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                            <i class="fa-solid fa-download mr-1"></i>Export
                        </button>
                    </div>
                </div>
                
                <div class="card p-6">
                    ${allArchived.length > 0 ? `
                        <div class="table-container">
                            <table class="table w-full text-sm text-left">
                                <thead>
                                    <tr>
                                        <th class="px-4 py-3">WO #</th>
                                        <th class="px-4 py-3">Customer</th>
                                        <th class="px-4 py-3">Part #</th>
                                        <th class="px-4 py-3">Qty</th>
                                        <th class="px-4 py-3">Due Date</th>
                                        <th class="px-4 py-3">Completed</th>
                                        <th class="px-4 py-3">Status</th>
                                        <th class="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${archivedRows}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="text-center py-12">
                            <i class="fa-solid fa-box-archive text-5xl mb-4" style="color: var(--color-text-muted);"></i>
                            <p style="color: var(--color-text-muted);">No archived work orders yet</p>
                            <p class="text-xs mt-2" style="color: var(--color-text-muted);">Completed work orders will appear here</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }, null, 'loadArchivedWorkView');
}

// ==================== ARCHIVED QUOTES VIEW ====================
export function loadArchivedQuotesView() {
    salesState.currentView = 'archived-quotes';
    showLoadingSpinner();
    
    safeExecute(() => {
        const container = DOMCache.get('dashboardContent');
        if (!container) return;
        
        // Get all quotes and filter for Lost ones
        const allQuotes = getQuotes();
        const archivedQuotes = allQuotes.filter(q => q.status === 'Lost');
        
        const archivedRows = archivedQuotes.map(quote => {
            return `
                <tr class="hover:bg-gray-800/50">
                    <td class="px-4 py-3">
                        <span class="font-medium text-white">${quote.quoteNumber}</span>
                    </td>
                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${quote.customerName}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${quote.partNumber}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-secondary);">${quote.quantity}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-muted);">${formatDate(quote.dueDate)}</td>
                    <td class="px-4 py-3" style="color: var(--color-text-muted);">${formatDate(quote.updatedAt || quote.createdAt)}</td>
                    <td class="px-4 py-3">
                        <span class="badge bg-red-600 text-red-100">Lost</span>
                    </td>
                    <td class="px-4 py-3">
                        <div class="flex space-x-2">
                            <button data-action="reopen-quote" data-id="${quote.id}" class="text-blue-400 hover:text-blue-300 text-sm" title="Reopen Quote">
                                <i class="fa-solid fa-redo mr-1"></i>Reopen
                            </button>
                            <button data-action="delete-quote" data-id="${quote.id}" data-name="${quote.quoteNumber}" class="text-red-400 hover:text-red-300 text-sm" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="col-span-3">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-sm font-medium" style="color: var(--color-accent-primary);">
                        <i class="fa-solid fa-file-circle-xmark mr-2"></i>Archived Quotes (Lost)
                        <span class="text-xs" style="color: var(--color-text-muted);">(${archivedQuotes.length} quotes)</span>
                    </h3>
                    <div class="flex space-x-2">
                        <button data-action="export-archived-quotes" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                            <i class="fa-solid fa-download mr-1"></i>Export
                        </button>
                    </div>
                </div>
                
                <div class="card p-6">
                    ${archivedQuotes.length > 0 ? `
                        <div class="table-container">
                            <table class="table w-full text-sm text-left">
                                <thead>
                                    <tr>
                                        <th class="px-4 py-3">Quote #</th>
                                        <th class="px-4 py-3">Customer</th>
                                        <th class="px-4 py-3">Part #</th>
                                        <th class="px-4 py-3">Qty</th>
                                        <th class="px-4 py-3">Due Date</th>
                                        <th class="px-4 py-3">Closed</th>
                                        <th class="px-4 py-3">Status</th>
                                        <th class="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${archivedRows}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="text-center py-12">
                            <i class="fa-solid fa-file-circle-check text-5xl mb-4" style="color: var(--color-text-muted);"></i>
                            <p style="color: var(--color-text-muted);">No archived quotes yet</p>
                            <p class="text-xs mt-2" style="color: var(--color-text-muted);">Quotes marked as Lost will appear here</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }, null, 'loadArchivedQuotesView');
}

// ==================== ACTION HANDLERS ====================
export function toggleCustomerExpand(customerId) {
    const id = parseInt(customerId);
    if (salesState.expandedCustomers.has(id)) {
        salesState.expandedCustomers.delete(id);
    } else {
        salesState.expandedCustomers.add(id);
    }
    loadCustomersView();
}

export function toggleWOExpand(woId) {
    const id = parseInt(woId);
    if (salesState.expandedWorkOrders.has(id)) {
        salesState.expandedWorkOrders.delete(id);
    } else {
        salesState.expandedWorkOrders.add(id);
    }
    loadWIPView();
}

export function toggleLineItemExpand(woId, itemId) {
    const key = `${woId}-${itemId}`;
    if (salesState.expandedLineItems.has(key)) {
        salesState.expandedLineItems.delete(key);
    } else {
        salesState.expandedLineItems.add(key);
    }
    loadWIPView();
}

// ==================== ADD LINE ITEM MODAL ====================
export function showAddLineItemModal(woId) {
    const modal = document.createElement('div');
    modal.id = 'addLineItemModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fa-solid fa-plus mr-2"></i>Add Part to Work Order</h3>
                <button class="modal-close" data-action="close-modal"><i class="fa-solid fa-times"></i></button>
            </div>
            <div class="modal-body">
                <form id="addLineItemForm">
                    <input type="hidden" name="woId" value="${woId}">
                    <div class="form-group">
                        <label>Part Number *</label>
                        <input type="text" name="partNumber" required class="form-input" placeholder="e.g., PLT-001">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" name="description" class="form-input" placeholder="Part description">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label>Quantity *</label>
                            <input type="number" name="quantity" required class="form-input" min="1" value="1">
                        </div>
                        <div class="form-group">
                            <label>Material</label>
                            <input type="text" name="material" class="form-input" placeholder="e.g., 6061 Aluminum">
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button>
                <button type="button" class="btn btn-primary" data-action="save-line-item">
                    <i class="fa-solid fa-plus mr-1"></i>Add Part
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
}

export function saveLineItem(woId) {
    const form = document.getElementById('addLineItemForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === parseInt(woId));
    
    if (!wo) {
        showToast('Work order not found', 'error');
        return;
    }
    
    // Initialize lineItems if not present
    if (!wo.lineItems) wo.lineItems = [];
    
    const newItem = {
        id: wo.lineItems.length + 1,
        partNumber: formData.get('partNumber'),
        description: formData.get('description') || '',
        quantity: parseInt(formData.get('quantity')) || 1,
        material: formData.get('material') || '',
        completionPercentage: 0,
        checklist: getDefaultChecklist()
    };
    
    wo.lineItems.push(newItem);
    saveWorkOrders(workOrders);
    
    closeModal('addLineItemModal');
    showToast(`Part ${newItem.partNumber} added successfully`, 'success');
    loadWIPView();
}

// ==================== ADD CUSTOMER MODAL ====================
function showAddCustomerModal() {
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-building mr-2" style="color: var(--color-accent-primary);"></i>Add Customer
                </h3>
                <button onclick="BPERP.common.closeModal('addCustomerModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="addCustomerForm" class="space-y-4">
                <div>
                    <label class="form-label">Company Name *</label>
                    <input type="text" name="companyName" required class="form-input w-full" placeholder="Enter company name">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Contact Name</label>
                        <input type="text" name="contactName" class="form-input w-full" placeholder="Primary contact">
                    </div>
                    <div>
                        <label class="form-label">Phone</label>
                        <input type="tel" name="phone" class="form-input w-full" placeholder="(555) 123-4567">
                    </div>
                </div>
                <div>
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-input w-full" placeholder="contact@company.com">
                </div>
                <div>
                    <label class="form-label">Address</label>
                    <textarea name="address" class="form-input w-full" rows="2" placeholder="Street address, City, State ZIP"></textarea>
                </div>
                <div>
                    <label class="form-label">Terms</label>
                    <select name="terms" class="form-input w-full">
                        <option value="NET 30">NET 30</option>
                        <option value="NET 15">NET 15</option>
                        <option value="NET 45">NET 45</option>
                        <option value="NET 60">NET 60</option>
                        <option value="COD">COD</option>
                    </select>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('addCustomerModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn btn-primary flex-1">
                        <i class="fa-solid fa-plus mr-2"></i>Add Customer
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('addCustomerModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('addCustomerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customer = {
            id: Date.now(),
            companyName: formData.get('companyName'),
            contactName: formData.get('contactName'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            address: formData.get('address'),
            terms: formData.get('terms'),
            openWOCount: 0,
            createdAt: new Date().toISOString()
        };
        
        const customers = getCustomers();
        customers.push(customer);
        storage.set(STORAGE_KEYS.CUSTOMERS, customers);
        
        closeModal('addCustomerModal');
        showToast(`Customer "${customer.companyName}" added successfully!`, 'success');
        loadCustomersView();
    });
}

// ==================== ADD QUOTE MODAL ====================
function showAddQuoteModal() {
    const customers = getCustomers();
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-file-invoice mr-2" style="color: var(--color-accent-primary);"></i>New Quote
                </h3>
                <button onclick="BPERP.common.closeModal('addQuoteModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="addQuoteForm" class="space-y-4">
                <div>
                    <label class="form-label">Customer *</label>
                    <select name="customerId" required class="form-input w-full">
                        <option value="">Select customer...</option>
                        ${customers.map(c => `<option value="${c.id}">${c.companyName}</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Part Number *</label>
                        <input type="text" name="partNumber" required class="form-input w-full" placeholder="PART-001">
                    </div>
                    <div>
                        <label class="form-label">Quantity *</label>
                        <input type="number" name="quantity" required min="1" class="form-input w-full" placeholder="100">
                    </div>
                </div>
                <div>
                    <label class="form-label">Description</label>
                    <textarea name="description" class="form-input w-full" rows="2" placeholder="Part description..."></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Material</label>
                        <input type="text" name="material" class="form-input w-full" placeholder="6061 Aluminum">
                    </div>
                    <div>
                        <label class="form-label">Due Date</label>
                        <input type="date" name="dueDate" class="form-input w-full">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Unit Price</label>
                        <input type="number" name="unitPrice" step="0.01" class="form-input w-full" placeholder="0.00">
                    </div>
                    <div>
                        <label class="form-label">Status</label>
                        <select name="status" class="form-input w-full">
                            <option value="New">New</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Sent">Sent</option>
                        </select>
                    </div>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('addQuoteModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn btn-primary flex-1">
                        <i class="fa-solid fa-plus mr-2"></i>Create Quote
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('addQuoteModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('addQuoteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customerId = parseInt(formData.get('customerId'));
        const customer = customers.find(c => c.id === customerId);
        
        const quote = {
            id: Date.now(),
            quoteNumber: 'Q-' + Date.now().toString().slice(-6),
            customerId: customerId,
            customerName: customer?.companyName || 'Unknown',
            partNumber: formData.get('partNumber'),
            quantity: parseInt(formData.get('quantity')),
            description: formData.get('description'),
            material: formData.get('material'),
            dueDate: formData.get('dueDate'),
            unitPrice: parseFloat(formData.get('unitPrice')) || 0,
            status: formData.get('status'),
            createdAt: new Date().toISOString()
        };
        
        const quotes = getQuotes();
        quotes.push(quote);
        storage.set(STORAGE_KEYS.QUOTES, quotes);
        
        closeModal('addQuoteModal');
        showToast(`Quote "${quote.quoteNumber}" created successfully!`, 'success');
        loadQuotesView();
    });
}

// ==================== ADD WORK ORDER MODAL ====================
// Track line items being added to a new work order
let newWOLineItems = [];

function showAddWorkOrderModal() {
    const customers = getCustomers();
    newWOLineItems = []; // Reset line items
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-clipboard-list mr-2" style="color: var(--color-accent-primary);"></i>New Work Order
                </h3>
                <button onclick="BPERP.common.closeModal('addWOModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="addWOForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Customer *</label>
                        <select name="customerId" required class="form-input w-full">
                            <option value="">Select customer...</option>
                            ${customers.map(c => `<option value="${c.id}">${c.companyName}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Due Date *</label>
                        <input type="date" name="dueDate" required class="form-input w-full">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Priority</label>
                        <select name="priority" class="form-input w-full">
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Rush">Rush</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Notes</label>
                        <input type="text" name="notes" class="form-input w-full" placeholder="Special instructions...">
                    </div>
                </div>
                
                <!-- Line Items Section -->
                <div class="border-t pt-4" style="border-color: var(--color-border);">
                    <div class="flex justify-between items-center mb-3">
                        <label class="form-label mb-0">Parts / Line Items *</label>
                        <button type="button" id="addPartBtn" class="text-sm px-2 py-1 rounded hover:bg-gray-700" style="color: var(--color-accent-primary);">
                            <i class="fa-solid fa-plus mr-1"></i>Add Part
                        </button>
                    </div>
                    
                    <!-- Line Items List -->
                    <div id="lineItemsList" class="space-y-2 max-h-48 overflow-y-auto">
                        <div class="text-center py-4" style="color: var(--color-text-muted);">
                            <i class="fa-solid fa-cube text-2xl mb-2"></i>
                            <p class="text-sm">No parts added yet. Click "Add Part" to begin.</p>
                        </div>
                    </div>
                    
                    <!-- Add Part Form (hidden initially) -->
                    <div id="addPartForm" class="hidden mt-3 p-3 rounded" style="background: var(--color-dark-bg);">
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <input type="text" id="newPartNumber" class="form-input text-sm" placeholder="Part Number *">
                            <input type="number" id="newPartQty" class="form-input text-sm" placeholder="Qty *" min="1">
                        </div>
                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <input type="text" id="newPartDesc" class="form-input text-sm" placeholder="Description">
                            <input type="text" id="newPartMaterial" class="form-input text-sm" placeholder="Material">
                        </div>
                        <div class="flex gap-2">
                            <button type="button" id="savePartBtn" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex-1">
                                <i class="fa-solid fa-check mr-1"></i>Add
                            </button>
                            <button type="button" id="cancelPartBtn" class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('addWOModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn btn-primary flex-1" id="createWOBtn" disabled>
                        <i class="fa-solid fa-plus mr-2"></i>Create Work Order
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('addWOModal', content, { width: 'w-full max-w-xl' });
    
    // Setup event handlers for line items
    setupLineItemHandlers();
    
    document.getElementById('addWOForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (newWOLineItems.length === 0) {
            showToast('Please add at least one part', 'error');
            return;
        }
        
        const formData = new FormData(e.target);
        const customerId = parseInt(formData.get('customerId'));
        const customer = customers.find(c => c.id === customerId);
        
        const workOrder = {
            id: Date.now(),
            woNumber: 'WO-' + Date.now().toString().slice(-6),
            customerId: customerId,
            customerName: customer?.companyName || 'Unknown',
            dueDate: formData.get('dueDate'),
            priority: formData.get('priority'),
            notes: formData.get('notes'),
            status: 'Open',
            lineItems: newWOLineItems.map((item, idx) => ({
                id: idx + 1,
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
                material: item.material,
                completionPercentage: 0,
                checklist: getDefaultChecklist()
            })),
            createdAt: new Date().toISOString()
        };
        
        const workOrders = getWorkOrders();
        workOrders.push(workOrder);
        saveWorkOrders(workOrders);
        
        closeModal('addWOModal');
        showToast(`Work Order "${workOrder.woNumber}" created with ${newWOLineItems.length} part(s)!`, 'success');
        loadWIPView();
    });
}

function setupLineItemHandlers() {
    const addPartBtn = document.getElementById('addPartBtn');
    const addPartForm = document.getElementById('addPartForm');
    const savePartBtn = document.getElementById('savePartBtn');
    const cancelPartBtn = document.getElementById('cancelPartBtn');
    const createWOBtn = document.getElementById('createWOBtn');
    
    addPartBtn.addEventListener('click', () => {
        addPartForm.classList.remove('hidden');
        document.getElementById('newPartNumber').focus();
    });
    
    cancelPartBtn.addEventListener('click', () => {
        addPartForm.classList.add('hidden');
        clearPartForm();
    });
    
    savePartBtn.addEventListener('click', () => {
        const partNumber = document.getElementById('newPartNumber').value.trim();
        const quantity = parseInt(document.getElementById('newPartQty').value);
        const description = document.getElementById('newPartDesc').value.trim();
        const material = document.getElementById('newPartMaterial').value.trim();
        
        if (!partNumber || !quantity || quantity < 1) {
            showToast('Part number and quantity are required', 'error');
            return;
        }
        
        newWOLineItems.push({ partNumber, quantity, description, material });
        renderLineItemsList();
        clearPartForm();
        addPartForm.classList.add('hidden');
        createWOBtn.disabled = false;
    });
    
    function clearPartForm() {
        document.getElementById('newPartNumber').value = '';
        document.getElementById('newPartQty').value = '';
        document.getElementById('newPartDesc').value = '';
        document.getElementById('newPartMaterial').value = '';
    }
}

function renderLineItemsList() {
    const list = document.getElementById('lineItemsList');
    const createWOBtn = document.getElementById('createWOBtn');
    
    if (newWOLineItems.length === 0) {
        list.innerHTML = `
            <div class="text-center py-4" style="color: var(--color-text-muted);">
                <i class="fa-solid fa-cube text-2xl mb-2"></i>
                <p class="text-sm">No parts added yet. Click "Add Part" to begin.</p>
            </div>
        `;
        createWOBtn.disabled = true;
        return;
    }
    
    list.innerHTML = newWOLineItems.map((item, idx) => `
        <div class="flex items-center justify-between p-2 rounded" style="background: var(--color-dark-bg);">
            <div class="flex items-center gap-3">
                <span class="text-xs px-2 py-0.5 rounded" style="background: var(--color-accent-primary); color: white;">${idx + 1}</span>
                <div>
                    <span class="font-medium text-white">${item.partNumber}</span>
                    <span class="text-gray-400 text-sm ml-2">× ${item.quantity}</span>
                    ${item.description ? `<span class="text-gray-500 text-sm ml-2">- ${item.description}</span>` : ''}
                </div>
            </div>
            <button type="button" class="text-red-400 hover:text-red-300 px-2" onclick="BPERP.sales.removeLineItem(${idx})">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');
}

export function removeLineItem(index) {
    newWOLineItems.splice(index, 1);
    renderLineItemsList();
}

// ==================== EDIT CUSTOMER MODAL ====================
function showEditCustomerModal(customerId) {
    const customers = getCustomers();
    const customer = customers.find(c => c.id === parseInt(customerId));
    if (!customer) {
        showToast('Customer not found', 'error');
        return;
    }
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2" style="color: var(--color-accent-primary);"></i>Edit Customer
                </h3>
                <button onclick="BPERP.common.closeModal('editCustomerModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="editCustomerForm" class="space-y-4">
                <input type="hidden" name="id" value="${customer.id}">
                <div>
                    <label class="form-label">Company Name *</label>
                    <input type="text" name="companyName" required class="form-input w-full" value="${customer.companyName || ''}">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Contact Name</label>
                        <input type="text" name="contactName" class="form-input w-full" value="${customer.contactName || ''}">
                    </div>
                    <div>
                        <label class="form-label">Phone</label>
                        <input type="tel" name="phone" class="form-input w-full" value="${customer.phone || ''}">
                    </div>
                </div>
                <div>
                    <label class="form-label">Email</label>
                    <input type="email" name="email" class="form-input w-full" value="${customer.email || ''}">
                </div>
                <div>
                    <label class="form-label">Address</label>
                    <textarea name="address" class="form-input w-full" rows="2">${customer.address || ''}</textarea>
                </div>
                <div>
                    <label class="form-label">Terms</label>
                    <select name="terms" class="form-input w-full">
                        <option value="NET 30" ${customer.terms === 'NET 30' ? 'selected' : ''}>NET 30</option>
                        <option value="NET 15" ${customer.terms === 'NET 15' ? 'selected' : ''}>NET 15</option>
                        <option value="NET 45" ${customer.terms === 'NET 45' ? 'selected' : ''}>NET 45</option>
                        <option value="NET 60" ${customer.terms === 'NET 60' ? 'selected' : ''}>NET 60</option>
                        <option value="COD" ${customer.terms === 'COD' ? 'selected' : ''}>COD</option>
                    </select>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('editCustomerModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn btn-primary flex-1">
                        <i class="fa-solid fa-save mr-2"></i>Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('editCustomerModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('editCustomerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = parseInt(formData.get('id'));
        
        const index = customers.findIndex(c => c.id === id);
        if (index !== -1) {
            customers[index] = {
                ...customers[index],
                companyName: formData.get('companyName'),
                contactName: formData.get('contactName'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                address: formData.get('address'),
                terms: formData.get('terms'),
                updatedAt: new Date().toISOString()
            };
            storage.set(STORAGE_KEYS.CUSTOMERS, customers);
            closeModal('editCustomerModal');
            showToast('Customer updated successfully!', 'success');
            loadCustomersView();
        }
    });
}

// ==================== DELETE CUSTOMER ====================
function deleteCustomer(customerId, customerName) {
    showDeleteConfirm(customerName, 'customer', customerId, () => {
        const customers = getCustomers();
        const filtered = customers.filter(c => c.id !== parseInt(customerId));
        storage.set(STORAGE_KEYS.CUSTOMERS, filtered);
        showToast(`Customer "${customerName}" deleted`, 'success');
        loadCustomersView();
    });
}

// ==================== EXPORT FUNCTIONS ====================
async function exportCustomers() {
    await exportToCSV(null, 'customers', null, '/export/customers');
}

async function exportQuotes() {
    await exportToCSV(null, 'quotes', null, '/export/quotes');
}

async function exportWorkOrders() {
    await exportToCSV(null, 'work-orders', null, '/export/work-orders');
}

async function exportArchivedWork() {
    const allWorkOrders = getWorkOrders();
    const archivedWOs = allWorkOrders.filter(wo => wo.completionPercentage === 100 || wo.status === 'Completed');
    const archivedStorage = storage.get(STORAGE_KEYS.ARCHIVED_WORK_ORDERS) || [];
    const allArchived = [...archivedWOs, ...archivedStorage];
    const headers = ['id', 'woNumber', 'customerId', 'customerName', 'dueDate', 'status', 'notes', 'completionPercentage', 'lineItems', 'completedAt'];

    // For archived work orders, we still use client-side export since it's a mix of DB and localStorage data
    await exportToCSV(allArchived, 'archived-work-orders', headers);
}

async function exportArchivedQuotes() {
    const allQuotes = getQuotes();
    const archivedQuotes = allQuotes.filter(q => q.status === 'Lost');
    const headers = ['id', 'quoteNumber', 'customerId', 'customerName', 'partNumber', 'description', 'quantity', 'status', 'requestedDate', 'dueDate', 'totalPrice', 'sentAt'];

    // For archived quotes, we still use client-side export since it's filtered from localStorage
    await exportToCSV(archivedQuotes, 'archived-quotes', headers);
}

function reopenQuote(quoteId) {
    const quotes = getQuotes();
    const index = quotes.findIndex(q => q.id === parseInt(quoteId));
    if (index !== -1) {
        quotes[index].status = 'In Progress';
        quotes[index].updatedAt = new Date().toISOString();
        storage.set(STORAGE_KEYS.QUOTES, quotes);
        showToast(`Quote ${quotes[index].quoteNumber} reopened`, 'success');
        loadArchivedQuotesView();
    }
}

function deleteQuote(quoteId, quoteName) {
    showDeleteConfirm(quoteName, 'quote', quoteId, () => {
        const quotes = getQuotes();
        const filtered = quotes.filter(q => q.id !== parseInt(quoteId));
        storage.set(STORAGE_KEYS.QUOTES, filtered);
        showToast(`Quote "${quoteName}" deleted`, 'success');
        
        // Refresh the current view
        if (salesState.currentView === 'archived-quotes') {
            loadArchivedQuotesView();
        } else {
            loadQuotesView();
        }
    });
}

function viewArchivedWorkOrder(woId) {
    const allWorkOrders = getWorkOrders();
    const archivedStorage = storage.get(STORAGE_KEYS.ARCHIVED_WORK_ORDERS) || [];
    const allWOs = [...allWorkOrders, ...archivedStorage];
    const wo = allWOs.find(w => w.id === parseInt(woId));
    
    if (!wo) {
        showToast('Work order not found', 'error');
        return;
    }
    
    const checklist = wo.checklist || getDefaultChecklist(wo.id);
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-clipboard-list mr-2" style="color: var(--color-accent-primary);"></i>${wo.woNumber}
                </h3>
                <button onclick="BPERP.common.closeModal('viewWOModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-xs" style="color: var(--color-text-muted);">Customer</label>
                        <p class="text-white">${wo.customerName}</p>
                    </div>
                    <div>
                        <label class="text-xs" style="color: var(--color-text-muted);">Part Number</label>
                        <p class="text-white">${wo.partNumber}</p>
                    </div>
                    <div>
                        <label class="text-xs" style="color: var(--color-text-muted);">Quantity</label>
                        <p class="text-white">${wo.quantity}</p>
                    </div>
                    <div>
                        <label class="text-xs" style="color: var(--color-text-muted);">Due Date</label>
                        <p class="text-white">${formatDate(wo.dueDate)}</p>
                    </div>
                </div>
                <div>
                    <label class="text-xs" style="color: var(--color-text-muted);">Status</label>
                    <p><span class="badge bg-green-600 text-green-100">Completed</span></p>
                </div>
                <div>
                    <label class="text-xs mb-2 block" style="color: var(--color-text-muted);">Workflow History</label>
                    <div class="space-y-1">
                        ${checklist.map(item => `
                            <div class="flex items-center gap-2 p-2 rounded bg-green-500/10">
                                <i class="fa-solid fa-check text-green-400"></i>
                                <span class="text-sm text-green-400">${item.stepName}</span>
                                <span class="text-xs ml-auto" style="color: var(--color-text-muted);">
                                    ${item.completedAt ? formatDate(item.completedAt) : '-'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="mt-6">
                <button onclick="BPERP.common.closeModal('viewWOModal')" class="btn btn-secondary w-full">Close</button>
            </div>
        </div>
    `;
    
    createModal('viewWOModal', content, { width: 'w-full max-w-lg' });
}

// ==================== EDIT QUOTE MODAL ====================
function showEditQuoteModal(quoteId) {
    const quotes = getQuotes();
    const quote = quotes.find(q => q.id === parseInt(quoteId));
    if (!quote) {
        showToast('Quote not found', 'error');
        return;
    }
    
    const customers = getCustomers();
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2" style="color: var(--color-accent-primary);"></i>Edit Quote ${quote.quoteNumber}
                </h3>
                <button onclick="BPERP.common.closeModal('editQuoteModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="editQuoteForm" class="space-y-4">
                <input type="hidden" name="id" value="${quote.id}">
                <div>
                    <label class="form-label">Customer *</label>
                    <select name="customerId" required class="form-input w-full">
                        ${customers.map(c => `<option value="${c.id}" ${c.id === quote.customerId ? 'selected' : ''}>${c.companyName}</option>`).join('')}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Part Number *</label>
                        <input type="text" name="partNumber" required class="form-input w-full" value="${quote.partNumber || ''}">
                    </div>
                    <div>
                        <label class="form-label">Quantity *</label>
                        <input type="number" name="quantity" required min="1" class="form-input w-full" value="${quote.quantity || ''}">
                    </div>
                </div>
                <div>
                    <label class="form-label">Description</label>
                    <textarea name="description" class="form-input w-full" rows="2">${quote.description || ''}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Material</label>
                        <input type="text" name="material" class="form-input w-full" value="${quote.material || ''}">
                    </div>
                    <div>
                        <label class="form-label">Due Date</label>
                        <input type="date" name="dueDate" class="form-input w-full" value="${quote.dueDate || ''}">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Unit Price</label>
                        <input type="number" name="unitPrice" step="0.01" class="form-input w-full" value="${quote.unitPrice || ''}">
                    </div>
                    <div>
                        <label class="form-label">Status</label>
                        <select name="status" class="form-input w-full">
                            <option value="New" ${quote.status === 'New' ? 'selected' : ''}>New</option>
                            <option value="In Progress" ${quote.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Sent" ${quote.status === 'Sent' ? 'selected' : ''}>Sent</option>
                            <option value="Won" ${quote.status === 'Won' ? 'selected' : ''}>Won</option>
                            <option value="Lost" ${quote.status === 'Lost' ? 'selected' : ''}>Lost</option>
                        </select>
                    </div>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('editQuoteModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn btn-primary flex-1">
                        <i class="fa-solid fa-save mr-2"></i>Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('editQuoteModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('editQuoteForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = parseInt(formData.get('id'));
        const customerId = parseInt(formData.get('customerId'));
        const customer = customers.find(c => c.id === customerId);
        
        const index = quotes.findIndex(q => q.id === id);
        if (index !== -1) {
            quotes[index] = {
                ...quotes[index],
                customerId: customerId,
                customerName: customer?.companyName || 'Unknown',
                partNumber: formData.get('partNumber'),
                quantity: parseInt(formData.get('quantity')),
                description: formData.get('description'),
                material: formData.get('material'),
                dueDate: formData.get('dueDate'),
                unitPrice: parseFloat(formData.get('unitPrice')) || 0,
                status: formData.get('status'),
                updatedAt: new Date().toISOString()
            };
            storage.set(STORAGE_KEYS.QUOTES, quotes);
            closeModal('editQuoteModal');
            showToast('Quote updated successfully!', 'success');
            loadQuotesView();
        }
    });
}

// ==================== CONVERT QUOTE TO WORK ORDER ====================
function convertQuoteToWorkOrder(quoteId) {
    const quotes = getQuotes();
    const quote = quotes.find(q => q.id === parseInt(quoteId));
    if (!quote) {
        showToast('Quote not found', 'error');
        return;
    }
    
    // Create a work order from the quote
    const workOrder = {
        id: Date.now(),
        woNumber: 'WO-' + Date.now().toString().slice(-6),
        customerId: quote.customerId,
        customerName: quote.customerName,
        partNumber: quote.partNumber,
        quantity: quote.quantity,
        description: quote.description,
        dueDate: quote.dueDate,
        priority: 'Normal',
        notes: `Converted from Quote ${quote.quoteNumber}`,
        status: 'Open',
        completionPercentage: 0,
        checklist: getDefaultChecklist(),
        createdAt: new Date().toISOString()
    };
    
    const workOrders = getWorkOrders();
    workOrders.push(workOrder);
    storage.set(STORAGE_KEYS.WORK_ORDERS, workOrders);
    
    // Update quote status to Won
    const index = quotes.findIndex(q => q.id === parseInt(quoteId));
    if (index !== -1) {
        quotes[index].status = 'Won';
        quotes[index].updatedAt = new Date().toISOString();
        storage.set(STORAGE_KEYS.QUOTES, quotes);
    }
    
    showToast(`Quote ${quote.quoteNumber} converted to Work Order ${workOrder.woNumber}!`, 'success');
    loadQuotesView();
}

export function registerActionHandlers(registerFn) {
    registerFn('toggle-customer', (target) => toggleCustomerExpand(target.dataset.id));
    registerFn('toggle-wo', (target) => toggleWOExpand(target.dataset.id));
    registerFn('refresh-wip', () => loadWIPView());
    registerFn('add-customer', () => showAddCustomerModal());
    registerFn('edit-customer', (target) => showEditCustomerModal(target.dataset.id));
    registerFn('delete-customer', (target) => deleteCustomer(target.dataset.id, target.dataset.name));
    registerFn('add-quote', () => showAddQuoteModal());
    registerFn('edit-quote', (target) => showEditQuoteModal(target.dataset.id));
    registerFn('convert-quote', (target) => convertQuoteToWorkOrder(target.dataset.id));
    registerFn('add-wo', () => showAddWorkOrderModal());
    registerFn('export-customers', () => exportCustomers());
    registerFn('export-quotes', () => exportQuotes());
    registerFn('export-work-orders', () => exportWorkOrders());
    registerFn('export-archived', () => exportArchivedWork());
    registerFn('view-archived-wo', (target) => viewArchivedWorkOrder(target.dataset.id));
    registerFn('export-archived-quotes', () => exportArchivedQuotes());
    registerFn('reopen-quote', (target) => reopenQuote(target.dataset.id));
    registerFn('delete-quote', (target) => deleteQuote(target.dataset.id, target.dataset.name));
    
    // Line item actions
    registerFn('toggle-line-item', (target) => {
        toggleLineItemExpand(target.dataset.woId, target.dataset.itemId);
    });
    registerFn('add-line-item', (target) => {
        showAddLineItemModal(target.dataset.woId);
    });
    registerFn('save-line-item', () => {
        const form = document.getElementById('addLineItemForm');
        if (form) {
            const woId = form.querySelector('[name="woId"]').value;
            saveLineItem(woId);
        }
    });
    
    // Step completion with line item support
    registerFn('complete-step', (target) => {
        const woId = parseInt(target.dataset.woId);
        const stepId = parseInt(target.dataset.stepId);
        const itemId = target.dataset.itemId ? parseInt(target.dataset.itemId) : null;
        
        const result = updateChecklistStep(
            woId, 
            stepId, 
            { isCompleted: true, completedAt: new Date().toISOString(), completedByName: 'Current User' },
            itemId
        );
        if (result) {
            showToast(`Step "${target.dataset.stepName}" completed!`, 'success');
            loadWIPView();
        }
    });
}

// ==================== AUTO-REFRESH ====================
export function enableAutoRefresh() {
    masterTimer.register('wip-refresh', () => {
        // Only refresh if we're on a sales view
        if (salesState.currentView === 'wip') {
            loadWIPView();
        } else if (salesState.currentView === 'customers') {
            loadCustomersView();
        } else if (salesState.currentView === 'quotes') {
            loadQuotesView();
        }
    }, 300); // 5 minutes
}

// ==================== DEACTIVATION ====================
export function deactivate() {
    // Mark sales module as inactive to prevent auto-refresh
    salesState.currentView = '';
}

// ==================== INITIALIZATION ====================
export function init() {
    enableAutoRefresh();
    
    if (window.BPERP?.common?.registerActionHandler) {
        registerActionHandlers(window.BPERP.common.registerActionHandler);
    }
}
