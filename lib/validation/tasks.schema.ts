// Tasks Module Zod Validation Schemas for BPERP
import { z } from 'zod';

// ==================== ENUM SCHEMAS ====================

export const taskTypeSchema = z.enum([
  'ordering',
  'processing',
  'machining',
  'inspection',
  'shipping',
  'receiving',
  'maintenance',
  'misc'
]);

export const taskStatusSchema = z.enum([
  'Not Started',
  'In Progress',
  'Complete',
  'Issue',
  'On Hold'
]);

export const taskPrioritySchema = z.enum(['Low', 'Medium', 'High', 'Urgent']);

export const recurrencePatternSchema = z.enum(['daily', 'weekly', 'monthly']);

export const workcenterTypeSchema = z.enum([
  'saw',
  'waterjet',
  'laser',
  'cnc_mill',
  'cnc_lathe',
  'manual',
  'grinder',
  'inspection',
  'shipping'
]);

export const queueStatusSchema = z.enum(['Waiting', 'Setup', 'Running', 'Complete', 'Issue']);

export const machineTypeSchema = z.enum([
  'cnc_mill',
  'cnc_lathe',
  'saw',
  'waterjet',
  'laser',
  'grinder',
  'manual',
  'other'
]);

export const machineStatusSchema = z.enum(['Idle', 'Running', 'Setup', 'Down', 'Maintenance']);

export const maintenanceCategorySchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'as_needed'
]);

export const maintenanceFrequencyTypeSchema = z.enum(['hours', 'days', 'cycles', 'on_demand']);

export const maintenanceStatusSchema = z.enum([
  'Scheduled',
  'In Progress',
  'Complete',
  'Deferred',
  'Overdue'
]);

export const poStatusSchema = z.enum([
  'Pending',
  'Ordered',
  'Shipped',
  'Partial',
  'Received',
  'Cancelled'
]);

export const poItemTypeSchema = z.enum(['material', 'tooling', 'supply', 'other']);

export const inspectionTypeSchema = z.enum(['first_article', 'in_process', 'final', 'receiving']);

export const inspectionStatusSchema = z.enum(['Pending', 'In Progress', 'Pass', 'Fail', 'Hold']);

export const shippingStatusSchema = z.enum(['Ready', 'Packing', 'Packed', 'Labeled', 'Shipped']);

export const receivingStatusSchema = z.enum([
  'Expected',
  'Received',
  'Partial',
  'Inspecting',
  'Complete',
  'Rejected'
]);

export const issueTypeSchema = z.enum([
  'late_delivery',
  'wrong_item',
  'damaged',
  'quality',
  'quantity_short'
]);

export const issueSeveritySchema = z.enum(['Low', 'Medium', 'High', 'Critical']);

export const issueStatusSchema = z.enum(['Open', 'In Progress', 'Resolved', 'Closed']);

// ==================== TASK SCHEMAS ====================

// Create task schema
export const createTaskSchema = z.object({
  type: taskTypeSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  workOrderId: z.number().int().positive().optional(),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().optional(),
  assignedToName: z.string().max(100).optional(),
  priority: taskPrioritySchema.default('Medium'),
  dueDate: z.string().optional(),
  estimatedDuration: z.number().int().positive().optional(),
  isRecurring: z.boolean().default(false),
  recurrencePattern: recurrencePatternSchema.optional(),
  taskData: z.record(z.any()).optional()
});

// Update task schema
export const updateTaskSchema = z.object({
  id: z.number().int().positive(),
  type: taskTypeSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  workOrderId: z.number().int().positive().nullable().optional(),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().nullable().optional(),
  assignedToName: z.string().max(100).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  dueDate: z.string().nullable().optional(),
  estimatedDuration: z.number().int().positive().nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: recurrencePatternSchema.nullable().optional(),
  taskData: z.record(z.any()).optional()
});

// Task status update
export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
  notes: z.string().max(500).optional(),
  actualDuration: z.number().int().positive().optional()
});

// Task assignment
export const assignTaskSchema = z.object({
  assignedToName: z.string().max(100),
  notes: z.string().max(500).optional()
});

// ==================== WORKCENTER SCHEMAS ====================

export const createWorkcenterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: workcenterTypeSchema,
  description: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  capacity: z.number().int().positive().default(1),
  displayOrder: z.number().int().min(0).default(0)
});

export const updateWorkcenterSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  type: workcenterTypeSchema.optional(),
  description: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional()
});

// Queue item schema
export const createQueueItemSchema = z.object({
  workcenterId: z.number().int().positive(),
  workOrderId: z.number().int().positive().optional(),
  taskId: z.number().int().positive().optional(),
  sequence: z.number().int().min(0).default(0),
  priority: z.number().int().min(1).max(10).default(5),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().int().positive().optional(),
  operationNumber: z.number().int().positive().optional(),
  operationDescription: z.string().max(500).optional(),
  estimatedTime: z.number().int().positive().optional(),
  setupNotes: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional()
});

