// Workcenters API Routes for BPERP
const express = require('express');
const router = express.Router();

// In-memory storage
let workcenters = [
  { id: 1, name: 'Saw Station', type: 'saw', description: 'Horizontal bandsaw for cutting stock', capacity: 1, isActive: true, displayOrder: 1 },
  { id: 2, name: 'Waterjet', type: 'waterjet', description: 'Flow waterjet cutting system', capacity: 1, isActive: true, displayOrder: 2 },
  { id: 3, name: 'CNC Mill 1', type: 'cnc_mill', description: 'Haas VF-2 Vertical Mill', capacity: 1, isActive: true, displayOrder: 3 },
  { id: 4, name: 'CNC Mill 2', type: 'cnc_mill', description: 'Haas VF-3 Vertical Mill', capacity: 1, isActive: true, displayOrder: 4 },
  { id: 5, name: 'CNC Lathe', type: 'cnc_lathe', description: 'Haas ST-10 CNC Lathe', capacity: 1, isActive: true, displayOrder: 5 },
  { id: 6, name: 'Manual Mill', type: 'manual', description: 'Bridgeport manual milling machine', capacity: 1, isActive: true, displayOrder: 6 },
  { id: 7, name: 'Grinding', type: 'grinder', description: 'Surface and cylindrical grinding', capacity: 2, isActive: true, displayOrder: 7 },
  { id: 8, name: 'Inspection', type: 'inspection', description: 'Quality control inspection station', capacity: 3, isActive: true, displayOrder: 8 },
  { id: 9, name: 'Shipping', type: 'shipping', description: 'Shipping and receiving dock', capacity: 2, isActive: true, displayOrder: 9 }
];

let workcenterQueue = [
  { 
    id: 1, workcenterId: 1, sequence: 1, status: 'Running', priority: 3,
    partNumber: 'ALU-6061-2X4', quantity: 25, operationDescription: 'Cut to 12" lengths',
    estimatedTime: 45, operatorName: 'Tom Wilson', setupNotes: 'Use 14 TPI blade',
    woNumber: 'WO-2025-002', material: 'Aluminum 6061', queuedAt: new Date().toISOString(),
    processingStartedAt: new Date().toISOString()
  },
  { 
    id: 2, workcenterId: 1, sequence: 2, status: 'Waiting', priority: 5,
    partNumber: 'STL-4140-1.5RD', quantity: 10, operationDescription: 'Cut to 8" lengths',
    estimatedTime: 30, setupNotes: 'Use coolant',
    woNumber: 'WO-2025-003', material: 'Steel 4140', queuedAt: new Date().toISOString()
  },
  { 
    id: 3, workcenterId: 3, sequence: 1, status: 'Setup', priority: 2,
    partNumber: 'PLT-4001', quantity: 50, operationNumber: 10, operationDescription: 'Face and drill',
    estimatedTime: 120, operatorName: 'Mike Johnson', setupNotes: 'Program #4001-OP10, Use 3/8 endmill',
    woNumber: 'WO-2025-001', queuedAt: new Date().toISOString(), setupStartedAt: new Date().toISOString()
  },
  { 
    id: 4, workcenterId: 3, sequence: 2, status: 'Waiting', priority: 4,
    partNumber: 'BRKT-1001', quantity: 25, operationNumber: 10, operationDescription: 'Rough profile',
    estimatedTime: 90, setupNotes: 'Program #1001-OP10',
    woNumber: 'WO-2025-004', queuedAt: new Date().toISOString()
  },
  { 
    id: 5, workcenterId: 5, sequence: 1, status: 'Running', priority: 3,
    partNumber: 'SHF-2001', quantity: 12, operationNumber: 10, operationDescription: 'Turn OD and face',
    estimatedTime: 60, operatorName: 'Dave Martinez', setupNotes: 'Use soft jaws',
    woNumber: 'WO-2025-005', queuedAt: new Date().toISOString(), processingStartedAt: new Date().toISOString()
  }
];

let nextQueueId = 6;

