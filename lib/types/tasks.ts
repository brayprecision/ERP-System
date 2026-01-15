// Tasks Module TypeScript Interfaces for BPERP

// ==================== CORE TASK TYPES ====================

export type TaskType = 
  | 'ordering' 
  | 'processing' 
  | 'machining' 
  | 'inspection' 
  | 'shipping' 
  | 'receiving' 
  | 'maintenance' 
  | 'misc';

export type TaskStatus = 'Not Started' | 'In Progress' | 'Complete' | 'Issue' | 'On Hold';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly';

export interface Task {
  id: number;
  type: TaskType;
  title: string;
  description?: string;
  workOrderId?: number;
  partNumber?: string;
  quantity?: number;
  
  // Assignment
  assignedTo?: number;
  assignedToName?: string;
  assignedAt?: Date;
  
  // Status
  status: TaskStatus;
  priority: TaskPriority;
  
  // Dates
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Timing
  estimatedDuration?: number; // minutes
  actualDuration?: number;
  
  // Additional data
  taskData?: Record<string, any>;
  
  // Recurring
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  parentTaskId?: number;
  
  // Metadata
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  
  // Computed
  isOverdue?: boolean;
  daysUntilDue?: number;
}

export interface TaskAssignment {
  id: number;
  taskId: number;
  userId?: number;
  userName?: string;
  assignedBy?: number;
  assignedAt: Date;
  removedAt?: Date;
  notes?: string;
}

export interface TaskHistory {
  id: number;
  taskId: number;
  action: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  userId?: number;
  userName?: string;
  timestamp: Date;
  notes?: string;
}

// ==================== WORKCENTER TYPES ====================

export type WorkcenterType = 
  | 'saw' 
  | 'waterjet' 
  | 'laser' 
  | 'cnc_mill' 
  | 'cnc_lathe' 
  | 'manual' 
  | 'grinder'
  | 'inspection' 
  | 'shipping';

export interface Workcenter {
  id: number;
  name: string;
  type: WorkcenterType;
  description?: string;
  location?: string;
  capacity: number;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/joined
  currentJobs?: WorkcenterQueueItem[];
  queue?: WorkcenterQueueItem[];
  machineCount?: number;
}

export type QueueStatus = 'Waiting' | 'Setup' | 'Running' | 'Complete' | 'Issue';

export interface WorkcenterQueueItem {
  id: number;
  workcenterId: number;
  workOrderId?: number;
  taskId?: number;
  sequence: number;
  status: QueueStatus;
  priority: number;
  
  // Job details
  partNumber?: string;
  quantity?: number;
  operationNumber?: number;
  operationDescription?: string;
  estimatedTime?: number;
  setupNotes?: string;
  
  // Timing
  queuedAt: Date;
  setupStartedAt?: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  actualTime?: number;
  
  // Operator
  operatorId?: number;
  operatorName?: string;
  
  notes?: string;
  
  // Joined
  woNumber?: string;
  customerName?: string;
  material?: string;
}

// ==================== MACHINE TYPES ====================

export type MachineType = 
  | 'cnc_mill' 
  | 'cnc_lathe' 
  | 'saw' 
  | 'waterjet' 
  | 'laser' 
  | 'grinder' 
  | 'manual'
  | 'other';

export type MachineStatus = 'Idle' | 'Running' | 'Setup' | 'Down' | 'Maintenance';

export interface Machine {
  id: number;
  name: string;
  machineId?: string;
  type: MachineType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  yearInstalled?: number;
  
  // Location
  workcenterId?: number;
  location?: string;
  
  // Status
  status: MachineStatus;
  currentJobId?: number;
  currentOperatorId?: number;
  currentOperatorName?: string;
  
  // Maintenance tracking
  maintenanceHours: number;
  maintenanceCycles: number;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  maintenanceIntervalHours?: number;
  maintenanceIntervalDays?: number;
  
  // Utilization
  totalRunHours: number;
  totalCycles: number;
  
  // Metadata
  notes?: string;
  specifications?: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed
  maintenanceStatus?: 'Good' | 'Attention' | 'Overdue';
  utilizationPercent?: number;
  workcenterName?: string;
}

// ==================== MAINTENANCE TYPES ====================

export type MaintenanceCategory = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'as_needed';
export type MaintenanceFrequencyType = 'hours' | 'days' | 'cycles' | 'on_demand';
export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Complete' | 'Deferred' | 'Overdue';

