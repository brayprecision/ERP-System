/**
 * BPERP Dashboard - Machine Maintenance Module
 * Machine profiles and maintenance task management
 */

import { 
    showToast, showDeleteConfirm, showLoadingSpinner,
    formatDate, DOMCache, createModal, closeModal, safeExecute
} from './common.js';
import { storage, STORAGE_KEYS } from './storage.js';

// ==================== STORAGE KEYS ====================
const MACHINES_KEY = 'bperp_machines';
const MAINTENANCE_HISTORY_KEY = 'bperp_maintenance_history';

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
function getMachines() {
    let data = storage.get(MACHINES_KEY);
    if (!data) {
        data = getDefaultMachines();
        storage.set(MACHINES_KEY, data);
    }
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

function calculateStats(machines) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today.getTime() + 7*24*60*60*1000);
    const history = getMaintenanceHistory();
    const weekAgo = new Date(today.getTime() - 7*24*60*60*1000);
    
    let overdue = 0, scheduledToday = 0, upcomingThisWeek = 0;
    
    machines.forEach(m => {
        (m.maintenanceTasks || []).forEach(t => {
            const nextDue = new Date(t.nextDue);
            if (nextDue < today) overdue++;
            else if (nextDue.toDateString() === today.toDateString()) scheduledToday++;
            else if (nextDue <= weekAhead) upcomingThisWeek++;
        });
    });
    
    const completedThisWeek = history.filter(h => new Date(h.completedAt) >= weekAgo).length;
    
    return { overdue, scheduledToday, upcomingThisWeek, completedThisWeek };
}

// ==================== VIEW FUNCTION ====================
export function loadMaintenanceTasks() {
    showLoadingSpinner();
    
    safeExecute(() => {
        const machines = getMachines();
        const stats = calculateStats(machines);
        renderMaintenanceView(machines, stats);
    }, () => {
        showToast('Error loading maintenance', 'error');
    }, 'loadMaintenanceTasks');
}

function renderMaintenanceView(machines, stats) {
    const container = DOMCache.get('dashboardContent');
    if (!container) return;
    
    const machineCards = machines.map(m => {
        const statusColor = getMaintenanceStatusColor(m);
        const upcomingTasks = (m.maintenanceTasks || []).slice(0, 3);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return `
            <div class="bg-gray-800 p-4 rounded-lg border-l-4 ${statusColor === 'red' ? 'border-red-600' : statusColor === 'yellow' ? 'border-yellow-600' : 'border-green-600'}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-medium text-white">${m.machineName}</h4>
                        <p class="text-xs text-gray-500">${m.machineId} | ${m.manufacturer} ${m.model}</p>
                    </div>
                    <div class="flex space-x-1">
                        <button data-action="edit-machine" data-id="${m.id}" class="text-blue-400 hover:text-blue-300 text-sm" title="Edit">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button data-action="view-machine-history" data-id="${m.id}" class="text-gray-400 hover:text-gray-300 text-sm" title="History">
                            <i class="fa-solid fa-history"></i>
                        </button>
                        <button data-action="delete-machine" data-id="${m.id}" data-name="${m.machineName}" class="text-red-400 hover:text-red-300 text-sm" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="text-xs text-gray-400 mb-2">
                    <span class="mr-3"><i class="fa-solid fa-map-marker-alt mr-1"></i>${m.location || 'N/A'}</span>
                    <span class="${m.status === 'Active' ? 'text-green-400' : 'text-yellow-400'}">
                        <i class="fa-solid fa-circle mr-1 text-[8px]"></i>${m.status}
                    </span>
                </div>
                
                <div class="border-t border-gray-700 pt-2 mt-2">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs text-gray-500 uppercase">Maintenance Tasks</span>
                        <button data-action="add-maintenance-task" data-machine-id="${m.id}" class="text-accentGreen hover:text-green-300 text-xs">
                            <i class="fa-solid fa-plus mr-1"></i>Add
                        </button>
                    </div>
                    ${upcomingTasks.length > 0 ? upcomingTasks.map(t => {
                        const nextDue = new Date(t.nextDue);
                        const daysUntil = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
                        const colorClass = daysUntil < 0 ? 'text-red-400' : daysUntil <= 3 ? 'text-yellow-400' : 'text-gray-400';
                        const dueText = daysUntil < 0 ? 'Overdue' : daysUntil === 0 ? 'Due Today' : `Due in ${daysUntil}d`;
                        
                        return `
                            <div class="flex justify-between items-center py-1 text-xs border-b border-gray-700">
                                <span class="text-gray-300">${t.taskName}</span>
                                <div class="flex items-center space-x-2">
                                    <span class="${colorClass}">${dueText}</span>
                                    <button data-action="complete-maintenance" data-machine-id="${m.id}" data-task-id="${t.id}" class="text-green-400 hover:text-green-300" title="Complete">
                                        <i class="fa-solid fa-check"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('') : '<div class="text-xs text-gray-500 py-2">No scheduled tasks</div>'}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="col-span-3">
            <div class="grid grid-cols-4 gap-4 mb-6">
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Scheduled Today</p>
                    <p class="text-2xl font-bold text-white">${stats.scheduledToday}</p>
                </div>
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Overdue</p>
                    <p class="text-2xl font-bold text-red-500">${stats.overdue}</p>
                </div>
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Completed This Week</p>
                    <p class="text-2xl font-bold text-green-500">${stats.completedThisWeek}</p>
                </div>
                <div class="card p-4">
                    <p class="text-xs text-gray-500 uppercase">Upcoming This Week</p>
                    <p class="text-2xl font-bold text-blue-500">${stats.upcomingThisWeek}</p>
                </div>
            </div>
            
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-gray-400 text-sm font-medium">
                    <i class="fa-solid fa-industry mr-2 text-purple-400"></i>Machine Profiles (${machines.length})
                </h3>
                <div class="flex space-x-2">
                    <button data-action="refresh-maintenance" class="text-gray-400 hover:text-white text-sm">
                        <i class="fa-solid fa-refresh mr-1"></i>Refresh
                    </button>
                    <button data-action="add-machine" class="bg-accentGreen text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                        <i class="fa-solid fa-plus mr-1"></i>Add Machine
                    </button>
                </div>
            </div>
            
            <div class="flex gap-4 mb-4 text-xs">
                <span><i class="fa-solid fa-circle text-green-500 mr-1"></i>Good</span>
                <span><i class="fa-solid fa-circle text-yellow-500 mr-1"></i>Due Soon</span>
                <span><i class="fa-solid fa-circle text-red-500 mr-1"></i>Overdue</span>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                ${machineCards || '<div class="col-span-2 text-center py-8 text-gray-500">No machines configured</div>'}
            </div>
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
            maintenanceTasks: []
        });
        
        saveMachines(machines);
        closeModal('machineModal');
        showToast('Machine added successfully', 'success');
        loadMaintenanceTasks();
    });
}