export const updateQueueItemSchema = z.object({
  id: z.number().int().positive(),
  sequence: z.number().int().min(0).optional(),
  status: queueStatusSchema.optional(),
  priority: z.number().int().min(1).max(10).optional(),
  operatorName: z.string().max(100).optional(),
  notes: z.string().max(1000).optional()
});

// ==================== MACHINE SCHEMAS ====================

export const createMachineSchema = z.object({
  name: z.string().min(1, 'Machine name is required').max(100),
  machineId: z.string().max(50).optional(),
  type: machineTypeSchema,
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  yearInstalled: z.number().int().min(1900).max(2100).optional(),
  workcenterId: z.number().int().positive().optional(),
  location: z.string().max(100).optional(),
  maintenanceIntervalHours: z.number().int().positive().optional(),
  maintenanceIntervalDays: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  specifications: z.record(z.any()).optional()
});

export const updateMachineSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  machineId: z.string().max(50).optional(),
  type: machineTypeSchema.optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  yearInstalled: z.number().int().min(1900).max(2100).optional(),
  workcenterId: z.number().int().positive().nullable().optional(),
  location: z.string().max(100).optional(),
  status: machineStatusSchema.optional(),
  maintenanceIntervalHours: z.number().int().positive().optional(),
  maintenanceIntervalDays: z.number().int().positive().optional(),
  maintenanceHours: z.number().min(0).optional(),
  maintenanceCycles: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  specifications: z.record(z.any()).optional(),
  isActive: z.boolean().optional()
});

export const updateMachineStatusSchema = z.object({
  status: machineStatusSchema,
  currentOperatorName: z.string().max(100).optional(),
  workOrderId: z.number().int().positive().optional(),
  notes: z.string().max(500).optional()
});

// ==================== MAINTENANCE SCHEMAS ====================

export const createMaintenanceDefinitionSchema = z.object({
  machineId: z.number().int().positive().optional(),
  machineType: machineTypeSchema.optional(),
  taskName: z.string().min(1, 'Task name is required').max(200),
  description: z.string().max(2000).optional(),
  category: maintenanceCategorySchema.optional(),
  frequencyType: maintenanceFrequencyTypeSchema,
  frequencyValue: z.number().int().positive().optional(),
  estimatedDuration: z.number().int().positive().optional(),
  requiresShutdown: z.boolean().default(false),
  skillLevel: z.string().max(20).optional(),
  instructions: z.string().max(5000).optional(),
  safetyNotes: z.string().max(2000).optional(),
  materials: z.array(z.object({
    materialName: z.string().min(1).max(200),
    partNumber: z.string().max(100).optional(),
    quantity: z.number().positive().default(1),
    unit: z.string().max(20).default('EA'),
    notes: z.string().max(500).optional(),
    isCritical: z.boolean().default(false)
  })).optional()
});

export const createMaintenanceTaskSchema = z.object({
  definitionId: z.number().int().positive().optional(),
  machineId: z.number().int().positive(),
  taskName: z.string().min(1, 'Task name is required').max(200),
  description: z.string().max(2000).optional(),
  category: maintenanceCategorySchema.optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  frequencyType: maintenanceFrequencyTypeSchema.optional()
});

export const completeMaintenanceSchema = z.object({
  completedByName: z.string().max(100).optional(),
  actualDuration: z.number().int().positive().optional(),
  issuesFound: z.string().max(2000).optional(),
  partsReplaced: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  readings: z.record(z.any()).optional()
});

export const deferMaintenanceSchema = z.object({
  deferredTo: z.string().min(1, 'New due date is required'),
  deferredReason: z.string().min(1, 'Reason is required').max(500)
});

// ==================== PURCHASE ORDER SCHEMAS ====================

export const createPOSchema = z.object({
  supplierName: z.string().min(1, 'Supplier is required').max(200),
  workOrderId: z.number().int().positive().optional(),
  expectedDelivery: z.string().optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
  items: z.array(z.object({
    itemType: poItemTypeSchema.optional(),
    itemName: z.string().min(1, 'Item name is required').max(200),
    partNumber: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    quantityOrdered: z.number().int().positive('Quantity must be positive'),
    unit: z.string().max(20).default('EA'),
    unitPrice: z.number().min(0).default(0),
    inspectionRequired: z.boolean().default(false),
    notes: z.string().max(500).optional()
  })).min(1, 'At least one item is required')
});

export const updatePOSchema = z.object({
  id: z.number().int().positive(),
  supplierName: z.string().min(1).max(200).optional(),
  status: poStatusSchema.optional(),
  orderDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional()
});

export const markOrderedSchema = z.object({
  poNumber: z.string().min(1, 'PO Number is required').max(50),
  orderDate: z.string().optional()
});

export const receiveItemSchema = z.object({
  quantityReceived: z.number().int().positive('Quantity must be positive'),
  lotNumber: z.string().max(100).optional(),
  location: z.string().max(100).optional()
});

