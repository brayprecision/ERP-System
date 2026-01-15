// Sales Module TypeScript Interfaces for BPERP

// ==================== CUSTOMERS ====================

export interface Customer {
  id: number;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country: string;
  phone?: string;
  fax?: string;
  website?: string;
  defaultTerms: PaymentTerms;
  taxId?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  
  // Computed/joined fields
  contacts?: Contact[];
  openWorkOrderCount?: number;
  openWorkOrders?: WorkOrderSummary[];
}

export type PaymentTerms = 'NET 15' | 'NET 30' | 'NET 45' | 'NET 60' | 'COD' | 'Due on Receipt' | 'Custom';

export interface Contact {
  id: number;
  customerId: number;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary: boolean;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerRequest {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  fax?: string;
  website?: string;
  defaultTerms?: PaymentTerms;
  taxId?: string;
  notes?: string;
  contacts?: CreateContactRequest[];
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {
  id: number;
}

export interface CreateContactRequest {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface UpdateContactRequest extends Partial<CreateContactRequest> {
  id: number;
}

// ==================== QUOTES ====================

export type QuoteStatus = 'New' | 'In Progress' | 'Sent' | 'Won' | 'Lost' | 'Expired';
export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent';

export interface Quote {
  id: number;
  quoteNumber: string;
  customerId: number;
  contactId?: number;
  status: QuoteStatus;
  priority: Priority;
  
  // RFQ Details
  rfqNumber?: string;
  rfqReceivedDate?: Date;
  quoteDueDate?: Date;
  
  // Sent Quote Details
  sentAt?: Date;
  sentTo?: string;
  validUntil?: Date;
  
  // Win/Loss tracking
  wonAt?: Date;
  lostAt?: Date;
  lostReason?: string;
  
  // Totals
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  
  notes?: string;
  internalNotes?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  
  // Joined fields
  customer?: Customer;
  contact?: Contact;
  items?: QuoteItem[];
  documents?: QuoteDocument[];
}

export interface QuoteItem {
  id: number;
  quoteId: number;
  lineNumber: number;
  
  // Part Details
  partNumber: string;
  revision?: string;
  description?: string;
  quantity: number;
  unit: string;
  
  // Material
  material?: string;
  materialCost: number;
  
  // Pricing
  unitPrice: number;
  setupCost: number;
  extendedPrice: number;
  
  // Lead time
  leadTimeDays?: number;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuoteDocument {
  id: number;
  quoteId: number;
  filename: string;
  originalFilename?: string;
  fileType?: string;
  fileSize?: number;
  filePath?: string;
  url?: string;
  description?: string;
  uploadedBy?: number;
  uploadedAt: Date;
}

export interface CreateQuoteRequest {
  customerId: number;
  contactId?: number;
  priority?: Priority;
  rfqNumber?: string;
  rfqReceivedDate?: string;
  quoteDueDate?: string;
  validUntil?: string;
  notes?: string;
  internalNotes?: string;
  items?: CreateQuoteItemRequest[];
}

export interface UpdateQuoteRequest extends Partial<CreateQuoteRequest> {
  id: number;
  status?: QuoteStatus;
  sentTo?: string;
  lostReason?: string;
}

export interface CreateQuoteItemRequest {
  partNumber: string;
  revision?: string;
  description?: string;
  quantity: number;
  unit?: string;
  material?: string;
  materialCost?: number;
  unitPrice: number;
  setupCost?: number;
  leadTimeDays?: number;
  notes?: string;
}

export interface UpdateQuoteItemRequest extends Partial<CreateQuoteItemRequest> {
  id: number;
}

// ==================== WORK ORDERS ====================

export type WorkOrderStatus = 'Open' | 'In Progress' | 'On Hold' | 'Complete' | 'Shipped' | 'Cancelled';

export interface WorkOrder {
  id: number;
  woNumber: string;
  quoteId?: number;
  quoteItemId?: number;
  customerId: number;
  
  // Part Details
  partNumber: string;
  revision?: string;
  description?: string;
  quantity: number;
  unit: string;
  
  // Material
  material?: string;
  
  // Dates
  orderDate: Date;
  dueDate: Date;
  shipDate?: Date;
  completedDate?: Date;
  
  // Status
  status: WorkOrderStatus;
  priority: Priority;
  
  // Progress
  completionPercentage: number;
  currentStep?: string;
  
  // Pricing
  quotedPrice?: number;
  actualCost: number;
  
  // Customer PO
  customerPo?: string;
  
  notes?: string;
  internalNotes?: string;
  createdBy?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  
  // Joined fields
  customer?: Customer;
  quote?: Quote;
  checklist?: WorkOrderChecklistItem[];
  
  // Computed fields
  daysUntilDue?: number;
  urgencyColor?: 'green' | 'yellow' | 'red';
}

export interface WorkOrderSummary {
  id: number;
  woNumber: string;
  partNumber: string;
  quantity: number;
  dueDate: Date;
  status: WorkOrderStatus;
  completionPercentage: number;
}

export type ChecklistStepKey = 
  | 'material_ordered'
  | 'tooling_ordered'
  | 'part_programmed'
  | 'material_received'
  | 'tooling_received'
  | 'material_processed'
  | 'machining_complete'
  | 'post_processing'
  | 'inspection_complete'
  | 'ready_for_shipment';

export interface WorkOrderChecklistItem {
  id: number;
  workOrderId: number;
  stepOrder: number;
  stepName: string;
  stepKey: ChecklistStepKey;
  
  // Completion status
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: number;
  completedByName?: string;
  
  // Step-specific data
  stepData: ChecklistStepData;
  
  // Common fields
  dateValue?: Date;
  referenceNumber?: string;
  vendorSupplier?: string;
  operatorName?: string;
  
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Step-specific data interfaces
export interface ChecklistStepData {
  // Material/Tooling Ordered
  poNumber?: string;
  supplier?: string;
  orderDate?: string;
  expectedDate?: string;
  
  // Material/Tooling Received
  lotNumber?: string;
  certsReceived?: boolean;
  toolList?: string[];
  
  // Part Programmed
  programmer?: string;
  programNumber?: string;
  machine?: string;
  
  // Material Processed
  operator?: string;
  processNotes?: string;
  
  // Machining Complete
  machineUsed?: string;
  hours?: number;
  
  // Post Processing
  processType?: string;
  vendor?: string;
  isOutsourced?: boolean;
  
  // Inspection
  inspector?: string;
  firstArticle?: boolean;
  cocNumber?: string;
  
  // Ready for Shipment
  packagingNotes?: string;
  weight?: number;
  dimensions?: string;
}

export interface UpdateChecklistItemRequest {
  id: number;
  isCompleted?: boolean;
  dateValue?: string;
  referenceNumber?: string;
  vendorSupplier?: string;
  operatorName?: string;
  notes?: string;
  stepData?: Partial<ChecklistStepData>;
}

export interface CreateWorkOrderRequest {
  customerId: number;
  quoteId?: number;
  quoteItemId?: number;
  partNumber: string;
  revision?: string;
  description?: string;
  quantity: number;
  unit?: string;
  material?: string;
  dueDate: string;
  priority?: Priority;
  customerPo?: string;
  quotedPrice?: number;
  notes?: string;
  internalNotes?: string;
}

export interface UpdateWorkOrderRequest extends Partial<CreateWorkOrderRequest> {
  id: number;
  status?: WorkOrderStatus;
}

// ==================== FILTERS & QUERIES ====================

export interface CustomerFilters {
  search?: string;
  isActive?: boolean;
  hasOpenWorkOrders?: boolean;
}

export interface QuoteFilters {
  search?: string;
  customerId?: number;
  status?: QuoteStatus | QuoteStatus[];
  dateFrom?: string;
  dateTo?: string;
  isOpen?: boolean; // New, In Progress = open
  isSent?: boolean; // Sent, Won, Lost = sent
}

export interface WorkOrderFilters {
  search?: string;
  customerId?: number;
  status?: WorkOrderStatus | WorkOrderStatus[];
  dueDateFrom?: string;
  dueDateTo?: string;
  isOverdue?: boolean;
}

// ==================== API RESPONSES ====================

export interface CustomerWithDetails extends Customer {
  contacts: Contact[];
  openWorkOrderCount: number;
  openWorkOrders: WorkOrderSummary[];
  totalQuotes: number;
  wonQuotes: number;
}

export interface QuoteWithDetails extends Quote {
  customer: Customer;
  contact?: Contact;
  items: QuoteItem[];
  documents: QuoteDocument[];
}

export interface WorkOrderWithDetails extends WorkOrder {
  customer: Customer;
  checklist: WorkOrderChecklistItem[];
  quote?: Quote;
}

// ==================== STATS ====================

export interface SalesStats {
  openQuotes: number;
  sentQuotes: number;
  wonThisMonth: number;
  lostThisMonth: number;
  winRate: number;
  totalQuoteValue: number;
  activeWorkOrders: number;
  overdueWorkOrders: number;
  completedThisMonth: number;
}
