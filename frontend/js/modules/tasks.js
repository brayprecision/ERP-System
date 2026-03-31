/**
 * BPERP Dashboard - Tasks Module
 * Unified workflow task management integrated with WIP
 */

import { 
    debounce, showToast, showLoadingSpinner,
    formatDate, DOMCache, createModal, closeModal,
    getStatusBadgeClass, getUrgencyColor, safeExecute, masterTimer, exportToCSV
} from './common.js';
import { storage, STORAGE_KEYS } from './storage.js';
import { getWorkOrders, getNextWorkflowStep, getNextWorkflowStepWithLineItem, updateChecklistStep, getWOUrgencyColor, getLineItemsByWorkflowStep, getNextWorkflowStepForLineItem, saveWorkOrders, getWODocuments, showDocumentsModal, showDocumentUploadModal, getDefaultChecklist, rollBackOneWorkflowStep } from './sales.js';
import { getMachines } from './maintenance.js';

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
    ready_for_shipment: { stepName: 'Ready For Shipment', icon: 'fa-truck', color: 'text-green-400', tab: 'shipping' },
    invoicing_complete: { stepName: 'Invoicing Complete', icon: 'fa-file-invoice-dollar', color: 'text-emerald-400', tab: 'completed' }
};

/** Short label for workcenter cards: "{Label} Started" / "{Label} not started" */
const WORKCENTER_OPERATION_LABEL = {
    part_programmed: 'Programming',
    material_processed: 'Processing',
    machining_complete: 'Machining',
    post_processing: 'Post Processing',
    inspection_complete: 'Inspection',
    ready_for_shipment: 'Shipping'
};

function getWorkcenterOperationLabel(stepKey) {
    if (WORKCENTER_OPERATION_LABEL[stepKey]) return WORKCENTER_OPERATION_LABEL[stepKey];
    const meta = WORKFLOW_STEPS[stepKey];
    return meta?.stepName || 'Work';
}

// Task type config for display
const TASK_TYPE_CONFIG = {
    ordering: { icon: 'fa-shopping-cart', label: 'Ordering', color: 'text-blue-400' },
    programming: { icon: 'fa-code', label: 'Programming', color: 'text-pink-400' },
    processing: { icon: 'fa-cut', label: 'Processing', color: 'text-yellow-400' },
    machining: { icon: 'fa-cogs', label: 'Machining', color: 'text-purple-400' },
    postprocessing: { icon: 'fa-industry', label: 'Post Processing', color: 'text-orange-400' },
    inspection: { icon: 'fa-search-plus', label: 'Inspection', color: 'text-cyan-400' },
    shipping: { icon: 'fa-truck', label: 'Shipping', color: 'text-green-400' },
    completed: { icon: 'fa-check-circle', label: 'Completed', color: 'text-emerald-400' },
    maintenance: { icon: 'fa-wrench', label: 'Maintenance', color: 'text-red-400' },
    misc: { icon: 'fa-tasks', label: 'Misc', color: 'text-gray-400' }
};

// ==================== STATE ====================
const DEFAULT_TASKS_FILTERS = {
    search: '',
    status: '',
    sortBy: 'dueDate',
    sortDir: 'asc'
};

let tasksState = {
    currentView: 'all',
    workOrders: [],
    isActive: false,
    filters: { ...DEFAULT_TASKS_FILTERS }
};

// ==================== TASK LIST FILTER / SORT (inventory-style) ====================
function getLineItemWorkflowStatus(item) {
    const step = item?.currentStep;
    if (!step) return 'Complete';
    if (step.hasIssue) return 'Issue';
    if (step.startedAt) return 'In Progress';
    return 'Not Started';
}

function escapeAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderTasksFilterBar({ statusOptions, sortOptions }) {
    const f = tasksState.filters;
    const statusOptsHtml = (statusOptions || []).map(o =>
        `<option value="${escapeAttr(o.value)}" ${f.status === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');
    const sortOptsHtml = (sortOptions || []).map(o =>
        `<option value="${escapeAttr(o.value)}" ${f.sortBy === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');
    return `
            <div class="flex items-center gap-2 mb-4 p-2 rounded-lg flex-wrap" style="background: var(--color-dark-bg); border: 1px solid var(--color-border);">
                <div class="flex items-center gap-1 flex-1 min-w-[120px]">
                    <i class="fa-solid fa-search text-gray-400 text-sm"></i>
                    <input type="text" id="tasksSearch" placeholder="Search..."
                        value="${escapeAttr(f.search)}"
                        class="bg-transparent border-0 outline-none text-sm text-white placeholder-gray-400 flex-1 min-w-0">
                </div>
                <select id="tasksStatusFilter" class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 min-w-[120px]">
                    ${statusOptsHtml}
                </select>
                <select id="tasksSortBy" class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 min-w-[140px]">
                    ${sortOptsHtml}
                </select>
                <select id="tasksSortDir" class="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 min-w-[90px]">
                    <option value="asc" ${f.sortDir === 'asc' ? 'selected' : ''}>Asc</option>
                    <option value="desc" ${f.sortDir === 'desc' ? 'selected' : ''}>Desc</option>
                </select>
                <button type="button" data-action="clear-tasks-filters" class="text-xs px-2 py-1 rounded hover:bg-gray-600 transition-colors" style="color: var(--color-accent-primary);">
                    <i class="fa-solid fa-times mr-1"></i>Clear
                </button>
            </div>`;
}

function buildAllTasksWoRows(activeWOs) {
    const rows = [];
    activeWOs.forEach(wo => {
        const ctx = getNextWorkflowStepWithLineItem(wo);
        const nextStep = ctx?.step;
        if (!nextStep) return;
        const lineItemId = ctx.lineItemId;
        const partLabel = wo.lineItems && wo.lineItems.length > 0 && lineItemId != null
            ? (wo.lineItems.find(li => li.id === lineItemId)?.partNumber || wo.partNumber || 'N/A')
            : (wo.partNumber || 'N/A');
        rows.push({ wo, ctx, nextStep, partLabel, lineItemId });
    });
    return rows;
}

function filterSortAllTasksRows(woRows, miscTasks, filters) {
    const q = (filters.search || '').toLowerCase().trim();
    const status = filters.status || '';
    let fWo = woRows.filter(row => {
        if (status && getWOWorkflowStatus(row.wo) !== status) return false;
        if (!q) return true;
        const typeLabel = TASK_TYPE_CONFIG[getTaskTypeFromStep(row.nextStep.stepKey)]?.label || '';
        const blob = [row.wo.woNumber, row.wo.customerName, row.partLabel, row.nextStep.stepName, typeLabel]
            .filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q);
    });
    let fMisc = miscTasks.filter(task => {
        if (status) {
            if (status === 'Issue') return false;
            if (task.status !== status) return false;
        }
        if (!q) return true;
        const blob = [
            task.title,
            task.description,
            task.assignedTo,
            task.category,
            task.linkedWorkOrderNumber,
            task.linkedPartNumber,
            task.linkedWorkflowStepName
        ].filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q);
    });
    const dir = filters.sortDir === 'desc' ? -1 : 1;
    const sortBy = filters.sortBy || 'dueDate';
    const woSortKey = (row) => {
        const wo = row.wo;
        if (sortBy === 'dueDate') return new Date(wo.dueDate || 0).getTime();
        if (sortBy === 'woNumber') return (wo.woNumber || '').toLowerCase();
        if (sortBy === 'customer') return (wo.customerName || '').toLowerCase();
        if (sortBy === 'type') return (TASK_TYPE_CONFIG[getTaskTypeFromStep(row.nextStep.stepKey)]?.label || '').toLowerCase();
        return 0;
    };
    fWo.sort((a, b) => {
        const va = woSortKey(a);
        const vb = woSortKey(b);
        if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
        return dir * String(va).localeCompare(String(vb));
    });
    const miscSortKey = (task) => {
        if (sortBy === 'dueDate') return new Date(task.dueDate || 0).getTime();
        if (sortBy === 'woNumber') return (task.linkedWorkOrderNumber || task.title || '').toLowerCase();
        if (sortBy === 'customer') return (task.assignedTo || '').toLowerCase();
        if (sortBy === 'type') return 'misc';
        return 0;
    };
    fMisc.sort((a, b) => {
        const va = miscSortKey(a);
        const vb = miscSortKey(b);
        if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
        return dir * String(va).localeCompare(String(vb));
    });
    return { woRows: fWo, miscTasks: fMisc };
}

