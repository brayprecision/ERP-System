// Maintenance API Routes for BPERP
const express = require('express');
const router = express.Router();

// In-memory storage for maintenance tasks
let maintenanceDefinitions = [
  {
    id: 1, machineType: 'cnc_mill', taskName: 'Daily Coolant Check',
    description: 'Check coolant level and concentration', category: 'daily',
    frequencyType: 'days', frequencyValue: 1, estimatedDuration: 10,
    requiresShutdown: false, instructions: 'Check coolant reservoir level. Test concentration with refractometer. Top off as needed.',
    isActive: true
  },
  {
    id: 2, machineType: 'cnc_mill', taskName: 'Weekly Lubrication',
    description: 'Lubricate way covers and check auto-lube system', category: 'weekly',
    frequencyType: 'days', frequencyValue: 7, estimatedDuration: 30,
    requiresShutdown: false, instructions: 'Apply way lube to exposed ways. Check auto-lube reservoir level.',
    isActive: true
  },
  {
    id: 3, machineType: 'cnc_mill', taskName: 'Monthly Full Service',
    description: 'Complete machine inspection and service', category: 'monthly',
    frequencyType: 'days', frequencyValue: 30, estimatedDuration: 120,
    requiresShutdown: true, instructions: 'Check spindle runout. Verify axis backlash. Clean chip conveyor. Replace filters.',
    isActive: true
  },
  {
    id: 4, machineType: 'cnc_lathe', taskName: 'Daily Chip Removal',
    description: 'Clean chips from work area', category: 'daily',
    frequencyType: 'days', frequencyValue: 1, estimatedDuration: 15,
    requiresShutdown: false, instructions: 'Remove chips from chuck, turret, and chip conveyor.',
    isActive: true
  },
  {
    id: 5, machineType: 'saw', taskName: 'Blade Tension Check',
    description: 'Verify blade tension and tracking', category: 'weekly',
    frequencyType: 'days', frequencyValue: 7, estimatedDuration: 15,
    requiresShutdown: false, instructions: 'Check blade tension gauge. Verify blade tracking. Inspect blade for wear/damage.',
    isActive: true
  }
];

let maintenanceMaterials = [
  { id: 1, taskDefinitionId: 1, materialName: 'Coolant Concentrate', partNumber: 'COOL-001', quantity: 1, unit: 'GAL', isCritical: true },
  { id: 2, taskDefinitionId: 2, materialName: 'Way Lube Oil', partNumber: 'OIL-WAY-01', quantity: 0.5, unit: 'QT', isCritical: true },
  { id: 3, taskDefinitionId: 3, materialName: 'Spindle Oil', partNumber: 'OIL-SPIN-01', quantity: 1, unit: 'QT', isCritical: true },
  { id: 4, taskDefinitionId: 3, materialName: 'Air Filter', partNumber: 'FILT-AIR-01', quantity: 1, unit: 'EA', isCritical: false },
  { id: 5, taskDefinitionId: 3, materialName: 'Coolant Filter', partNumber: 'FILT-COOL-01', quantity: 1, unit: 'EA', isCritical: false }
];

let maintenanceTasks = [
  {
    id: 1, definitionId: 1, machineId: 1, taskName: 'Daily Coolant Check - CNC Mill 1',
    description: 'Check coolant level and concentration', category: 'daily',
    scheduledDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0],
    frequencyType: 'days', status: 'Scheduled', machineName: 'CNC Mill 1', machineType: 'cnc_mill'
  },
  {
    id: 2, definitionId: 2, machineId: 1, taskName: 'Weekly Lubrication - CNC Mill 1',
    description: 'Lubricate way covers and check auto-lube system', category: 'weekly',
    scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    frequencyType: 'days', status: 'Scheduled', machineName: 'CNC Mill 1', machineType: 'cnc_mill'
  },
  {
    id: 3, definitionId: 3, machineId: 1, taskName: 'Monthly Full Service - CNC Mill 1',
    description: 'Complete machine inspection and service', category: 'monthly',
    scheduledDate: '2025-01-31', dueDate: '2025-01-31',
    frequencyType: 'days', status: 'Scheduled', machineName: 'CNC Mill 1', machineType: 'cnc_mill'
  },
  {
    id: 4, definitionId: 4, machineId: 3, taskName: 'Daily Chip Removal - CNC Lathe',
    description: 'Clean chips from work area', category: 'daily',
    scheduledDate: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0],
    frequencyType: 'days', status: 'Scheduled', machineName: 'CNC Lathe', machineType: 'cnc_lathe'
  },
  {
    id: 5, definitionId: 5, machineId: 4, taskName: 'Blade Tension Check - Bandsaw',
    description: 'Verify blade tension and tracking', category: 'weekly',
    scheduledDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    frequencyType: 'days', status: 'Scheduled', machineName: 'Bandsaw', machineType: 'saw'
  },
  {
    id: 6, machineId: 3, taskName: 'Oil Change - CNC Lathe',
    description: 'Replace hydraulic and spindle oil', category: 'monthly',
    scheduledDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    dueDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    frequencyType: 'days', status: 'Overdue', machineName: 'CNC Lathe', machineType: 'cnc_lathe'
  }
];

