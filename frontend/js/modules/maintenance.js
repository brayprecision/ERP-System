/**
 * BPERP Dashboard - Machines module
 * Machine profiles, recurring maintenance tasks, and upgrade tasks
 */

import { 
    showToast, showDeleteConfirm, showLoadingSpinner,
    formatDate, DOMCache, createModal, closeModal, safeExecute, getUrgencyColor
} from './common.js';
import { storage } from './storage.js';

// ==================== STORAGE KEYS ====================
const MACHINES_KEY = 'bperp_machines';
const MAINTENANCE_HISTORY_KEY = 'bperp_maintenance_history';

const maintenanceState = {
    expandedMachineIds: new Set()
};

// ==================== DEMO DATA ====================
function getDefaultMachines() {
    const today = new Date();
    return [
        { 
            id: 1, machineName: 'CNC Mill 1', machineId: 'CNC-M1', manufacturer: 'Haas', model: 'VF-2', 
            serialNumber: 'HAAS-VF2-12345', purchaseDate: '2020-03-15', location: 'Bay 1',
            status: 'Active',
            maintenanceTasks: [
                { id: 1, taskName: 'Daily Coolant Check', frequency: 'Daily', lastCompleted: today.toISOString().split('T')[0], nextDue: today.toISOString().split('T')[0], requiredMaterials: [{ material: 'Coolant', quantity: '1 gal' }], estimatedTime: 15, instructions: 'Check coolant level' },
                { id: 2, taskName: 'Weekly Lubrication', frequency: 'Weekly', lastCompleted: new Date(today.getTime() - 5*24*60*60*1000).toISOString().split('T')[0], nextDue: new Date(today.getTime() + 2*24*60*60*1000).toISOString().split('T')[0], requiredMaterials: [{ material: 'Way Oil', quantity: '0.5 gal' }], estimatedTime: 30, instructions: 'Lubricate all guides' }
            ],
            upgradeTasks: [
                { id: 1, title: '4th-axis ready — controller parameter review', description: 'Verify parameters before first part run', status: 'Planned', priority: 'Medium', targetDate: '2026-04-15', createdAt: today.toISOString() }
            ]
        },
        { 
            id: 2, machineName: 'CNC Mill 2', machineId: 'CNC-M2', manufacturer: 'Haas', model: 'VF-3', 
            serialNumber: 'HAAS-VF3-54321', purchaseDate: '2021-08-20', location: 'Bay 2',
            status: 'Active', maintenanceTasks: []
        },
        { 
            id: 3, machineName: 'CNC Lathe', machineId: 'CNC-L1', manufacturer: 'Haas', model: 'ST-10', 
            serialNumber: 'HAAS-ST10-67890', purchaseDate: '2019-11-10', location: 'Bay 3',
            status: 'Active',
            maintenanceTasks: [
                { id: 1, taskName: 'Oil Change', frequency: 'Monthly', lastCompleted: new Date(today.getTime() - 35*24*60*60*1000).toISOString().split('T')[0], nextDue: new Date(today.getTime() - 5*24*60*60*1000).toISOString().split('T')[0], requiredMaterials: [{ material: 'Hydraulic Oil', quantity: '2 gal' }], estimatedTime: 90, instructions: 'Drain and replace' }
            ]
        },
        { 
            id: 4, machineName: 'Bandsaw', machineId: 'SAW-01', manufacturer: 'DoAll', model: 'C-916M', 
            serialNumber: 'DOALL-C916-11111', purchaseDate: '2018-05-22', location: 'Saw Area',
            status: 'Active', maintenanceTasks: []
        },
        { 
            id: 5, machineName: 'Manual Mill', machineId: 'MM-01', manufacturer: 'Bridgeport', model: 'Series I', 
            serialNumber: 'BP-S1-99999', purchaseDate: '2015-01-01', location: 'Manual Area',
            status: 'Active',
            maintenanceTasks: [
                { id: 1, taskName: 'Full Service', frequency: 'Annual', lastCompleted: new Date(today.getTime() - 400*24*60*60*1000).toISOString().split('T')[0], nextDue: new Date(today.getTime() - 35*24*60*60*1000).toISOString().split('T')[0], requiredMaterials: [{ material: 'Various oils', quantity: '3 qt' }], estimatedTime: 240, instructions: 'Complete service' }
            ]
        }
    ];
}

// ==================== DATA ACCESS ====================
function normalizeMachine(m) {
    if (!m.maintenanceTasks) m.maintenanceTasks = [];
    if (!m.upgradeTasks) m.upgradeTasks = [];
    return m;
}