export interface MaintenanceTaskDefinition {
  id: number;
  machineId?: number;
  machineType?: MachineType;
  taskName: string;
  description?: string;
  category?: MaintenanceCategory;
  frequencyType: MaintenanceFrequencyType;
  frequencyValue?: number;
  estimatedDuration?: number;
  requiresShutdown: boolean;
  skillLevel?: string;
  instructions?: string;
  safetyNotes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined
  materials?: MaintenanceMaterial[];
}

export interface MaintenanceMaterial {
  id: number;
  taskDefinitionId: number;
  materialName: string;
  partNumber?: string;
  quantity: number;
  unit: string;
  notes?: string;
  isCritical: boolean;
  createdAt: Date;
}

export interface MaintenanceTask {
  id: number;
  definitionId?: number;
  machineId: number;
  taskName: string;
  description?: string;
  category?: MaintenanceCategory;
  
  // Scheduling
  scheduledDate?: Date;
  dueDate: Date;
  frequencyType?: MaintenanceFrequencyType;
  
  // Status
  status: MaintenanceStatus;
  
  // Execution
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: number;
  completedByName?: string;
  actualDuration?: number;
  
  // Deferral
  deferredTo?: Date;
  deferredReason?: string;
  deferredBy?: number;
  
  // Findings
  issuesFound?: string;
  partsReplaced?: string;
  notes?: string;
  readings?: Record<string, any>;
  
  // Costs
  laborCost?: number;
  partsCost?: number;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Joined
  machineName?: string;
  machineType?: MachineType;
  materials?: MaintenanceMaterial[];
}

export interface MaintenanceHistory {
  id: number;
  machineId: number;
  maintenanceTaskId?: number;
  action: string;
  description?: string;
  performedBy?: number;
  performedByName?: string;
  performedAt: Date;
  hoursAtTime?: number;
  cyclesAtTime?: number;
  notes?: string;
}

// ==================== ORDERING TYPES ====================

export type POStatus = 'Pending' | 'Ordered' | 'Shipped' | 'Partial' | 'Received' | 'Cancelled';
export type POItemType = 'material' | 'tooling' | 'supply' | 'other';

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId?: number;
  supplierName: string;
  
  // Status
  status: POStatus;
  
  // Dates
  createdDate: Date;
  orderDate?: Date;
  expectedDelivery?: Date;
  receivedDate?: Date;
  
  // Financials
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  
  // Related
  workOrderId?: number;
  
  // Tracking
  trackingNumber?: string;
  carrier?: string;
  
  notes?: string;
  internalNotes?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined
  items?: POItem[];
  issues?: OrderIssue[];
  woNumber?: string;
}

export interface POItem {
  id: number;
  poId: number;
  lineNumber: number;
  
  // Item details
  itemType?: POItemType;
  itemName: string;
  partNumber?: string;
  description?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unit: string;
  unitPrice: number;
  extendedPrice: number;
  
  // Receipt tracking
  receivedDate?: Date;
  lotNumber?: string;
  location?: string;
  
  // Quality
  inspectionRequired: boolean;
  inspectionStatus?: string;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IssueType = 'late_delivery' | 'wrong_item' | 'damaged' | 'quality' | 'quantity_short';
export type IssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface OrderIssue {
  id: number;
  poId: number;
  poItemId?: number;
  issueType: IssueType;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: number;
  reportedBy?: number;
  reportedAt: Date;
}

// ==================== INSPECTION TYPES ====================

export type InspectionType = 'first_article' | 'in_process' | 'final' | 'receiving';
export type InspectionStatus = 'Pending' | 'In Progress' | 'Pass' | 'Fail' | 'Hold';

export interface InspectionTask {
  id: number;
  taskId?: number;
  workOrderId?: number;
  partNumber?: string;
  
  // Type
  inspectionType: InspectionType;
  
  // Quantities
  quantityToInspect: number;
  quantityInspected: number;
  quantityPassed: number;
  quantityFailed: number;
  
  // Status
  status: InspectionStatus;
  
  // Documents
  drawingNumber?: string;
  revision?: string;
  specNumbers?: string;
  
  // Dimensions
  criticalDimensions?: CriticalDimension[];
  
  // Results
  inspectionResults?: Record<string, any>;
  measurementData?: MeasurementData[];
  
  // Inspector
  inspectorId?: number;
  inspectorName?: string;
  startedAt?: Date;
  completedAt?: Date;
  