let maintenanceHistory = [];
let nextTaskId = 7;
let nextDefId = 6;

// Helper: Check if task is overdue
function updateTaskStatus(task) {
  if (task.status === 'Complete' || task.status === 'Deferred') return task;
  
  const now = new Date();
  const dueDate = new Date(task.dueDate);
  
  if (dueDate < now) {
    return { ...task, status: 'Overdue' };
  }
  return task;
}

// Helper: Get stats
function getStats(taskList) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekFromNow = new Date(today.getTime() + 7 * 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  
  return {
    scheduledToday: taskList.filter(t => {
      const due = new Date(t.dueDate);
      return due >= today && due < new Date(today.getTime() + 86400000) && 
             t.status !== 'Complete';
    }).length,
    overdue: taskList.filter(t => t.status === 'Overdue').length,
    completedThisWeek: taskList.filter(t => {
      return t.status === 'Complete' && t.completedAt && 
             new Date(t.completedAt) >= weekAgo;
    }).length,
    upcomingThisWeek: taskList.filter(t => {
      const due = new Date(t.dueDate);
      return due >= today && due <= weekFromNow && t.status !== 'Complete';
    }).length,
    byCategory: taskList.reduce((acc, t) => {
      if (t.category && t.status !== 'Complete') {
        acc[t.category] = (acc[t.category] || 0) + 1;
      }
      return acc;
    }, {})
  };
}