function filterSortWorkflowLineItems(items, filters) {
    const q = (filters.search || '').toLowerCase().trim();
    const status = filters.status || '';
    let out = items.filter(item => {
        if (status && getLineItemWorkflowStatus(item) !== status) return false;
        if (!q) return true;
        const blob = [item.woNumber, item.customerName, item.partNumber, item.description, item.currentStep?.stepName]
            .filter(Boolean).join(' ').toLowerCase();
        return blob.includes(q);
    });
    const dir = filters.sortDir === 'desc' ? -1 : 1;
    const sortBy = filters.sortBy || 'dueDate';
    out = [...out].sort((a, b) => {
        if (sortBy === 'dueDate') return dir * (new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
        if (sortBy === 'woNumber') return dir * (a.woNumber || '').localeCompare(b.woNumber || '');
        if (sortBy === 'part') return dir * (a.partNumber || '').localeCompare(b.partNumber || '');
        if (sortBy === 'customer') return dir * (a.customerName || '').localeCompare(b.customerName || '');
        return 0;
    });
    return out;
}

function filterSortOrderingWorkOrders(wos, filters) {
    const q = (filters.search || '').toLowerCase().trim();
    const status = filters.status || '';
    let out = wos.filter(wo => {
        if (status && getWOWorkflowStatus(wo) !== status) return false;
        if (!q) return true;
        const part = wo.partNumber || (wo.lineItems || []).map(li => li.partNumber).filter(Boolean).join(' ') || '';
        const blob = [wo.woNumber, wo.customerName, part].join(' ').toLowerCase();
        return blob.includes(q);
    });
    const dir = filters.sortDir === 'desc' ? -1 : 1;
    const sortBy = filters.sortBy || 'dueDate';
    out.sort((a, b) => {
        if (sortBy === 'dueDate') return dir * (new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
        if (sortBy === 'woNumber') return dir * (a.woNumber || '').localeCompare(b.woNumber || '');
        if (sortBy === 'customer') return dir * (a.customerName || '').localeCompare(b.customerName || '');
        return 0;
    });
    return out;
}

function filterSortCompletedWorkOrders(wos, filters) {
    const q = (filters.search || '').toLowerCase().trim();
    const status = filters.status || '';
    let out = wos.filter(wo => {
        if (status) {
            const u = getWOUrgencyColor(wo.dueDate);
            if (status === 'Overdue' && u !== 'red') return false;
            if (status === 'Due Soon' && u !== 'yellow') return false;
            if (status === 'On Schedule' && !['green', 'gray'].includes(u)) return false;
        }
        if (!q) return true;
        const part = wo.partNumber || (wo.lineItems || []).map(li => li.partNumber).filter(Boolean).join(' ') || '';
        const blob = [wo.woNumber, wo.customerName, part].join(' ').toLowerCase();
        return blob.includes(q);
    });
    const dir = filters.sortDir === 'desc' ? -1 : 1;
    const sortBy = filters.sortBy || 'dueDate';
    out.sort((a, b) => {
        if (sortBy === 'dueDate') return dir * (new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
        if (sortBy === 'woNumber') return dir * (a.woNumber || '').localeCompare(b.woNumber || '');
        if (sortBy === 'customer') return dir * (a.customerName || '').localeCompare(b.customerName || '');
        return 0;
    });
    return out;
}

const debouncedTasksSearch = debounce((value) => {
    tasksState.filters.search = value;
    rerenderCurrentTasksViewQuiet();
}, 300);

function rerenderCurrentTasksViewQuiet() {
    const workOrders = getWorkOrders();
    switch (tasksState.currentView) {
        case 'all':
            renderAllTasksView(workOrders);
            break;
        case 'ordering':
            renderOrderingView(workOrders);
            break;
        case 'completed':
            renderCompletedWorkView(workOrders);
            break;
        case 'programming':
            renderWorkflowView(workOrders, ['part_programmed'], 'Programming Tasks', 'fa-code', 'text-pink-400');
            break;
        case 'processing':
            renderWorkflowView(workOrders, ['material_processed'], 'Material Processing Tasks', 'fa-cut', 'text-yellow-400');
            break;
        case 'machining':
            renderWorkflowView(workOrders, ['machining_complete'], 'Machining Tasks', 'fa-cogs', 'text-purple-400');
            break;
        case 'postprocessing':
            renderWorkflowView(workOrders, ['post_processing'], 'Post Processing Tasks', 'fa-industry', 'text-orange-400');
            break;
        case 'inspection':
            renderWorkflowView(workOrders, ['inspection_complete'], 'Inspection Tasks', 'fa-search-plus', 'text-cyan-400');
            break;
        case 'shipping':
            renderWorkflowView(workOrders, ['ready_for_shipment'], 'Shipping Tasks', 'fa-truck', 'text-green-400');
            break;
        default:
            break;
    }
}

function setupTasksFilters() {
    const searchInput = document.getElementById('tasksSearch');
    const statusFilter = document.getElementById('tasksStatusFilter');
    const sortFilter = document.getElementById('tasksSortBy');
    const sortDir = document.getElementById('tasksSortDir');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => debouncedTasksSearch(e.target.value));
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            tasksState.filters.status = e.target.value;
            rerenderCurrentTasksViewQuiet();
        });
    }
    if (sortFilter) {
        sortFilter.addEventListener('change', (e) => {
            tasksState.filters.sortBy = e.target.value;
            rerenderCurrentTasksViewQuiet();
        });
    }
    if (sortDir) {
        sortDir.addEventListener('change', (e) => {
            tasksState.filters.sortDir = e.target.value;
            rerenderCurrentTasksViewQuiet();
        });
    }
}

export function clearTasksFilters() {
    tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
    rerenderCurrentTasksViewQuiet();
}

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
        'ready_for_shipment': 'shipping',
        'invoicing_complete': 'completed'
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

    const stepKeyFb = resolveStepKeyForWoStep(woId, stepId);
    updateChecklistStep(woId, stepId, updates, null, stepKeyFb);
}

/** Find stepKey for a checklist step id (handles id type mismatch across line items). */
function resolveStepKeyForWoStep(woId, stepId) {
    const wo = getWorkOrders().find(w => w.id === woId);
    if (!wo) return null;
    const match = (c) => {
        const list = c || getDefaultChecklist();
        const st = list.find(s => s.id === stepId || Number(s.id) === Number(stepId));
        return st?.stepKey || null;
    };
    if (wo.lineItems && wo.lineItems.length > 0) {
        for (const item of wo.lineItems) {
            const k = match(item.checklist);
            if (k) return k;
        }
        return null;
    }
    return match(wo.checklist);
}

/** Prompt for machine when starting Machining; calls onConfirm(machineId|null, machineName). */
function showMachiningMachinePickerModal(onConfirm, onCancel) {
    const machines = getMachines() || [];
    const options = machines
        .filter(m => (m.status || 'Active') === 'Active')
        .map(m =>
            `<option value="${escapeAttr(m.id)}">${escapeAttr(m.machineName)} (${escapeAttr(m.machineId || '')})</option>`
        )
        .join('');

    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-gears mr-2 text-purple-400"></i>Select machine
                </h3>
                <button type="button" onclick="BPERP.common.closeModal('machiningMachineModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-sm mb-4" style="color: var(--color-text-muted);">Which machine is this job running on for machining?</p>
            ${machines.length > 0 ? `
                <div class="mb-4">
                    <label class="form-label">Machine *</label>
                    <select id="machiningMachineSelect" class="form-input w-full" required>
                        <option value="">Select a machine…</option>
                        ${options}
                    </select>
                </div>
            ` : `
                <div class="mb-4">
                    <label class="form-label">Machine name *</label>
                    <input type="text" id="machiningMachineManual" class="form-input w-full" placeholder="e.g. CNC Mill 1">
                    <p class="text-xs mt-1 text-gray-500">No machine profiles yet — add one under Machines or enter a name.</p>
                </div>
            `}
            <div class="flex gap-3 pt-2">
                <button type="button" id="machiningMachineCancel" class="btn btn-secondary flex-1">Cancel</button>
                <button type="button" id="machiningMachineOk" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex-1">
                    <i class="fa-solid fa-play mr-2"></i>Start machining
                </button>
            </div>
        </div>
    `;

    createModal('machiningMachineModal', content, { width: 'w-full max-w-md' });

    document.getElementById('machiningMachineCancel').addEventListener('click', () => {
        closeModal('machiningMachineModal');
        if (onCancel) onCancel();
    });

    document.getElementById('machiningMachineOk').addEventListener('click', () => {
        if (machines.length > 0) {
            const sel = document.getElementById('machiningMachineSelect');
            const id = sel?.value;
            if (!id) {
                showToast('Select a machine', 'warning');
                return;
            }
            const m = machines.find(x => String(x.id) === String(id));
            closeModal('machiningMachineModal');
            onConfirm(Number(id), m ? m.machineName : '');
        } else {
            const raw = document.getElementById('machiningMachineManual')?.value?.trim();
            if (!raw) {
                showToast('Enter a machine name', 'warning');
                return;
            }
            closeModal('machiningMachineModal');
            onConfirm(null, raw);
        }
    });
}

// ==================== UNIFIED WORKFLOW VIEW RENDERER ====================
// Updated to track individual parts/line items through workflow
function renderWorkflowView(workOrders, stepKeys, stepName, tabIcon, tabColor) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    const keysArray = Array.isArray(stepKeys) ? stepKeys : [stepKeys];
    
    const rawItems = filterLineItemsByStep(workOrders, keysArray);
    const relevantItems = filterSortWorkflowLineItems(rawItems, tasksState.filters);
    const filterBar = renderTasksFilterBar({
        statusOptions: [
            { value: '', label: 'All status' },
            { value: 'Not Started', label: 'Not Started' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Issue', label: 'Issue' }
        ],
        sortOptions: [
            { value: 'dueDate', label: 'Sort: Due date' },
            { value: 'woNumber', label: 'Sort: Work order' },
            { value: 'part', label: 'Sort: Part' },
            { value: 'customer', label: 'Sort: Customer' }
        ]
    });
    
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
        
        // Get document count for this WO
        const docCount = getWODocuments(item.woId).length;
        
        // Data attributes for action buttons
        const dataAttrs = `data-wo-id="${item.woId}" data-step-id="${step.id}" data-step-name="${escapeAttr(step.stepName)}" data-step-key="${escapeAttr(step.stepKey)}" data-item-id="${item.lineItemId || ''}"`;
        const operationLabel = getWorkcenterOperationLabel(step.stepKey);
        const statusLineText = isStarted
            ? `${operationLabel} Started`
            : `${operationLabel} not started`;
        
        return `
            <div class="card p-4 border-l-4 ${borderColor}">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-sm" style="color: var(--color-accent-primary);">${item.woNumber}</span>
                        ${hasIssue ? '<span class="text-red-400"><i class="fa-solid fa-exclamation-triangle"></i></span>' : ''}
                        <!-- Documents Badge - Access blueprints from any workcenter -->
                        <button data-action="view-wo-documents" data-wo-id="${item.woId}" data-wo-number="${item.woNumber}"
                            class="px-2 py-0.5 rounded text-xs ${docCount > 0 ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-700 text-gray-500'} hover:bg-blue-600/50"
                            title="View Blueprints & Documents">
                            <i class="fa-solid fa-drafting-compass mr-1"></i>${docCount}
                        </button>
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
                
                <div class="text-xs mb-3" style="color: var(--color-text-muted);">
                    <i class="fa-solid ${WORKFLOW_STEPS[step.stepKey]?.icon || 'fa-circle'} mr-1"></i>
                    Current: <span class="text-white">${statusLineText}</span>
                    ${hasIssue ? '<span class="text-red-400 ml-2"><i class="fa-solid fa-exclamation-triangle"></i> Issue</span>' : ''}
                </div>
                
                <div class="flex gap-2 flex-wrap">
                    ${!isStarted ? `
                        <button data-action="workflow-begin" ${dataAttrs}
                            class="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 flex-1 min-w-[120px]">
                            <i class="fa-solid fa-play mr-1"></i>Begin Process
                        </button>
                    ` : `
                        <button data-action="workflow-complete" ${dataAttrs}
                            class="bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 flex-1 min-w-[120px]">
                            <i class="fa-solid fa-check mr-1"></i>Complete Process
                        </button>
                    `}
                    <button data-action="create-wo-task" ${dataAttrs}
                        class="bg-orange-600 text-white px-3 py-1.5 rounded text-xs hover:bg-orange-700">
                        <i class="fa-solid fa-plus mr-1"></i>New Task
                    </button>
                </div>
                <div class="flex gap-2">
                    <button data-action="workflow-rollback" ${dataAttrs}
                        class="bg-purple-400 text-white px-3 py-1.5 rounded text-xs hover:bg-purple-300 flex-1">
                        <i class="fa-solid fa-rotate-left mr-1"></i>Rollback step
                    </button>
                    <button data-action="workflow-issue" ${dataAttrs}
                        class="bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700 flex-1">
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
            
            ${filterBar}
            
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
    setupTasksFilters();
}

