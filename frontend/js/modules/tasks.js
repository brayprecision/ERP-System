/**
 * BPERP Dashboard - Tasks Module
 * Unified workflow task management integrated with WIP
 */

import { 
    debounce, showToast, showLoadingSpinner,
    formatDate, DOMCache, createModal, closeModal,
    getStatusBadgeClass, getUrgencyColor, safeExecute, masterTimer
} from './common.js';
import { storage, STORAGE_KEYS, state } from './storage.js';
import { getWorkOrders, getNextWorkflowStep, updateChecklistStep, getWOUrgencyColor, getLineItemsByWorkflowStep, getNextWorkflowStepForLineItem } from './sales.js';

// ==================== WORKFLOW STEP CONFIGURATION ====================
const WORKFLOW_STEPS = {
    material_ordered: { stepName: 'Material Ordered', icon: 'fa-shopping-cart', color: 'text-blue-400', tab: 'ordering' },
    tooling_ordered: { stepName: 'Tooling Ordered', icon: 'fa-tools', color: 'text-blue-400', tab: 'ordering' },
    part_programmed: { stepName: 'Part Programmed', icon: 'fa-code', color: 'text-pink-400', tab: 'programming' },
    material_received: { stepName: 'Material Received', icon: 'fa-box', color: 'text-cyan-400', tab: 'ordering' },
    tooling_received: { stepName: 'Tooling Received', icon: 'fa-wrench', color: 'text-cyan-400', tab: 'ordering' },
    material_processed: { stepName: 'Material Sawn/Processed', icon: 'fa-cut', color: 'text-yellow-400', tab: 'processing' },
    machining_complete: { stepName: 'Machining Complete', icon: 'fa-cogs', color: 'text-purple-400', tab: 'machining' },
    post_processing: { stepName: 'Post Processing Complete', icon: 'fa-industry', color: 'text-orange-400', tab: 'postprocessing' },
    inspection_complete: { stepName: 'Inspection Complete', icon: 'fa-search-plus', color: 'text-cyan-400', tab: 'inspection' },
    ready_for_shipment: { stepName: 'Ready For Shipment', icon: 'fa-truck', color: 'text-green-400', tab: 'shipping' }
};

// Task type config for display
const TASK_TYPE_CONFIG = {
    ordering: { icon: 'fa-shopping-cart', label: 'Ordering', color: 'text-blue-400' },
    programming: { icon: 'fa-code', label: 'Programming', color: 'text-pink-400' },
    processing: { icon: 'fa-cut', label: 'Processing', color: 'text-yellow-400' },
    machining: { icon: 'fa-cogs', label: 'Machining', color: 'text-purple-400' },
    postprocessing: { icon: 'fa-industry', label: 'Post Processing', color: 'text-orange-400' },
    inspection: { icon: 'fa-search-plus', label: 'Inspection', color: 'text-cyan-400' },
    shipping: { icon: 'fa-truck', label: 'Shipping', color: 'text-green-400' },
    maintenance: { icon: 'fa-wrench', label: 'Maintenance', color: 'text-red-400' },
    misc: { icon: 'fa-tasks', label: 'Misc', color: 'text-gray-400' }
};

// ==================== STATE ====================
let tasksState = {
    currentView: 'all',
    workOrders: [],
    isActive: false  // Track if tasks module is currently active
};

// ==================== WORKFLOW HELPERS ====================
// Filter work order line items by workflow step (returns flat list of items)
function filterLineItemsByStep(workOrders, stepKeys) {
    const keysArray = Array.isArray(stepKeys) ? stepKeys : [stepKeys];
    const results = [];
    
    workOrders.forEach(wo => {
        // Handle multi-part work orders
        if (wo.lineItems && wo.lineItems.length > 0) {
            wo.lineItems.forEach(item => {
                const checklist = item.checklist || [];
                const nextStep = checklist.find(step => !step.isCompleted);
                
                if (nextStep && keysArray.includes(nextStep.stepKey)) {
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
                        completionPercentage: item.completionPercentage || 0,
                        currentStep: nextStep,
                        checklist: checklist
                    });
                }
            });
        } else {
            // Legacy single-part format
            const nextStep = getNextWorkflowStep(wo);
            if (nextStep && keysArray.includes(nextStep.stepKey)) {
                results.push({
                    woId: wo.id,
                    woNumber: wo.woNumber,
                    customerId: wo.customerId,
                    customerName: wo.customerName,
                    dueDate: wo.dueDate,
                    lineItemId: null,
                    partNumber: wo.partNumber || 'N/A',
                    description: wo.description || '',
                    quantity: wo.quantity || 0,
                    material: wo.material || '',
                    completionPercentage: wo.completionPercentage || 0,
                    currentStep: nextStep,
                    checklist: wo.checklist || []
                });
            }
        }
    });
    
    // Sort by due date (most urgent first)
    return results.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

