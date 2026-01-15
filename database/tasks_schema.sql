-- BPERP Tasks Module Database Schema
-- Run this script after schema.sql and sales_schema.sql

-- ==================== CORE TASKS ====================

-- Main tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- ordering, processing, machining, inspection, shipping, receiving, maintenance, misc
    title VARCHAR(200) NOT NULL,
    description TEXT,
    work_order_id INT REFERENCES work_orders(id),
    part_number VARCHAR(100),
    quantity INT,
    
    -- Assignment
    assigned_to INT REFERENCES users(id),
    assigned_to_name VARCHAR(100),
    assigned_at TIMESTAMP,
    
    -- Status and Priority
    status VARCHAR(30) DEFAULT 'Not Started', -- Not Started, In Progress, Complete, Issue, On Hold
    priority VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High, Urgent
    
    -- Dates
    due_date TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Timing
    estimated_duration INT, -- minutes
    actual_duration INT, -- minutes
    
    -- Additional data (JSON for flexibility)
    task_data JSONB DEFAULT '{}',
    
    -- Recurring tasks
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(20), -- daily, weekly, monthly
    parent_task_id INT REFERENCES tasks(id),
    
    -- Metadata
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Task assignments history
CREATE TABLE IF NOT EXISTS task_assignments (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id),
    user_name VARCHAR(100),
    assigned_by INT REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    removed_at TIMESTAMP,
    notes TEXT
);

-- Task history/audit log
CREATE TABLE IF NOT EXISTS task_history (
    id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- created, started, completed, reassigned, issue_reported, etc
    old_value JSONB,
    new_value JSONB,
    user_id INT REFERENCES users(id),
    user_name VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    ip_address VARCHAR(50)
);

-- ==================== WORKCENTERS & QUEUES ====================