function renderCompletedWorkView(workOrders) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;

    // Helper to check if a step is complete across all line items (or in legacy checklist)
    const isStepCompleteForWO = (wo, stepKey) => {
        // Multi-line-item format: check if ALL line items have completed this step
        if (wo.lineItems && wo.lineItems.length > 0) {
            return wo.lineItems.every(item => {
                const step = item.checklist?.find(s => s.stepKey === stepKey);
                return step?.isCompleted || false;
            });
        }
        // Legacy single-part format: check wo.checklist directly
        const step = wo.checklist?.find(s => s.stepKey === stepKey);
        return step?.isCompleted || false;
    };

    const completedWOsRaw = workOrders.filter(wo => {
        const isReadyForShipment = isStepCompleteForWO(wo, 'ready_for_shipment');
        const isInvoicingComplete = isStepCompleteForWO(wo, 'invoicing_complete');

        return isReadyForShipment && !isInvoicingComplete;
    });

    const completedWOs = filterSortCompletedWorkOrders(completedWOsRaw, tasksState.filters);
    const filterBar = renderTasksFilterBar({
        statusOptions: [
            { value: '', label: 'All urgency' },
            { value: 'Overdue', label: 'Overdue' },
            { value: 'Due Soon', label: 'Due Soon' },
            { value: 'On Schedule', label: 'On Schedule' }
        ],
        sortOptions: [
            { value: 'dueDate', label: 'Sort: Due date' },
            { value: 'woNumber', label: 'Sort: Work order' },
            { value: 'customer', label: 'Sort: Customer' }
        ]
    });

    // Group by urgency (though these should mostly be completed/on time)
    const overdue = completedWOs.filter(wo => getWOUrgencyColor(wo.dueDate) === 'red');
    const dueSoon = completedWOs.filter(wo => getWOUrgencyColor(wo.dueDate) === 'yellow');
    const onSchedule = completedWOs.filter(wo => ['green', 'gray'].includes(getWOUrgencyColor(wo.dueDate)));

    const renderCompletedCard = (wo) => {
        const urgency = getWOUrgencyColor(wo.dueDate);
        const borderColor = urgency === 'red' ? 'border-red-600' : urgency === 'yellow' ? 'border-yellow-600' : 'border-emerald-600';

        // Check invoicing status using the helper that handles multi-line-item format
        const isInvoicingComplete = isStepCompleteForWO(wo, 'invoicing_complete');

        // Calculate total value (this would come from line items in a real system)
        const totalValue = '$' + (Math.random() * 5000 + 1000).toFixed(2); // Mock value
        
        // Get document count for this WO
        const docCount = getWODocuments(wo.id).length;

        return `
            <div class="card p-4 border-l-4 ${borderColor}">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-lg" style="color: var(--color-accent-primary);">${wo.woNumber}</span>
                        <span class="text-sm" style="color: var(--color-text-muted);">${wo.customerName}</span>
                        <!-- Documents Badge -->
                        <button data-action="view-wo-documents" data-wo-id="${wo.id}" data-wo-number="${wo.woNumber}"
                            class="px-2 py-0.5 rounded text-xs ${docCount > 0 ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-700 text-gray-500'} hover:bg-blue-600/50"
                            title="View Blueprints & Documents">
                            <i class="fa-solid fa-folder${docCount > 0 ? '' : '-open'} mr-1"></i>${docCount}
                        </button>
                    </div>
                    <span class="text-xs px-2 py-1 rounded-full bg-emerald-600 text-emerald-100">
                        <i class="fa-solid fa-check-circle mr-1"></i>Shipped
                    </span>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                        <span class="text-gray-400">Shipped:</span>
                        <span class="text-white ml-2">${formatDate(wo.dueDate)}</span>
                    </div>
                    <div>
                        <span class="text-gray-400">Value:</span>
                        <span class="text-green-400 ml-2 font-medium">${totalValue}</span>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button data-action="mark-invoicing-complete" data-wo-id="${wo.id}"
                        class="${isInvoicingComplete ? 'bg-gray-600' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-3 py-2 rounded text-sm flex-1"
                        ${isInvoicingComplete ? 'disabled' : ''}>
                        <i class="fa-solid fa-file-invoice-dollar mr-2"></i>Invoicing${isInvoicingComplete ? ' ✓' : ''}
                    </button>
                    <button data-action="archive-work-order" data-wo-id="${wo.id}"
                        class="${!isInvoicingComplete ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3 py-2 rounded text-sm flex-1"
                        ${!isInvoicingComplete ? 'disabled' : ''}>
                        <i class="fa-solid fa-archive mr-2"></i>Archive
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
                    ${items.map(renderCompletedCard).join('')}
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="col-span-3">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-gray-400 text-sm font-medium">
                    <i class="fa-solid fa-check-circle mr-2 text-emerald-400"></i>Completed Work
                    <span class="text-xs text-gray-500">(${completedWOs.length} work orders ready for invoicing)</span>
                </h3>
                <button data-action="refresh-tasks" class="text-gray-400 hover:text-white text-sm">
                    <i class="fa-solid fa-refresh mr-1"></i>Refresh
                </button>
            </div>

            ${filterBar}

            <div class="mb-4 p-3 rounded-lg bg-blue-900/20 border border-blue-700">
                <p class="text-blue-300 text-sm">
                    <i class="fa-solid fa-info-circle mr-2"></i>
                    Work orders shown here have been shipped and are ready for invoicing.
                    Complete invoicing before archiving.
                </p>
            </div>

            ${renderSection('Overdue', overdue, 'text-red-400')}
            ${renderSection('Due Soon', dueSoon, 'text-yellow-400')}
            ${renderSection('On Schedule', onSchedule, 'text-emerald-400')}

            ${completedWOs.length === 0 ? `
                <div class="card p-8 text-center">
                    <i class="fa-solid fa-check-double text-4xl text-emerald-500 mb-4"></i>
                    <p style="color: var(--color-text-muted);">No work orders ready for invoicing</p>
                    <p class="text-xs mt-2" style="color: var(--color-text-muted);">Completed work orders will appear here after shipping</p>
                </div>
            ` : ''}
        </div>
    `;
    setupTasksFilters();
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
    const prev = tasksState.currentView;
    if (prev !== 'all') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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
    const miscTasks = (storage.get(STORAGE_KEYS.MISC_TASKS) || []).filter(t => t.status !== 'Completed');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const woRowsBuilt = buildAllTasksWoRows(activeWOs);
    const { woRows, miscTasks: miscFiltered } = filterSortAllTasksRows(woRowsBuilt, miscTasks, tasksState.filters);

    const stats = {
        totalOpen: woRows.length + miscFiltered.length,
        overdue: woRows.filter(row => getWOUrgencyColor(row.wo.dueDate) === 'red').length +
            miscFiltered.filter(t => t.dueDate && getWOUrgencyColor(t.dueDate) === 'red').length,
        dueToday: woRows.filter(row => {
            const due = new Date(row.wo.dueDate);
            return due >= today && due < tomorrow;
        }).length + miscFiltered.filter(t => {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate);
            return due >= today && due < tomorrow;
        }).length,
        completed: workOrders.filter(wo => wo.completionPercentage === 100).length
    };

    const allTasksFilterBar = renderTasksFilterBar({
        statusOptions: [
            { value: '', label: 'All status' },
            { value: 'Not Started', label: 'Not Started' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Issue', label: 'Issue' }
        ],
        sortOptions: [
            { value: 'dueDate', label: 'Sort: Due date' },
            { value: 'woNumber', label: 'Sort: Work order' },
            { value: 'customer', label: 'Sort: Customer' },
            { value: 'type', label: 'Sort: Type' }
        ]
    });

    const woTaskRows = woRows.map(({ wo, nextStep, partLabel, lineItemId }) => {
        const itemAttr = lineItemId != null ? ` data-item-id="${lineItemId}"` : '';
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
                    <div class="text-xs text-gray-500">${partLabel} - ${nextStep.stepName}</div>
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
                        <button data-action="workflow-complete" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="${nextStep.stepName}" data-step-key="${escapeAttr(nextStep.stepKey)}"${itemAttr}
                            class="text-green-500 hover:text-green-400" title="Complete Step">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button data-action="workflow-start" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="${nextStep.stepName}" data-step-key="${escapeAttr(nextStep.stepKey)}"${itemAttr}
                            class="text-blue-500 hover:text-blue-400" title="Start Step">
                            <i class="fa-solid fa-play"></i>
                        </button>
                        <button data-action="workflow-issue" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="${nextStep.stepName}"${itemAttr}
                            class="text-red-500 hover:text-red-400" title="Report Issue">
                            <i class="fa-solid fa-exclamation-triangle"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    const miscTaskRows = miscFiltered.map(task => {
        const typeConfig = TASK_TYPE_CONFIG.misc;
        const urgency = task.dueDate ? getWOUrgencyColor(task.dueDate) : 'gray';
        const urgencyClass = urgency === 'red' ? 'text-red-500 font-bold' : urgency === 'yellow' ? 'text-yellow-500' : 'text-gray-400';
        const statusClass = task.status === 'In Progress' ? 'bg-blue-600 text-blue-100' :
            task.status === 'Not Started' ? 'bg-gray-600 text-gray-200' : 'bg-green-600 text-green-100';
        const recurringBadge = task.isRecurring ? '<span class="ml-2 text-xs text-purple-400"><i class="fa-solid fa-rotate mr-1"></i>Recurring</span>' : '';
        const linkedRef = task.linkedWorkOrderNumber
            ? [task.linkedWorkOrderNumber, task.linkedPartNumber, task.linkedWorkflowStepName].filter(Boolean).join(' · ')
            : '';
        const subLines = linkedRef
            ? `<div class="text-xs text-gray-400">${linkedRef}</div>${task.description ? `<div class="text-xs text-gray-500">${escapeAttr(task.description)}</div>` : ''}`
            : `<div class="text-xs text-gray-500">${task.description ? escapeAttr(task.description) : 'No description'}</div>`;

        return `
            <tr class="border-b border-gray-700 hover:bg-gray-800 bg-gray-800/30">
                <td class="px-4 py-3">
                    <span class="${typeConfig.color}">
                        <i class="fa-solid ${typeConfig.icon} mr-2"></i>${typeConfig.label}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <div class="font-medium text-white">${escapeAttr(task.title)}${recurringBadge}</div>
                    ${subLines}
                </td>
                <td class="px-4 py-3 text-gray-300">${task.assignedTo || '-'}</td>
                <td class="px-4 py-3 ${urgencyClass}">${task.dueDate ? formatDate(task.dueDate) : '-'}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${task.status}</span>
                </td>
                <td class="px-4 py-3">
                    <span class="text-xs text-gray-500">${task.priority || 'Normal'}</span>
                </td>
                <td class="px-4 py-3">
                    <div class="flex space-x-2">
                        <button data-action="complete-misc-task" data-task-id="${task.id}"
                            class="text-green-500 hover:text-green-400" title="Mark Complete">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button data-action="edit-misc-task" data-task-id="${task.id}"
                            class="text-blue-500 hover:text-blue-400" title="Edit Task">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button data-action="delete-misc-task" data-task-id="${task.id}" data-task-name="${task.title}"
                            class="text-red-500 hover:text-red-400" title="Delete Task">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    const taskRows = woTaskRows + miscTaskRows;

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

            <div class="card p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-gray-400 text-sm font-medium">
                        <i class="fa-solid fa-clipboard-check mr-2"></i>All Workflow Tasks
                        <span class="text-xs text-gray-500">(${woRows.length + miscFiltered.length} shown)</span>
                    </h3>
                    <div class="flex space-x-2">
                        <button data-action="export-tasks" class="text-gray-400 hover:text-white text-sm">
                            <i class="fa-solid fa-download mr-1"></i>Export
                        </button>
                        <button data-action="refresh-tasks" class="text-gray-400 hover:text-white text-sm">
                            <i class="fa-solid fa-refresh mr-1"></i>Refresh
                        </button>
                        <button data-action="create-misc-task" class="bg-accentGreen text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                            <i class="fa-solid fa-plus mr-1"></i>Misc Task
                        </button>
                    </div>
                </div>

                ${allTasksFilterBar}

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
                            ${taskRows || '<tr><td colspan="7" class="text-center py-8" style="color: var(--color-text-muted);">No matching tasks</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    setupTasksFilters();
}

// ==================== WORKFLOW TAB FUNCTIONS ====================
export function loadOrderingTasks() {
    const prev = tasksState.currentView;
    if (prev !== 'ordering') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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
    
    const orderingSteps = ['material_ordered', 'tooling_ordered', 'material_received', 'tooling_received'];
    const relevantWOsRaw = filterWorkOrdersByStep(workOrders, orderingSteps);
    const relevantWOs = filterSortOrderingWorkOrders(relevantWOsRaw, tasksState.filters);
    const orderingFilterBar = renderTasksFilterBar({
        statusOptions: [
            { value: '', label: 'All status' },
            { value: 'Not Started', label: 'Not Started' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Issue', label: 'Issue' }
        ],
        sortOptions: [
            { value: 'dueDate', label: 'Sort: Due date' },
            { value: 'woNumber', label: 'Sort: Work order' },
            { value: 'customer', label: 'Sort: Customer' }
        ]
    });
    
    // Group by urgency
    const overdue = relevantWOs.filter(wo => getWOUrgencyColor(wo.dueDate) === 'red');
    const dueSoon = relevantWOs.filter(wo => getWOUrgencyColor(wo.dueDate) === 'yellow');
    const onSchedule = relevantWOs.filter(wo => ['green', 'gray'].includes(getWOUrgencyColor(wo.dueDate)));
    
    const renderOrderingCard = (wo) => {
        const nextStep = getNextWorkflowStep(wo);
        const urgency = getWOUrgencyColor(wo.dueDate);
        const borderColor = urgency === 'red' ? 'border-red-600' : urgency === 'yellow' ? 'border-yellow-600' : 'border-gray-700';
        
        // Get document count for this WO
        const docCount = getWODocuments(wo.id).length;
        
        // Check which ordering steps are complete
        let materialOrdered = false;
        let toolingOrdered = false;
        let materialReceived = false;
        let toolingReceived = false;
        let materialOrderStep = null;
        let toolingOrderStep = null;
        let materialReceiveStep = null;
        let toolingReceiveStep = null;
        let hasIssue = false;

        // Handle multi-part work orders — use .every() so one line cannot block receiving on another
        // (OR was wrong: if any line had material received, Receive was disabled for the whole WO.)
        if (wo.lineItems && wo.lineItems.length > 0) {
            const items = wo.lineItems;
            const getC = (item) => item.checklist || getDefaultChecklist();
            materialOrdered = items.every(item => getC(item).find(s => s.stepKey === 'material_ordered')?.isCompleted);
            toolingOrdered = items.every(item => getC(item).find(s => s.stepKey === 'tooling_ordered')?.isCompleted);
            materialReceived = items.every(item => getC(item).find(s => s.stepKey === 'material_received')?.isCompleted);
            toolingReceived = items.every(item => getC(item).find(s => s.stepKey === 'tooling_received')?.isCompleted);

            const firstC = getC(items[0]);
            materialOrderStep = firstC.find(s => s.stepKey === 'material_ordered');
            toolingOrderStep = firstC.find(s => s.stepKey === 'tooling_ordered');
            materialReceiveStep = firstC.find(s => s.stepKey === 'material_received');
            toolingReceiveStep = firstC.find(s => s.stepKey === 'tooling_received');

            for (const item of items) {
                const checklist = item.checklist || [];
                hasIssue = hasIssue || checklist.some(s => s.hasIssue);
            }
        } else {
            // Handle single-part work orders (legacy)
            const checklist = wo.checklist || getDefaultChecklist();
            materialOrdered = checklist.find(s => s.stepKey === 'material_ordered')?.isCompleted || false;
            toolingOrdered = checklist.find(s => s.stepKey === 'tooling_ordered')?.isCompleted || false;
            materialReceived = checklist.find(s => s.stepKey === 'material_received')?.isCompleted || false;
            toolingReceived = checklist.find(s => s.stepKey === 'tooling_received')?.isCompleted || false;
            materialOrderStep = checklist.find(s => s.stepKey === 'material_ordered');
            toolingOrderStep = checklist.find(s => s.stepKey === 'tooling_ordered');
            materialReceiveStep = checklist.find(s => s.stepKey === 'material_received');
            toolingReceiveStep = checklist.find(s => s.stepKey === 'tooling_received');
            hasIssue = checklist.some(s => s.hasIssue) || false;
        }
        
        return `
            <div class="card p-4 border-l-4 ${borderColor}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-medium text-white">${wo.woNumber}</span>
                        <span class="text-sm ml-2" style="color: var(--color-text-muted);">${wo.partNumber}</span>
                        ${hasIssue ? '<span class="text-red-400 ml-2"><i class="fa-solid fa-exclamation-triangle"></i></span>' : ''}
                        <!-- Documents Badge -->
                        <button data-action="view-wo-documents" data-wo-id="${wo.id}" data-wo-number="${wo.woNumber}"
                            class="ml-2 px-2 py-0.5 rounded text-xs ${docCount > 0 ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-700 text-gray-500'} hover:bg-blue-600/50"
                            title="View Documents & Blueprints">
                            <i class="fa-solid fa-folder${docCount > 0 ? '' : '-open'} mr-1"></i>${docCount}
                        </button>
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
                <div class="space-y-2">
                    <!-- Ordering Row -->
                    <div class="flex gap-2">
                        <button data-action="order-material" data-wo-id="${wo.id}" data-step-id="${materialOrderStep?.id || 2}"
                            class="${materialOrdered ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-2 py-1 rounded text-xs flex-1"
                            ${materialOrdered ? 'disabled' : ''}>
                            <i class="fa-solid fa-shopping-cart mr-1"></i>Order Material${materialOrdered ? ' ✓' : ''}
                        </button>
                        <button data-action="order-tooling" data-wo-id="${wo.id}" data-step-id="${toolingOrderStep?.id || 3}"
                            class="${toolingOrdered ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'} text-white px-2 py-1 rounded text-xs flex-1"
                            ${toolingOrdered ? 'disabled' : ''}>
                            <i class="fa-solid fa-tools mr-1"></i>Order Tooling${toolingOrdered ? ' ✓' : ''}
                        </button>
                        <button data-action="order-all" data-wo-id="${wo.id}"
                            class="${materialOrdered && toolingOrdered ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} text-white px-2 py-1 rounded text-xs flex-1"
                            ${materialOrdered && toolingOrdered ? 'disabled' : ''}>
                            <i class="fa-solid fa-check-double mr-1"></i>Order All
                        </button>
                    </div>

                    <!-- Receiving Row -->
                    <div class="flex gap-2">
                        <button data-action="receive-material" data-wo-id="${wo.id}" data-step-id="${materialReceiveStep?.id || 4}"
                            class="${!materialOrdered || materialReceived ? 'bg-gray-600' : 'bg-cyan-600 hover:bg-cyan-700'} text-white px-2 py-1 rounded text-xs flex-1"
                            ${!materialOrdered || materialReceived ? 'disabled' : ''}>
                            <i class="fa-solid fa-box mr-1"></i>Receive Material${materialReceived ? ' ✓' : ''}
                        </button>
                        <button data-action="receive-tooling" data-wo-id="${wo.id}" data-step-id="${toolingReceiveStep?.id || 5}"
                            class="${!toolingOrdered || toolingReceived ? 'bg-gray-600' : 'bg-cyan-600 hover:bg-cyan-700'} text-white px-2 py-1 rounded text-xs flex-1"
                            ${!toolingOrdered || toolingReceived ? 'disabled' : ''}>
                            <i class="fa-solid fa-wrench mr-1"></i>Receive Tooling${toolingReceived ? ' ✓' : ''}
                        </button>
                        <button data-action="receive-all" data-wo-id="${wo.id}"
                            class="${(!materialOrdered || !toolingOrdered) || (materialReceived && toolingReceived) ? 'bg-gray-600' : 'bg-purple-600 hover:bg-purple-700'} text-white px-2 py-1 rounded text-xs flex-1"
                            ${(!materialOrdered || !toolingOrdered) || (materialReceived && toolingReceived) ? 'disabled' : ''}>
                            <i class="fa-solid fa-check-double mr-1"></i>Receive All
                        </button>
                    </div>
                    
                    <!-- Material Cert & Documents Row -->
                    <div class="flex gap-2 pt-1 border-t flex-wrap items-start" style="border-color: var(--color-border);">
                        <button data-action="add-material-cert" data-wo-id="${wo.id}" data-wo-number="${wo.woNumber}"
                            class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs flex-1 min-w-[140px]">
                            <i class="fa-solid fa-certificate mr-1"></i>Add Material Cert
                        </button>
                        <button data-action="create-wo-task" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="${escapeAttr(nextStep.stepName)}" data-step-key="${escapeAttr(nextStep.stepKey)}" data-item-id=""
                            class="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs">
                            <i class="fa-solid fa-plus mr-1"></i>New Task
                        </button>
                        <div class="flex flex-col gap-1">
                            <button data-action="workflow-rollback" data-wo-id="${wo.id}" data-item-id=""
                                class="bg-purple-400 hover:bg-purple-300 text-white px-2 py-1 rounded text-xs whitespace-nowrap" title="Roll back one workflow step">
                                <i class="fa-solid fa-rotate-left mr-1"></i>Rollback
                            </button>
                            <button data-action="workflow-issue" data-wo-id="${wo.id}" data-step-id="${nextStep.id}" data-step-name="Ordering"
                                class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700" title="Report Issue">
                                <i class="fa-solid fa-exclamation-triangle"></i>
                            </button>
                        </div>
                    </div>
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
            
            ${orderingFilterBar}
            
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
    setupTasksFilters();
}

export function loadProgrammingTasks() {
    const prev = tasksState.currentView;
    if (prev !== 'programming') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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
    const prev = tasksState.currentView;
    if (prev !== 'processing') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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
    const prev = tasksState.currentView;
    if (prev !== 'machining') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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
    const prev = tasksState.currentView;
    if (prev !== 'postprocessing') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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
    const prev = tasksState.currentView;
    if (prev !== 'inspection') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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
    const prev = tasksState.currentView;
    if (prev !== 'shipping') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
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

export function loadCompletedWorkTasks() {
    const prev = tasksState.currentView;
    if (prev !== 'completed') tasksState.filters = { ...DEFAULT_TASKS_FILTERS };
    tasksState.currentView = 'completed';
    tasksState.isActive = true;
    showLoadingSpinner();

    safeExecute(() => {
        const workOrders = getWorkOrders();
        renderCompletedWorkView(workOrders);
    }, null, 'loadCompletedWorkTasks');
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
        'shipping': loadShippingReceivingTasks,
        'completed': loadCompletedWorkTasks
    };
    
    const fn = refreshFns[tasksState.currentView];
    if (fn) fn();
}

// ==================== ACTION HANDLERS ====================
export function registerActionHandlers(registerFn) {
    // Begin Process - marks step as started (supports line items). "workflow-start" is an alias used on All Tasks rows.
    const handleWorkflowBegin = (target) => {
        const woId = parseInt(target.dataset.woId, 10);
        const stepId = parseInt(target.dataset.stepId, 10);
        const stepName = target.dataset.stepName;
        const itemId = target.dataset.itemId !== undefined && target.dataset.itemId !== ''
            ? parseInt(target.dataset.itemId, 10)
            : null;
        const stepKeyFb = target.dataset.stepKey || resolveStepKeyForWoStep(woId, stepId);

        const applyStart = (extra = {}) => {
            updateChecklistStep(woId, stepId, {
                startedAt: new Date().toISOString(),
                startedByName: 'Current User',
                inProgress: true,
                ...extra
            }, itemId, stepKeyFb);

            const partInfo = target.dataset.itemId ? ` (Part ID: ${target.dataset.itemId})` : '';
            showToast(`Started: ${stepName}${partInfo}`, 'info');
            refreshCurrentView();
        };

        if (stepKeyFb === 'machining_complete') {
            showMachiningMachinePickerModal((machineId, machineName) => {
                applyStart({
                    machiningMachineId: machineId != null ? machineId : null,
                    machiningMachineName: machineName || ''
                });
            });
            return;
        }

        applyStart();
    };
    registerFn('workflow-begin', handleWorkflowBegin);
    registerFn('workflow-start', handleWorkflowBegin);
    
    // Complete Process - marks step as completed (supports line items)
    registerFn('workflow-complete', (target) => {
        const woId = parseInt(target.dataset.woId, 10);
        const stepId = parseInt(target.dataset.stepId, 10);
        const stepName = target.dataset.stepName;
        const itemId = target.dataset.itemId !== undefined && target.dataset.itemId !== ''
            ? parseInt(target.dataset.itemId, 10)
            : null;
        const stepKeyFb = target.dataset.stepKey || resolveStepKeyForWoStep(woId, stepId);

        const updates = {
            isCompleted: true,
            inProgress: false,
            completedAt: new Date().toISOString(),
            completedByName: 'Current User'
        };
        if (stepKeyFb === 'machining_complete') {
            updates.machiningMachineId = null;
            updates.machiningMachineName = null;
        }
        updateChecklistStep(woId, stepId, updates, itemId, stepKeyFb);
        
        const partInfo = target.dataset.itemId ? ` (Part ID: ${target.dataset.itemId})` : '';
        showToast(`Completed: ${stepName}${partInfo}`, 'success');
        refreshCurrentView();
    });
    
    registerFn('workflow-rollback', (target) => {
        const woId = parseInt(target.dataset.woId, 10);
        let lineItemId;
        if (target.dataset.itemId !== undefined && target.dataset.itemId !== '') {
            const p = parseInt(target.dataset.itemId, 10);
            if (!Number.isNaN(p)) lineItemId = p;
        }
        const result = rollBackOneWorkflowStep(woId, lineItemId);
        if (result.ok) {
            showToast(result.message, 'success');
            refreshCurrentView();
        } else {
            showToast(result.message, 'warning');
        }
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

    registerFn('create-wo-task', (target) => {
        const itemId = target.dataset.itemId ? parseInt(target.dataset.itemId) : null;
        const idParsed = itemId && !Number.isNaN(itemId) ? itemId : null;
        showCreateWoLinkedTaskModal(
            parseInt(target.dataset.woId, 10),
            parseInt(target.dataset.stepId, 10),
            target.dataset.stepName,
            idParsed,
            target.dataset.stepKey || '',
            refreshCurrentView
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

    registerFn('receive-material', (target) => {
        const woId = parseInt(target.dataset.woId);
        const stepId = parseInt(target.dataset.stepId);
        markReceivingStepComplete(woId, 'material_received', 'Material Received');
    });

    registerFn('receive-tooling', (target) => {
        const woId = parseInt(target.dataset.woId);
        const stepId = parseInt(target.dataset.stepId);
        markReceivingStepComplete(woId, 'tooling_received', 'Tooling Received');
    });

    registerFn('receive-all', (target) => {
        const woId = parseInt(target.dataset.woId);
        markAllReceivingComplete(woId);
    });

    registerFn('mark-invoicing-complete', (target) => {
        const woId = parseInt(target.dataset.woId);
        markInvoicingComplete(woId);
    });

    registerFn('archive-work-order', (target) => {
        const woId = parseInt(target.dataset.woId);
        archiveWorkOrder(woId);
    });

    registerFn('refresh-tasks', refreshCurrentView);

    registerFn('clear-tasks-filters', () => clearTasksFilters());
    
    registerFn('export-tasks', () => {
        exportTasks();
    });

    registerFn('create-misc-task', () => {
        showCreateMiscTaskModal();
    });
    
    registerFn('complete-misc-task', (target) => {
        completeMiscTask(target.dataset.taskId);
    });
    
    registerFn('edit-misc-task', (target) => {
        editMiscTask(target.dataset.taskId);
    });
    
    registerFn('delete-misc-task', (target) => {
        deleteMiscTask(target.dataset.taskId, target.dataset.taskName);
    });
    
    // Document actions for workcenters
    registerFn('view-wo-documents', (target) => {
        const woId = parseInt(target.dataset.woId);
        const woNumber = target.dataset.woNumber;
        showDocumentsModal('wo', woId, woNumber);
    });
    
    registerFn('add-material-cert', (target) => {
        const woId = parseInt(target.dataset.woId);
        showDocumentUploadModal('wo', woId, 'MATERIAL_CERT');
    });
}

// ==================== ORDERING STEP FUNCTIONS ====================
function markOrderingStepComplete(woId, stepKey, stepName) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);

    if (!wo) {
        return;
    }

    // For multi-part work orders, update all line items
    if (wo.lineItems && wo.lineItems.length > 0) {
        let updated = false;

        for (const item of wo.lineItems) {
            const checklist = item.checklist || getDefaultChecklist();
            const step = checklist.find(s => s.stepKey === stepKey);

            if (step && !step.isCompleted) {
                updateChecklistStep(woId, step.id, {
                    isCompleted: true,
                    completedAt: new Date().toISOString(),
                    completedByName: 'Current User'
                }, item.id, stepKey);
                updated = true;
            }
        }

        if (!updated) {
            return;
        }
    } else {
        // Legacy single-part structure
        const checklist = wo.checklist || getDefaultChecklist();
        const step = checklist.find(s => s.stepKey === stepKey);

        if (!step || step.isCompleted) {
            return;
        }

        const result = updateChecklistStep(woId, step.id, {
            isCompleted: true,
            completedAt: new Date().toISOString(),
            completedByName: 'Current User'
        }, null, stepKey);

        if (!result) {
            return;
        }
    }

    showToast(`${stepName} marked complete for ${wo.woNumber}`, 'success');
    refreshCurrentView();
}

function markAllOrderingComplete(woId) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    if (!wo) return;

    const timestamp = new Date().toISOString();
    let updated = false;

    // For multi-part work orders, update all line items
    if (wo.lineItems && wo.lineItems.length > 0) {
        for (const item of wo.lineItems) {
            const checklist = item.checklist || getDefaultChecklist();

            const materialStep = checklist.find(s => s.stepKey === 'material_ordered');
            const toolingStep = checklist.find(s => s.stepKey === 'tooling_ordered');

            if (materialStep && !materialStep.isCompleted) {
                updateChecklistStep(woId, materialStep.id, {
                    isCompleted: true,
                    completedAt: timestamp,
                    completedByName: 'Current User'
                }, item.id, 'material_ordered');
                updated = true;
            }

            if (toolingStep && !toolingStep.isCompleted) {
                updateChecklistStep(woId, toolingStep.id, {
                    isCompleted: true,
                    completedAt: timestamp,
                    completedByName: 'Current User'
                }, item.id, 'tooling_ordered');
                updated = true;
            }
        }
    } else {
        // Legacy single-part structure
        const checklist = wo.checklist || getDefaultChecklist();

        const materialStep = checklist.find(s => s.stepKey === 'material_ordered');
        const toolingStep = checklist.find(s => s.stepKey === 'tooling_ordered');

        if (materialStep && !materialStep.isCompleted) {
            updateChecklistStep(woId, materialStep.id, {
                isCompleted: true,
                completedAt: timestamp,
                completedByName: 'Current User'
            }, null, 'material_ordered');
            updated = true;
        }

        if (toolingStep && !toolingStep.isCompleted) {
            updateChecklistStep(woId, toolingStep.id, {
                isCompleted: true,
                completedAt: timestamp,
                completedByName: 'Current User'
            }, null, 'tooling_ordered');
            updated = true;
        }
    }

    if (updated) {
        showToast(`All ordering steps complete for ${wo.woNumber}`, 'success');
        refreshCurrentView();
    } else {
        showToast(`All ordering steps already complete for ${wo.woNumber}`, 'info');
    }
}

function markReceivingStepComplete(woId, stepKey, stepName) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);

    if (!wo) {
        return;
    }

    // For multi-part work orders, update all line items
    if (wo.lineItems && wo.lineItems.length > 0) {
        let updated = false;

        for (const item of wo.lineItems) {
            const checklist = item.checklist || getDefaultChecklist();
            const step = checklist.find(s => s.stepKey === stepKey);

            if (step && !step.isCompleted) {
                updateChecklistStep(woId, step.id, {
                    isCompleted: true,
                    completedAt: new Date().toISOString(),
                    completedByName: 'Current User'
                }, item.id, stepKey);
                updated = true;
            }
        }

        if (!updated) {
            return;
        }
    } else {
        // Legacy single-part structure
        const checklist = wo.checklist || getDefaultChecklist();
        const step = checklist.find(s => s.stepKey === stepKey);

        if (!step || step.isCompleted) {
            return;
        }

        const result = updateChecklistStep(woId, step.id, {
            isCompleted: true,
            completedAt: new Date().toISOString(),
            completedByName: 'Current User'
        }, null, stepKey);

        if (!result) {
            return;
        }
    }

    showToast(`${stepName} for ${wo.woNumber}`, 'success');
    refreshCurrentView();
}

function markAllReceivingComplete(woId) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    if (!wo) return;

    const timestamp = new Date().toISOString();
    let updated = false;

    // For multi-part work orders, update all line items
    if (wo.lineItems && wo.lineItems.length > 0) {
        for (const item of wo.lineItems) {
            const checklist = item.checklist || getDefaultChecklist();

            const materialReceiveStep = checklist.find(s => s.stepKey === 'material_received');
            const toolingReceiveStep = checklist.find(s => s.stepKey === 'tooling_received');

            if (materialReceiveStep && !materialReceiveStep.isCompleted) {
                updateChecklistStep(woId, materialReceiveStep.id, {
                    isCompleted: true,
                    completedAt: timestamp,
                    completedByName: 'Current User'
                }, item.id, 'material_received');
                updated = true;
            }

            if (toolingReceiveStep && !toolingReceiveStep.isCompleted) {
                updateChecklistStep(woId, toolingReceiveStep.id, {
                    isCompleted: true,
                    completedAt: timestamp,
                    completedByName: 'Current User'
                }, item.id, 'tooling_received');
                updated = true;
            }
        }
    } else {
        // Legacy single-part structure
        const checklist = wo.checklist || getDefaultChecklist();

        const materialReceiveStep = checklist.find(s => s.stepKey === 'material_received');
        const toolingReceiveStep = checklist.find(s => s.stepKey === 'tooling_received');

        if (materialReceiveStep && !materialReceiveStep.isCompleted) {
            updateChecklistStep(woId, materialReceiveStep.id, {
                isCompleted: true,
                completedAt: timestamp,
                completedByName: 'Current User'
            }, null, 'material_received');
            updated = true;
        }

        if (toolingReceiveStep && !toolingReceiveStep.isCompleted) {
            updateChecklistStep(woId, toolingReceiveStep.id, {
                isCompleted: true,
                completedAt: timestamp,
                completedByName: 'Current User'
            }, null, 'tooling_received');
            updated = true;
        }
    }

    if (updated) {
        showToast(`All receiving steps complete for ${wo.woNumber}`, 'success');
        refreshCurrentView();
    } else {
        showToast(`All receiving steps already complete for ${wo.woNumber}`, 'info');
    }
}

function markInvoicingComplete(woId) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);

    if (!wo) {
        return;
    }

    // For multi-part work orders, update all line items
    if (wo.lineItems && wo.lineItems.length > 0) {
        let updated = false;

        for (const item of wo.lineItems) {
            const checklist = item.checklist || getDefaultChecklist();
            const step = checklist.find(s => s.stepKey === 'invoicing_complete');

            if (step && !step.isCompleted) {
                updateChecklistStep(woId, step.id, {
                    isCompleted: true,
                    completedAt: new Date().toISOString(),
                    completedByName: 'Current User'
                }, item.id, 'invoicing_complete');
                updated = true;
            }
        }

        if (!updated) {
            return;
        }
    } else {
        // Legacy single-part structure
        const checklist = wo.checklist || getDefaultChecklist();
        const step = checklist.find(s => s.stepKey === 'invoicing_complete');

        if (!step || step.isCompleted) {
            return;
        }

        const result = updateChecklistStep(woId, step.id, {
            isCompleted: true,
            completedAt: new Date().toISOString(),
            completedByName: 'Current User'
        }, null, 'invoicing_complete');

        if (!result) {
            return;
        }
    }

    showToast(`Invoicing completed for ${wo.woNumber}`, 'success');
    
    // Automatically archive the work order after invoicing is complete
    autoArchiveWorkOrder(woId, wo.woNumber);
}

// Auto-archive without confirmation (called after invoicing is complete)
function autoArchiveWorkOrder(woId, woNumber) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    
    if (!wo) {
        return;
    }
    
    // Set archive metadata
    const now = new Date().toISOString();
    wo.archivedAt = now;
    wo.completedAt = now;  // Used for sorting in archived view
    wo.status = 'Archived';
    wo.completionPercentage = 100;
    
    // Move to archived work orders - use immediate save to prevent race conditions
    const archivedWorkOrders = storage.get(STORAGE_KEYS.ARCHIVED_WORK_ORDERS) || [];
    
    // Prevent duplicates by checking if already archived
    const existingIndex = archivedWorkOrders.findIndex(a => a.id === woId);
    if (existingIndex === -1) {
        archivedWorkOrders.unshift(wo); // Add to beginning of array
    } else {
        archivedWorkOrders[existingIndex] = wo; // Update existing
    }
    
    // Use immediate save (true) to ensure data is persisted before view refresh
    storage.set(STORAGE_KEYS.ARCHIVED_WORK_ORDERS, archivedWorkOrders, true);
    
    // Remove from active work orders
    const updatedWorkOrders = workOrders.filter(w => w.id !== woId);
    saveWorkOrders(updatedWorkOrders);
    
    // Force flush any pending saves
    storage.flushDirty();
    
    showToast(`Work order ${woNumber} has been archived`, 'success');
    refreshCurrentView();
}

