-- BPERP Sales Module Database Schema
-- Run this script after schema.sql to add sales tables

-- ==================== CUSTOMERS ====================

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    phone VARCHAR(50),
    fax VARCHAR(50),
    website VARCHAR(200),
    default_terms VARCHAR(50) DEFAULT 'NET 30', -- NET 30, NET 15, COD, etc.
    tax_id VARCHAR(50),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP -- Soft delete
);

-- Contact persons table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100), -- Purchasing, Engineering, Quality, Owner, etc.
    email VARCHAR(200),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    is_primary BOOLEAN DEFAULT FALSE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== QUOTES ====================

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    quote_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT NOT NULL REFERENCES customers(id),
    contact_id INT REFERENCES contacts(id),
    status VARCHAR(30) DEFAULT 'New', -- New, In Progress, Sent, Won, Lost, Expired
    priority VARCHAR(20) DEFAULT 'Normal', -- Low, Normal, High, Urgent
    
    -- RFQ Details
    rfq_number VARCHAR(100), -- Customer's RFQ number
    rfq_received_date DATE,
    quote_due_date DATE,
    
    -- Sent Quote Details  
    sent_at TIMESTAMP,
    sent_to VARCHAR(200), -- Email addresses quote was sent to
    valid_until DATE,
    
    -- Win/Loss tracking
    won_at TIMESTAMP,
    lost_at TIMESTAMP,
    lost_reason VARCHAR(200),
    
    -- Totals
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) DEFAULT 0,
    
    notes TEXT,
    internal_notes TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Quote line items
