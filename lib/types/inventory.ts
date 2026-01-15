// Inventory TypeScript Interfaces for BPERP

// Base inventory item interface
export interface BaseInventoryItem {
  id: string;
  name: string;
  qtyOnHand: number;
  minimumQty: number;
  reorderLink: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Material inventory item
export interface Material extends BaseInventoryItem {
  type: 'material';
  materialType: string;
  materialShape: string;
  lengthUnit: string;
  unitPrice: number;
  supplier: string;
}

// Tooling inventory item
export interface Tool extends BaseInventoryItem {
  type: 'tool';
  toolType: string;
  operation: string;
  supplier: string;
  toolPrice: number;
}

// Miscellaneous inventory item
export interface MiscItem extends BaseInventoryItem {
  type: 'misc';
  workcenter: string;
  itemPrice: number;
}

// Union type for all inventory items
export type InventoryItem = Material | Tool | MiscItem;

// Inventory category type
export type InventoryCategory = 'material' | 'tool' | 'misc' | 'all';

// Urgency status for inventory
export interface UrgencyStatus {
  score: number;
  status: 'Critical' | 'Low Stock' | 'Monitor' | 'Good';
  colorClass: string;
  badgeClass: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request types for creating/updating inventory
export interface CreateMaterialRequest {
  name: string;
  materialType: string;
  materialShape: string;
  qtyOnHand: number;
  lengthUnit: string;
  unitPrice: number;
  supplier: string;
  minimumQty: number;
  reorderLink: string;
}

export interface UpdateMaterialRequest extends Partial<CreateMaterialRequest> {
  id: string;
}

export interface CreateToolRequest {
  name: string;
  toolType: string;
  operation: string;
  qtyOnHand: number;
  minimumQty: number;
  supplier: string;
  toolPrice: number;
  reorderLink: string;
}

export interface UpdateToolRequest extends Partial<CreateToolRequest> {
  id: string;
}

export interface CreateMiscRequest {
  name: string;
  workcenter: string;
  qtyOnHand: number;
  minimumQty: number;
  reorderLink: string;
  itemPrice: number;
}

export interface UpdateMiscRequest extends Partial<CreateMiscRequest> {
  id: string;
}

// Filter and sort options
export interface InventoryFilters {
  search?: string;
  category?: InventoryCategory;
  supplier?: string;
  status?: 'critical' | 'low' | 'monitor' | 'good';
  minQty?: number;
  maxQty?: number;
}

export type SortField = 'name' | 'qtyOnHand' | 'minimumQty' | 'price' | 'supplier' | 'status' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: SortField;
  order: SortOrder;
}

export interface InventoryQueryParams extends InventoryFilters {
  page?: number;
  limit?: number;
  sortField?: SortField;
  sortOrder?: SortOrder;
}

// Form validation error type
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