function archiveWorkOrder(woId) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);

    if (!wo) {
        showToast('Work order not found', 'error');
        return;
    }

    // Check if invoicing is complete before allowing archive
    let invoicingComplete = false;

    if (wo.lineItems && wo.lineItems.length > 0) {
        invoicingComplete = wo.lineItems.every(item => {
            const checklist = item.checklist || [];
            const step = checklist.find(s => s.stepKey === 'invoicing_complete');
            return step?.isCompleted || false;
        });
    } else {
        const checklist = wo.checklist || [];
        const step = checklist.find(s => s.stepKey === 'invoicing_complete');
        invoicingComplete = step?.isCompleted || false;
    }

    if (!invoicingComplete) {
        showToast('Cannot archive: Invoicing must be completed first', 'error');
        return;
    }

    // Confirm archiving
    if (!confirm(`Are you sure you want to archive work order ${wo.woNumber}? This will move it to the archived work orders section.`)) {
        return;
    }

    // Set archive metadata
    const now = new Date().toISOString();
    wo.archivedAt = now;
    wo.completedAt = now;  // Used for sorting in archived view
    wo.status = 'Archived';
    wo.completionPercentage = 100;

    // Move to archived work orders
    const archivedWorkOrders = storage.get(STORAGE_KEYS.ARCHIVED_WORK_ORDERS) || [];
    
    // Prevent duplicates
    const existingIndex = archivedWorkOrders.findIndex(a => a.id === woId);
    if (existingIndex === -1) {
        archivedWorkOrders.unshift(wo);
    } else {
        archivedWorkOrders[existingIndex] = wo;
    }
    
    // Use immediate save
    storage.set(STORAGE_KEYS.ARCHIVED_WORK_ORDERS, archivedWorkOrders, true);

    // Remove from active work orders
    const updatedWorkOrders = workOrders.filter(w => w.id !== woId);
    saveWorkOrders(updatedWorkOrders);

    showToast(`Work order ${wo.woNumber} has been archived`, 'success');
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
        let issueStepKey = null;
        if (lineItemId != null && wo.lineItems) {
            const li = wo.lineItems.find(i => i.id === lineItemId);
            const lc = li?.checklist || getDefaultChecklist();
            const st = lc.find(s => s.id === stepId || Number(s.id) === Number(stepId));
            issueStepKey = st?.stepKey || null;
        } else {
            const c = wo.checklist || getDefaultChecklist();
            const st = c.find(s => s.id === stepId || Number(s.id) === Number(stepId));
            issueStepKey = st?.stepKey || null;
        }
        updateChecklistStep(woId, stepId, {
            hasIssue: true,
            issueType: issue.issueType,
            issueSeverity: issue.severity,
            issueDescription: issue.description,
            issueReportedAt: issue.reportedAt
        }, lineItemId, issueStepKey);
        
        closeModal('issueModal');
        showToast(`Issue reported for ${wo.woNumber} - ${partNumber}`, 'warning');
        if (callback) callback();
    });
}