// Legacy function for backward compatibility
function filterWorkOrdersByStep(workOrders, stepKeys) {
    const keysArray = Array.isArray(stepKeys) ? stepKeys : [stepKeys];
    return workOrders.filter(wo => {
        const nextStep = getNextWorkflowStep(wo);
        return nextStep && keysArray.includes(nextStep.stepKey);
    });
}

function getTaskTypeFromStep(stepKey) {
    const stepMapping = {
        'material_ordered': 'ordering',
        'tooling_ordered': 'ordering',
        'material_received': 'ordering',
        'tooling_received': 'ordering',
        'part_programmed': 'programming',
        'material_processed': 'processing',
        'machining_complete': 'machining',
        'post_processing': 'postprocessing',
        'inspection_complete': 'inspection',
        'ready_for_shipment': 'shipping'
    };
    return stepMapping[stepKey] || 'misc';
}

function getWOWorkflowStatus(wo) {
    const nextStep = getNextWorkflowStep(wo);
    if (!nextStep) return 'Complete';
    if (nextStep.hasIssue) return 'Issue';
    if (nextStep.startedAt) return 'In Progress';
    return 'Not Started';
}

// ==================== CONFIRMATION MODAL ====================
export function showWorkflowConfirmModal(woId, stepId, stepName, action, callback) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    
    if (!wo) {
        showToast('Work order not found', 'error');
        return;
    }
    
    const actionConfig = {
        start: { title: 'Start Step', buttonClass: 'bg-blue-600 hover:bg-blue-700', buttonText: 'Start' },
        complete: { title: 'Complete Step', buttonClass: 'bg-green-600 hover:bg-green-700', buttonText: 'Mark Complete' },
        report_issue: { title: 'Report Issue', buttonClass: 'bg-red-600 hover:bg-red-700', buttonText: 'Report Issue' }
    };
    const config = actionConfig[action] || actionConfig.complete;
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium"><i class="fa-solid fa-clipboard-check mr-2 text-accentGreen"></i>${config.title}</h3>
                <button onclick="BPERP.common.closeModal('workflowConfirmModal')" class="text-gray-400 hover:text-white"><i class="fa-solid fa-times"></i></button>
            </div>
            
            <div class="bg-gray-800 p-4 rounded mb-4">
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Work Order:</span>
                    <span class="text-white font-medium">${wo.woNumber}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span class="text-gray-400">Part Number:</span>
                    <span class="text-white">${wo.partNumber}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Step:</span>
                    <span class="text-accentGreen font-medium">${stepName}</span>
                </div>
            </div>
            
            <div class="mb-4">
                <label class="block text-sm text-gray-400 mb-1">Notes (optional)</label>
                <textarea id="workflowNotes" rows="2" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600" placeholder="Add notes..."></textarea>
            </div>
            
            ${action === 'complete' ? `
                <div class="mb-4">
                    <label class="block text-sm text-gray-400 mb-1">Reference # (PO, Lot#, etc)</label>
                    <input type="text" id="workflowRefNumber" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
            ` : ''}
            
            <div class="flex space-x-3 pt-2">
                <button onclick="BPERP.common.closeModal('workflowConfirmModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                <button id="workflowConfirmBtn" class="flex-1 ${config.buttonClass} text-white px-4 py-2 rounded">${config.buttonText}</button>
            </div>
        </div>
    `;
    
    createModal('workflowConfirmModal', content);
    
    document.getElementById('workflowConfirmBtn').addEventListener('click', () => {
        const notes = document.getElementById('workflowNotes')?.value || '';
        const refNumber = document.getElementById('workflowRefNumber')?.value || '';
        
        executeWorkflowAction(woId, stepId, stepName, action, notes, refNumber);
        closeModal('workflowConfirmModal');
        
        if (callback && typeof callback === 'function') {
            callback();
        }
    });
}

function executeWorkflowAction(woId, stepId, stepName, action, notes, refNumber) {
    const updates = {
        notes,
        referenceNumber: refNumber
    };
    
    if (action === 'complete') {
        updates.isCompleted = true;
        updates.completedAt = new Date().toISOString();
        updates.completedByName = 'Current User';
        showToast(`Step "${stepName}" completed!`, 'success');
    } else if (action === 'start') {
        updates.startedAt = new Date().toISOString();
        updates.startedByName = 'Current User';
        showToast(`Step "${stepName}" started!`, 'success');
    } else if (action === 'report_issue') {
        updates.hasIssue = true;
        updates.issueNotes = notes;
        updates.issueReportedAt = new Date().toISOString();
        showToast(`Issue reported for "${stepName}"`, 'warning');
    }
    
    updateChecklistStep(woId, stepId, updates);
}

// ==================== UNIFIED WORKFLOW VIEW RENDERER ====================
// Updated to track individual parts/line items through workflow
function renderWorkflowView(workOrders, stepKeys, stepName, tabIcon, tabColor) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    const keysArray = Array.isArray(stepKeys) ? stepKeys : [stepKeys];
    
    // Filter to get individual line items at this step
    const relevantItems = filterLineItemsByStep(workOrders, keysArray);
    
    // Group by urgency
    const overdue = relevantItems.filter(item => getWOUrgencyColor(item.dueDate) === 'red');
    const dueSoon = relevantItems.filter(item => getWOUrgencyColor(item.dueDate) === 'yellow');
    const onSchedule = relevantItems.filter(item => ['green', 'gray'].includes(getWOUrgencyColor(item.dueDate)));
    
    // Render a card for each line item (part)
    const renderPartCard = (item) => {
        const urgency = getWOUrgencyColor(item.dueDate);
        const borderColor = urgency === 'red' ? 'border-red-600' : urgency === 'yellow' ? 'border-yellow-600' : 'border-gray-700';
        
        const step = item.currentStep;
        const isStarted = step.startedAt ? true : false;
        const hasIssue = step.hasIssue || false;
        
        // Data attributes for action buttons
        const dataAttrs = `data-wo-id="${item.woId}" data-step-id="${step.id}" data-step-name="${step.stepName}" data-item-id="${item.lineItemId || ''}"`;
        
        return `
            <div class="card p-4 border-l-4 ${borderColor}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-bold text-sm" style="color: var(--color-accent-primary);">${item.woNumber}</span>
                        ${hasIssue ? '<span class="text-red-400 ml-2"><i class="fa-solid fa-exclamation-triangle"></i></span>' : ''}
                    </div>
                    <span class="text-xs" style="color: var(--color-${urgency === 'red' ? 'error' : urgency === 'yellow' ? 'warning' : 'success'});">
                        ${formatDate(item.dueDate)}
                    </span>
                </div>
                
                <!-- Part Number & Details -->
                <div class="bg-gray-800/50 rounded p-2 mb-2">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-semibold text-white">${item.partNumber}</span>
                        ${item.description ? `<span class="text-xs text-gray-400">- ${item.description}</span>` : ''}
                    </div>
                    <div class="text-xs grid grid-cols-2 gap-1" style="color: var(--color-text-muted);">
                        <span><i class="fa-solid fa-cube mr-1"></i>Qty: ${item.quantity}</span>
                        ${item.material ? `<span><i class="fa-solid fa-layer-group mr-1"></i>${item.material}</span>` : ''}
                    </div>
                </div>
                
                <div class="text-sm mb-2" style="color: var(--color-text-muted);">
                    <i class="fa-solid fa-building mr-1"></i>${item.customerName}
                </div>
                
                <!-- Progress bar -->
                <div class="mb-3">
                    <div class="flex justify-between text-xs mb-1">
                        <span style="color: var(--color-text-muted);">Part Progress</span>
                        <span style="color: var(--color-accent-secondary);">${item.completionPercentage}%</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-1.5">
                        <div class="h-1.5 rounded-full transition-all" 
                             style="width: ${item.completionPercentage}%; background: var(--color-accent-secondary);"></div>
                    </div>
                </div>
                
                <div class="text-xs mb-3" style="color: var(--color-text-muted);">
                    <i class="fa-solid ${WORKFLOW_STEPS[step.stepKey]?.icon || 'fa-circle'} mr-1"></i>
                    Current: <span class="text-white">${step.stepName}</span>
                    ${hasIssue ? '<span class="text-red-400 ml-2"><i class="fa-solid fa-exclamation-triangle"></i> Issue</span>' : ''}
                </div>
                
                <div class="flex gap-2">
                    ${!isStarted ? `
                        <button data-action="workflow-begin" ${dataAttrs}
                            class="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 flex-1">
                            <i class="fa-solid fa-play mr-1"></i>Begin Process
                        </button>
                    ` : `
                        <button data-action="workflow-complete" ${dataAttrs}
                            class="bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 flex-1">
                            <i class="fa-solid fa-check mr-1"></i>Complete Process
                        </button>
                    `}
                    <button data-action="workflow-issue" ${dataAttrs}
                        class="bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700">
                        <i class="fa-solid fa-exclamation-triangle mr-1"></i>Issue
                    </button>
                </div>
            </div>
        `;
    };
    
    const renderSection = (title, items, colorClass) => {
        if (items.length === 0) return '';
        return `
            <div class="mb-6">
                <h4 class="${colorClass} text-sm font-medium mb-3"><i class="fa-solid fa-circle mr-2"></i>${title} (${items.length} parts)</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${items.map(renderPartCard).join('')}
                </div>
            </div>
        `;
    };
    
    container.innerHTML = `
        <div class="col-span-3">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-gray-400 text-sm font-medium">
                    <i class="fa-solid ${tabIcon} mr-2 ${tabColor}"></i>${stepName}
                    <span class="text-xs text-gray-500">(${relevantItems.length} parts at this step)</span>
                </h3>
                <button data-action="refresh-tasks" class="text-gray-400 hover:text-white text-sm">
                    <i class="fa-solid fa-refresh mr-1"></i>Refresh
                </button>
            </div>
            
            <div class="flex gap-4 mb-4 text-xs">
                <span><i class="fa-solid fa-circle text-green-500 mr-1"></i>On Schedule</span>
                <span><i class="fa-solid fa-circle text-yellow-500 mr-1"></i>Due Within 3 Days</span>
                <span><i class="fa-solid fa-circle text-red-500 mr-1"></i>Overdue</span>
            </div>
            
            ${renderSection('Overdue', overdue, 'text-red-400')}
            ${renderSection('Due Soon', dueSoon, 'text-yellow-400')}
            ${renderSection('On Schedule', onSchedule, 'text-green-400')}
            
            ${relevantItems.length === 0 ? `
                <div class="card p-8 text-center">
                    <i class="fa-solid fa-check-circle text-4xl text-green-500 mb-4"></i>
                    <p class="text-gray-400">No work orders at this workflow stage</p>
                </div>
            ` : ''}
        </div>
    `;
}

function getCurrentRefreshFn() {
    const fnMap = {
        'all': 'loadAllTasks',
        'ordering': 'loadOrderingTasks',
        'programming': 'loadProgrammingTasks',
        'processing': 'loadProcessingTasks',
        'machining': 'loadMachiningTasks',
        'postprocessing': 'loadPostProcessingTasks',
        'inspection': 'loadInspectionTasks',
        'shipping': 'loadShippingReceivingTasks'
    };
    return fnMap[tasksState.currentView] || 'loadAllTasks';
}

// ==================== VIEW FUNCTIONS ====================
export function loadAllTasks() {
    tasksState.currentView = 'all';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        tasksState.workOrders = workOrders;
        renderAllTasksView(workOrders);
    }, () => {
        showToast('Error loading tasks', 'error');
    }, 'loadAllTasks');
}

function renderAllTasksView(workOrders) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    const activeWOs = workOrders.filter(wo => wo.completionPercentage < 100);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24*60*60*1000);
    
    const stats = {
        totalOpen: activeWOs.length,
        overdue: activeWOs.filter(wo => getWOUrgencyColor(wo.dueDate) === 'red').length,
        dueToday: activeWOs.filter(wo => {
            const due = new Date(wo.dueDate);
            return due >= today && due < tomorrow;
        }).length,
        completed: workOrders.filter(wo => wo.completionPercentage === 100).length
    };
    
    const taskRows = activeWOs.map(wo => {
        const nextStep = getNextWorkflowStep(wo);
        if (!nextStep) return '';
        
        const taskType = getTaskTypeFromStep(nextStep.stepKey);
        const typeConfig = TASK_TYPE_CONFIG[taskType] || TASK_TYPE_CONFIG.misc;
        const status = getWOWorkflowStatus(wo);
        const urgency = getWOUrgencyColor(wo.dueDate);
        const urgencyClass = urgency === 'red' ? 'text-red-500 font-bold' : urgency === 'yellow' ? 'text-yellow-500' : 'text-gray-400';
        
        return `
            <tr class="border-b border-gray-700 hover:bg-gray-800">
                <td class="px-4 py-3">
                    <span class="${typeConfig.color}">
                        <i class="fa-solid ${typeConfig.icon} mr-2"></i>${typeConfig.label}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <div class="font-medium">${wo.woNumber}</div>
                    <div class="text-xs text-gray-500">${wo.partNumber} - ${nextStep.stepName}</div>
                </td>
                <td class="px-4 py-3 text-gray-300">${wo.customerName || '-'}</td>
                <td class="px-4 py-3 ${urgencyClass}">${formatDate(wo.dueDate)}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(status)}">${status}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="w-20 bg-gray-700 rounded-full h-2">
                        <div class="bg-accentGreen h-2 rounded-full" style="width: ${wo.completionPercentage}%"></div>
                    </div>
                    <span class="text-xs text-gray-400">${wo.completionPercentage}%</span>
                </td>
                <td class="px-4 py-3">
                    <div class="flex space-x-2">
                        <button data-action="workflow-complete" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="${nextStep.stepName}" 
                            class="text-green-500 hover:text-green-400" title="Complete Step">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button data-action="workflow-start" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="${nextStep.stepName}" 
                            class="text-blue-500 hover:text-blue-400" title="Start Step">
                            <i class="fa-solid fa-play"></i>
                        </button>
                        <button data-action="workflow-issue" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="${nextStep.stepName}" 
                            class="text-red-500 hover:text-red-400" title="Report Issue">
                            <i class="fa-solid fa-exclamation-triangle"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="col-span-3">
            <div class="grid grid-cols-4 gap-4 mb-6">
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Total Open</p>
                    <p class="text-2xl font-bold text-white">${stats.totalOpen}</p>
                </div>
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Overdue</p>
                    <p class="text-2xl font-bold text-red-500">${stats.overdue}</p>
                </div>
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Due Today</p>
                    <p class="text-2xl font-bold text-orange-500">${stats.dueToday}</p>
                </div>
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Completed</p>
                    <p class="text-2xl font-bold text-green-500">${stats.completed}</p>
                </div>
            </div>
            
            <div class="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4 text-sm text-blue-300">
                <i class="fa-solid fa-info-circle mr-2"></i>
                Tasks are derived from Work In Progress checklists.
            </div>
            
            <div class="card p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-gray-400 text-sm font-medium">
                        <i class="fa-solid fa-clipboard-check mr-2"></i>All Workflow Tasks
                    </h3>
                    <div class="flex space-x-2">
                        <button data-action="refresh-tasks" class="text-gray-400 hover:text-white text-sm">
                            <i class="fa-solid fa-refresh mr-1"></i>Refresh
                        </button>
                        <button data-action="create-misc-task" class="bg-accentGreen text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                            <i class="fa-solid fa-plus mr-1"></i>Misc Task
                        </button>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="table w-full text-sm text-left">
                        <thead>
                            <tr>
                                <th class="px-4 py-3">Type</th>
                                <th class="px-4 py-3">Work Order / Step</th>
                                <th class="px-4 py-3">Customer</th>
                                <th class="px-4 py-3">Due Date</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3">Progress</th>
                                <th class="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${taskRows || '<tr><td colspan="7" class="text-center py-8" style="color: var(--color-text-muted);">No active work orders</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ==================== WORKFLOW TAB FUNCTIONS ====================