  // Documentation
  reportNumber?: string;
  cocNumber?: string;
  ncrNumber?: string;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined
  woNumber?: string;
  customerName?: string;
}

export interface CriticalDimension {
  name: string;
  nominal: number;
  tolerance: string;
  unit: string;
  isCritical: boolean;
}

export interface MeasurementData {
  dimension: string;
  measured: number;
  nominal: number;
  tolerance: string;
  result: 'Pass' | 'Fail';
  notes?: string;
}

// ==================== SHIPPING/RECEIVING TYPES ====================

export type ShippingStatus = 'Ready' | 'Packing' | 'Packed' | 'Labeled' | 'Shipped';

export interface ShippingTask {
  id: number;
  taskId?: number;
  workOrderId?: number;
  customerId?: number;
  customerName?: string;
  
  // Status
  status: ShippingStatus;
  
  // Items
  items?: ShippingItem[];
  
  // Packing
  packingRequirements?: string;
  packageCount?: number;
  totalWeight?: number;
  dimensions?: string;
  
  // Shipping
  shippingMethod?: string;
  carrier?: string;
  serviceLevel?: string;
  trackingNumber?: string;
  shippingCost?: number;
  
  // Dates
  shipDate?: Date;
  deliveryDate?: Date;
  
  // Documentation
  packingSlipNumber?: string;
  bolNumber?: string;
  
  packedBy?: number;
  packedAt?: Date;
  shippedBy?: number;
  shippedAt?: Date;
  
  notes?: string;
  specialInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined
  woNumber?: string;
}

export interface ShippingItem {
  partNumber: string;
  description?: string;
  quantity: number;
  weight?: number;
}

export type ReceivingStatus = 'Expected' | 'Received' | 'Partial' | 'Inspecting' | 'Complete' | 'Rejected';

export interface ReceivingTask {
  id: number;
  taskId?: number;
  poId?: number;
  
  // Vendor
  vendorName?: string;
  expectedDate?: Date;
  
  // Status
  status: ReceivingStatus;
  
  // Receipt
  receivedDate?: Date;
  receivedBy?: number;
  receivedByName?: string;
  
  // Items
  expectedItems?: ReceivingItem[];
  receivedItems?: ReceivingItem[];
  
  // Checklist
  countVerified: boolean;
  conditionChecked: boolean;
  paperworkReceived: boolean;
  putAwayComplete: boolean;
  
  // Issues
  hasDiscrepancy: boolean;
  discrepancyNotes?: string;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Joined
  poNumber?: string;
}

export interface ReceivingItem {
  itemName: string;
  partNumber?: string;
  quantityExpected: number;
  quantityReceived: number;
  lotNumber?: string;
  location?: string;
}

// ==================== STATS & FILTERS ====================

export interface TaskStats {
  totalOpen: number;
  overdue: number;
  dueToday: number;
  completedThisWeek: number;
  byType: Record<TaskType, number>;
  byStatus: Record<TaskStatus, number>;
}

export interface TaskFilters {
  type?: TaskType | TaskType[];
  status?: TaskStatus | TaskStatus[];
  assignedTo?: number;
  priority?: TaskPriority | TaskPriority[];
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  workOrderId?: number;
  isOverdue?: boolean;
}

export interface MaintenanceStats {
  scheduledToday: number;
  overdue: number;
  completedThisWeek: number;
  upcomingThisWeek: number;
  byCategory: Record<MaintenanceCategory, number>;
}

// ==================== REQUEST TYPES ====================

export interface CreateTaskRequest {
  type: TaskType;
  title: string;
  description?: string;
  workOrderId?: number;
  partNumber?: string;
  quantity?: number;
  assignedToName?: string;
  priority?: TaskPriority;
  dueDate?: string;
  estimatedDuration?: number;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  taskData?: Record<string, any>;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  id: number;
  status?: TaskStatus;
}

export interface CreateMachineRequest {
  name: string;
  machineId?: string;
  type: MachineType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  yearInstalled?: number;
  workcenterId?: number;
  location?: string;
  maintenanceIntervalHours?: number;
  maintenanceIntervalDays?: number;
  notes?: string;
  specifications?: Record<string, any>;
}

export interface UpdateMachineRequest extends Partial<CreateMachineRequest> {
  id: number;
  status?: MachineStatus;
}

export interface CreateMaintenanceTaskRequest {
  machineId: number;
  taskName: string;
  description?: string;
  category?: MaintenanceCategory;
  dueDate: string;
  frequencyType?: MaintenanceFrequencyType;
  estimatedDuration?: number;
}

export interface CompleteMaintenanceRequest {
  id: number;
  completedByName?: string;
  actualDuration?: number;
  issuesFound?: string;
  partsReplaced?: string;
  notes?: string;
  readings?: Record<string, any>;
}
