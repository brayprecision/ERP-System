/**
 * BPERP Type Definitions
 * Central type definitions for the entire application
 */

import { Request, Response, NextFunction } from 'express';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// ==================== DATABASE ====================

export type DatabasePool = Pool;
export type DatabaseClient = PoolClient;
export type DBQueryResult<T extends QueryResultRow = any> = QueryResult<T>;

// ==================== EXPRESS EXTENSIONS ====================

export interface AuthenticatedRequest extends Request {
    user?: User;
    token?: string;
    validatedBody?: any;
    validatedParams?: any;
    validatedQuery?: any;
}

export type AuthMiddleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => Promise<void> | void;

// ==================== USER & AUTH ====================

export interface User {
    id: number;
    username: string;
    name: string;
    email: string | null;
    role: UserRole;
    appearanceSettings: AppearanceSettings;
    tabPermissions: TabPermissions;
    isActive: boolean;
    lastLogin: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export type UserRole = 'Administrator' | 'Machinist' | 'Operator';

export interface AppearanceSettings {
    theme: string;
    showGrid: boolean;
    showGlow: boolean;
    animations: boolean;
    transparency: number;
}

export interface TabPermissions {
    dashboard: boolean;
    workcenter: boolean;
    inventory: boolean;
    sales: boolean;
    tasks: boolean;
    settings: boolean;
}

export interface UserSession {
    id: number;
    userId: number;
    token: string;
    expiresAt: Date;
    createdAt: Date;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export interface CreateUserInput {
    username: string;
    name: string;
    email?: string;
    password: string;
    role?: UserRole;
}

// ==================== CUSTOMER ====================

export interface Customer {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    terms: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface Contact {
    id: number;
    customerId: number;
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateCustomerInput {
    name: string;
    address?: string;
    phone?: string;
    terms?: string;
    notes?: string;
}

// ==================== INVENTORY ====================

export interface Material {
    id: number;
    name: string;
    partNumber: string | null;
    category: string | null;
    description: string | null;
    qtyOnHand: number;
    minimumQty: number;
    unit: string;
    supplier: string | null;
    unitPrice: number | null;
    location: string | null;
    lastOrdered: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface Tooling extends Material {
    condition: string | null;
}

export interface MiscItem extends Material {}

export type InventoryCategory = 'material' | 'tooling' | 'misc';

export interface CreateMaterialInput {
    name: string;
    partNumber?: string;
    category?: string;
    description?: string;
    qtyOnHand?: number;
    minimumQty?: number;
    unit?: string;
    supplier?: string;
    unitPrice?: number;
    location?: string;
}

// ==================== QUOTES ====================

export interface Quote {
    id: number;
    quoteNumber: string;
    customerId: number | null;
    customerName: string | null;
    rfqNumber: string | null;
    rfqDate: Date | null;
    partNumber: string | null;
    description: string | null;
    quantity: number;
    status: QuoteStatus;
    requestedDate: Date | null;
    dueDate: Date | null;
    totalAmount: number;
    notes: string | null;
    internalNotes: string | null;
    sentAt: Date | null;
    createdBy: number | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export type QuoteStatus = 'New' | 'In Progress' | 'Sent' | 'Won' | 'Lost';

export interface QuoteItem {
    id: number;
    quoteId: number;
    lineNumber: number;
    partNumber: string | null;
    description: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    extendedPrice: number;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// ==================== WORK ORDERS ====================

export interface WorkOrder {
    id: number;
    woNumber: string;
    customerId: number | null;
    customerName: string | null;
    quoteId: number | null;
    dueDate: Date | null;
    status: WorkOrderStatus;
    completionPercentage: number;
    notes: string | null;
    createdBy: number | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export type WorkOrderStatus = 'Active' | 'On Hold' | 'Complete' | 'Cancelled';

export interface WOChecklistItem {
    id: number;
    workOrderId: number;
    stepNumber: number;
    stepName: string;
    isCompleted: boolean;
    completedBy: number | null;
    completedByName: string | null;
    completedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// ==================== TASKS ====================

export interface Task {
    id: number;
    type: TaskType;
    title: string;
    description: string | null;
    workOrderId: number | null;
    partNumber: string | null;
    quantity: number | null;
    assignedTo: number | null;
    assignedToName: string | null;
    assignedAt: Date | null;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    estimatedDuration: number | null;
    actualDuration: number | null;
    taskData: Record<string, any>;
    isRecurring: boolean;
    recurrencePattern: string | null;
    parentTaskId: number | null;
    createdBy: number | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export type TaskType = 
    | 'ordering' 
    | 'processing' 
    | 'machining' 
    | 'inspection' 
    | 'shipping' 
    | 'receiving' 
    | 'maintenance' 
    | 'misc';

export type TaskStatus = 
    | 'Not Started' 
    | 'In Progress' 
    | 'Complete' 
    | 'Issue' 
    | 'On Hold';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface TaskHistory {
    id: number;
    taskId: number;
    action: string;
    oldValue: Record<string, any> | null;
    newValue: Record<string, any> | null;
    userId: number | null;
    userName: string | null;
    timestamp: Date;
    notes: string | null;
    ipAddress: string | null;
}

// ==================== WORKCENTERS ====================

export interface Workcenter {
    id: number;
    name: string;
    type: WorkcenterType;
    description: string | null;
    location: string | null;
    capacity: number;
    isActive: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

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

export interface WorkcenterQueueItem {
    id: number;
    workcenterId: number;
    workOrderId: number | null;
    taskId: number | null;
    sequence: number;
    status: QueueStatus;
    priority: number;
    partNumber: string | null;
    quantity: number | null;
    quantityComplete: number | null;
    operationNumber: number | null;
    operationDescription: string | null;
    estimatedTime: number | null;
    setupNotes: string | null;
    woNumber: string | null;
    material: string | null;
    queuedAt: Date;
    setupStartedAt: Date | null;
    processingStartedAt: Date | null;
    completedAt: Date | null;
    actualTime: number | null;
    operatorId: number | null;
    operatorName: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type QueueStatus = 'Waiting' | 'Setup' | 'Running' | 'Complete' | 'Issue';

// ==================== MACHINES ====================

export interface Machine {
    id: number;
    name: string;
    machineId: string | null;
    type: MachineType;
    manufacturer: string | null;
    model: string | null;
    serialNumber: string | null;
    yearInstalled: number | null;
    workcenterId: number | null;
    location: string | null;
    status: MachineStatus;
    currentJobId: number | null;
    currentOperatorId: number | null;
    currentOperatorName: string | null;
    maintenanceHours: number;
    maintenanceCycles: number;
    lastMaintenanceDate: Date | null;
    nextMaintenanceDate: Date | null;
    maintenanceIntervalHours: number | null;
    maintenanceIntervalDays: number | null;
    totalRunHours: number;
    totalCycles: number;
    notes: string | null;
    specifications: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type MachineType = 
    | 'cnc_mill' 
    | 'cnc_lathe' 
    | 'saw' 
    | 'waterjet' 
    | 'laser' 
    | 'grinder' 
    | 'manual';

export type MachineStatus = 'Idle' | 'Running' | 'Setup' | 'Down' | 'Maintenance';

export type MaintenanceStatus = 'Good' | 'Attention' | 'Overdue';

// ==================== MAINTENANCE ====================

export interface MaintenanceTaskDefinition {
    id: number;
    machineId: number | null;
    machineType: MachineType | null;
    taskName: string;
    description: string | null;
    category: MaintenanceCategory | null;
    frequencyType: FrequencyType;
    frequencyValue: number | null;
    estimatedDuration: number | null;
    requiresShutdown: boolean;
    skillLevel: string | null;
    instructions: string | null;
    safetyNotes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type MaintenanceCategory = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'as_needed';
export type FrequencyType = 'hours' | 'days' | 'cycles' | 'on_demand';

export interface MaintenanceTask {
    id: number;
    definitionId: number | null;
    machineId: number;
    taskName: string;
    description: string | null;
    category: MaintenanceCategory | null;
    scheduledDate: Date | null;
    dueDate: Date;
    frequencyType: FrequencyType | null;
    status: MaintenanceTaskStatus;
    startedAt: Date | null;
    completedAt: Date | null;
    completedBy: number | null;
    completedByName: string | null;
    actualDuration: number | null;
    deferredTo: Date | null;
    deferredReason: string | null;
    deferredBy: number | null;
    issuesFound: string | null;
    partsReplaced: string | null;
    notes: string | null;
    readings: Record<string, any>;
    laborCost: number | null;
    partsCost: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export type MaintenanceTaskStatus = 
    | 'Scheduled' 
    | 'In Progress' 
    | 'Complete' 
    | 'Deferred' 
    | 'Overdue';

// ==================== PURCHASE ORDERS ====================

export interface PurchaseOrder {
    id: number;
    poNumber: string;
    supplierId: number | null;
    supplierName: string;
    status: POStatus;
    createdDate: Date;
    orderDate: Date | null;
    expectedDelivery: Date | null;
    receivedDate: Date | null;
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    workOrderId: number | null;
    trackingNumber: string | null;
    carrier: string | null;
    notes: string | null;
    internalNotes: string | null;
    createdBy: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export type POStatus = 
    | 'Pending' 
    | 'Ordered' 
    | 'Shipped' 
    | 'Partial' 
    | 'Received' 
    | 'Cancelled';

export interface POItem {
    id: number;
    poId: number;
    lineNumber: number;
    itemType: POItemType | null;
    itemName: string;
    partNumber: string | null;
    description: string | null;
    quantityOrdered: number;
    quantityReceived: number;
    unit: string;
    unitPrice: number;
    extendedPrice: number;
    receivedDate: Date | null;
    lotNumber: string | null;
    location: string | null;
    inspectionRequired: boolean;
    inspectionStatus: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type POItemType = 'material' | 'tooling' | 'supply' | 'other';

// ==================== INSPECTION ====================

export interface InspectionTask {
    id: number;
    taskId: number | null;
    workOrderId: number | null;
    partNumber: string | null;
    inspectionType: InspectionType;
    quantityToInspect: number;
    quantityInspected: number;
    quantityPassed: number;
    quantityFailed: number;
    status: InspectionStatus;
    drawingNumber: string | null;
    revision: string | null;
    specNumbers: string | null;
    criticalDimensions: CriticalDimension[];
    inspectionResults: Record<string, any>;
    measurementData: MeasurementData[];
    inspectorId: number | null;
    inspectorName: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    reportNumber: string | null;
    cocNumber: string | null;
    ncrNumber: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type InspectionType = 'first_article' | 'in_process' | 'final' | 'receiving';
export type InspectionStatus = 'Pending' | 'In Progress' | 'Pass' | 'Fail' | 'Hold';

export interface CriticalDimension {
    name: string;
    nominal: number;
    tolerance: string;
    unit: string;
    isCritical: boolean;
}

export interface MeasurementData {
    dimension: string;
    nominal: number;
    actual: number;
    deviation: number;
    pass: boolean;
}

// ==================== SHIPPING & RECEIVING ====================

export interface ShippingTask {
    id: number;
    taskId: number | null;
    workOrderId: number | null;
    customerId: number | null;
    customerName: string | null;
    status: ShippingStatus;
    items: ShippingItem[];
    packingRequirements: string | null;
    packageCount: number | null;
    totalWeight: number | null;
    dimensions: string | null;
    shippingMethod: string | null;
    carrier: string | null;
    serviceLevel: string | null;
    trackingNumber: string | null;
    shippingCost: number | null;
    shipDate: Date | null;
    deliveryDate: Date | null;
    packingSlipNumber: string | null;
    bolNumber: string | null;
    packedBy: number | null;
    packedAt: Date | null;
    shippedBy: number | null;
    shippedAt: Date | null;
    notes: string | null;
    specialInstructions: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type ShippingStatus = 'Ready' | 'Packing' | 'Packed' | 'Labeled' | 'Shipped';

export interface ShippingItem {
    partNumber: string;
    description: string;
    quantity: number;
    weight?: number;
}

export interface ReceivingTask {
    id: number;
    taskId: number | null;
    poId: number | null;
    vendorName: string | null;
    expectedDate: Date | null;
    status: ReceivingStatus;
    receivedDate: Date | null;
    receivedBy: number | null;
    receivedByName: string | null;
    expectedItems: ExpectedItem[];
    receivedItems: ReceivedItem[];
    countVerified: boolean;
    conditionChecked: boolean;
    paperworkReceived: boolean;
    putAwayComplete: boolean;
    hasDiscrepancy: boolean;
    discrepancyNotes: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export type ReceivingStatus = 'Expected' | 'Received' | 'Partial' | 'Inspecting' | 'Complete' | 'Rejected';

export interface ExpectedItem {
    itemName: string;
    partNumber: string;
    quantityExpected: number;
}

export interface ReceivedItem extends ExpectedItem {
    quantityReceived: number;
    lotNumber?: string;
    location?: string;
}

// ==================== API RESPONSES ====================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    details?: any;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface StatsResponse<T> extends ApiResponse<T> {
    stats: Record<string, any>;
}

// ==================== IMPORT ====================

export interface ImportPreviewResult {
    entityType: string;
    filename: string;
    totalRows: number;
    validRows: number;
    errorRows: number;
    columnMapping: Record<string, string>;
    unmappedColumns: string[];
    preview: any[];
    errors: ImportError[];
    requiredFields: string[];
    availableFields: string[];
}

export interface ImportResult {
    imported: number;
    skipped?: number;
    validationErrors: number;
    importErrors: number;
    details: {
        importedRecords: any[];
        validationErrors: ImportError[];
        importErrors: ImportError[];
    };
}

export interface ImportError {
    row: number;
    errors?: string[];
    error?: string;
}

export type ImportEntityType = 
    | 'customers' 
    | 'contacts' 
    | 'materials' 
    | 'tooling' 
    | 'workcenters' 
    | 'machines';