export function loadOrderingTasks() {
    tasksState.currentView = 'ordering';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderOrderingView(workOrders);
    }, null, 'loadOrderingTasks');
}

// ==================== SPECIALIZED ORDERING VIEW ====================
function renderOrderingView(workOrders) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    // Filter WOs that need material or tooling ordered
    const orderingSteps = ['material_ordered', 'tooling_ordered', 'material_received', 'tooling_received'];
    const relevantWOs = filterWorkOrdersByStep(workOrders, orderingSteps);
    
    // Group by urgency
    const overdue = relevantWOs.filter(wo => getWOUrgencyColor(wo.dueDate) === 'red');
    const dueSoon = relevantWOs.filter(wo => getWOUrgencyColor(wo.dueDate) === 'yellow');
    const onSchedule = relevantWOs.filter(wo => ['green', 'gray'].includes(getWOUrgencyColor(wo.dueDate)));
    
    const renderOrderingCard = (wo) => {
        const nextStep = getNextWorkflowStep(wo);
        const urgency = getWOUrgencyColor(wo.dueDate);
        const borderColor = urgency === 'red' ? 'border-red-600' : urgency === 'yellow' ? 'border-yellow-600' : 'border-gray-700';
        
        // Check which ordering steps are complete
        const materialOrdered = wo.checklist?.find(s => s.stepKey === 'material_ordered')?.isCompleted || false;
        const toolingOrdered = wo.checklist?.find(s => s.stepKey === 'tooling_ordered')?.isCompleted || false;
        const materialStep = wo.checklist?.find(s => s.stepKey === 'material_ordered');
        const toolingStep = wo.checklist?.find(s => s.stepKey === 'tooling_ordered');
        
        // Check for issues
        const hasIssue = wo.checklist?.some(s => s.hasIssue) || false;
        
        return `
            <div class="card p-4 border-l-4 ${borderColor}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-medium text-white">${wo.woNumber}</span>
                        <span class="text-sm ml-2" style="color: var(--color-text-muted);">${wo.partNumber}</span>
                        ${hasIssue ? '<span class="text-red-400 ml-2"><i class="fa-solid fa-exclamation-triangle"></i></span>' : ''}
                    </div>
                    <span class="text-xs" style="color: var(--color-${urgency === 'red' ? 'error' : urgency === 'yellow' ? 'warning' : 'success'});">
                        ${formatDate(wo.dueDate)}
                    </span>
                </div>
                <div class="text-sm mb-2" style="color: var(--color-text-muted);">${wo.customerName} • Qty: ${wo.quantity}</div>
                <div class="text-xs mb-3" style="color: var(--color-text-muted);">
                    <i class="fa-solid ${WORKFLOW_STEPS[nextStep.stepKey]?.icon || 'fa-circle'} mr-1"></i>
                    Next: ${nextStep.stepName}
                </div>
                <div class="flex gap-2">
                    <button data-action="order-material" data-wo-id="${wo.id}" data-step-id="${materialStep?.id || 1}" 
                        class="${materialOrdered ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-2 py-1 rounded text-xs flex-1"
                        ${materialOrdered ? 'disabled' : ''}>
                        <i class="fa-solid fa-cube mr-1"></i>Material${materialOrdered ? ' ✓' : ''}
                    </button>
                    <button data-action="order-tooling" data-wo-id="${wo.id}" data-step-id="${toolingStep?.id || 2}" 
                        class="${toolingOrdered ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-2 py-1 rounded text-xs flex-1"
                        ${toolingOrdered ? 'disabled' : ''}>
                        <i class="fa-solid fa-tools mr-1"></i>Tooling${toolingOrdered ? ' ✓' : ''}
                    </button>
                    <button data-action="order-all" data-wo-id="${wo.id}" 
                        class="${materialOrdered && toolingOrdered ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} text-white px-2 py-1 rounded text-xs flex-1"
                        ${materialOrdered && toolingOrdered ? 'disabled' : ''}>
                        <i class="fa-solid fa-check-double mr-1"></i>All
                    </button>
                    <button data-action="workflow-issue" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="Ordering" 
                        class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">
                        <i class="fa-solid fa-exclamation-triangle"></i>
                    </button>
                </div>
            </div>
        `;
    };
    
    const renderSection = (title, items, colorClass) => {
        if (items.length === 0) return '';
        return `
            <div class="mb-6">
                <h4 class="${colorClass} text-sm font-medium mb-3"><i class="fa-solid fa-circle mr-2"></i>${title} (${items.length})</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${items.map(renderOrderingCard).join('')}
                </div>
            </div>
        `;
    };
    
    container.innerHTML = `
        <div class="col-span-3">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-medium" style="color: var(--color-accent-primary);">
                    <i class="fa-solid fa-shopping-cart mr-2"></i>Ordering Tasks
                    <span class="text-xs" style="color: var(--color-text-muted);">(${relevantWOs.length} work orders)</span>
                </h3>
                <button data-action="refresh-tasks" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                    <i class="fa-solid fa-refresh mr-1"></i>Refresh
                </button>
            </div>
            
            <div class="flex gap-4 mb-4 text-xs">
                <span><i class="fa-solid fa-circle text-green-500 mr-1"></i>On Schedule</span>
                <span><i class="fa-solid fa-circle text-yellow-500 mr-1"></i>Due Within 3 Days</span>
                <span><i class="fa-solid fa-circle text-red-500 mr-1"></i>Overdue</span>
            </div>
            
            ${renderSection('Overdue', overdue, 'text-red-400')}
            ${renderSection('Due Soon', dueSoon, 'text-yellow-400')}
            ${renderSection('On Schedule', onSchedule, 'text-green-400')}
            
            ${relevantWOs.length === 0 ? `
                <div class="card p-8 text-center">
                    <i class="fa-solid fa-check-circle text-4xl text-green-500 mb-4"></i>
                    <p style="color: var(--color-text-muted);">No work orders awaiting ordering</p>
                </div>
            ` : ''}
        </div>
    `;
}