function getMachines() {
    let data = storage.get(MACHINES_KEY);
    if (!data) {
        data = getDefaultMachines();
        storage.set(MACHINES_KEY, data);
    }
    data.forEach(normalizeMachine);
    return data;
}

function saveMachines(machines) {
    storage.set(MACHINES_KEY, machines, true);
}

function getMaintenanceHistory() {
    return storage.get(MAINTENANCE_HISTORY_KEY, []);
}

function saveMaintenanceHistory(history) {
    storage.set(MAINTENANCE_HISTORY_KEY, history, true);
}

// ==================== MAINTENANCE STATUS ====================
function getMaintenanceStatusColor(machine) {
    const tasks = machine.maintenanceTasks || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let hasOverdue = false, hasAttention = false;
    
    tasks.forEach(t => {
        const nextDue = new Date(t.nextDue);
        const daysUntil = (nextDue - today) / (1000 * 60 * 60 * 24);
        if (daysUntil < 0) hasOverdue = true;
        else if (daysUntil <= 3) hasAttention = true;
    });
    
    if (hasOverdue) return 'red';
    if (hasAttention) return 'yellow';
    return 'green';
}

function getMachineBorderColor(machine) {
    return getMaintenanceStatusColor(machine);
}

function getEarliestMaintenanceDueStr(maintList) {
    const dates = maintList.map(t => t.nextDue).filter(Boolean).sort();
    return dates.length ? dates[0] : null;
}