// ==================== WO-LINKED TASK MODAL (from workcenter) ====================
function showCreateWoLinkedTaskModal(woId, stepId, stepName, lineItemId, stepKey, onDone) {
    const workOrders = getWorkOrders();
    const wo = workOrders.find(w => w.id === woId);
    if (!wo) return;

    let partNumber = wo.partNumber || 'N/A';
    let partDescription = '';
    if (lineItemId && wo.lineItems) {
        const lineItem = wo.lineItems.find(item => item.id === lineItemId);
        if (lineItem) {
            partNumber = lineItem.partNumber;
            partDescription = lineItem.description || '';
        }
    }

    const defaultTitle = `${wo.woNumber} — ${partNumber}`;

    const content = `
        <div class="p-6" id="woLinkedTaskModalRoot">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-plus mr-2 text-orange-400"></i>New Task from Work Order
                </h3>
                <button onclick="BPERP.common.closeModal('woLinkedTaskModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <div class="mb-4 p-3 rounded" style="background: var(--color-dark-bg);">
                <div class="font-medium text-white">${wo.woNumber}</div>
                <div class="text-sm text-white">${partNumber}${partDescription ? ` - ${partDescription}` : ''}</div>
                <div class="text-sm" style="color: var(--color-text-muted);">${wo.customerName}</div>
                <div class="text-sm" style="color: var(--color-text-muted);">Step: ${stepName}</div>
            </div>
            <form id="woLinkedTaskForm" class="space-y-4">
                <div>
                    <label class="form-label">Title *</label>
                    <input type="text" name="title" required class="form-input w-full" value="${escapeAttr(defaultTitle)}" placeholder="Task title">
                </div>
                <div>
                    <label class="form-label">Description / instructions</label>
                    <textarea name="description" class="form-input w-full" rows="4" placeholder="Notes or instructions..."></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Category</label>
                        <select name="category" class="form-input w-full">
                            <option value="General">General</option>
                            <option value="Tooling">Tooling</option>
                            <option value="Purchasing">Purchasing</option>
                            <option value="Quality">Quality</option>
                            <option value="Safety">Safety</option>
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
                        <label class="form-label">Due date</label>
                        <input type="date" name="dueDate" class="form-input w-full">
                    </div>
                </div>
                <div>
                    <label class="form-label">Estimated Duration</label>
                    <input type="text" name="estimatedDuration" class="form-input w-full" placeholder="e.g., 2 hours">
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('woLinkedTaskModal')"
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex-1">
                        <i class="fa-solid fa-plus mr-2"></i>Create Task
                    </button>
                </div>
            </form>
        </div>
    `;

    createModal('woLinkedTaskModal', content, { width: 'w-full max-w-lg' });

    document.getElementById('woLinkedTaskForm').addEventListener('submit', (e) => {
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
            createdAt: new Date().toISOString(),
            isRecurring: false,
            recurrence: null,
            source: 'workcenter',
            linkedWorkOrderId: woId,
            linkedWorkOrderNumber: wo.woNumber,
            linkedLineItemId: lineItemId,
            linkedWorkflowStepKey: stepKey || null,
            linkedWorkflowStepName: stepName,
            linkedPartNumber: partNumber
        };

        let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
        miscTasks.push(task);
        storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);

        closeModal('woLinkedTaskModal');
        showToast(`Task "${task.title}" created`, 'success');
        if (onDone) onDone();
    });
}