export function loadProgrammingTasks() {
    tasksState.currentView = 'programming';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderWorkflowView(
            workOrders, 
            ['part_programmed'],
            'Programming Tasks',
            'fa-code',
            'text-pink-400'
        );
    }, null, 'loadProgrammingTasks');
}

export function loadProcessingTasks() {
    tasksState.currentView = 'processing';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderWorkflowView(
            workOrders, 
            ['material_processed'],
            'Material Processing Tasks',
            'fa-cut',
            'text-yellow-400'
        );
    }, null, 'loadProcessingTasks');
}

export function loadMachiningTasks() {
    tasksState.currentView = 'machining';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderWorkflowView(
            workOrders, 
            ['machining_complete'],
            'Machining Tasks',
            'fa-cogs',
            'text-purple-400'
        );
    }, null, 'loadMachiningTasks');
}

export function loadPostProcessingTasks() {
    tasksState.currentView = 'postprocessing';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderWorkflowView(
            workOrders, 
            ['post_processing'],
            'Post Processing Tasks',
            'fa-industry',
            'text-orange-400'
        );
    }, null, 'loadPostProcessingTasks');
}

export function loadInspectionTasks() {
    tasksState.currentView = 'inspection';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderWorkflowView(
            workOrders, 
            ['inspection_complete'],
            'Inspection Tasks',
            'fa-search-plus',
            'text-cyan-400'
        );
    }, null, 'loadInspectionTasks');
}

