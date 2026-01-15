// Machines API Routes for BPERP
const express = require('express');
const router = express.Router();

// In-memory storage
let machines = [
  {
    id: 1, name: 'CNC Mill 1', machineId: 'CNC-M1', type: 'cnc_mill',
    manufacturer: 'Haas', model: 'VF-2', serialNumber: 'HV21234',
    workcenterId: 3, location: 'Bay 1',
    status: 'Running', currentOperatorName: 'Mike Johnson',
    maintenanceHours: 423, maintenanceCycles: 15200,
    lastMaintenanceDate: '2025-01-01', nextMaintenanceDate: '2025-01-31',
    maintenanceIntervalHours: 500, maintenanceIntervalDays: 30,
    totalRunHours: 8423, totalCycles: 315200, isActive: true
  },
  {
    id: 2, name: 'CNC Mill 2', machineId: 'CNC-M2', type: 'cnc_mill',
    manufacturer: 'Haas', model: 'VF-3', serialNumber: 'HV31456',
    workcenterId: 4, location: 'Bay 2',
    status: 'Idle',
    maintenanceHours: 180, maintenanceCycles: 6500,
    lastMaintenanceDate: '2025-01-08', nextMaintenanceDate: '2025-02-07',
    maintenanceIntervalHours: 500, maintenanceIntervalDays: 30,
    totalRunHours: 6180, totalCycles: 226500, isActive: true
  },
  {
    id: 3, name: 'CNC Lathe', machineId: 'CNC-L1', type: 'cnc_lathe',
    manufacturer: 'Haas', model: 'ST-10', serialNumber: 'HL11789',
    workcenterId: 5, location: 'Bay 3',
    status: 'Running', currentOperatorName: 'Dave Martinez',
    maintenanceHours: 320, maintenanceCycles: 8900,
    lastMaintenanceDate: '2024-12-20', nextMaintenanceDate: '2025-01-19',
    maintenanceIntervalHours: 400, maintenanceIntervalDays: 30,
    totalRunHours: 5320, totalCycles: 178900, isActive: true
  },
  {
    id: 4, name: 'Bandsaw', machineId: 'SAW-01', type: 'saw',
    manufacturer: 'DoAll', model: 'C-916M', serialNumber: 'DA456789',
    workcenterId: 1, location: 'Material Prep',
    status: 'Running', currentOperatorName: 'Tom Wilson',
    maintenanceHours: 95, maintenanceCycles: 2100,
    lastMaintenanceDate: '2025-01-10', nextMaintenanceDate: '2025-01-24',
    maintenanceIntervalHours: 200, maintenanceIntervalDays: 14,
    totalRunHours: 3095, totalCycles: 52100, isActive: true
  },
  {
    id: 5, name: 'Waterjet', machineId: 'WJ-01', type: 'waterjet',
    manufacturer: 'Flow', model: 'Mach 500', serialNumber: 'FL789012',
    workcenterId: 2, location: 'Waterjet Bay',
    status: 'Idle',
    maintenanceHours: 120, maintenanceCycles: 3200,
    lastMaintenanceDate: '2025-01-05', nextMaintenanceDate: '2025-02-04',
    maintenanceIntervalHours: 300, maintenanceIntervalDays: 30,
    totalRunHours: 2120, totalCycles: 43200, isActive: true
  },
  {
    id: 6, name: 'Manual Mill', machineId: 'MM-01', type: 'manual',
    manufacturer: 'Bridgeport', model: 'Series I', serialNumber: 'BP234567',
    workcenterId: 6, location: 'Bay 4',
    status: 'Idle',
    maintenanceHours: 45, maintenanceCycles: 0,
    lastMaintenanceDate: '2025-01-12', nextMaintenanceDate: '2025-01-19',
    maintenanceIntervalHours: 100, maintenanceIntervalDays: 7,
    totalRunHours: 1245, totalCycles: 0, isActive: true
  },
  {
    id: 7, name: 'Surface Grinder', machineId: 'GRD-01', type: 'grinder',
    manufacturer: 'Chevalier', model: 'FSG-618M', serialNumber: 'CH345678',
    workcenterId: 7, location: 'Grinding Area',
    status: 'Idle',
    maintenanceHours: 180, maintenanceCycles: 4500,
    lastMaintenanceDate: '2025-01-03', nextMaintenanceDate: '2025-01-17',
    maintenanceIntervalHours: 200, maintenanceIntervalDays: 14,
    totalRunHours: 1680, totalCycles: 34500, isActive: true
  }
];

