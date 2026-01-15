// Purchase Orders, Receiving, Shipping, Inspection API Routes for BPERP
const express = require('express');
const router = express.Router();

// ==================== PURCHASE ORDERS ====================

let purchaseOrders = [
  {
    id: 1, poNumber: 'PO-2025-001', supplierName: 'Metals Depot',
    status: 'Ordered', createdDate: '2025-01-10', orderDate: '2025-01-10',
    expectedDelivery: '2025-01-17', workOrderId: 1, woNumber: 'WO-2025-001',
    subtotal: 450.00, tax: 36.00, shipping: 25.00, total: 511.00
  },
  {
    id: 2, poNumber: 'PO-2025-002', supplierName: 'MSC Industrial',
    status: 'Shipped', createdDate: '2025-01-08', orderDate: '2025-01-08',
    expectedDelivery: '2025-01-15', trackingNumber: '1Z999AA10123456784',
    subtotal: 320.00, tax: 25.60, shipping: 15.00, total: 360.60
  },
  {
    id: 3, poNumber: '', supplierName: 'McMaster-Carr',
    status: 'Pending', createdDate: '2025-01-14',
    expectedDelivery: '2025-01-20', workOrderId: 2, woNumber: 'WO-2025-002',
    subtotal: 180.00, tax: 14.40, shipping: 0, total: 194.40
  }
];

let poItems = [
  { id: 1, poId: 1, lineNumber: 1, itemType: 'material', itemName: 'Aluminum 6061 Bar 2x4x144', partNumber: 'ALU-6061-2X4', quantityOrdered: 5, quantityReceived: 0, unit: 'EA', unitPrice: 90.00, extendedPrice: 450.00 },
  { id: 2, poId: 2, lineNumber: 1, itemType: 'tooling', itemName: '3/8" Carbide Endmill', partNumber: 'EM-375-4FL', quantityOrdered: 10, quantityReceived: 0, unit: 'EA', unitPrice: 24.00, extendedPrice: 240.00 },
  { id: 3, poId: 2, lineNumber: 2, itemType: 'tooling', itemName: '1/2" Drill', partNumber: 'DR-500-HSS', quantityOrdered: 5, quantityReceived: 0, unit: 'EA', unitPrice: 16.00, extendedPrice: 80.00 },
  { id: 4, poId: 3, lineNumber: 1, itemType: 'supply', itemName: 'Coolant Concentrate', partNumber: 'COOL-001', quantityOrdered: 5, quantityReceived: 0, unit: 'GAL', unitPrice: 36.00, extendedPrice: 180.00 }
];

let orderIssues = [];
let nextPOId = 4;
let nextPOItemId = 5;