export function editMachine(machineId) {
    const machines = getMachines();
    const machine = machines.find(m => m.id === parseInt(machineId));
    if (!machine) return;
    
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
                        <input type="text" name="machineName" required value="${machine.machineName || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Machine ID *</label>
                        <input type="text" name="machineId" required value="${machine.machineId || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Manufacturer</label>
                        <input type="text" name="manufacturer" value="${machine.manufacturer || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Model</label>
                        <input type="text" name="model" value="${machine.model || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Serial Number</label>
                        <input type="text" name="serialNumber" value="${machine.serialNumber || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Location</label>
                        <input type="text" name="location" value="${machine.location || ''}" class="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600">
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
        const idx = machines.findIndex(m => m.id === parseInt(data.id));
        
        if (idx !== -1) {
            machines[idx] = { ...machines[idx], ...data, id: parseInt(data.id) };
            saveMachines(machines);
            closeModal('machineModal');
            showToast('Machine updated successfully', 'success');
            loadMaintenanceTasks();
        }
    });
}

export function deleteMachine(machineId, machineName) {
    showDeleteConfirm(machineName, 'machine', machineId, () => {
        const machines = getMachines().filter(m => m.id !== parseInt(machineId));
        saveMachines(machines);
        showToast('Machine deleted successfully', 'success');
        loadMaintenanceTasks();
    });
}

export function completeMaintenanceTask(machineId, taskId) {
    const machines = getMachines();
    const machineIdx = machines.findIndex(m => m.id === parseInt(machineId));
    if (machineIdx === -1) return;
    
    const machine = machines[machineIdx];
    const taskIdx = machine.maintenanceTasks?.findIndex(t => t.id === parseInt(taskId));
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
    const machine = machines.find(m => m.id === parseInt(machineId));
    if (!machine) return;
    
    const history = getMaintenanceHistory().filter(h => h.machineId === parseInt(machineId)).slice(-20);
    
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

// ==================== ACTION HANDLERS ====================
export function registerActionHandlers(registerFn) {
    registerFn('add-machine', showAddMachineModal);
    registerFn('edit-machine', (target) => editMachine(target.dataset.id));
    registerFn('delete-machine', (target) => deleteMachine(target.dataset.id, target.dataset.name));
    registerFn('view-machine-history', (target) => showMachineHistory(target.dataset.id));
    registerFn('add-maintenance-task', (target) => showToast('Add maintenance task for machine ' + target.dataset.machineId, 'info'));
    registerFn('complete-maintenance', (target) => completeMaintenanceTask(target.dataset.machineId, target.dataset.taskId));
    registerFn('refresh-maintenance', loadMaintenanceTasks);
}

// ==================== INITIALIZATION ====================
export function init() {
    if (window.BPERP?.common?.registerActionHandler) {
        registerActionHandlers(window.BPERP.common.registerActionHandler);
    }
}