export function loadShippingReceivingTasks() {
    tasksState.currentView = 'shipping';
    tasksState.isActive = true;
    showLoadingSpinner();
    
    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderWorkflowView(
            workOrders, 
            ['ready_for_shipment'],
            'Shipping Tasks',
            'fa-truck',
            'text-green-400'
        );
    }, null, 'loadShippingReceivingTasks');
}

function refreshCurrentView() {
    const refreshFns = {
        'all': loadAllTasks,
        'ordering': loadOrderingTasks,
        'programming': loadProgrammingTasks,
        'processing': loadProcessingTasks,
        'machining': loadMachiningTasks,
        'postprocessing': loadPostProcessingTasks,
        'inspection': loadInspectionTasks,
        'shipping': loadShippingReceivingTasks
    };
    
    const fn = refreshFns[tasksState.currentView];
    if (fn) fn();
}

// ==================== ACTION HANDLERS ====================
export function registerActionHandlers(registerFn) {
    // Begin Process - marks step as started (supports line items)
    registerFn('workflow-begin', (target) => {
        const woId = parseInt(target.dataset.woId);
        const stepId = parseInt(target.dataset.stepId);
        const stepName = target.dataset.stepName;
        const itemId = target.dataset.itemId ? parseInt(target.dataset.itemId) : null;
        
        // Mark step as started
        updateChecklistStep(woId, stepId, {
            startedAt: new Date().toISOString(),
            startedByName: 'Current User',
            inProgress: true
        }, itemId);
        
        const partInfo = target.dataset.itemId ? ` (Part ID: ${target.dataset.itemId})` : '';
        showToast(`Started: ${stepName}${partInfo}`, 'info');
        refreshCurrentView();
    });
    
    // Complete Process - marks step as completed (supports line items)
    registerFn('workflow-complete', (target) => {
        const woId = parseInt(target.dataset.woId);
        const stepId = parseInt(target.dataset.stepId);
        const stepName = target.dataset.stepName;
        const itemId = target.dataset.itemId ? parseInt(target.dataset.itemId) : null;
        
        updateChecklistStep(woId, stepId, {
            isCompleted: true,
            inProgress: false,
            completedAt: new Date().toISOString(),
            completedByName: 'Current User'
        }, itemId);
        
        const partInfo = target.dataset.itemId ? ` (Part ID: ${target.dataset.itemId})` : '';
        showToast(`Completed: ${stepName}${partInfo}`, 'success');
        refreshCurrentView();
    });
    
    registerFn('workflow-issue', (target) => {
        const itemId = target.dataset.itemId ? parseInt(target.dataset.itemId) : null;
        showIssueReportModal(
            parseInt(target.dataset.woId), 
            parseInt(target.dataset.stepId), 
            target.dataset.stepName,
            refreshCurrentView,
            itemId
        );
    });
    
    // Ordering-specific actions
    registerFn('order-material', (target) => {
        const woId = parseInt(target.dataset.woId);
        const stepId = parseInt(target.dataset.stepId);
        markOrderingStepComplete(woId, 'material_ordered', 'Material Ordered');
    });
    
    registerFn('order-tooling', (target) => {
        const woId = parseInt(target.dataset.woId);
        const stepId = parseInt(target.dataset.stepId);
        markOrderingStepComplete(woId, 'tooling_ordered', 'Tooling Ordered');
    });
    
    registerFn('order-all', (target) => {
        const woId = parseInt(target.dataset.woId);
        markAllOrderingComplete(woId);
    });
    
    registerFn('refresh-tasks', refreshCurrentView);
    
    registerFn('create-misc-task', () => {
        showCreateMiscTaskModal();
    });
}