// GET /api/workcenters - List all workcenters
router.get('/', (req, res) => {
  try {
    let result = workcenters.filter(w => w.isActive);
    result.sort((a, b) => a.displayOrder - b.displayOrder);
    
    // Add queue info to each workcenter
    result = result.map(wc => {
      const queue = workcenterQueue
        .filter(q => q.workcenterId === wc.id && q.status !== 'Complete')
        .sort((a, b) => a.sequence - b.sequence);
      
      return {
        ...wc,
        currentJobs: queue.filter(q => q.status === 'Running' || q.status === 'Setup'),
        queueLength: queue.filter(q => q.status === 'Waiting').length,
        nextJobs: queue.filter(q => q.status === 'Waiting').slice(0, 3)
      };
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workcenters/:id - Get single workcenter with full queue
router.get('/:id', (req, res) => {
  try {
    const workcenter = workcenters.find(w => w.id === parseInt(req.params.id));
    if (!workcenter) {
      return res.status(404).json({ success: false, error: 'Workcenter not found' });
    }
    
    const queue = workcenterQueue
      .filter(q => q.workcenterId === workcenter.id && q.status !== 'Complete')
      .sort((a, b) => a.sequence - b.sequence);
    
    res.json({
      success: true,
      data: {
        ...workcenter,
        queue,
        currentJobs: queue.filter(q => q.status === 'Running' || q.status === 'Setup'),
        waitingJobs: queue.filter(q => q.status === 'Waiting')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/workcenters/:id/queue - Get workcenter queue
router.get('/:id/queue', (req, res) => {
  try {
    const queue = workcenterQueue
      .filter(q => q.workcenterId === parseInt(req.params.id))
      .sort((a, b) => a.sequence - b.sequence);
    
    res.json({
      success: true,
      data: queue
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/workcenters/:id/queue - Add item to queue
router.post('/:id/queue', (req, res) => {
  try {
    const workcenterId = parseInt(req.params.id);
    const workcenter = workcenters.find(w => w.id === workcenterId);
    if (!workcenter) {
      return res.status(404).json({ success: false, error: 'Workcenter not found' });
    }
    
    const { 
      workOrderId, taskId, partNumber, quantity, operationNumber, 
      operationDescription, estimatedTime, setupNotes, priority = 5,
      woNumber, material
    } = req.body;
    
    // Get next sequence number
    const existingQueue = workcenterQueue.filter(q => q.workcenterId === workcenterId && q.status !== 'Complete');
    const maxSequence = existingQueue.reduce((max, q) => Math.max(max, q.sequence), 0);
    
    const newItem = {
      id: nextQueueId++,
      workcenterId,
      workOrderId,
      taskId,
      sequence: maxSequence + 1,
      status: 'Waiting',
      priority,
      partNumber,
      quantity,
      operationNumber,
      operationDescription,
      estimatedTime,
      setupNotes,
      woNumber,
      material,
      queuedAt: new Date().toISOString()
    };
    
    workcenterQueue.push(newItem);
    
    res.status(201).json({
      success: true,
      data: newItem
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workcenters/:id/queue/:queueId - Update queue item
router.put('/:id/queue/:queueId', (req, res) => {
  try {
    const queueIndex = workcenterQueue.findIndex(
      q => q.id === parseInt(req.params.queueId) && q.workcenterId === parseInt(req.params.id)
    );
    
    if (queueIndex === -1) {
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }
    
    const updates = req.body;
    workcenterQueue[queueIndex] = {
      ...workcenterQueue[queueIndex],
      ...updates,
      id: workcenterQueue[queueIndex].id,
      workcenterId: workcenterQueue[queueIndex].workcenterId,
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: workcenterQueue[queueIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workcenters/:id/queue/:queueId/start-setup - Start setup
router.put('/:id/queue/:queueId/start-setup', (req, res) => {
  try {
    const queueIndex = workcenterQueue.findIndex(
      q => q.id === parseInt(req.params.queueId) && q.workcenterId === parseInt(req.params.id)
    );
    
    if (queueIndex === -1) {
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }
    
    const { operatorName } = req.body;
    
    workcenterQueue[queueIndex].status = 'Setup';
    workcenterQueue[queueIndex].setupStartedAt = new Date().toISOString();
    if (operatorName) workcenterQueue[queueIndex].operatorName = operatorName;
    workcenterQueue[queueIndex].updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: workcenterQueue[queueIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workcenters/:id/queue/:queueId/start-processing - Start processing
router.put('/:id/queue/:queueId/start-processing', (req, res) => {
  try {
    const queueIndex = workcenterQueue.findIndex(
      q => q.id === parseInt(req.params.queueId) && q.workcenterId === parseInt(req.params.id)
    );
    
    if (queueIndex === -1) {
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }
    
    const { operatorName } = req.body;
    
    workcenterQueue[queueIndex].status = 'Running';
    workcenterQueue[queueIndex].processingStartedAt = new Date().toISOString();
    if (operatorName) workcenterQueue[queueIndex].operatorName = operatorName;
    workcenterQueue[queueIndex].updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: workcenterQueue[queueIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workcenters/:id/queue/:queueId/complete - Complete job
router.put('/:id/queue/:queueId/complete', (req, res) => {
  try {
    const queueIndex = workcenterQueue.findIndex(
      q => q.id === parseInt(req.params.queueId) && q.workcenterId === parseInt(req.params.id)
    );
    
    if (queueIndex === -1) {
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }
    
    const { quantityComplete, actualTime, notes } = req.body;
    
    workcenterQueue[queueIndex].status = 'Complete';
    workcenterQueue[queueIndex].completedAt = new Date().toISOString();
    if (quantityComplete) workcenterQueue[queueIndex].quantityComplete = quantityComplete;
    if (actualTime) workcenterQueue[queueIndex].actualTime = actualTime;
    if (notes) workcenterQueue[queueIndex].notes = notes;
    workcenterQueue[queueIndex].updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: workcenterQueue[queueIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workcenters/:id/queue/:queueId/issue - Report issue
router.put('/:id/queue/:queueId/issue', (req, res) => {
  try {
    const queueIndex = workcenterQueue.findIndex(
      q => q.id === parseInt(req.params.queueId) && q.workcenterId === parseInt(req.params.id)
    );
    
    if (queueIndex === -1) {
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }
    
    const { issueType, description } = req.body;
    
    workcenterQueue[queueIndex].status = 'Issue';
    workcenterQueue[queueIndex].issue = { issueType, description, reportedAt: new Date().toISOString() };
    workcenterQueue[queueIndex].updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: workcenterQueue[queueIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workcenters/:id/queue/reorder - Reorder queue
router.put('/:id/queue/reorder', (req, res) => {
  try {
    const { items } = req.body; // Array of { id, sequence }
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Items array is required' });
    }
    
    items.forEach(({ id, sequence }) => {
      const queueIndex = workcenterQueue.findIndex(q => q.id === id);
      if (queueIndex !== -1) {
        workcenterQueue[queueIndex].sequence = sequence;
        workcenterQueue[queueIndex].updatedAt = new Date().toISOString();
      }
    });
    
    const queue = workcenterQueue
      .filter(q => q.workcenterId === parseInt(req.params.id))
      .sort((a, b) => a.sequence - b.sequence);
    
    res.json({
      success: true,
      data: queue
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/workcenters/:id/queue/:queueId - Remove from queue
router.delete('/:id/queue/:queueId', (req, res) => {
  try {
    const queueIndex = workcenterQueue.findIndex(
      q => q.id === parseInt(req.params.queueId) && q.workcenterId === parseInt(req.params.id)
    );
    
    if (queueIndex === -1) {
      return res.status(404).json({ success: false, error: 'Queue item not found' });
    }
    
    workcenterQueue.splice(queueIndex, 1);
    
    res.json({
      success: true,
      message: 'Queue item removed'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/workcenters - Create new workcenter
router.post('/', (req, res) => {
  try {
    const { name, type, description, capacity = 1, location, displayOrder } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }
    
    const maxOrder = workcenters.reduce((max, w) => Math.max(max, w.displayOrder || 0), 0);
    
    const newWorkcenter = {
      id: workcenters.length + 1,
      name,
      type,
      description,
      location,
      capacity,
      isActive: true,
      displayOrder: displayOrder || maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    workcenters.push(newWorkcenter);
    
    res.status(201).json({
      success: true,
      data: newWorkcenter
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/workcenters/:id - Update workcenter
router.put('/:id', (req, res) => {
  try {
    const wcIndex = workcenters.findIndex(w => w.id === parseInt(req.params.id));
    if (wcIndex === -1) {
      return res.status(404).json({ success: false, error: 'Workcenter not found' });
    }
    
    const updates = req.body;
    workcenters[wcIndex] = {
      ...workcenters[wcIndex],
      ...updates,
      id: workcenters[wcIndex].id,
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: workcenters[wcIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