export const reportOrderIssueSchema = z.object({
  poItemId: z.number().int().positive().optional(),
  issueType: issueTypeSchema,
  description: z.string().min(1, 'Description is required').max(1000),
  severity: issueSeveritySchema.default('Medium')
});

// ==================== INSPECTION SCHEMAS ====================

export const createInspectionSchema = z.object({
  workOrderId: z.number().int().positive().optional(),
  partNumber: z.string().max(100).optional(),
  inspectionType: inspectionTypeSchema,
  quantityToInspect: z.number().int().positive('Quantity must be positive'),
  drawingNumber: z.string().max(100).optional(),
  revision: z.string().max(20).optional(),
  specNumbers: z.string().max(500).optional(),
  criticalDimensions: z.array(z.object({
    name: z.string().min(1).max(100),
    nominal: z.number(),
    tolerance: z.string().max(50),
    unit: z.string().max(20).default('in'),
    isCritical: z.boolean().default(false)
  })).optional(),
  notes: z.string().max(2000).optional()
});

export const completeInspectionSchema = z.object({
  status: z.enum(['Pass', 'Fail', 'Hold']),
  quantityInspected: z.number().int().positive(),
  quantityPassed: z.number().int().min(0),
  quantityFailed: z.number().int().min(0),
  inspectorName: z.string().max(100).optional(),
  reportNumber: z.string().max(100).optional(),
  cocNumber: z.string().max(100).optional(),
  ncrNumber: z.string().max(100).optional(),
  inspectionResults: z.record(z.any()).optional(),
  measurementData: z.array(z.object({
    dimension: z.string(),
    measured: z.number(),
    nominal: z.number(),
    tolerance: z.string(),
    result: z.enum(['Pass', 'Fail']),
    notes: z.string().optional()
  })).optional(),
  notes: z.string().max(2000).optional()
});

// ==================== SHIPPING/RECEIVING SCHEMAS ====================

export const createShippingTaskSchema = z.object({
  workOrderId: z.number().int().positive().optional(),
  customerName: z.string().min(1, 'Customer is required').max(200),
  items: z.array(z.object({
    partNumber: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    quantity: z.number().int().positive(),
    weight: z.number().positive().optional()
  })).min(1, 'At least one item is required'),
  packingRequirements: z.string().max(1000).optional(),
  shippingMethod: z.string().max(50).optional(),
  specialInstructions: z.string().max(1000).optional()
});

export const updateShippingTaskSchema = z.object({
  id: z.number().int().positive(),
  status: shippingStatusSchema.optional(),
  packageCount: z.number().int().positive().optional(),
  totalWeight: z.number().positive().optional(),
  dimensions: z.string().max(100).optional(),
  carrier: z.string().max(50).optional(),
  serviceLevel: z.string().max(50).optional(),
  trackingNumber: z.string().max(100).optional(),
  shippingCost: z.number().min(0).optional(),
  packingSlipNumber: z.string().max(100).optional(),
  bolNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional()
});

export const createReceivingTaskSchema = z.object({
  poId: z.number().int().positive().optional(),
  vendorName: z.string().min(1, 'Vendor is required').max(200),
  expectedDate: z.string().optional(),
  expectedItems: z.array(z.object({
    itemName: z.string().min(1).max(200),
    partNumber: z.string().max(100).optional(),
    quantityExpected: z.number().int().positive()
  })).optional(),
  notes: z.string().max(2000).optional()
});

export const updateReceivingTaskSchema = z.object({
  id: z.number().int().positive(),
  status: receivingStatusSchema.optional(),
  receivedByName: z.string().max(100).optional(),
  countVerified: z.boolean().optional(),
  conditionChecked: z.boolean().optional(),
  paperworkReceived: z.boolean().optional(),
  putAwayComplete: z.boolean().optional(),
  hasDiscrepancy: z.boolean().optional(),
  discrepancyNotes: z.string().max(1000).optional(),
  receivedItems: z.array(z.object({
    itemName: z.string().max(200),
    partNumber: z.string().max(100).optional(),
    quantityExpected: z.number().int(),
    quantityReceived: z.number().int().min(0),
    lotNumber: z.string().max(100).optional(),
    location: z.string().max(100).optional()
  })).optional(),
  notes: z.string().max(2000).optional()
});

// ==================== QUERY SCHEMAS ====================

export const taskQuerySchema = z.object({
  type: z.union([taskTypeSchema, z.array(taskTypeSchema)]).optional(),
  status: z.union([taskStatusSchema, z.array(taskStatusSchema)]).optional(),
  priority: z.union([taskPrioritySchema, z.array(taskPrioritySchema)]).optional(),
  assignedTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  search: z.string().max(100).optional(),
  workOrderId: z.coerce.number().int().positive().optional(),
  isOverdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

export const maintenanceQuerySchema = z.object({
  machineId: z.coerce.number().int().positive().optional(),
  category: maintenanceCategorySchema.optional(),
  status: z.union([maintenanceStatusSchema, z.array(maintenanceStatusSchema)]).optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50)
});

// ==================== HELPER FUNCTIONS ====================

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return errors;
}