// ==================== ORDERING STEP FUNCTIONS ====================
function markOrderingStepComplete(woId, stepKey, stepName) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    if (!wo || !wo.checklist) return;
    
    const step = wo.checklist.find(s => s.stepKey === stepKey);
    if (!step || step.isCompleted) return;
    
    updateChecklistStep(woId, step.id, {
        isCompleted: true,
        completedAt: new Date().toISOString(),
        completedByName: 'Current User'
    });
    
    showToast(`${stepName} marked complete for ${wo.woNumber}`, 'success');
    refreshCurrentView();
}

function markAllOrderingComplete(woId) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    if (!wo || !wo.checklist) return;
    
    const materialStep = wo.checklist.find(s => s.stepKey === 'material_ordered');
    const toolingStep = wo.checklist.find(s => s.stepKey === 'tooling_ordered');
    
    const timestamp = new Date().toISOString();
    
    if (materialStep && !materialStep.isCompleted) {
        updateChecklistStep(woId, materialStep.id, {
            isCompleted: true,
            completedAt: timestamp,
            completedByName: 'Current User'
        });
    }
    
    if (toolingStep && !toolingStep.isCompleted) {
        updateChecklistStep(woId, toolingStep.id, {
            isCompleted: true,
            completedAt: timestamp,
            completedByName: 'Current User'
        });
    }
    
    showToast(`All ordering steps complete for ${wo.woNumber}`, 'success');
    refreshCurrentView();
}