// ==================== MISC TASK RECURRENCE (local dates, 0=Sun .. 6=Sat) ====================
function miscWeekdayOptionsHtml(selected) {
    const days = [
        { v: 0, l: 'Sunday' }, { v: 1, l: 'Monday' }, { v: 2, l: 'Tuesday' }, { v: 3, l: 'Wednesday' },
        { v: 4, l: 'Thursday' }, { v: 5, l: 'Friday' }, { v: 6, l: 'Saturday' }
    ];
    return days.map(d => `<option value="${d.v}" ${String(selected) === String(d.v) ? 'selected' : ''}>${d.l}</option>`).join('');
}

/** Nth weekday in month; if fewer than nth occurrences, use last occurrence of that weekday in the month. */
function findNthWeekdayInMonth(year, monthIndex, nth, dayOfWeek) {
    let count = 0;
    let lastMatch = null;
    for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, monthIndex, d);
        if (dt.getMonth() !== monthIndex) break;
        if (dt.getDay() === dayOfWeek) {
            count++;
            lastMatch = new Date(dt);
            if (count === nth) return lastMatch;
        }
    }
    return lastMatch;
}

function computeNextDueDate(recurrence, fromDate) {
    if (!recurrence || recurrence.kind === 'none') return null;
    const from = new Date(fromDate);
    from.setHours(12, 0, 0, 0);

    if (recurrence.kind === 'weekly') {
        const target = ((recurrence.dayOfWeek ?? 5) + 7) % 7;
        const d = new Date(from);
        d.setDate(d.getDate() + 1);
        let steps = 0;
        while (d.getDay() !== target && steps < 370) {
            d.setDate(d.getDate() + 1);
            steps++;
        }
        return d.toISOString().split('T')[0];
    }

    if (recurrence.kind === 'monthlyNth') {
        const nth = Math.min(4, Math.max(1, parseInt(recurrence.nth, 10) || 1));
        const targetDow = ((recurrence.dayOfWeek ?? 1) + 7) % 7;
        let y = from.getFullYear();
        let m = from.getMonth();
        let candidate = findNthWeekdayInMonth(y, m, nth, targetDow);
        if (!candidate) return null;
        let candMid = new Date(candidate);
        candMid.setHours(12, 0, 0, 0);
        if (candMid <= from) {
            m += 1;
            if (m > 11) {
                m = 0;
                y += 1;
            }
            candidate = findNthWeekdayInMonth(y, m, nth, targetDow);
        }
        return candidate ? candidate.toISOString().split('T')[0] : null;
    }
    return null;
}

