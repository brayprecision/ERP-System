// Tasks API Routes for BPERP
const express = require('express');
const router = express.Router();

// Note: In production, these would use a real database connection
// For now, we'll use in-memory storage that can be replaced with PostgreSQL

let tasks = [
  {
    id: 1,
    type: 'ordering',
    title: 'Order Material for WO-2025-001',
    description: 'Order 6061 aluminum bar stock',
    status: 'Not Started',
    priority: 'High',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    assignedToName: 'Leland Bray',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 2,
    type: 'processing',
    title: 'Cut stock for WO-2025-002',
    description: 'Cut 12" lengths from aluminum bar',
    status: 'In Progress',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 172800000).toISOString(),
    assignedToName: 'Tom Wilson',
    partNumber: 'ALU-6061-2X4',
    quantity: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 3,
    type: 'machining',
    title: 'Machine PLT-4001 Parts',
    description: 'Run OP10 - Face and drill',
    status: 'Not Started',
    priority: 'High',
    dueDate: new Date(Date.now() + 259200000).toISOString(),
    assignedToName: 'Mike Johnson',
    partNumber: 'PLT-4001',
    quantity: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 4,
    type: 'inspection',
    title: 'First Article - BRKT-1001',
    description: 'Complete FAI for bracket assembly',
    status: 'Not Started',
    priority: 'High',
    dueDate: new Date(Date.now() + 172800000).toISOString(),
    assignedToName: 'Sarah Chen',
    partNumber: 'BRKT-1001',
    quantity: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 5,
    type: 'shipping',
    title: 'Ship WO-2025-004 to Precision Parts',
    description: 'Pack and ship completed order',
    status: 'Not Started',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    assignedToName: 'Bob Smith',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 6,
    type: 'maintenance',
    title: 'CNC Mill 1 - Weekly Lubrication',
    description: 'Perform weekly lube service',
    status: 'Not Started',
    priority: 'Medium',
    dueDate: new Date().toISOString(),
    assignedToName: 'Leland Bray',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 7,
    type: 'misc',
    title: 'Organize tooling cabinet',
    description: 'Sort and label tooling in cabinet #3',
    status: 'Not Started',
    priority: 'Low',
    dueDate: new Date(Date.now() + 432000000).toISOString(),
    assignedToName: 'Tom Wilson',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let taskHistory = [];
let nextTaskId = 8;

// Helper: Calculate task stats
function calculateStats(taskList) {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  return {
    totalOpen: taskList.filter(t => t.status !== 'Complete' && !t.deletedAt).length,
    overdue: taskList.filter(t => {
      if (t.status === 'Complete' || t.deletedAt) return false;
      return t.dueDate && new Date(t.dueDate) < now;
    }).length,
    dueToday: taskList.filter(t => {
      if (t.status === 'Complete' || t.deletedAt) return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due < tomorrow;
    }).length,
    completedThisWeek: taskList.filter(t => {
      if (t.status !== 'Complete') return false;
      return t.completedAt && new Date(t.completedAt) >= weekAgo;
    }).length,
    byType: taskList.reduce((acc, t) => {
      if (!t.deletedAt) {
        acc[t.type] = (acc[t.type] || 0) + 1;
      }
      return acc;
    }, {}),
    byStatus: taskList.reduce((acc, t) => {
      if (!t.deletedAt) {
        acc[t.status] = (acc[t.status] || 0) + 1;
      }
      return acc;
    }, {})
  };
}

// Helper: Add task color coding info
function enrichTask(task) {
  if (!task.dueDate) return { ...task };
  
  const now = new Date();
  const dueDate = new Date(task.dueDate);
  const msUntilDue = dueDate - now;
  const hoursUntilDue = msUntilDue / (1000 * 60 * 60);
  
  return {
    ...task,
    isOverdue: msUntilDue < 0 && task.status !== 'Complete',
    daysUntilDue: Math.ceil(msUntilDue / (1000 * 60 * 60 * 24)),
    urgency: task.status === 'Complete' ? 'complete' :
             msUntilDue < 0 ? 'overdue' :
             hoursUntilDue < 24 ? 'urgent' :
             hoursUntilDue < 72 ? 'soon' : 'normal'
  };
}

// GET /api/tasks - List all tasks with filtering
router.get('/', (req, res) => {
  try {
    let result = tasks.filter(t => !t.deletedAt);
    
    // Filter by type
    if (req.query.type) {
      const types = Array.isArray(req.query.type) ? req.query.type : [req.query.type];
      result = result.filter(t => types.includes(t.type));
    }
    
    // Filter by status
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
      result = result.filter(t => statuses.includes(t.status));
    }
    
    // Filter by priority
    if (req.query.priority) {
      const priorities = Array.isArray(req.query.priority) ? req.query.priority : [req.query.priority];
      result = result.filter(t => priorities.includes(t.priority));
    }
    
    // Filter by assignee
    if (req.query.assignedTo) {
      result = result.filter(t => 
        t.assignedToName && t.assignedToName.toLowerCase().includes(req.query.assignedTo.toLowerCase())
      );
    }
    
    // Filter by overdue
    if (req.query.isOverdue === 'true') {
      const now = new Date();
      result = result.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'Complete');
    }
    
    // Filter by date range
    if (req.query.dueDateFrom) {
      result = result.filter(t => t.dueDate && new Date(t.dueDate) >= new Date(req.query.dueDateFrom));
    }
    if (req.query.dueDateTo) {
      result = result.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(req.query.dueDateTo));
    }
    
    // Search
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search)) ||
        (t.partNumber && t.partNumber.toLowerCase().includes(search)) ||
        (t.assignedToName && t.assignedToName.toLowerCase().includes(search))
      );
    }
    
    // Sort
    const sortBy = req.query.sortBy || 'dueDate';
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return (new Date(a.dueDate) - new Date(b.dueDate)) * sortOrder;
      }
      if (sortBy === 'priority') {
        const priorityOrder = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
        return (priorityOrder[a.priority] - priorityOrder[b.priority]) * sortOrder;
      }
      return String(a[sortBy] || '').localeCompare(String(b[sortBy] || '')) * sortOrder;
    });
    
    // Enrich with computed fields
    result = result.map(enrichTask);
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const total = result.length;
    const startIndex = (page - 1) * limit;
    result = result.slice(startIndex, startIndex + limit);
    
    res.json({
      success: true,
      data: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: calculateStats(tasks)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tasks/stats - Get task statistics
router.get('/stats', (req, res) => {
  try {
    res.json({
      success: true,
      data: calculateStats(tasks)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tasks/my-tasks - Get tasks for current user
router.get('/my-tasks', (req, res) => {
  try {
    const userName = req.query.userName;
    if (!userName) {
      return res.status(400).json({ success: false, error: 'userName parameter required' });
    }
    
    let result = tasks.filter(t => 
      !t.deletedAt && 
      t.assignedToName && 
      t.assignedToName.toLowerCase() === userName.toLowerCase()
    );
    
    result = result.map(enrichTask);
    result.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', (req, res) => {
  try {
    const task = tasks.find(t => t.id === parseInt(req.params.id) && !t.deletedAt);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const history = taskHistory.filter(h => h.taskId === task.id);
    
    res.json({
      success: true,
      data: {
        ...enrichTask(task),
        history
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/tasks - Create new task
router.post('/', (req, res) => {
  try {
    const {
      type,
      title,
      description,
      workOrderId,
      partNumber,
      quantity,
      assignedToName,
      priority = 'Medium',
      dueDate,
      estimatedDuration,
      isRecurring = false,
      recurrencePattern,
      taskData
    } = req.body;
    
    if (!type || !title) {
      return res.status(400).json({ success: false, error: 'Type and title are required' });
    }
    
    const newTask = {
      id: nextTaskId++,
      type,
      title,
      description,
      workOrderId,
      partNumber,
      quantity,
      assignedToName,
      status: 'Not Started',
      priority,
      dueDate,
      estimatedDuration,
      isRecurring,
      recurrencePattern,
      taskData: taskData || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tasks.push(newTask);
    
    // Log history
    taskHistory.push({
      id: taskHistory.length + 1,
      taskId: newTask.id,
      action: 'created',
      newValue: { title, type, assignedToName },
      timestamp: new Date().toISOString()
    });
    
    res.status(201).json({
      success: true,
      data: enrichTask(newTask)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', (req, res) => {
  try {
    const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id) && !t.deletedAt);
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const oldTask = { ...tasks[taskIndex] };
    const updates = req.body;
    
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      id: tasks[taskIndex].id,
      createdAt: tasks[taskIndex].createdAt,
      updatedAt: new Date().toISOString()
    };
    
    // Log history
    taskHistory.push({
      id: taskHistory.length + 1,
      taskId: tasks[taskIndex].id,
      action: 'updated',
      oldValue: oldTask,
      newValue: updates,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: enrichTask(tasks[taskIndex])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/tasks/:id/status - Update task status
router.put('/:id/status', (req, res) => {
  try {
    const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id) && !t.deletedAt);
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const { status, notes, actualDuration } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    
    const oldStatus = tasks[taskIndex].status;
    tasks[taskIndex].status = status;
    tasks[taskIndex].updatedAt = new Date().toISOString();
    
    if (status === 'In Progress' && !tasks[taskIndex].startedAt) {
      tasks[taskIndex].startedAt = new Date().toISOString();
    }
    
    if (status === 'Complete') {
      tasks[taskIndex].completedAt = new Date().toISOString();
      if (actualDuration) {
        tasks[taskIndex].actualDuration = actualDuration;
      }
    }
    
    // Log history
    taskHistory.push({
      id: taskHistory.length + 1,
      taskId: tasks[taskIndex].id,
      action: 'status_changed',
      oldValue: { status: oldStatus },
      newValue: { status, notes },
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: enrichTask(tasks[taskIndex])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/tasks/:id/assign - Assign/reassign task
router.put('/:id/assign', (req, res) => {
  try {
    const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id) && !t.deletedAt);
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const { assignedToName, notes } = req.body;
    if (!assignedToName) {
      return res.status(400).json({ success: false, error: 'assignedToName is required' });
    }
    
    const oldAssignee = tasks[taskIndex].assignedToName;
    tasks[taskIndex].assignedToName = assignedToName;
    tasks[taskIndex].assignedAt = new Date().toISOString();
    tasks[taskIndex].updatedAt = new Date().toISOString();
    
    // Log history
    taskHistory.push({
      id: taskHistory.length + 1,
      taskId: tasks[taskIndex].id,
      action: 'reassigned',
      oldValue: { assignedToName: oldAssignee },
      newValue: { assignedToName, notes },
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: enrichTask(tasks[taskIndex])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/tasks/:id/issue - Report an issue
router.post('/:id/issue', (req, res) => {
  try {
    const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id) && !t.deletedAt);
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const { issueType, description, severity = 'Medium' } = req.body;
    if (!description) {
      return res.status(400).json({ success: false, error: 'Description is required' });
    }
    
    tasks[taskIndex].status = 'Issue';
    tasks[taskIndex].updatedAt = new Date().toISOString();
    tasks[taskIndex].taskData = {
      ...tasks[taskIndex].taskData,
      issue: { issueType, description, severity, reportedAt: new Date().toISOString() }
    };
    
    // Log history
    taskHistory.push({
      id: taskHistory.length + 1,
      taskId: tasks[taskIndex].id,
      action: 'issue_reported',
      newValue: { issueType, description, severity },
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: enrichTask(tasks[taskIndex])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/tasks/:id - Soft delete task
router.delete('/:id', (req, res) => {
  try {
    const taskIndex = tasks.findIndex(t => t.id === parseInt(req.params.id) && !t.deletedAt);
    if (taskIndex === -1) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    tasks[taskIndex].deletedAt = new Date().toISOString();
    
    // Log history
    taskHistory.push({
      id: taskHistory.length + 1,
      taskId: tasks[taskIndex].id,
      action: 'deleted',
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/tasks/:id/history - Get task history
router.get('/:id/history', (req, res) => {
  try {
    const task = tasks.find(t => t.id === parseInt(req.params.id));
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    
    const history = taskHistory.filter(h => h.taskId === task.id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