// GET /api/orders/purchase-orders - List purchase orders
router.get('/purchase-orders', (req, res) => {
  try {
    let result = [...purchaseOrders];
    
    // Filter by status
    if (req.query.status) {
      result = result.filter(po => po.status === req.query.status);
    }
    
    // Filter by supplier
    if (req.query.supplier) {
      result = result.filter(po => 
        po.supplierName.toLowerCase().includes(req.query.supplier.toLowerCase())
      );
    }
    
    // Search
    if (req.query.search) {
      const search = req.query.search.toLowerCase();
      result = result.filter(po =>
        po.poNumber.toLowerCase().includes(search) ||
        po.supplierName.toLowerCase().includes(search)
      );
    }
    
    // Add items to each PO
    result = result.map(po => ({
      ...po,
      items: poItems.filter(item => item.poId === po.id),
      issues: orderIssues.filter(issue => issue.poId === po.id)
    }));
    
    // Sort by date
    result.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/orders/purchase-orders/:id - Get single PO
router.get('/purchase-orders/:id', (req, res) => {
  try {
    const po = purchaseOrders.find(p => p.id === parseInt(req.params.id));
    if (!po) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }
    
    res.json({
      success: true,
      data: {
        ...po,
        items: poItems.filter(item => item.poId === po.id),
        issues: orderIssues.filter(issue => issue.poId === po.id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/orders/purchase-orders - Create PO
router.post('/purchase-orders', (req, res) => {
  try {
    const { supplierName, workOrderId, woNumber, expectedDelivery, notes, items } = req.body;
    
    if (!supplierName || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Supplier and at least one item are required' 
      });
    }
    
    // Calculate totals
    let subtotal = 0;
    const newItems = items.map((item, index) => {
      const extendedPrice = item.quantityOrdered * (item.unitPrice || 0);
      subtotal += extendedPrice;
      return {
        id: nextPOItemId++,
        poId: nextPOId,
        lineNumber: index + 1,
        ...item,
        quantityReceived: 0,
        extendedPrice
      };
    });
    
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;
    
    const newPO = {
      id: nextPOId++,
      poNumber: '', // Assigned when marked as ordered
      supplierName,
      status: 'Pending',
      createdDate: new Date().toISOString().split('T')[0],
      expectedDelivery,
      workOrderId,
      woNumber,
      subtotal,
      tax,
      shipping: 0,
      total,
      notes,
      createdAt: new Date().toISOString()
    };
    
    purchaseOrders.push(newPO);
    poItems.push(...newItems);
    
    res.status(201).json({
      success: true,
      data: {
        ...newPO,
        items: newItems
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/purchase-orders/:id/mark-ordered - Mark as ordered
router.put('/purchase-orders/:id/mark-ordered', (req, res) => {
  try {
    const poIndex = purchaseOrders.findIndex(p => p.id === parseInt(req.params.id));
    if (poIndex === -1) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }
    
    const { poNumber, orderDate } = req.body;
    if (!poNumber) {
      return res.status(400).json({ success: false, error: 'PO Number is required' });
    }
    
    purchaseOrders[poIndex].poNumber = poNumber;
    purchaseOrders[poIndex].status = 'Ordered';
    purchaseOrders[poIndex].orderDate = orderDate || new Date().toISOString().split('T')[0];
    purchaseOrders[poIndex].updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: purchaseOrders[poIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/purchase-orders/:id/items/:itemId/receive - Receive item
router.put('/purchase-orders/:id/items/:itemId/receive', (req, res) => {
  try {
    const itemIndex = poItems.findIndex(
      i => i.id === parseInt(req.params.itemId) && i.poId === parseInt(req.params.id)
    );
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    
    const { quantityReceived, lotNumber, location } = req.body;
    
    poItems[itemIndex].quantityReceived = (poItems[itemIndex].quantityReceived || 0) + quantityReceived;
    poItems[itemIndex].lotNumber = lotNumber;
    poItems[itemIndex].location = location;
    poItems[itemIndex].receivedDate = new Date().toISOString().split('T')[0];
    
    // Update PO status
    const poIndex = purchaseOrders.findIndex(p => p.id === parseInt(req.params.id));
    const allItems = poItems.filter(i => i.poId === parseInt(req.params.id));
    const allReceived = allItems.every(i => i.quantityReceived >= i.quantityOrdered);
    const someReceived = allItems.some(i => i.quantityReceived > 0);
    
    if (allReceived) {
      purchaseOrders[poIndex].status = 'Received';
      purchaseOrders[poIndex].receivedDate = new Date().toISOString().split('T')[0];
    } else if (someReceived) {
      purchaseOrders[poIndex].status = 'Partial';
    }
    
    res.json({
      success: true,
      data: poItems[itemIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/orders/purchase-orders/:id/issues - Report issue
router.post('/purchase-orders/:id/issues', (req, res) => {
  try {
    const po = purchaseOrders.find(p => p.id === parseInt(req.params.id));
    if (!po) {
      return res.status(404).json({ success: false, error: 'Purchase order not found' });
    }
    
    const { poItemId, issueType, description, severity = 'Medium' } = req.body;
    
    if (!issueType || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Issue type and description are required' 
      });
    }
    
    const newIssue = {
      id: orderIssues.length + 1,
      poId: po.id,
      poItemId,
      issueType,
      description,
      severity,
      status: 'Open',
      reportedAt: new Date().toISOString()
    };
    
    orderIssues.push(newIssue);
    
    res.status(201).json({
      success: true,
      data: newIssue
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== INSPECTION TASKS ====================

let inspectionTasks = [
  {
    id: 1, workOrderId: 1, partNumber: 'PLT-4001', inspectionType: 'first_article',
    quantityToInspect: 1, quantityInspected: 0, quantityPassed: 0, quantityFailed: 0,
    status: 'Pending', drawingNumber: 'DWG-4001-A', revision: 'B',
    woNumber: 'WO-2025-001', customerName: 'Acme Corp',
    criticalDimensions: [
      { name: 'Length', nominal: 4.500, tolerance: '±0.005', unit: 'in', isCritical: true },
      { name: 'Width', nominal: 2.000, tolerance: '±0.003', unit: 'in', isCritical: true },
      { name: 'Hole Dia', nominal: 0.375, tolerance: '+0.002/-0.000', unit: 'in', isCritical: true }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 2, workOrderId: 2, partNumber: 'BRKT-1001', inspectionType: 'final',
    quantityToInspect: 25, quantityInspected: 0, quantityPassed: 0, quantityFailed: 0,
    status: 'Pending', drawingNumber: 'DWG-1001', revision: 'C',
    woNumber: 'WO-2025-002', customerName: 'TechMfg Inc',
    createdAt: new Date().toISOString()
  }
];

let nextInspectionId = 3;

// GET /api/orders/inspections - List inspection tasks
router.get('/inspections', (req, res) => {
  try {
    let result = [...inspectionTasks];
    
    // Filter by type
    if (req.query.inspectionType) {
      result = result.filter(i => i.inspectionType === req.query.inspectionType);
    }
    
    // Filter by status
    if (req.query.status) {
      result = result.filter(i => i.status === req.query.status);
    }
    
    // Group by type for dashboard
    const grouped = {
      first_article: result.filter(i => i.inspectionType === 'first_article'),
      in_process: result.filter(i => i.inspectionType === 'in_process'),
      final: result.filter(i => i.inspectionType === 'final'),
      receiving: result.filter(i => i.inspectionType === 'receiving')
    };
    
    res.json({
      success: true,
      data: result,
      grouped
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/orders/inspections/:id - Get single inspection
router.get('/inspections/:id', (req, res) => {
  try {
    const inspection = inspectionTasks.find(i => i.id === parseInt(req.params.id));
    if (!inspection) {
      return res.status(404).json({ success: false, error: 'Inspection not found' });
    }
    
    res.json({
      success: true,
      data: inspection
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/orders/inspections - Create inspection
router.post('/inspections', (req, res) => {
  try {
    const {
      workOrderId, partNumber, inspectionType, quantityToInspect,
      drawingNumber, revision, specNumbers, criticalDimensions,
      woNumber, customerName, notes
    } = req.body;
    
    if (!inspectionType || !quantityToInspect) {
      return res.status(400).json({ 
        success: false, 
        error: 'Inspection type and quantity are required' 
      });
    }
    
    const newInspection = {
      id: nextInspectionId++,
      workOrderId,
      partNumber,
      inspectionType,
      quantityToInspect,
      quantityInspected: 0,
      quantityPassed: 0,
      quantityFailed: 0,
      status: 'Pending',
      drawingNumber,
      revision,
      specNumbers,
      criticalDimensions: criticalDimensions || [],
      woNumber,
      customerName,
      notes,
      createdAt: new Date().toISOString()
    };
    
    inspectionTasks.push(newInspection);
    
    res.status(201).json({
      success: true,
      data: newInspection
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/inspections/:id/start - Start inspection
router.put('/inspections/:id/start', (req, res) => {
  try {
    const index = inspectionTasks.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Inspection not found' });
    }
    
    const { inspectorName } = req.body;
    
    inspectionTasks[index].status = 'In Progress';
    inspectionTasks[index].inspectorName = inspectorName;
    inspectionTasks[index].startedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: inspectionTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/inspections/:id/complete - Complete inspection
router.put('/inspections/:id/complete', (req, res) => {
  try {
    const index = inspectionTasks.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Inspection not found' });
    }
    
    const {
      status, quantityInspected, quantityPassed, quantityFailed,
      inspectorName, reportNumber, cocNumber, ncrNumber,
      inspectionResults, measurementData, notes
    } = req.body;
    
    inspectionTasks[index] = {
      ...inspectionTasks[index],
      status: status || (quantityFailed > 0 ? 'Fail' : 'Pass'),
      quantityInspected,
      quantityPassed,
      quantityFailed,
      inspectorName,
      reportNumber,
      cocNumber,
      ncrNumber,
      inspectionResults,
      measurementData,
      notes,
      completedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: inspectionTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/inspections/:id/hold - Put on hold
router.put('/inspections/:id/hold', (req, res) => {
  try {
    const index = inspectionTasks.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Inspection not found' });
    }
    
    const { reason, inspectorName } = req.body;
    
    inspectionTasks[index].status = 'Hold';
    inspectionTasks[index].holdReason = reason;
    inspectionTasks[index].holdBy = inspectorName;
    inspectionTasks[index].holdAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: inspectionTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SHIPPING TASKS ====================

let shippingTasks = [
  {
    id: 1, workOrderId: 3, customerName: 'Precision Parts Co',
    status: 'Ready', woNumber: 'WO-2025-003',
    items: [
      { partNumber: 'SHF-2001', description: 'Precision Shaft', quantity: 12, weight: 2.5 }
    ],
    packingRequirements: 'Wrap individual parts, use foam inserts',
    shippingMethod: 'Ground', carrier: 'UPS',
    createdAt: new Date().toISOString()
  }
];

let receivingTasks = [
  {
    id: 1, poId: 2, poNumber: 'PO-2025-002', vendorName: 'MSC Industrial',
    expectedDate: '2025-01-15', status: 'Expected',
    expectedItems: [
      { itemName: '3/8" Carbide Endmill', partNumber: 'EM-375-4FL', quantityExpected: 10 },
      { itemName: '1/2" Drill', partNumber: 'DR-500-HSS', quantityExpected: 5 }
    ],
    trackingNumber: '1Z999AA10123456784',
    createdAt: new Date().toISOString()
  }
];

let nextShippingId = 2;
let nextReceivingId = 2;

// GET /api/orders/shipping - List shipping tasks
router.get('/shipping', (req, res) => {
  try {
    let result = [...shippingTasks];
    
    if (req.query.status) {
      result = result.filter(s => s.status === req.query.status);
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/orders/shipping - Create shipping task
router.post('/shipping', (req, res) => {
  try {
    const {
      workOrderId, woNumber, customerName, items,
      packingRequirements, shippingMethod, specialInstructions
    } = req.body;
    
    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer and items are required' 
      });
    }
    
    const newTask = {
      id: nextShippingId++,
      workOrderId,
      woNumber,
      customerName,
      status: 'Ready',
      items,
      packingRequirements,
      shippingMethod,
      specialInstructions,
      createdAt: new Date().toISOString()
    };
    
    shippingTasks.push(newTask);
    
    res.status(201).json({
      success: true,
      data: newTask
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/shipping/:id/pack - Mark as packed
router.put('/shipping/:id/pack', (req, res) => {
  try {
    const index = shippingTasks.findIndex(s => s.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Shipping task not found' });
    }
    
    const { packageCount, totalWeight, dimensions, packedByName } = req.body;
    
    shippingTasks[index].status = 'Packed';
    shippingTasks[index].packageCount = packageCount;
    shippingTasks[index].totalWeight = totalWeight;
    shippingTasks[index].dimensions = dimensions;
    shippingTasks[index].packedByName = packedByName;
    shippingTasks[index].packedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: shippingTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/shipping/:id/label - Add tracking info
router.put('/shipping/:id/label', (req, res) => {
  try {
    const index = shippingTasks.findIndex(s => s.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Shipping task not found' });
    }
    
    const { carrier, serviceLevel, trackingNumber, shippingCost } = req.body;
    
    shippingTasks[index].status = 'Labeled';
    shippingTasks[index].carrier = carrier;
    shippingTasks[index].serviceLevel = serviceLevel;
    shippingTasks[index].trackingNumber = trackingNumber;
    shippingTasks[index].shippingCost = shippingCost;
    
    res.json({
      success: true,
      data: shippingTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/shipping/:id/ship - Mark as shipped
router.put('/shipping/:id/ship', (req, res) => {
  try {
    const index = shippingTasks.findIndex(s => s.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Shipping task not found' });
    }
    
    const { shippedByName, packingSlipNumber, bolNumber } = req.body;
    
    shippingTasks[index].status = 'Shipped';
    shippingTasks[index].shippedByName = shippedByName;
    shippingTasks[index].shippedAt = new Date().toISOString();
    shippingTasks[index].shipDate = new Date().toISOString().split('T')[0];
    shippingTasks[index].packingSlipNumber = packingSlipNumber;
    shippingTasks[index].bolNumber = bolNumber;
    
    res.json({
      success: true,
      data: shippingTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/orders/receiving - List receiving tasks
router.get('/receiving', (req, res) => {
  try {
    let result = [...receivingTasks];
    
    if (req.query.status) {
      result = result.filter(r => r.status === req.query.status);
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/orders/receiving - Create receiving task
router.post('/receiving', (req, res) => {
  try {
    const { poId, poNumber, vendorName, expectedDate, expectedItems, notes } = req.body;
    
    if (!vendorName) {
      return res.status(400).json({ success: false, error: 'Vendor is required' });
    }
    
    const newTask = {
      id: nextReceivingId++,
      poId,
      poNumber,
      vendorName,
      expectedDate,
      status: 'Expected',
      expectedItems: expectedItems || [],
      receivedItems: [],
      countVerified: false,
      conditionChecked: false,
      paperworkReceived: false,
      putAwayComplete: false,
      hasDiscrepancy: false,
      notes,
      createdAt: new Date().toISOString()
    };
    
    receivingTasks.push(newTask);
    
    res.status(201).json({
      success: true,
      data: newTask
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/receiving/:id/receive - Process receipt
router.put('/receiving/:id/receive', (req, res) => {
  try {
    const index = receivingTasks.findIndex(r => r.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Receiving task not found' });
    }
    
    const {
      receivedByName, receivedItems, countVerified, conditionChecked,
      paperworkReceived, hasDiscrepancy, discrepancyNotes, notes
    } = req.body;
    
    // Determine status based on items
    const allReceived = receivedItems && receivedItems.every(
      item => item.quantityReceived >= item.quantityExpected
    );
    
    receivingTasks[index] = {
      ...receivingTasks[index],
      status: hasDiscrepancy ? 'Partial' : (allReceived ? 'Received' : 'Partial'),
      receivedByName,
      receivedDate: new Date().toISOString().split('T')[0],
      receivedItems,
      countVerified,
      conditionChecked,
      paperworkReceived,
      hasDiscrepancy,
      discrepancyNotes,
      notes,
      updatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: receivingTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/receiving/:id/complete - Complete receiving
router.put('/receiving/:id/complete', (req, res) => {
  try {
    const index = receivingTasks.findIndex(r => r.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Receiving task not found' });
    }
    
    receivingTasks[index].status = 'Complete';
    receivingTasks[index].putAwayComplete = true;
    receivingTasks[index].completedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: receivingTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/orders/receiving/:id/reject - Reject delivery
router.put('/receiving/:id/reject', (req, res) => {
  try {
    const index = receivingTasks.findIndex(r => r.id === parseInt(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Receiving task not found' });
    }
    
    const { reason, rejectedByName } = req.body;
    
    receivingTasks[index].status = 'Rejected';
    receivingTasks[index].rejectedReason = reason;
    receivingTasks[index].rejectedByName = rejectedByName;
    receivingTasks[index].rejectedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: receivingTasks[index]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