let machineStatusHistory = [];

// Helper: Calculate maintenance status
function getMaintenanceStatus(machine) {
  const now = new Date();
  const nextMaint = machine.nextMaintenanceDate ? new Date(machine.nextMaintenanceDate) : null;
  const hoursRemaining = machine.maintenanceIntervalHours ? 
    machine.maintenanceIntervalHours - machine.maintenanceHours : null;
  
  // Check if overdue
  if (nextMaint && nextMaint < now) return 'Overdue';
  if (hoursRemaining !== null && hoursRemaining <= 0) return 'Overdue';
  
  // Check if attention needed
  const daysUntilMaint = nextMaint ? Math.ceil((nextMaint - now) / (1000 * 60 * 60 * 24)) : null;
  if (daysUntilMaint !== null && daysUntilMaint <= 7) return 'Attention';
  if (hoursRemaining !== null && hoursRemaining <= 50) return 'Attention';
  
  return 'Good';
}

// Helper: Enrich machine with computed fields
function enrichMachine(machine) {
  return {
    ...machine,
    maintenanceStatus: getMaintenanceStatus(machine),
    hoursUntilMaintenance: machine.maintenanceIntervalHours ? 
      machine.maintenanceIntervalHours - machine.maintenanceHours : null,
    daysUntilMaintenance: machine.nextMaintenanceDate ? 
      Math.ceil((new Date(machine.nextMaintenanceDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
  };
}

// GET /api/machines - List all machines
router.get('/', (req, res) => {
  try {
    let result = machines.filter(m => m.isActive);
    
    // Filter by type
    if (req.query.type) {
      result = result.filter(m => m.type === req.query.type);
    }
    
    // Filter by status
    if (req.query.status) {
      result = result.filter(m => m.status === req.query.status);
    }
    
    // Filter by workcenter
    if (req.query.workcenterId) {
      result = result.filter(m => m.workcenterId === parseInt(req.query.workcenterId));
    }
    
    // Filter by maintenance status
    if (req.query.maintenanceStatus) {
      result = result.filter(m => getMaintenanceStatus(m) === req.query.maintenanceStatus);
    }
    
    // Search
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(search) ||
        (m.machineId && m.machineId.toLowerCase().includes(search)) ||
        (m.manufacturer && m.manufacturer.toLowerCase().includes(search))
      );
    }
    
    // Enrich with computed fields
    result = result.map(enrichMachine);
    
    // Calculate summary stats
    const stats = {
      total: result.length,
      running: result.filter(m => m.status === 'Running').length,
      idle: result.filter(m => m.status === 'Idle').length,
      down: result.filter(m => m.status === 'Down').length,
      maintenance: result.filter(m => m.status === 'Maintenance').length,
      maintenanceOverdue: result.filter(m => m.maintenanceStatus === 'Overdue').length,
      maintenanceAttention: result.filter(m => m.maintenanceStatus === 'Attention').length
    };
    
    res.json({
      success: true,
      data: result,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/machines/:id - Get single machine
router.get('/:id', (req, res) => {
  try {
    const machine = machines.find(m => m.id === parseInt(req.params.id) && m.isActive);
    if (!machine) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }
    
    // Get recent status history
    const history = machineStatusHistory
      .filter(h => h.machineId === machine.id)
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt))
      .slice(0, 20);
    
    res.json({
      success: true,
      data: {
        ...enrichMachine(machine),
        statusHistory: history
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/machines - Create new machine
router.post('/', (req, res) => {
  try {
    const {
      name, machineId, type, manufacturer, model, serialNumber,
      yearInstalled, workcenterId, location,
      maintenanceIntervalHours, maintenanceIntervalDays, notes, specifications
    } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }
    
    // Check for duplicate machineId
    if (machineId && machines.some(m => m.machineId === machineId)) {
      return res.status(400).json({ success: false, error: 'Machine ID already exists' });
    }
    
    const newMachine = {
      id: machines.length + 1,
      name,
      machineId,
      type,
      manufacturer,
      model,
      serialNumber,
      yearInstalled,
      workcenterId,
      location,
      status: 'Idle',
      maintenanceHours: 0,
      maintenanceCycles: 0,
      lastMaintenanceDate: new Date().toISOString().split('T')[0],
      nextMaintenanceDate: maintenanceIntervalDays ? 
        new Date(Date.now() + maintenanceIntervalDays * 86400000).toISOString().split('T')[0] : null,
      maintenanceIntervalHours,
      maintenanceIntervalDays,
      totalRunHours: 0,
      totalCycles: 0,
      notes,
      specifications: specifications || {},
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    machines.push(newMachine);
    
    res.status(201).json({
      success: true,
      data: enrichMachine(newMachine)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/machines/:id - Update machine
router.put('/:id', (req, res) => {
  try {
    const machineIndex = machines.findIndex(m => m.id === parseInt(req.params.id));
    if (machineIndex === -1) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }
    
    const updates = req.body;
    
    // Check for duplicate machineId
    if (updates.machineId && 
        machines.some(m => m.machineId === updates.machineId && m.id !== machines[machineIndex].id)) {
      return res.status(400).json({ success: false, error: 'Machine ID already exists' });
    }
    
    machines[machineIndex] = {
      ...machines[machineIndex],
      ...updates,
      id: machines[machineIndex].id,
      createdAt: machines[machineIndex].createdAt,
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: enrichMachine(machines[machineIndex])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/machines/:id/status - Update machine status
router.put('/:id/status', (req, res) => {
  try {
    const machineIndex = machines.findIndex(m => m.id === parseInt(req.params.id));
    if (machineIndex === -1) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }
    
    const { status, currentOperatorName, workOrderId, notes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    
    const previousStatus = machines[machineIndex].status;
    machines[machineIndex].status = status;
    if (currentOperatorName !== undefined) {
      machines[machineIndex].currentOperatorName = currentOperatorName;
    }
    if (workOrderId !== undefined) {
      machines[machineIndex].currentJobId = workOrderId;
    }
    machines[machineIndex].updatedAt = new Date().toISOString();
    
    // Log status change
    machineStatusHistory.push({
      id: machineStatusHistory.length + 1,
      machineId: machines[machineIndex].id,
      status,
      previousStatus,
      operatorName: currentOperatorName,
      workOrderId,
      notes,
      changedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      data: enrichMachine(machines[machineIndex])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/machines/:id/log-runtime - Log runtime hours/cycles
router.put('/:id/log-runtime', (req, res) => {
  try {
    const machineIndex = machines.findIndex(m => m.id === parseInt(req.params.id));
    if (machineIndex === -1) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }
    
    const { hours, cycles } = req.body;
    
    if (hours !== undefined) {
      machines[machineIndex].maintenanceHours += hours;
      machines[machineIndex].totalRunHours += hours;
    }
    if (cycles !== undefined) {
      machines[machineIndex].maintenanceCycles += cycles;
      machines[machineIndex].totalCycles += cycles;
    }
    machines[machineIndex].updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: enrichMachine(machines[machineIndex])
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/machines/:id/reset-maintenance - Reset maintenance counters
router.put('/:id/reset-maintenance', (req, res) => {
  try {
    const machineIndex = machines.findIndex(m => m.id === parseInt(req.params.id));
    if (machineIndex === -1) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }
    
    const machine = machines[machineIndex];
    machine.maintenanceHours = 0;
    machine.maintenanceCycles = 0;
    machine.lastMaintenanceDate = new Date().toISOString().split('T')[0];
    
    // Calculate next maintenance date
    if (machine.maintenanceIntervalDays) {
      machine.nextMaintenanceDate = new Date(
        Date.now() + machine.maintenanceIntervalDays * 86400000
      ).toISOString().split('T')[0];
    }
    
    machine.updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: enrichMachine(machine)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/machines/:id - Soft delete machine
router.delete('/:id', (req, res) => {
  try {
    const machineIndex = machines.findIndex(m => m.id === parseInt(req.params.id));
    if (machineIndex === -1) {
      return res.status(404).json({ success: false, error: 'Machine not found' });
    }
    
    machines[machineIndex].isActive = false;
    machines[machineIndex].updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      message: 'Machine deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/machines/:id/history - Get status history
router.get('/:id/history', (req, res) => {
  try {
    const history = machineStatusHistory
      .filter(h => h.machineId === parseInt(req.params.id))
      .sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