// ==================== ISSUE REPORT MODAL ====================
function showIssueReportModal(woId, stepId, stepName, callback, lineItemId = null) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    if (!wo) return;
    
    // Get part number - either from line item or legacy single-part
    let partNumber = wo.partNumber || 'N/A';
    let partDescription = '';
    if (lineItemId && wo.lineItems) {
        const lineItem = wo.lineItems.find(item => item.id === lineItemId);
        if (lineItem) {
            partNumber = lineItem.partNumber;
            partDescription = lineItem.description || '';
        }
    }
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-exclamation-triangle mr-2 text-red-400"></i>Report Issue
                </h3>
                <button onclick="BPERP.common.closeModal('issueModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="mb-4 p-3 rounded" style="background: var(--color-dark-bg);">
                <div class="font-medium text-white">${wo.woNumber}</div>
                <div class="text-sm text-white">${partNumber}${partDescription ? ` - ${partDescription}` : ''}</div>
                <div class="text-sm" style="color: var(--color-text-muted);">${wo.customerName}</div>
                <div class="text-sm" style="color: var(--color-text-muted);">Step: ${stepName}</div>
            </div>
            <form id="issueForm" class="space-y-4">
                <div>
                    <label class="form-label">Issue Type *</label>
                    <select name="issueType" required class="form-input w-full">
                        <option value="">Select issue type...</option>
                        <option value="Material Defect">Material Defect</option>
                        <option value="Tooling Problem">Tooling Problem</option>
                        <option value="Late Delivery">Late Delivery</option>
                        <option value="Wrong Item">Wrong Item Received</option>
                        <option value="Quality Issue">Quality Issue</option>
                        <option value="Machine Problem">Machine Problem</option>
                        <option value="Program Error">Program Error</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Description *</label>
                    <textarea name="description" required class="form-input w-full" rows="3" placeholder="Describe the issue..."></textarea>
                </div>
                <div>
                    <label class="form-label">Severity</label>
                    <select name="severity" class="form-input w-full">
                        <option value="Low">Low - Can continue</option>
                        <option value="Medium" selected>Medium - Needs attention</option>
                        <option value="High">High - Blocks progress</option>
                    </select>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('issueModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex-1">
                        <i class="fa-solid fa-exclamation-triangle mr-2"></i>Report Issue
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('issueModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('issueForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        // Store the issue
        const issue = {
            id: Date.now(),
            woId: woId,
            woNumber: wo.woNumber,
            lineItemId: lineItemId,
            partNumber: partNumber,
            stepId: stepId,
            stepName: stepName,
            issueType: formData.get('issueType'),
            description: formData.get('description'),
            severity: formData.get('severity'),
            reportedAt: new Date().toISOString(),
            reportedBy: 'Current User',
            status: 'Open'
        };
        
        // Save issue to storage
        let issues = storage.get('bperp_issues') || [];
        issues.push(issue);
        storage.set('bperp_issues', issues);
        
        // Mark the step as having an issue (with line item support)
        updateChecklistStep(woId, stepId, {
            hasIssue: true,
            issueType: issue.issueType,
            issueSeverity: issue.severity,
            issueDescription: issue.description,
            issueReportedAt: issue.reportedAt
        }, lineItemId);
        
        closeModal('issueModal');
        showToast(`Issue reported for ${wo.woNumber} - ${partNumber}`, 'warning');
        if (callback) callback();
    });
}