-- Workcenters definition
CREATE TABLE IF NOT EXISTS workcenters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- saw, waterjet, laser, cnc_mill, cnc_lathe, manual, inspection, shipping
    description TEXT,
    location VARCHAR(100),
    capacity INT DEFAULT 1, -- number of simultaneous jobs
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workcenter queue
CREATE TABLE IF NOT EXISTS workcenter_queue (
    id SERIAL PRIMARY KEY,
    workcenter_id INT NOT NULL REFERENCES workcenters(id),
    work_order_id INT REFERENCES work_orders(id),
    task_id INT REFERENCES tasks(id),
    sequence INT NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Waiting', -- Waiting, Setup, Running, Complete, Issue
    priority INT DEFAULT 5, -- 1=highest, 10=lowest
    
    -- Job details
    part_number VARCHAR(100),
    quantity INT,
    operation_number INT,
    operation_description TEXT,
    estimated_time INT, -- minutes
    setup_notes TEXT,
    
    -- Timing
    queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    setup_started_at TIMESTAMP,
    processing_started_at TIMESTAMP,
    completed_at TIMESTAMP,
    actual_time INT,
    
    -- Operator
    operator_id INT REFERENCES users(id),
    operator_name VARCHAR(100),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== MACHINES ====================

-- Machine list
CREATE TABLE IF NOT EXISTS machines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    machine_id VARCHAR(50) UNIQUE, -- Internal ID like "CNC-01"
    type VARCHAR(50) NOT NULL, -- cnc_mill, cnc_lathe, saw, waterjet, laser, grinder, etc
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    year_installed INT,
    
    -- Location
    workcenter_id INT REFERENCES workcenters(id),
    location VARCHAR(100),
    
    -- Status
    status VARCHAR(30) DEFAULT 'Idle', -- Idle, Running, Setup, Down, Maintenance
    current_job_id INT,
    current_operator_id INT REFERENCES users(id),
    current_operator_name VARCHAR(100),
    
    -- Maintenance tracking
    maintenance_hours DECIMAL(10,2) DEFAULT 0, -- hours since last maintenance
    maintenance_cycles INT DEFAULT 0, -- cycles since last maintenance
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_interval_hours INT, -- hours between scheduled maintenance
    maintenance_interval_days INT, -- days between scheduled maintenance
    
    -- Utilization
    total_run_hours DECIMAL(10,2) DEFAULT 0,
    total_cycles INT DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    specifications JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Machine status history
CREATE TABLE IF NOT EXISTS machine_status_history (
    id SERIAL PRIMARY KEY,
    machine_id INT NOT NULL REFERENCES machines(id),
    status VARCHAR(30) NOT NULL,
    previous_status VARCHAR(30),
    work_order_id INT,
    operator_id INT REFERENCES users(id),
    operator_name VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- ==================== MAINTENANCE ====================

-- Maintenance task definitions (templates)
CREATE TABLE IF NOT EXISTS maintenance_task_definitions (
    id SERIAL PRIMARY KEY,
    machine_id INT REFERENCES machines(id), -- NULL for general tasks
    machine_type VARCHAR(50), -- Apply to all machines of this type
    task_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- daily, weekly, monthly, quarterly, annual, as_needed
    frequency_type VARCHAR(20) NOT NULL, -- hours, days, cycles, on_demand
    frequency_value INT, -- e.g., 500 hours, 7 days
    estimated_duration INT, -- minutes
    requires_shutdown BOOLEAN DEFAULT FALSE,
    skill_level VARCHAR(20), -- basic, intermediate, advanced
    instructions TEXT,
    safety_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Required materials for maintenance tasks
CREATE TABLE IF NOT EXISTS maintenance_materials (
    id SERIAL PRIMARY KEY,
    task_definition_id INT NOT NULL REFERENCES maintenance_task_definitions(id) ON DELETE CASCADE,
    material_name VARCHAR(200) NOT NULL,
    part_number VARCHAR(100),
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'EA',
    notes TEXT,
    is_critical BOOLEAN DEFAULT FALSE, -- Must have to complete task
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled/completed maintenance tasks
CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id SERIAL PRIMARY KEY,
    definition_id INT REFERENCES maintenance_task_definitions(id),
    machine_id INT NOT NULL REFERENCES machines(id),
    task_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    
    -- Scheduling
    scheduled_date DATE,
    due_date DATE NOT NULL,
    frequency_type VARCHAR(20),
    
    -- Status
    status VARCHAR(30) DEFAULT 'Scheduled', -- Scheduled, In Progress, Complete, Deferred, Overdue
    
    -- Execution
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    completed_by INT REFERENCES users(id),
    completed_by_name VARCHAR(100),
    actual_duration INT, -- minutes
    
    -- Deferral
    deferred_to DATE,
    deferred_reason TEXT,
    deferred_by INT REFERENCES users(id),
    
    -- Findings
    issues_found TEXT,
    parts_replaced TEXT,
    notes TEXT,
    
    -- Readings/measurements
    readings JSONB DEFAULT '{}', -- e.g., oil level, belt tension
    
    -- Costs
    labor_cost DECIMAL(10,2),
    parts_cost DECIMAL(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance history log
CREATE TABLE IF NOT EXISTS maintenance_history (
    id SERIAL PRIMARY KEY,
    machine_id INT NOT NULL REFERENCES machines(id),
    maintenance_task_id INT REFERENCES maintenance_tasks(id),
    action VARCHAR(50) NOT NULL, -- completed, deferred, issue_found, part_replaced
    description TEXT,
    performed_by INT REFERENCES users(id),
    performed_by_name VARCHAR(100),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hours_at_time DECIMAL(10,2),
    cycles_at_time INT,
    notes TEXT
);

-- ==================== ORDERING ====================

-- Purchase orders for materials/tooling
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INT, -- References suppliers table if exists
    supplier_name VARCHAR(200) NOT NULL,
    
    -- Status
    status VARCHAR(30) DEFAULT 'Pending', -- Pending, Ordered, Shipped, Partial, Received, Cancelled
    
    -- Dates
    created_date DATE DEFAULT CURRENT_DATE,
    order_date DATE,
    expected_delivery DATE,
    received_date DATE,
    
    -- Financials
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    shipping DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    
    -- Related
    work_order_id INT REFERENCES work_orders(id),
    
    -- Tracking
    tracking_number VARCHAR(100),
    carrier VARCHAR(50),
    
    notes TEXT,
    internal_notes TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase order line items
CREATE TABLE IF NOT EXISTS po_items (
    id SERIAL PRIMARY KEY,
    po_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    line_number INT DEFAULT 1,
    
    -- Item details
    item_type VARCHAR(30), -- material, tooling, supply, other
    item_name VARCHAR(200) NOT NULL,
    part_number VARCHAR(100),
    description TEXT,
    quantity_ordered INT NOT NULL,
    quantity_received INT DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'EA',
    unit_price DECIMAL(10,2) DEFAULT 0,
    extended_price DECIMAL(12,2) DEFAULT 0,
    
    -- Receipt tracking
    received_date DATE,
    lot_number VARCHAR(100),
    location VARCHAR(100), -- where it was put away
    
    -- Quality
    inspection_required BOOLEAN DEFAULT FALSE,
    inspection_status VARCHAR(30), -- pending, passed, failed
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order issues/problems
CREATE TABLE IF NOT EXISTS order_issues (
    id SERIAL PRIMARY KEY,
    po_id INT NOT NULL REFERENCES purchase_orders(id),
    po_item_id INT REFERENCES po_items(id),
    issue_type VARCHAR(50) NOT NULL, -- late_delivery, wrong_item, damaged, quality, quantity_short
    description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High, Critical
    status VARCHAR(30) DEFAULT 'Open', -- Open, In Progress, Resolved, Closed
    resolution TEXT,
    resolved_at TIMESTAMP,
    resolved_by INT REFERENCES users(id),
    reported_by INT REFERENCES users(id),
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INSPECTION ====================

-- Inspection tasks
CREATE TABLE IF NOT EXISTS inspection_tasks (
    id SERIAL PRIMARY KEY,
    task_id INT REFERENCES tasks(id),
    work_order_id INT REFERENCES work_orders(id),
    part_number VARCHAR(100),
    
    -- Type
    inspection_type VARCHAR(50) NOT NULL, -- first_article, in_process, final, receiving
    
    -- Quantities
    quantity_to_inspect INT NOT NULL,
    quantity_inspected INT DEFAULT 0,
    quantity_passed INT DEFAULT 0,
    quantity_failed INT DEFAULT 0,
    
    -- Status
    status VARCHAR(30) DEFAULT 'Pending', -- Pending, In Progress, Pass, Fail, Hold
    
    -- Required documents
    drawing_number VARCHAR(100),
    revision VARCHAR(20),
    spec_numbers TEXT, -- comma-separated
    
    -- Critical dimensions (JSON array)
    critical_dimensions JSONB DEFAULT '[]',
    
    -- Results
    inspection_results JSONB DEFAULT '{}',
    measurement_data JSONB DEFAULT '[]',
    
    -- Inspector
    inspector_id INT REFERENCES users(id),
    inspector_name VARCHAR(100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Documentation
    report_number VARCHAR(100),
    coc_number VARCHAR(100), -- Certificate of Conformance
    ncr_number VARCHAR(100), -- Non-Conformance Report if failed
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== SHIPPING ====================

-- Shipping tasks
CREATE TABLE IF NOT EXISTS shipping_tasks (
    id SERIAL PRIMARY KEY,
    task_id INT REFERENCES tasks(id),
    work_order_id INT REFERENCES work_orders(id),
    customer_id INT REFERENCES customers(id),
    customer_name VARCHAR(200),
    
    -- Status
    status VARCHAR(30) DEFAULT 'Ready', -- Ready, Packing, Packed, Labeled, Shipped
    
    -- Items
    items JSONB DEFAULT '[]', -- Array of items to ship
    
    -- Packing
    packing_requirements TEXT,
    package_count INT,
    total_weight DECIMAL(10,2),
    dimensions VARCHAR(100),
    
    -- Shipping
    shipping_method VARCHAR(50),
    carrier VARCHAR(50),
    service_level VARCHAR(50),
    tracking_number VARCHAR(100),
    shipping_cost DECIMAL(10,2),
    
    -- Dates
    ship_date DATE,
    delivery_date DATE,
    
    -- Documentation
    packing_slip_number VARCHAR(100),
    bol_number VARCHAR(100), -- Bill of Lading
    
    packed_by INT REFERENCES users(id),
    packed_at TIMESTAMP,
    shipped_by INT REFERENCES users(id),
    shipped_at TIMESTAMP,
    
    notes TEXT,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== RECEIVING ====================

-- Receiving tasks
CREATE TABLE IF NOT EXISTS receiving_tasks (
    id SERIAL PRIMARY KEY,
    task_id INT REFERENCES tasks(id),
    po_id INT REFERENCES purchase_orders(id),
    
    -- Vendor info
    vendor_name VARCHAR(200),
    expected_date DATE,
    
    -- Status
    status VARCHAR(30) DEFAULT 'Expected', -- Expected, Received, Partial, Inspecting, Complete, Rejected
    
    -- Receipt details
    received_date DATE,
    received_by INT REFERENCES users(id),
    received_by_name VARCHAR(100),
    
    -- Items (JSON for flexibility)
    expected_items JSONB DEFAULT '[]',
    received_items JSONB DEFAULT '[]',
    
    -- Checklist
    count_verified BOOLEAN DEFAULT FALSE,
    condition_checked BOOLEAN DEFAULT FALSE,
    paperwork_received BOOLEAN DEFAULT FALSE,
    put_away_complete BOOLEAN DEFAULT FALSE,
    
    -- Issues
    has_discrepancy BOOLEAN DEFAULT FALSE,
    discrepancy_notes TEXT,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_work_order ON tasks(work_order_id);

-- Queue indexes
CREATE INDEX IF NOT EXISTS idx_queue_workcenter ON workcenter_queue(workcenter_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON workcenter_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_sequence ON workcenter_queue(workcenter_id, sequence);

-- Machine indexes
CREATE INDEX IF NOT EXISTS idx_machines_type ON machines(type);
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_workcenter ON machines(workcenter_id);

-- Maintenance indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_machine ON maintenance_tasks(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_due ON maintenance_tasks(due_date);

-- PO indexes
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_name);

-- ==================== TRIGGERS ====================

-- Update timestamps
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workcenters_updated_at ON workcenters;
CREATE TRIGGER update_workcenters_updated_at
    BEFORE UPDATE ON workcenters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_machines_updated_at ON machines;
CREATE TRIGGER update_machines_updated_at
    BEFORE UPDATE ON machines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_maintenance_tasks_updated_at ON maintenance_tasks;
CREATE TRIGGER update_maintenance_tasks_updated_at
    BEFORE UPDATE ON maintenance_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== SAMPLE DATA ====================

-- Sample workcenters
INSERT INTO workcenters (name, type, description, display_order)
SELECT * FROM (VALUES
    ('Saw Station', 'saw', 'Horizontal bandsaw for cutting stock', 1),
    ('Waterjet', 'waterjet', 'Flow waterjet cutting system', 2),
    ('CNC Mill 1', 'cnc_mill', 'Haas VF-2 Vertical Mill', 3),
    ('CNC Mill 2', 'cnc_mill', 'Haas VF-3 Vertical Mill', 4),
    ('CNC Lathe', 'cnc_lathe', 'Haas ST-10 CNC Lathe', 5),
    ('Manual Mill', 'manual', 'Bridgeport manual milling machine', 6),
    ('Grinding', 'grinder', 'Surface and cylindrical grinding', 7),
    ('Inspection', 'inspection', 'Quality control inspection station', 8),
    ('Shipping', 'shipping', 'Shipping and receiving dock', 9)
) AS v(name, type, description, display_order)
WHERE NOT EXISTS (SELECT 1 FROM workcenters LIMIT 1);

-- Sample machines
INSERT INTO machines (name, machine_id, type, manufacturer, model, workcenter_id, maintenance_interval_hours, maintenance_interval_days)
SELECT v.name, v.machine_id, v.type, v.manufacturer, v.model, w.id, v.maint_hours, v.maint_days
FROM (VALUES
    ('CNC Mill 1', 'CNC-M1', 'cnc_mill', 'Haas', 'VF-2', 'CNC Mill 1', 500, 30),
    ('CNC Mill 2', 'CNC-M2', 'cnc_mill', 'Haas', 'VF-3', 'CNC Mill 2', 500, 30),
    ('CNC Lathe', 'CNC-L1', 'cnc_lathe', 'Haas', 'ST-10', 'CNC Lathe', 400, 30),
    ('Bandsaw', 'SAW-01', 'saw', 'DoAll', 'C-916M', 'Saw Station', 200, 14),
    ('Waterjet', 'WJ-01', 'waterjet', 'Flow', 'Mach 500', 'Waterjet', 300, 30),
    ('Manual Mill', 'MM-01', 'manual', 'Bridgeport', 'Series I', 'Manual Mill', 100, 7),
    ('Surface Grinder', 'GRD-01', 'grinder', 'Chevalier', 'FSG-618M', 'Grinding', 200, 14)
) AS v(name, machine_id, type, manufacturer, model, workcenter_name, maint_hours, maint_days)
JOIN workcenters w ON w.name = v.workcenter_name
WHERE NOT EXISTS (SELECT 1 FROM machines LIMIT 1);

-- Sample maintenance task definitions
INSERT INTO maintenance_task_definitions (machine_type, task_name, description, category, frequency_type, frequency_value, estimated_duration, requires_shutdown, instructions)
SELECT * FROM (VALUES
    ('cnc_mill', 'Daily Coolant Check', 'Check coolant level and concentration', 'daily', 'days', 1, 10, FALSE, 'Check coolant reservoir level. Test concentration with refractometer. Top off as needed.'),
    ('cnc_mill', 'Weekly Lubrication', 'Lubricate way covers and check auto-lube system', 'weekly', 'days', 7, 30, FALSE, 'Apply way lube to exposed ways. Check auto-lube reservoir level. Verify lube is reaching all points.'),
    ('cnc_mill', 'Monthly Full Service', 'Complete machine inspection and service', 'monthly', 'days', 30, 120, TRUE, 'Check spindle runout. Verify axis backlash. Clean chip conveyor. Replace filters.'),
    ('cnc_lathe', 'Daily Chip Removal', 'Clean chips from work area', 'daily', 'days', 1, 15, FALSE, 'Remove chips from chuck, turret, and chip conveyor. Check chip conveyor operation.'),
    ('cnc_lathe', 'Weekly Turret Check', 'Verify turret indexing and clamping', 'weekly', 'days', 7, 20, FALSE, 'Run turret through all positions. Check for proper clamping. Verify repeatability.'),
    ('saw', 'Blade Tension Check', 'Verify blade tension and tracking', 'weekly', 'days', 7, 15, FALSE, 'Check blade tension gauge. Verify blade tracking. Inspect blade for wear/damage.'),
    ('waterjet', 'Abrasive System Check', 'Verify abrasive feed system', 'daily', 'days', 1, 20, FALSE, 'Check abrasive hopper level. Verify feed rate. Inspect mixing tube.')
) AS v(machine_type, task_name, description, category, frequency_type, frequency_value, estimated_duration, requires_shutdown, instructions)
WHERE NOT EXISTS (SELECT 1 FROM maintenance_task_definitions LIMIT 1);

-- Sample maintenance materials
INSERT INTO maintenance_materials (task_definition_id, material_name, part_number, quantity, unit, is_critical)
SELECT td.id, v.material_name, v.part_number, v.quantity, v.unit, v.is_critical
FROM (VALUES
    ('Daily Coolant Check', 'Coolant Concentrate', 'COOL-001', 1, 'GAL', TRUE),
    ('Weekly Lubrication', 'Way Lube Oil', 'OIL-WAY-01', 0.5, 'QT', TRUE),
    ('Monthly Full Service', 'Spindle Oil', 'OIL-SPIN-01', 1, 'QT', TRUE),
    ('Monthly Full Service', 'Air Filter', 'FILT-AIR-01', 1, 'EA', FALSE),
    ('Monthly Full Service', 'Coolant Filter', 'FILT-COOL-01', 1, 'EA', FALSE)
) AS v(task_name, material_name, part_number, quantity, unit, is_critical)
JOIN maintenance_task_definitions td ON td.task_name = v.task_name
WHERE NOT EXISTS (SELECT 1 FROM maintenance_materials LIMIT 1);

-- Sample tasks
INSERT INTO tasks (type, title, description, status, priority, due_date, assigned_to_name)
SELECT * FROM (VALUES
    ('ordering', 'Order Material for WO-2025-001', 'Order 6061 aluminum bar stock', 'Not Started', 'High', CURRENT_DATE + INTERVAL '1 day', 'Leland Bray'),
    ('processing', 'Cut stock for WO-2025-002', 'Cut 12" lengths from aluminum bar', 'In Progress', 'Medium', CURRENT_DATE + INTERVAL '2 days', 'Tom Wilson'),
    ('machining', 'Machine PLT-4001 Parts', 'Run OP10 - Face and drill', 'Not Started', 'High', CURRENT_DATE + INTERVAL '3 days', 'Mike Johnson'),
    ('inspection', 'First Article - BRKT-1001', 'Complete FAI for bracket assembly', 'Not Started', 'High', CURRENT_DATE + INTERVAL '2 days', 'Sarah Chen'),
    ('shipping', 'Ship WO-2025-004 to Precision Parts', 'Pack and ship completed order', 'Not Started', 'Medium', CURRENT_DATE + INTERVAL '1 day', 'Bob Smith'),
    ('maintenance', 'CNC Mill 1 - Weekly Lubrication', 'Perform weekly lube service', 'Not Started', 'Medium', CURRENT_DATE, 'Leland Bray'),
    ('misc', 'Organize tooling cabinet', 'Sort and label tooling in cabinet #3', 'Not Started', 'Low', CURRENT_DATE + INTERVAL '5 days', 'Tom Wilson')
) AS v(type, title, description, status, priority, due_date, assigned_to_name)
WHERE NOT EXISTS (SELECT 1 FROM tasks LIMIT 1);