function parseMiscRecurrenceFromForm(formData) {
    const recurring = formData.get('isRecurring') === '1' || formData.get('isRecurring') === 'on';
    if (!recurring) {
        return { isRecurring: false, recurrence: null };
    }
    const kind = formData.get('recurrenceKind') || 'weekly';
    if (kind === 'monthlyNth') {
        return {
            isRecurring: true,
            recurrence: {
                kind: 'monthlyNth',
                nth: parseInt(formData.get('monthlyNth'), 10) || 1,
                dayOfWeek: parseInt(formData.get('monthlyDayOfWeek'), 10) || 1
            }
        };
    }
    return {
        isRecurring: true,
        recurrence: {
            kind: 'weekly',
            dayOfWeek: parseInt(formData.get('weeklyDayOfWeek'), 10) || 5
        }
    };
}

function wireMiscRecurrenceUi(root, prefix) {
    const cb = root.querySelector(`#${prefix}miscRecurring`);
    const fields = root.querySelector(`#${prefix}miscRecurrenceFields`);
    const kind = root.querySelector(`#${prefix}miscRecurrenceKind`);
    const weeklyBlock = root.querySelector(`#${prefix}miscWeeklyFields`);
    const monthlyBlock = root.querySelector(`#${prefix}miscMonthlyFields`);
    const sync = () => {
        const on = cb?.checked;
        if (fields) fields.classList.toggle('hidden', !on);
        if (!on) return;
        const k = kind?.value || 'weekly';
        if (weeklyBlock) weeklyBlock.classList.toggle('hidden', k !== 'weekly');
        if (monthlyBlock) monthlyBlock.classList.toggle('hidden', k !== 'monthlyNth');
    };
    cb?.addEventListener('change', sync);
    kind?.addEventListener('change', sync);
    sync();
}