// ==================== CREATE MISCELLANEOUS TASK MODAL ====================
function showCreateMiscTaskModal() {
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-tasks mr-2" style="color: var(--color-accent-primary);"></i>Create Task
                </h3>
                <button onclick="BPERP.common.closeModal('createTaskModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="createTaskForm" class="space-y-4">
                <div>
                    <label class="form-label">Task Title *</label>
                    <input type="text" name="title" required class="form-input w-full" placeholder="Enter task title">
                </div>
                <div>
                    <label class="form-label">Description</label>
                    <textarea name="description" class="form-input w-full" rows="3" placeholder="Task details..."></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Category</label>
                        <select name="category" class="form-input w-full">
                            <option value="General">General</option>
                            <option value="Cleaning">Cleaning</option>
                            <option value="Organization">Organization</option>
                            <option value="Moving/Rearranging">Moving/Rearranging</option>
                            <option value="Safety">Safety</option>
                            <option value="Training">Training</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Priority</label>
                        <select name="priority" class="form-input w-full">
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Assigned To</label>
                        <input type="text" name="assignedTo" class="form-input w-full" placeholder="Employee name">
                    </div>
                    <div>
                        <label class="form-label">Due Date</label>
                        <input type="date" name="dueDate" class="form-input w-full">
                    </div>
                </div>
                <div>
                    <label class="form-label">Estimated Duration</label>
                    <input type="text" name="estimatedDuration" class="form-input w-full" placeholder="e.g., 2 hours">
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('createTaskModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn btn-primary flex-1">
                        <i class="fa-solid fa-plus mr-2"></i>Create Task
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('createTaskModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('createTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const task = {
            id: Date.now(),
            title: formData.get('title'),
            description: formData.get('description'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            assignedTo: formData.get('assignedTo'),
            dueDate: formData.get('dueDate'),
            estimatedDuration: formData.get('estimatedDuration'),
            status: 'Not Started',
            type: 'miscellaneous',
            createdAt: new Date().toISOString()
        };
        
        // Save to misc tasks storage
        let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
        miscTasks.push(task);
        storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
        
        closeModal('createTaskModal');
        showToast(`Task "${task.title}" created successfully!`, 'success');
        
        // Refresh view if on tasks page
        if (tasksState.isActive) {
            refreshCurrentView();
        }
    });
}

// ==================== AUTO-REFRESH ====================
export function enableAutoRefresh() {
    masterTimer.register('tasks-refresh', () => {
        // Only refresh if tasks module is currently active
        if (!tasksState.isActive) return;
        
        const workflowViews = ['all', 'ordering', 'programming', 'processing', 'machining', 'postprocessing', 'inspection', 'shipping'];
        if (workflowViews.includes(tasksState.currentView)) {
            refreshCurrentView();
        }
    }, 30); // 30 seconds
}

// Call this when navigating away from tasks module
export function deactivate() {
    tasksState.isActive = false;
}

// ==================== INITIALIZATION ====================
export function init() {
    enableAutoRefresh();
    
    if (window.BPERP?.common?.registerActionHandler) {
        registerActionHandlers(window.BPERP.common.registerActionHandler);
    }
}