function escAttr(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

export function toggleMachineExpand(machineId) {
    const id = parseInt(machineId, 10);
    if (Number.isNaN(id)) return;
    if (maintenanceState.expandedMachineIds.has(id)) {
        maintenanceState.expandedMachineIds.delete(id);
    } else {
        maintenanceState.expandedMachineIds.add(id);
    }
    loadMaintenanceTasks();
}

// ==================== VIEW FUNCTION ====================
export function loadMaintenanceTasks() {
    showLoadingSpinner();
    
    safeExecute(() => {
        const machines = getMachines();
        renderMaintenanceView(machines);
    }, () => {
        showToast('Error loading machines', 'error');
    }, 'loadMaintenanceTasks');
}

function renderMaintenanceView(machines) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const machineCards = machines.map(m => {
        const isExpanded = maintenanceState.expandedMachineIds.has(m.id);
        const borderColor = getMachineBorderColor(m);
        const maintList = m.maintenanceTasks || [];
        const upList = m.upgradeTasks || [];
        const openUpgrades = upList.filter(u => (u.status || 'Planned') !== 'Complete').length;

        const maintRows = maintList.length > 0 ? maintList.map(t => {
            const nextDue = new Date(t.nextDue);
            const daysUntil = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
            const colorClass = daysUntil < 0 ? 'text-red-400' : daysUntil <= 3 ? 'text-yellow-400' : 'text-gray-400';
            const dueText = daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due Today' : `Due in ${daysUntil}d`;

            return `
                <div class="flex justify-between items-center py-2 text-sm border-b border-gray-700 gap-2">
                    <span class="text-gray-300 truncate">${escAttr(t.taskName)}</span>
                    <div class="flex items-center space-x-1 sm:space-x-2 shrink-0">
                        <span class="text-xs ${colorClass} mr-1">${dueText}</span>
                        <button type="button" data-action="complete-maintenance" data-machine-id="${m.id}" data-task-id="${t.id}" class="text-green-400 hover:text-green-300 p-1.5" title="Complete">
                            <i class="fa-solid fa-check"></i>
                        </button>
                        <button type="button" data-action="edit-maintenance-task" data-machine-id="${m.id}" data-task-id="${t.id}" class="text-blue-400 hover:text-blue-300 p-1.5" title="Edit task">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button type="button" data-action="delete-maintenance-task" data-machine-id="${m.id}" data-task-id="${t.id}" data-task-name="${escAttr(t.taskName)}" class="text-red-400 hover:text-red-300 p-1.5" title="Remove task">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('') : '<div class="text-sm text-gray-500 py-3">No scheduled maintenance tasks</div>';

        const upgradeRows = upList.length > 0 ? upList.map(u => {
            const st = u.status || 'Planned';
            const stClass = st === 'Complete' ? 'text-gray-500' : st === 'In Progress' ? 'text-blue-400' : 'text-amber-400';
            const target = u.targetDate ? formatDate(u.targetDate) : '—';
            return `
                <div class="flex justify-between items-start py-2 text-sm border-b border-gray-700 gap-2">
                    <div class="min-w-0">
                        <span class="text-gray-200 font-medium">${u.title || 'Untitled'}</span>
                        <div class="text-gray-500 text-xs truncate">${u.description || ''}</div>
                        <div class="text-xs text-gray-500 mt-0.5">Target: ${target} · <span class="${stClass}">${st}</span>${u.priority ? ` · ${u.priority}` : ''}</div>
                    </div>
                    <div class="flex items-center space-x-1 shrink-0">
                        ${st !== 'Complete' ? `
                        <button type="button" data-action="complete-upgrade-task" data-machine-id="${m.id}" data-task-id="${u.id}" class="text-green-400 hover:text-green-300" title="Mark complete">
                            <i class="fa-solid fa-check"></i>
                        </button>` : ''}
                        <button type="button" data-action="edit-upgrade-task" data-machine-id="${m.id}" data-task-id="${u.id}" class="text-blue-400 hover:text-blue-300" title="Edit">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button type="button" data-action="delete-upgrade-task" data-machine-id="${m.id}" data-task-id="${u.id}" data-task-title="${String(u.title || '').replace(/"/g, '&quot;')}" class="text-red-400 hover:text-red-300" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('') : '<div class="text-sm text-gray-500 py-3">No upgrade tasks</div>';

        const earliestDueStr = getEarliestMaintenanceDueStr(maintList);
        const nextDueLabel = earliestDueStr ? formatDate(earliestDueStr) : 'None';
        const urgencyForDue = maintList.length ? getUrgencyColor(earliestDueStr) : 'gray';

        return `
            <div class="card mb-4 border-l-4 border-l-${borderColor}-500" style="background: var(--color-card-bg);" data-machine-card-id="${m.id}">
                <div class="flex items-center justify-between p-4 gap-2">
                    <div class="flex items-center gap-4 min-w-0 flex-1 cursor-pointer hover:bg-gray-800/30 transition-colors rounded -m-2 p-2"
                         data-action="toggle-machine" data-id="${m.id}">
                        <span class="text-gray-500 shrink-0">
                            <i class="fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} transition-transform"></i>
                        </span>
                        <div class="min-w-0">
                            <span class="font-bold text-lg" style="color: var(--color-accent-primary);">${escAttr(m.machineName)}</span>
                            <span class="text-gray-400 ml-3 text-sm">${escAttr(m.machineId || '')}</span>
                            <span class="text-xs ml-2 px-2 py-1 rounded-full bg-gray-700 text-gray-300">${escAttr(`${m.manufacturer || ''} ${m.model || ''}`.trim())}</span>
                            <span class="text-xs ml-2 px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                                ${maintList.length} maint · ${openUpgrades} open upgrade${openUpgrades !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-4 shrink-0">
                        <div class="text-right hidden sm:block">
                            <div class="text-xs text-gray-500">Next maintenance</div>
                            <div class="text-${urgencyForDue}-400 font-medium text-sm">${maintList.length ? nextDueLabel : 'None'}</div>
                        </div>
                        <div class="text-right hidden md:block">
                            <div class="text-xs text-gray-500">Location</div>
                            <div class="text-gray-300 text-sm">${escAttr(m.location || 'N/A')}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">Status</div>
                            <div class="${m.status === 'Active' ? 'text-green-400' : 'text-yellow-400'} text-sm">${escAttr(m.status)}</div>
                        </div>
                        <div class="flex items-center gap-1 pl-2 border-l border-gray-600">
                            <button type="button" data-action="edit-machine" data-machine-id="${m.id}" class="text-blue-400 hover:text-blue-300 p-2" title="Edit machine">
                                <i class="fa-solid fa-edit"></i>
                            </button>
                            <button type="button" data-action="view-machine-history" data-machine-id="${m.id}" class="text-gray-400 hover:text-gray-300 p-2" title="History">
                                <i class="fa-solid fa-history"></i>
                            </button>
                            <button type="button" data-action="delete-machine" data-machine-id="${m.id}" data-machine-name="${escAttr(m.machineName)}" class="text-red-400 hover:text-red-300 p-2" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                ${isExpanded ? `
                <div class="border-t" style="border-color: var(--color-border); background: var(--color-dark-bg);">
                    <div class="p-4 pl-12 space-y-6">
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h5 class="text-xs font-medium uppercase" style="color: var(--color-text-muted);">Maintenance</h5>
                                <button type="button" data-action="add-maintenance-task" data-machine-id="${m.id}" class="text-accentGreen hover:text-green-300 text-sm">
                                    <i class="fa-solid fa-plus mr-1"></i>Add task
                                </button>
                            </div>
                            <div class="rounded-lg border border-gray-700/80 overflow-hidden px-3 bg-gray-900/20">
                                ${maintRows}
                            </div>
                        </div>
                        <div>
                            <div class="flex justify-between items-center mb-2">
                                <h5 class="text-xs font-medium uppercase" style="color: var(--color-text-muted);">Upgrades</h5>
                                <button type="button" data-action="add-upgrade-task" data-machine-id="${m.id}" class="text-accentGreen hover:text-green-300 text-sm">
                                    <i class="fa-solid fa-plus mr-1"></i>Add upgrade
                                </button>
                            </div>
                            <div class="rounded-lg border border-gray-700/80 overflow-hidden px-3 bg-gray-900/20">
                                ${upgradeRows}
                            </div>
                        </div>
                    </div>
                </div>` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="col-span-3">
            <div class="card p-4 mb-6">
                <div class="flex justify-between items-center">
                    <h3 class="text-lg font-medium" style="color: var(--color-accent-primary);">
                        <i class="fa-solid fa-industry mr-2"></i>Machines
                        <span class="text-sm ml-2" style="color: var(--color-text-muted);">(${machines.length} profiles)</span>
                    </h3>
                    <div class="flex space-x-2">
                        <button type="button" data-action="refresh-maintenance" class="text-sm hover:opacity-80" style="color: var(--color-text-secondary);">
                            <i class="fa-solid fa-refresh mr-1"></i>Refresh
                        </button>
                        <button type="button" data-action="add-machine" class="btn btn-primary text-sm">
                            <i class="fa-solid fa-plus mr-1"></i>Add Machine
                        </button>
                    </div>
                </div>
                <div class="flex gap-6 mt-4 text-xs">
                    <span><i class="fa-solid fa-circle text-green-500 mr-1"></i>On schedule</span>
                    <span><i class="fa-solid fa-circle text-yellow-500 mr-1"></i>Due within 3 days</span>
                    <span><i class="fa-solid fa-circle text-red-500 mr-1"></i>Overdue maintenance</span>
                </div>
            </div>
            ${machineCards || '<div class="card p-12 text-center" style="color: var(--color-text-muted);"><i class="fa-solid fa-industry text-5xl mb-4"></i><p>No machines configured</p></div>'}
        </div>
    `;
}

// ==================== CRUD OPERATIONS ====================
export function showAddMachineModal() {
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-plus-circle mr-2 text-accentGreen"></i>Add Machine
                </h3>
                <button onclick="BPERP.common.closeModal('machineModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="machineForm" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Machine Name *</label>
                        <input type="text" name="machineName" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Machine ID *</label>
                        <input type="text" name="machineId" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Manufacturer</label>
                        <input type="text" name="manufacturer" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Model</label>
                        <input type="text" name="model" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Serial Number</label>
                        <input type="text" name="serialNumber" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Location</label>
                        <input type="text" name="location" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('machineModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-accentGreen text-white px-4 py-2 rounded hover:bg-green-700">Add Machine</button>
                </div>
            </form>
        </div>
    `;
    
    createModal('machineModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('machineForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        const machines = getMachines();
        const newId = Math.max(...machines.map(m => m.id), 0) + 1;
        
        machines.push({
            id: newId,
            ...data,
            status: 'Active',
            maintenanceTasks: [],
            upgradeTasks: []
        });
        
        saveMachines(machines);
        closeModal('machineModal');
        showToast('Machine added successfully', 'success');
        loadMaintenanceTasks();
    });
}

export function editMachine(machineId) {
    const id = Number(machineId);
    if (machineId == null || machineId === '' || Number.isNaN(id)) {
        showToast('Could not open machine for editing', 'error');
        return;
    }
    const machines = getMachines();
    const machine = machines.find(m => Number(m.id) === id);
    if (!machine) {
        showToast('Machine not found', 'error');
        return;
    }
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2 text-blue-400"></i>Edit Machine
                </h3>
                <button onclick="BPERP.common.closeModal('machineModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <form id="machineForm" class="space-y-4">
                <input type="hidden" name="id" value="${machine.id}">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Machine Name *</label>
                        <input type="text" name="machineName" required value="${escAttr(machine.machineName)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Machine ID *</label>
                        <input type="text" name="machineId" required value="${escAttr(machine.machineId)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Manufacturer</label>
                        <input type="text" name="manufacturer" value="${escAttr(machine.manufacturer)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Model</label>
                        <input type="text" name="model" value="${escAttr(machine.model)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Serial Number</label>
                        <input type="text" name="serialNumber" value="${escAttr(machine.serialNumber)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Location</label>
                        <input type="text" name="location" value="${escAttr(machine.location)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Status</label>
                    <select name="status" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                        <option value="Active" ${machine.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Inactive" ${machine.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                        <option value="Retired" ${machine.status === 'Retired' ? 'selected' : ''}>Retired</option>
                    </select>
                </div>
                <div class="flex space-x-3 pt-4">
                    <button type="button" onclick="BPERP.common.closeModal('machineModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    
    createModal('machineModal', content, { width: 'w-full max-w-lg' });
    
    document.getElementById('machineForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        const machines = getMachines();
        const idx = machines.findIndex(m => Number(m.id) === parseInt(data.id, 10));
        
        if (idx !== -1) {
            machines[idx] = { ...machines[idx], ...data, id: parseInt(data.id, 10) };
            saveMachines(machines);
            closeModal('machineModal');
            showToast('Machine updated successfully', 'success');
            loadMaintenanceTasks();
        }
    });
}

export function deleteMachine(machineId, machineName) {
    showDeleteConfirm(machineName || 'this machine', 'machine', machineId, () => {
        const machines = getMachines().filter(m => Number(m.id) !== Number(machineId));
        saveMachines(machines);
        showToast('Machine deleted successfully', 'success');
        loadMaintenanceTasks();
    });
}

export function completeMaintenanceTask(machineId, taskId) {
    const machines = getMachines();
    const machineIdx = machines.findIndex(m => Number(m.id) === Number(machineId));
    if (machineIdx === -1) return;
    
    const machine = machines[machineIdx];
    const taskIdx = machine.maintenanceTasks?.findIndex(t => Number(t.id) === Number(taskId));
    if (taskIdx === -1 || taskIdx === undefined) return;
    
    const task = machine.maintenanceTasks[taskIdx];
    
    // Log to history
    const history = getMaintenanceHistory();
    history.push({
        id: history.length + 1,
        machineId: parseInt(machineId),
        machineName: machine.machineName,
        taskName: task.taskName,
        completedAt: new Date().toISOString(),
        completedBy: 'Current User'
    });
    saveMaintenanceHistory(history);
    
    // Calculate next due date
    const today = new Date();
    let nextDue = new Date();
    
    switch (task.frequency) {
        case 'Daily': nextDue.setDate(today.getDate() + 1); break;
        case 'Weekly': nextDue.setDate(today.getDate() + 7); break;
        case 'Monthly': nextDue.setMonth(today.getMonth() + 1); break;
        case 'Quarterly': nextDue.setMonth(today.getMonth() + 3); break;
        case 'Annual': nextDue.setFullYear(today.getFullYear() + 1); break;
    }
    
    machine.maintenanceTasks[taskIdx].lastCompleted = today.toISOString().split('T')[0];
    machine.maintenanceTasks[taskIdx].nextDue = nextDue.toISOString().split('T')[0];
    
    machines[machineIdx] = machine;
    saveMachines(machines);
    
    showToast('Maintenance completed', 'success');
    loadMaintenanceTasks();
}

export function showMachineHistory(machineId) {
    const machines = getMachines();
    const machine = machines.find(m => Number(m.id) === Number(machineId));
    if (!machine) return;
    
    const history = getMaintenanceHistory().filter(h => Number(h.machineId) === Number(machineId)).slice(-20);
    
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-history mr-2 text-blue-400"></i>Maintenance History
                </h3>
                <button onclick="BPERP.common.closeModal('historyModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-sm text-gray-400 mb-4">${machine.machineName}</p>
            
            ${history.length > 0 ? `
                <div class="space-y-3 max-h-96 overflow-y-auto">
                    ${history.reverse().map(h => `
                        <div class="bg-gray-800 p-3 rounded border-l-4 border-green-600">
                            <div class="flex justify-between items-start">
                                <span class="font-medium text-white">${h.taskName}</span>
                                <span class="text-xs text-gray-400">${formatDate(h.completedAt)}</span>
                            </div>
                            <div class="text-xs text-gray-500 mt-1">Completed by: ${h.completedBy || 'Unknown'}</div>
                        </div>
                    `).join('')}
                </div>
            ` : '<div class="text-center py-8 text-gray-500">No maintenance history</div>'}
            
            <div class="mt-4">
                <button onclick="BPERP.common.closeModal('historyModal')" class="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Close</button>
            </div>
        </div>
    `;
    
    createModal('historyModal', content, { width: 'w-full max-w-lg' });
}

function nextTaskId(tasks) {
    return Math.max(0, ...tasks.map(t => Number(t.id) || 0)) + 1;
}

function parseMaterialsLines(text) {
    if (!text || !String(text).trim()) return [];
    return String(text).trim().split('\n').map(line => {
        const parts = line.split(',').map(s => s.trim());
        if (parts.length >= 2) {
            return { material: parts[0], quantity: parts.slice(1).join(', ') };
        }
        return { material: line.trim(), quantity: '—' };
    });
}

function formatMaterialsForForm(mats) {
    if (!mats || !mats.length) return '';
    return mats.map(x => `${x.material || ''}${x.quantity ? `, ${x.quantity}` : ''}`).join('\n');
}

export function showAddMaintenanceTaskModal(machineId) {
    const machines = getMachines();
    const machine = machines.find(m => m.id === parseInt(machineId, 10));
    if (!machine) {
        showToast('Machine not found', 'error');
        return;
    }
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-wrench mr-2 text-accentGreen"></i>Add maintenance task
                </h3>
                <button onclick="BPERP.common.closeModal('maintTaskModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-sm text-gray-400 mb-4">${machine.machineName}</p>
            <form id="addMaintTaskForm" class="space-y-4">
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Task name *</label>
                    <input type="text" name="taskName" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Frequency *</label>
                        <select name="frequency" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Annual">Annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Next due *</label>
                        <input type="date" name="nextDue" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Estimated time (minutes)</label>
                    <input type="number" name="estimatedTime" min="0" value="30" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Instructions</label>
                    <textarea name="instructions" rows="2" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"></textarea>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Materials (optional, one per line: Material, qty)</label>
                    <textarea name="materials" rows="2" placeholder="Coolant, 1 gal" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"></textarea>
                </div>
                <div class="flex space-x-3 pt-2">
                    <button type="button" onclick="BPERP.common.closeModal('maintTaskModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-accentGreen text-white px-4 py-2 rounded hover:bg-green-700">Add task</button>
                </div>
            </form>
        </div>
    `;

    createModal('maintTaskModal', content, { width: 'w-full max-w-lg' });

    document.getElementById('addMaintTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const task = {
            id: nextTaskId(machine.maintenanceTasks),
            taskName: fd.get('taskName'),
            frequency: fd.get('frequency'),
            nextDue: fd.get('nextDue'),
            lastCompleted: '',
            estimatedTime: parseInt(fd.get('estimatedTime'), 10) || 0,
            instructions: fd.get('instructions') || '',
            requiredMaterials: parseMaterialsLines(fd.get('materials'))
        };
        machine.maintenanceTasks.push(task);
        saveMachines(machines);
        closeModal('maintTaskModal');
        showToast('Maintenance task added', 'success');
        loadMaintenanceTasks();
    });
}

export function showEditMaintenanceTaskModal(machineId, taskId) {
    const machines = getMachines();
    const machine = machines.find(m => Number(m.id) === Number(machineId));
    if (!machine) {
        showToast('Machine not found', 'error');
        return;
    }
    const task = machine.maintenanceTasks.find(t => Number(t.id) === Number(taskId));
    if (!task) {
        showToast('Maintenance task not found', 'error');
        return;
    }

    const freq = task.frequency || 'Weekly';
    const materialsText = formatMaterialsForForm(task.requiredMaterials);
    const nextDueVal = escAttr(task.nextDue || '');
    const est = Number(task.estimatedTime) || 0;

    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2 text-blue-400"></i>Edit maintenance task
                </h3>
                <button onclick="BPERP.common.closeModal('maintEditTaskModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-sm text-gray-400 mb-4">${escAttr(machine.machineName)}</p>
            <form id="editMaintTaskForm" class="space-y-4">
                <input type="hidden" name="taskId" value="${task.id}">
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Task name *</label>
                    <input type="text" name="taskName" required value="${escAttr(task.taskName)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Frequency *</label>
                        <select name="frequency" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="Daily" ${freq === 'Daily' ? 'selected' : ''}>Daily</option>
                            <option value="Weekly" ${freq === 'Weekly' ? 'selected' : ''}>Weekly</option>
                            <option value="Monthly" ${freq === 'Monthly' ? 'selected' : ''}>Monthly</option>
                            <option value="Quarterly" ${freq === 'Quarterly' ? 'selected' : ''}>Quarterly</option>
                            <option value="Annual" ${freq === 'Annual' ? 'selected' : ''}>Annual</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Next due *</label>
                        <input type="date" name="nextDue" required value="${nextDueVal}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Estimated time (minutes)</label>
                    <input type="number" name="estimatedTime" min="0" value="${est}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Instructions</label>
                    <textarea name="instructions" rows="2" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">${escAttr(task.instructions || '')}</textarea>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Materials (optional, one per line: Material, qty)</label>
                    <textarea name="materials" rows="2" placeholder="Coolant, 1 gal" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">${escAttr(materialsText)}</textarea>
                </div>
                <div class="flex space-x-3 pt-2">
                    <button type="button" onclick="BPERP.common.closeModal('maintEditTaskModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save changes</button>
                </div>
            </form>
        </div>
    `;

    createModal('maintEditTaskModal', content, { width: 'w-full max-w-lg' });

    document.getElementById('editMaintTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const tid = parseInt(fd.get('taskId'), 10);
        const tIdx = machine.maintenanceTasks.findIndex(t => Number(t.id) === tid);
        if (tIdx === -1) {
            showToast('Task not found', 'error');
            return;
        }
        const prev = machine.maintenanceTasks[tIdx];
        machine.maintenanceTasks[tIdx] = {
            ...prev,
            id: prev.id,
            taskName: fd.get('taskName'),
            frequency: fd.get('frequency'),
            nextDue: fd.get('nextDue'),
            estimatedTime: parseInt(fd.get('estimatedTime'), 10) || 0,
            instructions: fd.get('instructions') || '',
            requiredMaterials: parseMaterialsLines(fd.get('materials'))
        };
        saveMachines(machines);
        closeModal('maintEditTaskModal');
        showToast('Maintenance task updated', 'success');
        loadMaintenanceTasks();
    });
}

export function deleteMaintenanceTask(machineId, taskId, taskName) {
    const label = taskName || 'this task';
    showDeleteConfirm(label, 'maintenance task', taskId, () => {
        const machines = getMachines();
        const machine = machines.find(m => Number(m.id) === Number(machineId));
        if (!machine) return;
        machine.maintenanceTasks = machine.maintenanceTasks.filter(t => Number(t.id) !== Number(taskId));
        saveMachines(machines);
        showToast('Maintenance task removed', 'success');
        loadMaintenanceTasks();
    });
}

export function showAddUpgradeTaskModal(machineId) {
    const machines = getMachines();
    const machine = machines.find(m => m.id === parseInt(machineId, 10));
    if (!machine) {
        showToast('Machine not found', 'error');
        return;
    }
    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-arrow-trend-up mr-2 text-amber-400"></i>Add upgrade task
                </h3>
                <button onclick="BPERP.common.closeModal('upgradeTaskModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-sm text-gray-400 mb-4">${machine.machineName}</p>
            <form id="addUpgradeTaskForm" class="space-y-4">
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Title *</label>
                    <input type="text" name="title" required class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea name="description" rows="2" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Status</label>
                        <select name="status" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="Planned" selected>Planned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Complete">Complete</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Priority</label>
                        <select name="priority" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="Low">Low</option>
                            <option value="Medium" selected>Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Target date</label>
                    <input type="date" name="targetDate" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div class="flex space-x-3 pt-2">
                    <button type="button" onclick="BPERP.common.closeModal('upgradeTaskModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700">Save</button>
                </div>
            </form>
        </div>
    `;

    createModal('upgradeTaskModal', content, { width: 'w-full max-w-lg' });

    document.getElementById('addUpgradeTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const task = {
            id: nextTaskId(machine.upgradeTasks),
            title: fd.get('title'),
            description: fd.get('description') || '',
            status: fd.get('status'),
            priority: fd.get('priority'),
            targetDate: fd.get('targetDate') || '',
            createdAt: new Date().toISOString()
        };
        machine.upgradeTasks.push(task);
        saveMachines(machines);
        closeModal('upgradeTaskModal');
        showToast('Upgrade task added', 'success');
        loadMaintenanceTasks();
    });
}

export function completeUpgradeTask(machineId, taskId) {
    const machines = getMachines();
    const mIdx = machines.findIndex(m => m.id === parseInt(machineId, 10));
    if (mIdx === -1) return;
    const machine = machines[mIdx];
    const tIdx = machine.upgradeTasks.findIndex(t => t.id === parseInt(taskId, 10));
    if (tIdx === -1) return;
    machine.upgradeTasks[tIdx].status = 'Complete';
    machine.upgradeTasks[tIdx].completedAt = new Date().toISOString();
    saveMachines(machines);
    showToast('Upgrade marked complete', 'success');
    loadMaintenanceTasks();
}

export function editUpgradeTask(machineId, taskId) {
    const machines = getMachines();
    const machine = machines.find(m => m.id === parseInt(machineId, 10));
    if (!machine) return;
    const task = machine.upgradeTasks.find(t => t.id === parseInt(taskId, 10));
    if (!task) return;

    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    const content = `
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-white">
                    <i class="fa-solid fa-edit mr-2 text-blue-400"></i>Edit upgrade task
                </h3>
                <button onclick="BPERP.common.closeModal('upgradeEditModal')" class="text-gray-400 hover:text-white">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
            <p class="text-sm text-gray-400 mb-4">${esc(machine.machineName)}</p>
            <form id="editUpgradeTaskForm" class="space-y-4">
                <input type="hidden" name="taskId" value="${task.id}">
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Title *</label>
                    <input type="text" name="title" required value="${esc(task.title)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea name="description" rows="2" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">${esc(task.description)}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Status</label>
                        <select name="status" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="Planned" ${task.status === 'Planned' ? 'selected' : ''}>Planned</option>
                            <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                            <option value="Complete" ${task.status === 'Complete' ? 'selected' : ''}>Complete</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Priority</label>
                        <select name="priority" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                            <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm text-gray-400 mb-1">Target date</label>
                    <input type="date" name="targetDate" value="${esc(task.targetDate)}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                </div>
                <div class="flex space-x-3 pt-2">
                    <button type="button" onclick="BPERP.common.closeModal('upgradeEditModal')" class="flex-1 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-500">Cancel</button>
                    <button type="submit" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</button>
                </div>
            </form>
        </div>
    `;

    createModal('upgradeEditModal', content, { width: 'w-full max-w-lg' });

    document.getElementById('editUpgradeTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const id = parseInt(fd.get('taskId'), 10);
        const idx = machine.upgradeTasks.findIndex(t => t.id === id);
        if (idx === -1) return;
        machine.upgradeTasks[idx] = {
            ...machine.upgradeTasks[idx],
            title: fd.get('title'),
            description: fd.get('description') || '',
            status: fd.get('status'),
            priority: fd.get('priority'),
            targetDate: fd.get('targetDate') || ''
        };
        saveMachines(machines);
        closeModal('upgradeEditModal');
        showToast('Upgrade task updated', 'success');
        loadMaintenanceTasks();
    });
}

export function deleteUpgradeTask(machineId, taskId, title) {
    const name = title || 'this upgrade task';
    if (!confirm(`Delete upgrade task "${name}"?`)) return;
    const machines = getMachines();
    const machine = machines.find(m => m.id === parseInt(machineId, 10));
    if (!machine) return;
    machine.upgradeTasks = machine.upgradeTasks.filter(t => t.id !== parseInt(taskId, 10));
    saveMachines(machines);
    showToast('Upgrade task removed', 'success');
    loadMaintenanceTasks();
}

// ==================== ACTION HANDLERS ====================
export function registerActionHandlers(registerFn) {
    registerFn('toggle-machine', (target) => toggleMachineExpand(target.dataset.id));
    registerFn('add-machine', showAddMachineModal);
    registerFn('edit-machine', (target) => editMachine(target.dataset.machineId || target.dataset.id));
    registerFn('delete-machine', (target) => deleteMachine(
        target.dataset.machineId || target.dataset.id,
        target.dataset.machineName || target.dataset.name
    ));
    registerFn('view-machine-history', (target) => showMachineHistory(target.dataset.machineId || target.dataset.id));
    registerFn('add-maintenance-task', (target) => showAddMaintenanceTaskModal(target.dataset.machineId));
    registerFn('complete-maintenance', (target) => completeMaintenanceTask(target.dataset.machineId, target.dataset.taskId));
    registerFn('edit-maintenance-task', (target) => showEditMaintenanceTaskModal(target.dataset.machineId, target.dataset.taskId));
    registerFn('delete-maintenance-task', (target) => deleteMaintenanceTask(
        target.dataset.machineId,
        target.dataset.taskId,
        target.dataset.taskName
    ));
    registerFn('add-upgrade-task', (target) => showAddUpgradeTaskModal(target.dataset.machineId));
    registerFn('complete-upgrade-task', (target) => completeUpgradeTask(target.dataset.machineId, target.dataset.taskId));
    registerFn('edit-upgrade-task', (target) => editUpgradeTask(target.dataset.machineId, target.dataset.taskId));
    registerFn('delete-upgrade-task', (target) => deleteUpgradeTask(target.dataset.machineId, target.dataset.taskId, target.dataset.taskTitle));
    registerFn('refresh-maintenance', loadMaintenanceTasks);
}

// ==================== INITIALIZATION ====================
export function init() {
    if (window.BPERP?.common?.registerActionHandler) {
        registerActionHandlers(window.BPERP.common.registerActionHandler);
    }
}