// GET /api/maintenance/tasks - List maintenance tasks
router.get('/tasks', (req, res) => {
  try {
    let result = maintenanceTasks.map(updateTaskStatus);
    
    // Filter by machine
    if (req.query.machineId) {
      result = result.filter(t => t.machineId === parseInt(req.query.machineId));
    }
    
    // Filter by category
    if (req.query.category) {
      result = result.filter(t => t.category === req.query.category);
    }
    
    // Filter by status
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
      result = result.filter(t => statuses.includes(t.status));
    }
    
    // Filter by date range
    if (req.query.dueDateFrom) {
      result = result.filter(t => t.dueDate >= req.query.dueDateFrom);
    }
    if (req.query.dueDateTo) {
      result = result.filter(t => t.dueDate <= req.query.dueDateTo);
    }
    
    // Sort by due date
    result.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    // Add materials to each task
    result = result.map(t => ({
      ...t,
      materials: t.definitionId ? 
        maintenanceMaterials.filter(m => m.taskDefinitionId === t.definitionId) : []
    }));
    
    res.json({
      success: true,
      data: result,
      stats: getStats(result)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/maintenance/tasks/:id - Get single task
router.get('/tasks/:id', (req, res) => {
  try {
    let task = maintenanceTasks.find(t => t.id === parseInt(req.params.id));
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    task = updateTaskStatus(task);
    
    // Get definition and materials
    const definition = task.definitionId ? 
      maintenanceDefinitions.find(d => d.id === task.definitionId) : null;
    const materials = task.definitionId ?
      maintenanceMaterials.filter(m => m.taskDefinitionId === task.definitionId) : [];
    
    res.json({
      success: true,
      data: {
        ...task,
        definition,
        materials
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/maintenance/tasks - Create maintenance task
router.post('/tasks', (req, res) => {
  try {
    const {
      definitionId, machineId, taskName, description, category,
      dueDate, frequencyType, machineName, machineType
    } = req.body;
    
    if (!machineId || !taskName || !dueDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'machineId, taskName, and dueDate are required' 
      });
    }
    
    const newTask = {
      id: nextTaskId++,
      definitionId,
      machineId,
      taskName,
      description,
      category,
      scheduledDate: dueDate,
      dueDate,
      frequencyType,
      status: 'Scheduled',
      machineName,
      machineType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    maintenanceTasks.push(newTask);
    
    res.status(201).json({
      success: true,
      data: newTask
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/maintenance/tasks/:id/start - Start maintenance
router.put('/tasks/:id/start', (req, res) => {
  try {
    const taskIndex = maintenanceTasks.findIndex(t => t.id === parseInt(req.params.id));
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const { performerName } = req.body;
    
    maintenanceTasks[taskIndex].status = 'In Progress';
    maintenanceTasks[taskIndex].startedAt = new Date().toISOString();
    if (performerName) maintenanceTasks[taskIndex].performerName = performerName;
    maintenanceTasks[taskIndex].updatedAt = new Date().toISOString();
    
    // Log history
    maintenanceHistory.push({
      id: maintenanceHistory.length + 1,
      machineId: maintenanceTasks[taskIndex].machineId,
      maintenanceTaskId: maintenanceTasks[taskIndex].id,
      action: 'started',
      performedByName: performerName,
      performedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: maintenanceTasks[taskIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/maintenance/tasks/:id/complete - Complete maintenance
router.put('/tasks/:id/complete', (req, res) => {
  try {
    const taskIndex = maintenanceTasks.findIndex(t => t.id === parseInt(req.params.id));
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const {
      completedByName, actualDuration, issuesFound, partsReplaced, notes, readings
    } = req.body;
    
    maintenanceTasks[taskIndex].status = 'Complete';
    maintenanceTasks[taskIndex].completedAt = new Date().toISOString();
    maintenanceTasks[taskIndex].completedByName = completedByName;
    maintenanceTasks[taskIndex].actualDuration = actualDuration;
    maintenanceTasks[taskIndex].issuesFound = issuesFound;
    maintenanceTasks[taskIndex].partsReplaced = partsReplaced;
    maintenanceTasks[taskIndex].notes = notes;
    maintenanceTasks[taskIndex].readings = readings;
    maintenanceTasks[taskIndex].updatedAt = new Date().toISOString();
    
    // Log history
    maintenanceHistory.push({
      id: maintenanceHistory.length + 1,
      machineId: maintenanceTasks[taskIndex].machineId,
      maintenanceTaskId: maintenanceTasks[taskIndex].id,
      action: 'completed',
      description: `Completed: ${maintenanceTasks[taskIndex].taskName}`,
      performedByName: completedByName,
      performedAt: new Date().toISOString(),
      notes: issuesFound || notes
    });
    
    // Create next scheduled task if recurring
    const definition = maintenanceTasks[taskIndex].definitionId ?
      maintenanceDefinitions.find(d => d.id === maintenanceTasks[taskIndex].definitionId) : null;
    
    if (definition && definition.frequencyValue) {
      const nextDueDate = new Date(
        Date.now() + definition.frequencyValue * 86400000
      ).toISOString().split('T')[0];
      
      const nextTask = {
        id: nextTaskId++,
        definitionId: definition.id,
        machineId: maintenanceTasks[taskIndex].machineId,
        taskName: maintenanceTasks[taskIndex].taskName,
        description: maintenanceTasks[taskIndex].description,
        category: maintenanceTasks[taskIndex].category,
        scheduledDate: nextDueDate,
        dueDate: nextDueDate,
        frequencyType: maintenanceTasks[taskIndex].frequencyType,
        status: 'Scheduled',
        machineName: maintenanceTasks[taskIndex].machineName,
        machineType: maintenanceTasks[taskIndex].machineType,
        createdAt: new Date().toISOString()
      };
      
      maintenanceTasks.push(nextTask);
    }
    
    res.json({
      success: true,
      data: maintenanceTasks[taskIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/maintenance/tasks/:id/defer - Defer maintenance
router.put('/tasks/:id/defer', (req, res) => {
  try {
    const taskIndex = maintenanceTasks.findIndex(t => t.id === parseInt(req.params.id));
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const { deferredTo, deferredReason, deferredByName } = req.body;
    
    if (!deferredTo || !deferredReason) {
      return res.status(400).json({ 
        success: false, 
        error: 'deferredTo and deferredReason are required' 
      });
    }
    
    maintenanceTasks[taskIndex].status = 'Deferred';
    maintenanceTasks[taskIndex].dueDate = deferredTo;
    maintenanceTasks[taskIndex].deferredTo = deferredTo;
    maintenanceTasks[taskIndex].deferredReason = deferredReason;
    maintenanceTasks[taskIndex].deferredByName = deferredByName;
    maintenanceTasks[taskIndex].updatedAt = new Date().toISOString();
    
    // Log history
    maintenanceHistory.push({
      id: maintenanceHistory.length + 1,
      machineId: maintenanceTasks[taskIndex].machineId,
      maintenanceTaskId: maintenanceTasks[taskIndex].id,
      action: 'deferred',
      description: `Deferred to ${deferredTo}: ${deferredReason}`,
      performedByName: deferredByName,
      performedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: maintenanceTasks[taskIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/maintenance/tasks/:id/issue - Report issue during maintenance
router.post('/tasks/:id/issue', (req, res) => {
  try {
    const taskIndex = maintenanceTasks.findIndex(t => t.id === parseInt(req.params.id));
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const { issueDescription, severity = 'Medium', reportedByName } = req.body;
    
    if (!issueDescription) {
      return res.status(400).json({ success: false, error: 'Issue description is required' });
    }
    
    maintenanceTasks[taskIndex].issuesFound = 
      (maintenanceTasks[taskIndex].issuesFound || '') + '\n' + issueDescription;
    maintenanceTasks[taskIndex].updatedAt = new Date().toISOString();
    
    // Log history
    maintenanceHistory.push({
      id: maintenanceHistory.length + 1,
      machineId: maintenanceTasks[taskIndex].machineId,
      maintenanceTaskId: maintenanceTasks[taskIndex].id,
      action: 'issue_found',
      description: issueDescription,
      performedByName: reportedByName,
      performedAt: new Date().toISOString(),
      notes: `Severity: ${severity}`
    });
    
    res.json({
      success: true,
      data: maintenanceTasks[taskIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/maintenance/tasks/:id - Delete/cancel task
router.delete('/tasks/:id', (req, res) => {
  try {
    const taskIndex = maintenanceTasks.findIndex(t => t.id === parseInt(req.params.id));
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    maintenanceTasks.splice(taskIndex, 1);
    
    res.json({
      success: true,
      message: 'Task deleted'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEFINITIONS ====================

// GET /api/maintenance/definitions - List task definitions
router.get('/definitions', (req, res) => {
  try {
    let result = maintenanceDefinitions.filter(d => d.isActive);
    
    // Filter by machine type
    if (req.query.machineType) {
      result = result.filter(d => d.machineType === req.query.machineType);
    }
    
    // Add materials to each definition
    result = result.map(d => ({
      ...d,
      materials: maintenanceMaterials.filter(m => m.taskDefinitionId === d.id)
    }));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/maintenance/definitions - Create definition
router.post('/definitions', (req, res) => {
  try {
    const {
      machineId, machineType, taskName, description, category,
      frequencyType, frequencyValue, estimatedDuration,
      requiresShutdown, skillLevel, instructions, safetyNotes, materials
    } = req.body;
    
    if (!taskName || !frequencyType) {
      return res.status(400).json({ 
        success: false, 
        error: 'taskName and frequencyType are required' 
      });
    }
    
    const newDefinition = {
      id: nextDefId++,
      machineId,
      machineType,
      taskName,
      description,
      category,
      frequencyType,
      frequencyValue,
      estimatedDuration,
      requiresShutdown: requiresShutdown || false,
      skillLevel,
      instructions,
      safetyNotes,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    maintenanceDefinitions.push(newDefinition);
    
    // Add materials if provided
    if (materials && Array.isArray(materials)) {
      materials.forEach(m => {
        maintenanceMaterials.push({
          id: maintenanceMaterials.length + 1,
          taskDefinitionId: newDefinition.id,
          ...m,
          createdAt: new Date().toISOString()
        });
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        ...newDefinition,
        materials: maintenanceMaterials.filter(m => m.taskDefinitionId === newDefinition.id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== HISTORY ====================

// GET /api/maintenance/history - Get maintenance history
router.get('/history', (req, res) => {
  try {
    let result = [...maintenanceHistory];
    
    // Filter by machine
    if (req.query.machineId) {
      result = result.filter(h => h.machineId === parseInt(req.query.machineId));
    }
    
    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.performedAt) - new Date(a.performedAt));
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startIndex = (page - 1) * limit;
    result = result.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/maintenance/stats - Get maintenance statistics
router.get('/stats', (req, res) => {
  try {
    const updatedTasks = maintenanceTasks.map(updateTaskStatus);
    res.json({
      success: true,
      data: getStats(updatedTasks)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