CREATE TABLE IF NOT EXISTS quote_items (
    id SERIAL PRIMARY KEY,
    quote_id INT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    line_number INT NOT NULL DEFAULT 1,
    
    -- Part Details
    part_number VARCHAR(100) NOT NULL,
    revision VARCHAR(20),
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'EA', -- EA, LB, FT, etc.
    
    -- Material
    material VARCHAR(200),
    material_cost DECIMAL(10, 2) DEFAULT 0,
    
    -- Pricing
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    setup_cost DECIMAL(10, 2) DEFAULT 0,
    extended_price DECIMAL(12, 2) DEFAULT 0,
    
    -- Lead time
    lead_time_days INT,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Quote documents (drawings, specs, etc.)
CREATE TABLE IF NOT EXISTS quote_documents (
    id SERIAL PRIMARY KEY,
    quote_id INT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_type VARCHAR(50), -- PDF, DWG, STEP, etc.
    file_size INT,
    file_path TEXT,
    url TEXT,
    description VARCHAR(200),
    uploaded_by INT REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== WORK ORDERS ====================

-- Work orders table
CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    wo_number VARCHAR(50) NOT NULL UNIQUE,
    quote_id INT REFERENCES quotes(id),
    quote_item_id INT REFERENCES quote_items(id),
    customer_id INT NOT NULL REFERENCES customers(id),
    
    -- Part Details
    part_number VARCHAR(100) NOT NULL,
    revision VARCHAR(20),
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'EA',
    
    -- Material
    material VARCHAR(200),
    
    -- Dates
    order_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    ship_date DATE,
    completed_date DATE,
    
    -- Status
    status VARCHAR(30) DEFAULT 'Open', -- Open, In Progress, On Hold, Complete, Shipped, Cancelled
    priority VARCHAR(20) DEFAULT 'Normal',
    
    -- Progress tracking
    completion_percentage INT DEFAULT 0,
    current_step VARCHAR(50),
    
    -- Pricing
    quoted_price DECIMAL(12, 2),
    actual_cost DECIMAL(12, 2) DEFAULT 0,
    
    -- Customer PO
    customer_po VARCHAR(100),
    
    notes TEXT,
    internal_notes TEXT,
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Work order checklist items
CREATE TABLE IF NOT EXISTS wo_checklist (
    id SERIAL PRIMARY KEY,
    work_order_id INT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    step_order INT NOT NULL, -- Order of the step (1-10)
    step_name VARCHAR(100) NOT NULL,
    step_key VARCHAR(50) NOT NULL, -- material_ordered, tooling_ordered, etc.
    
    -- Completion status
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    completed_by INT REFERENCES users(id),
    completed_by_name VARCHAR(100),
    
    -- Step-specific data (JSON for flexibility)
    step_data JSONB DEFAULT '{}',
    
    -- Common fields that most steps have
    date_value DATE,
    reference_number VARCHAR(100), -- PO#, Program#, Lot#, etc.
    vendor_supplier VARCHAR(200),
    operator_name VARCHAR(100),
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Work order checklist audit log
CREATE TABLE IF NOT EXISTS wo_checklist_audit (
    id SERIAL PRIMARY KEY,
    checklist_id INT NOT NULL REFERENCES wo_checklist(id),
    work_order_id INT NOT NULL REFERENCES work_orders(id),
    action VARCHAR(50) NOT NULL, -- completed, unchecked, updated, note_added
    old_value JSONB,
    new_value JSONB,
    changed_by INT REFERENCES users(id),
    changed_by_name VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    notes TEXT
);

-- Archived work orders view (for customer archived work orders)
CREATE TABLE IF NOT EXISTS work_order_archive (
    id SERIAL PRIMARY KEY,
    work_order_id INT NOT NULL,
    customer_id INT NOT NULL,
    wo_number VARCHAR(50) NOT NULL,
    part_number VARCHAR(100),
    quantity INT,
    completed_date DATE,
    total_cost DECIMAL(12, 2),
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archive_data JSONB -- Full WO data snapshot
);

-- ==================== INDEXES ====================

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active) WHERE deleted_at IS NULL;

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Quote indexes
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_due_date ON quotes(quote_due_date);

-- Quote item indexes
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_part ON quote_items(part_number);

-- Work order indexes
CREATE INDEX IF NOT EXISTS idx_wo_customer ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_wo_number ON work_orders(wo_number);
CREATE INDEX IF NOT EXISTS idx_wo_due_date ON work_orders(due_date);
CREATE INDEX IF NOT EXISTS idx_wo_quote ON work_orders(quote_id);

-- Checklist indexes
CREATE INDEX IF NOT EXISTS idx_checklist_wo ON wo_checklist(work_order_id);
CREATE INDEX IF NOT EXISTS idx_checklist_completed ON wo_checklist(is_completed);

-- ==================== TRIGGERS ====================

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_items_updated_at ON quote_items;
CREATE TRIGGER update_quote_items_updated_at
    BEFORE UPDATE ON quote_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
CREATE TRIGGER update_work_orders_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wo_checklist_updated_at ON wo_checklist;
CREATE TRIGGER update_wo_checklist_updated_at
    BEFORE UPDATE ON wo_checklist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== FUNCTIONS ====================

-- Function to calculate work order completion percentage
CREATE OR REPLACE FUNCTION calculate_wo_completion(wo_id INT)
RETURNS INT AS $$
DECLARE
    total_steps INT;
    completed_steps INT;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = TRUE)
    INTO total_steps, completed_steps
    FROM wo_checklist
    WHERE work_order_id = wo_id;
    
    IF total_steps = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((completed_steps::DECIMAL / total_steps) * 100);
END;
$$ LANGUAGE plpgsql;

-- Function to initialize checklist for a new work order
CREATE OR REPLACE FUNCTION initialize_wo_checklist(wo_id INT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO wo_checklist (work_order_id, step_order, step_name, step_key) VALUES
        (wo_id, 1, 'Material Ordered', 'material_ordered'),
        (wo_id, 2, 'Tooling Ordered', 'tooling_ordered'),
        (wo_id, 3, 'Part Programmed', 'part_programmed'),
        (wo_id, 4, 'Material Received', 'material_received'),
        (wo_id, 5, 'Tooling Received', 'tooling_received'),
        (wo_id, 6, 'Material Sawn/Processed', 'material_processed'),
        (wo_id, 7, 'Machining Complete', 'machining_complete'),
        (wo_id, 8, 'Post Processing Complete', 'post_processing'),
        (wo_id, 9, 'Inspection Complete', 'inspection_complete'),
        (wo_id, 10, 'Ready For Shipment', 'ready_for_shipment');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-initialize checklist on new work order
CREATE OR REPLACE FUNCTION auto_init_checklist()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_wo_checklist(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS init_wo_checklist ON work_orders;
CREATE TRIGGER init_wo_checklist
    AFTER INSERT ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_init_checklist();

-- ==================== SAMPLE DATA ====================

-- Sample customers
INSERT INTO customers (name, address_line1, city, state, zip_code, phone, default_terms)
SELECT * FROM (VALUES
    ('Acme Manufacturing', '123 Industrial Blvd', 'Detroit', 'MI', '48201', '(313) 555-0100', 'NET 30'),
    ('Precision Parts Inc', '456 Tech Drive', 'Cleveland', 'OH', '44101', '(216) 555-0200', 'NET 15'),
    ('Global Aerospace Corp', '789 Aviation Way', 'Seattle', 'WA', '98101', '(206) 555-0300', 'NET 45'),
    ('Smith & Sons Machinery', '321 Main Street', 'Chicago', 'IL', '60601', '(312) 555-0400', 'NET 30'),
    ('Eastern Defense Systems', '555 Military Rd', 'Boston', 'MA', '02101', '(617) 555-0500', 'NET 60')
) AS v(name, address_line1, city, state, zip_code, phone, default_terms)
WHERE NOT EXISTS (SELECT 1 FROM customers LIMIT 1);

-- Sample contacts (linked to customers)
INSERT INTO contacts (customer_id, name, role, email, phone, is_primary)
SELECT c.id, v.name, v.role, v.email, v.phone, v.is_primary
FROM (VALUES
    ('Acme Manufacturing', 'John Smith', 'Purchasing Manager', 'jsmith@acme.com', '(313) 555-0101', TRUE),
    ('Acme Manufacturing', 'Jane Doe', 'Engineer', 'jdoe@acme.com', '(313) 555-0102', FALSE),
    ('Precision Parts Inc', 'Mike Johnson', 'Owner', 'mike@precisionparts.com', '(216) 555-0201', TRUE),
    ('Global Aerospace Corp', 'Sarah Williams', 'Supply Chain', 'swilliams@globalaero.com', '(206) 555-0301', TRUE),
    ('Global Aerospace Corp', 'Tom Brown', 'Quality Engineer', 'tbrown@globalaero.com', '(206) 555-0302', FALSE),
    ('Smith & Sons Machinery', 'Bob Smith', 'Owner', 'bob@smithsons.com', '(312) 555-0401', TRUE),
    ('Eastern Defense Systems', 'Carol White', 'Contracts', 'cwhite@eastdef.com', '(617) 555-0501', TRUE)
) AS v(customer_name, name, role, email, phone, is_primary)
JOIN customers c ON c.name = v.customer_name
WHERE NOT EXISTS (SELECT 1 FROM contacts LIMIT 1);

-- Sample quotes
INSERT INTO quotes (quote_number, customer_id, status, rfq_received_date, quote_due_date, subtotal, total_amount)
SELECT 
    v.quote_number,
    c.id,
    v.status,
    v.rfq_date::DATE,
    v.due_date::DATE,
    v.subtotal,
    v.total
FROM (VALUES
    ('Q-2025-001', 'Acme Manufacturing', 'New', '2025-01-10', '2025-01-17', 5500.00, 5500.00),
    ('Q-2025-002', 'Precision Parts Inc', 'In Progress', '2025-01-08', '2025-01-15', 12000.00, 12000.00),
    ('Q-2025-003', 'Global Aerospace Corp', 'Sent', '2025-01-05', '2025-01-12', 45000.00, 45000.00),
    ('Q-2025-004', 'Smith & Sons Machinery', 'Won', '2025-01-01', '2025-01-08', 8500.00, 8500.00),
    ('Q-2025-005', 'Acme Manufacturing', 'New', '2025-01-12', '2025-01-20', 3200.00, 3200.00)
) AS v(quote_number, customer_name, status, rfq_date, due_date, subtotal, total)
JOIN customers c ON c.name = v.customer_name
WHERE NOT EXISTS (SELECT 1 FROM quotes LIMIT 1);

-- Sample quote items
INSERT INTO quote_items (quote_id, line_number, part_number, description, quantity, material, unit_price, extended_price)
SELECT 
    q.id,
    v.line_num,
    v.part_number,
    v.description,
    v.quantity,
    v.material,
    v.unit_price,
    v.quantity * v.unit_price
FROM (VALUES
    ('Q-2025-001', 1, 'BRKT-1001', 'Mounting Bracket Assembly', 50, 'Aluminum 6061-T6', 110.00),
    ('Q-2025-002', 1, 'SHFT-2001', 'Drive Shaft', 25, 'Steel 4140', 480.00),
    ('Q-2025-003', 1, 'HSNG-3001', 'Hydraulic Housing', 10, 'Aluminum 7075-T6', 4500.00),
    ('Q-2025-004', 1, 'PLT-4001', 'Base Plate', 100, 'Steel 1018', 85.00),
    ('Q-2025-005', 1, 'PIN-5001', 'Locating Pin', 200, 'Steel 4340', 16.00)
) AS v(quote_number, line_num, part_number, description, quantity, material, unit_price)
JOIN quotes q ON q.quote_number = v.quote_number
WHERE NOT EXISTS (SELECT 1 FROM quote_items LIMIT 1);

-- Sample work orders
INSERT INTO work_orders (wo_number, customer_id, part_number, description, quantity, material, due_date, status, customer_po, quoted_price)
SELECT 
    v.wo_number,
    c.id,
    v.part_number,
    v.description,
    v.quantity,
    v.material,
    v.due_date::DATE,
    v.status,
    v.customer_po,
    v.price
FROM (VALUES
    ('WO-2025-001', 'Smith & Sons Machinery', 'PLT-4001', 'Base Plate', 100, 'Steel 1018', '2025-01-25', 'In Progress', 'PO-44521', 8500.00),
    ('WO-2025-002', 'Acme Manufacturing', 'BRKT-1001-A', 'Bracket Revision A', 75, 'Aluminum 6061-T6', '2025-01-20', 'In Progress', 'PO-AC-789', 8250.00),
    ('WO-2025-003', 'Global Aerospace Corp', 'HSNG-3001', 'Hydraulic Housing', 10, 'Aluminum 7075-T6', '2025-02-15', 'Open', 'PO-GA-2025-100', 45000.00),
    ('WO-2025-004', 'Precision Parts Inc', 'GER-001', 'Gear Blank', 50, 'Steel 4140', '2025-01-18', 'In Progress', 'PP-1234', 6500.00)
) AS v(wo_number, customer_name, part_number, description, quantity, material, due_date, status, customer_po, price)
JOIN customers c ON c.name = v.customer_name
WHERE NOT EXISTS (SELECT 1 FROM work_orders LIMIT 1);