function miscRecurrenceFieldsHtml(prefix, task) {
    const rec = task?.recurrence;
    const isRec = task?.isRecurring && rec;
    const kind = rec?.kind === 'monthlyNth' ? 'monthlyNth' : 'weekly';
    const wDay = rec?.kind === 'weekly' ? (rec.dayOfWeek ?? 5) : 5;
    const mNth = rec?.kind === 'monthlyNth' ? (rec.nth ?? 1) : 1;
    const mDow = rec?.kind === 'monthlyNth' ? (rec.dayOfWeek ?? 1) : 1;
    return `
                <div class="flex items-center gap-2">
                    <input type="checkbox" id="${prefix}miscRecurring" name="isRecurring" value="1" class="rounded border-gray-600"
                        ${isRec ? 'checked' : ''}>
                    <label for="${prefix}miscRecurring" class="form-label mb-0">Recurring task</label>
                </div>
                <div id="${prefix}miscRecurrenceFields" class="space-y-3 border border-gray-600 rounded p-3 ${isRec ? '' : 'hidden'}">
                    <div>
                        <label class="form-label">Pattern</label>
                        <select id="${prefix}miscRecurrenceKind" name="recurrenceKind" class="form-input w-full">
                            <option value="weekly" ${kind === 'weekly' ? 'selected' : ''}>Every week (same weekday)</option>
                            <option value="monthlyNth" ${kind === 'monthlyNth' ? 'selected' : ''}>Monthly (Nth weekday, e.g. 3rd Monday)</option>
                        </select>
                    </div>
                    <div id="${prefix}miscWeeklyFields" class="${kind === 'weekly' ? '' : 'hidden'}">
                        <label class="form-label">Day of week</label>
                        <select name="weeklyDayOfWeek" class="form-input w-full">${miscWeekdayOptionsHtml(wDay)}</select>
                    </div>
                    <div id="${prefix}miscMonthlyFields" class="${kind === 'monthlyNth' ? '' : 'hidden'}">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="form-label">Week in month</label>
                                <select name="monthlyNth" class="form-input w-full">
                                    <option value="1" ${mNth === 1 ? 'selected' : ''}>1st</option>
                                    <option value="2" ${mNth === 2 ? 'selected' : ''}>2nd</option>
                                    <option value="3" ${mNth === 3 ? 'selected' : ''}>3rd</option>
                                    <option value="4" ${mNth === 4 ? 'selected' : ''}>4th</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Day of week</label>
                                <select name="monthlyDayOfWeek" class="form-input w-full">${miscWeekdayOptionsHtml(mDow)}</select>
                            </div>
                        </div>
                    </div>
                </div>`;
}

// ==================== CREATE MISCELLANEOUS TASK MODAL ====================
function showCreateMiscTaskModal() {
    const content = `
        <div class="p-6" id="createTaskModalRoot">
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
                        <label class="form-label">Due date (first occurrence)</label>
                        <input type="date" name="dueDate" class="form-input w-full">
                    </div>
                </div>
                ${miscRecurrenceFieldsHtml('create', null)}
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
    
    const root = document.getElementById('createTaskModalRoot');
    if (root) {
        wireMiscRecurrenceUi(root, 'create');
    }
    
    document.getElementById('createTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const { isRecurring, recurrence } = parseMiscRecurrenceFromForm(formData);

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
            createdAt: new Date().toISOString(),
            isRecurring,
            recurrence: isRecurring ? recurrence : null
        };

        if (isRecurring && !task.dueDate) {
            showToast('Set a due date for the first occurrence of a recurring task', 'warning');
            return;
        }
        
        let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
        miscTasks.push(task);
        storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
        
        closeModal('createTaskModal');
        showToast(`Task "${task.title}" created successfully!`, 'success');
        
        if (tasksState.isActive) {
            refreshCurrentView();
        }
    });
}

// ==================== MISC TASK ACTIONS ====================
function completeMiscTask(taskId) {
    let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
    const taskIndex = miscTasks.findIndex(t => t.id === parseInt(taskId));
    
    if (taskIndex === -1) {
        showToast('Task not found', 'error');
        return;
    }
    
    const task = miscTasks[taskIndex];
    if (task.isRecurring && task.recurrence) {
        const nextDue = computeNextDueDate(task.recurrence, new Date());
        if (!nextDue) {
            showToast('Could not compute next due date for recurring task', 'error');
            return;
        }
        task.lastCompletedAt = new Date().toISOString();
        task.dueDate = nextDue;
        task.status = 'Not Started';
        delete task.completedAt;
        storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
        showToast(`Recurring task "${task.title}" completed — next due ${formatDate(nextDue)}`, 'success');
    } else {
        task.status = 'Completed';
        task.completedAt = new Date().toISOString();
        storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
        showToast(`Task "${task.title}" marked as complete!`, 'success');
    }
    
    if (tasksState.isActive) {
        refreshCurrentView();
    }
}

function editMiscTask(taskId) {
    const miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
    const task = miscTasks.find(t => t.id === parseInt(taskId));
    
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    const content = `
        <div class="p-6" id="editTaskModalRoot">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2" style="color: var(--color-accent-primary);"></i>Edit Task
                </h3>
                <button onclick="BPERP.common.closeModal('editTaskModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            
            <form id="editTaskForm" class="space-y-4">
                <input type="hidden" name="taskId" value="${task.id}">
                
                <div>
                    <label class="form-label">Title *</label>
                    <input type="text" name="title" value="${task.title || ''}" required
                        class="form-input w-full" placeholder="Task title">
                </div>
                
                <div>
                    <label class="form-label">Description</label>
                    <textarea name="description" rows="3" class="form-input w-full" 
                        placeholder="Task description">${task.description || ''}</textarea>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Category</label>
                        <select name="category" class="form-input w-full">
                            <option value="General" ${task.category === 'General' ? 'selected' : ''}>General</option>
                            <option value="Administrative" ${task.category === 'Administrative' ? 'selected' : ''}>Administrative</option>
                            <option value="Quality" ${task.category === 'Quality' ? 'selected' : ''}>Quality</option>
                            <option value="Safety" ${task.category === 'Safety' ? 'selected' : ''}>Safety</option>
                            <option value="Training" ${task.category === 'Training' ? 'selected' : ''}>Training</option>
                            <option value="Other" ${task.category === 'Other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Priority</label>
                        <select name="priority" class="form-input w-full">
                            <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Normal" ${task.priority === 'Normal' ? 'selected' : ''}>Normal</option>
                            <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
                            <option value="Urgent" ${task.priority === 'Urgent' ? 'selected' : ''}>Urgent</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Status</label>
                        <select name="status" class="form-input w-full">
                            <option value="Not Started" ${task.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                            <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Assigned To</label>
                        <input type="text" name="assignedTo" value="${task.assignedTo || ''}"
                            class="form-input w-full" placeholder="Person responsible">
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Due date (next / first occurrence)</label>
                        <input type="date" name="dueDate" value="${task.dueDate || ''}"
                            class="form-input w-full">
                    </div>
                    <div>
                        <label class="form-label">Est. Duration</label>
                        <input type="text" name="estimatedDuration" value="${task.estimatedDuration || ''}"
                            class="form-input w-full" placeholder="e.g., 2 hours">
                    </div>
                </div>
                ${miscRecurrenceFieldsHtml('edit', task)}
                
                <div class="flex space-x-3 pt-4 border-t border-gray-700">
                    <button type="button" onclick="BPERP.common.closeModal('editTaskModal')" 
                        class="btn btn-secondary flex-1">Cancel</button>
                    <button type="submit" class="btn btn-primary flex-1">
                        <i class="fa-solid fa-save mr-2"></i>Save Changes
                    </button>
                </div>
            </form>
        </div>
    `;
    
    createModal('editTaskModal', content, { width: 'w-full max-w-lg' });
    
    const editRoot = document.getElementById('editTaskModalRoot');
    if (editRoot) {
        wireMiscRecurrenceUi(editRoot, 'edit');
    }
    
    document.getElementById('editTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const { isRecurring, recurrence } = parseMiscRecurrenceFromForm(formData);
        const dueDate = formData.get('dueDate');
        if (isRecurring && !dueDate) {
            showToast('Set a due date for a recurring task', 'warning');
            return;
        }
        
        let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
        const taskIndex = miscTasks.findIndex(t => t.id === parseInt(formData.get('taskId')));
        
        if (taskIndex === -1) {
            showToast('Task not found', 'error');
            return;
        }
        
        const next = {
            ...miscTasks[taskIndex],
            title: formData.get('title'),
            description: formData.get('description'),
            category: formData.get('category'),
            priority: formData.get('priority'),
            status: formData.get('status'),
            assignedTo: formData.get('assignedTo'),
            dueDate,
            estimatedDuration: formData.get('estimatedDuration'),
            updatedAt: new Date().toISOString(),
            isRecurring,
            recurrence: isRecurring ? recurrence : null
        };
        if (!isRecurring) {
            delete next.lastCompletedAt;
        }
        miscTasks[taskIndex] = next;
        
        storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
        
        closeModal('editTaskModal');
        showToast(`Task "${miscTasks[taskIndex].title}" updated successfully!`, 'success');
        
        if (tasksState.isActive) {
            refreshCurrentView();
        }
    });
}

function deleteMiscTask(taskId, taskName) {
    if (!confirm(`Delete task "${taskName}"?`)) {
        return;
    }
    
    let miscTasks = storage.get(STORAGE_KEYS.MISC_TASKS) || [];
    miscTasks = miscTasks.filter(t => t.id !== parseInt(taskId));
    storage.set(STORAGE_KEYS.MISC_TASKS, miscTasks);
    
    showToast(`Task "${taskName}" deleted`, 'success');
    
    if (tasksState.isActive) {
        refreshCurrentView();
    }
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

// ==================== EXPORT FUNCTIONS ====================
async function exportTasks() {
    const workOrders = getWorkOrders();
    const activeWOs = workOrders.filter(wo => wo.completionPercentage < 100);

    const taskData = activeWOs.map(wo => {
        const ctx = getNextWorkflowStepWithLineItem(wo);
        const nextStep = ctx?.step;
        if (!nextStep) return null;

        const taskType = getTaskTypeFromStep(nextStep.stepKey);
        const typeConfig = TASK_TYPE_CONFIG[taskType] || TASK_TYPE_CONFIG.misc;
        const status = getWOWorkflowStatus(wo);
        const urgency = getWOUrgencyColor(wo.dueDate);

        let partNumber = wo.partNumber || '';
        if (ctx.lineItemId != null && wo.lineItems?.length) {
            const li = wo.lineItems.find(i => i.id === ctx.lineItemId);
            if (li?.partNumber) partNumber = li.partNumber;
        }

        return {
            woNumber: wo.woNumber,
            customerName: wo.customerName,
            partNumber,
            dueDate: wo.dueDate,
            taskType: typeConfig.label,
            nextStep: nextStep.stepName,
            status: status,
            urgency: urgency === 'red' ? 'Overdue' : urgency === 'yellow' ? 'Due Soon' : 'On Schedule',
            completionPercentage: wo.completionPercentage
        };
    }).filter(Boolean);

    const headers = ['woNumber', 'customerName', 'partNumber', 'dueDate', 'taskType', 'nextStep', 'status', 'urgency', 'completionPercentage'];
    await exportToCSV(taskData, 'tasks', headers);
    showToast('Tasks exported to CSV (Google Sheets compatible)', 'success');
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
