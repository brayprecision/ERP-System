/**
 * Database-specific type definitions
 * Maps between database column names and TypeScript property names
 */

// ==================== ROW TYPES (Database format - snake_case) ====================

export interface UserRow {
    id: number;
    username: string;
    name: string;
    email: string | null;
    password_hash: string;
    role: string;
    appearance_settings: Record<string, any> | null;
    tab_permissions: Record<string, any> | null;
    is_active: boolean;
    last_login: Date | null;
    created_at: Date;
    updated_at: Date;
}

export interface CustomerRow {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    terms: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface MaterialRow {
    id: number;
    name: string;
    part_number: string | null;
    category: string | null;
    description: string | null;
    qty_on_hand: number;
    minimum_qty: number;
    unit: string;
    supplier: string | null;
    unit_price: string | null; // PostgreSQL DECIMAL comes as string
    location: string | null;
    last_ordered: Date | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface TaskRow {
    id: number;
    type: string;
    title: string;
    description: string | null;
    work_order_id: number | null;
    part_number: string | null;
    quantity: number | null;
    assigned_to: number | null;
    assigned_to_name: string | null;
    assigned_at: Date | null;
    status: string;
    priority: string;
    due_date: Date | null;
    started_at: Date | null;
    completed_at: Date | null;
    estimated_duration: number | null;
    actual_duration: number | null;
    task_data: Record<string, any> | null;
    is_recurring: boolean;
    recurrence_pattern: string | null;
    parent_task_id: number | null;
    created_by: number | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

export interface WorkcenterRow {
    id: number;
    name: string;
    type: string;
    description: string | null;
    location: string | null;
    capacity: number;
    is_active: boolean;
    display_order: number;
    created_at: Date;
    updated_at: Date;
}

export interface WorkcenterQueueRow {
    id: number;
    workcenter_id: number;
    work_order_id: number | null;
    task_id: number | null;
    sequence: number;
    status: string;
    priority: number;
    part_number: string | null;
    quantity: number | null;
    quantity_complete: number | null;
    operation_number: number | null;
    operation_description: string | null;
    estimated_time: number | null;
    setup_notes: string | null;
    wo_number: string | null;
    material: string | null;
    queued_at: Date;
    setup_started_at: Date | null;
    processing_started_at: Date | null;
    completed_at: Date | null;
    actual_time: number | null;
    operator_id: number | null;
    operator_name: string | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface MachineRow {
    id: number;
    name: string;
    machine_id: string | null;
    type: string;
    manufacturer: string | null;
    model: string | null;
    serial_number: string | null;
    year_installed: number | null;
    workcenter_id: number | null;
    location: string | null;
    status: string;
    current_job_id: number | null;
    current_operator_id: number | null;
    current_operator_name: string | null;
    maintenance_hours: string; // DECIMAL
    maintenance_cycles: number;
    last_maintenance_date: Date | null;
    next_maintenance_date: Date | null;
    maintenance_interval_hours: number | null;
    maintenance_interval_days: number | null;
    total_run_hours: string; // DECIMAL
    total_cycles: number;
    notes: string | null;
    specifications: Record<string, any> | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface MaintenanceTaskRow {
    id: number;
    definition_id: number | null;
    machine_id: number;
    task_name: string;
    description: string | null;
    category: string | null;
    scheduled_date: Date | null;
    due_date: Date;
    frequency_type: string | null;
    status: string;
    started_at: Date | null;
    completed_at: Date | null;
    completed_by: number | null;
    completed_by_name: string | null;
    actual_duration: number | null;
    deferred_to: Date | null;
    deferred_reason: string | null;
    deferred_by: number | null;
    issues_found: string | null;
    parts_replaced: string | null;
    notes: string | null;
    readings: Record<string, any> | null;
    labor_cost: string | null; // DECIMAL
    parts_cost: string | null; // DECIMAL
    created_at: Date;
    updated_at: Date;
    // Joined fields
    machine_name?: string;
    machine_type?: string;
}

export interface PurchaseOrderRow {
    id: number;
    po_number: string;
    supplier_id: number | null;
    supplier_name: string;
    status: string;
    created_date: Date;
    order_date: Date | null;
    expected_delivery: Date | null;
    received_date: Date | null;
    subtotal: string; // DECIMAL
    tax: string; // DECIMAL
    shipping: string; // DECIMAL
    total: string; // DECIMAL
    work_order_id: number | null;
    tracking_number: string | null;
    carrier: string | null;
    notes: string | null;
    internal_notes: string | null;
    created_by: number | null;
    created_at: Date;
    updated_at: Date;
}

export interface POItemRow {
    id: number;
    po_id: number;
    line_number: number;
    item_type: string | null;
    item_name: string;
    part_number: string | null;
    description: string | null;
    quantity_ordered: number;
    quantity_received: number;
    unit: string;
    unit_price: string; // DECIMAL
    extended_price: string; // DECIMAL
    received_date: Date | null;
    lot_number: string | null;
    location: string | null;
    inspection_required: boolean;
    inspection_status: string | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date;
}

// ==================== TRANSFORMER UTILITIES ====================

/**
 * Convert snake_case database row to camelCase object
 */
export function snakeToCamel<T extends Record<string, any>>(row: T): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}

/**
 * Convert camelCase object to snake_case for database
 */
export function camelToSnake<T extends Record<string, any>>(obj: T): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        result[snakeKey] = value;
    }
    return result;
}

/**
 * Parse PostgreSQL DECIMAL string to number
 */
export function parseDecimal(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return parseFloat(value) || 0;
}
