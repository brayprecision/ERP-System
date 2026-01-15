-- BPERP Database Schema
-- Run this script to set up the database tables

-- 1. Users (for Login and Assignments)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    role VARCHAR(50) -- e.g., 'Admin', 'Sales'
);

-- 2. Products (Legacy Inventory - kept for compatibility)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200),
    sku VARCHAR(50),
    stock_level INT,
    price DECIMAL(10, 2),
    category VARCHAR(100)
);

-- 3. Quotes (The "Quotes in March" and "Win Rate" cards)
CREATE TABLE IF NOT EXISTS quotes (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100),
    total_amount DECIMAL(10, 2),
    status VARCHAR(20), -- 'Won', 'Lost', 'Sent', 'Draft'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tasks (The "Tasks Due" card)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200),
    due_date DATE,
    priority VARCHAR(20), -- 'High', 'Medium', 'Low'
    assigned_to INT REFERENCES users(id),
    is_completed BOOLEAN DEFAULT FALSE
);

-- 5. Activity Log (The "Recent Activity" card)
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    description TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    icon_type VARCHAR(50) -- To determine which icon to show (user, box, alert)
);

-- ==================== INVENTORY TABLES ====================

-- 6. Materials Inventory
CREATE TABLE IF NOT EXISTS materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    material_type VARCHAR(100) NOT NULL,
    material_shape VARCHAR(100) NOT NULL,
    qty_on_hand INT NOT NULL DEFAULT 0,
    length_unit VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    supplier VARCHAR(100) NOT NULL,
    minimum_qty INT NOT NULL DEFAULT 0,
    reorder_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Tooling Inventory
CREATE TABLE IF NOT EXISTS tooling (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    tool_type VARCHAR(100) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    qty_on_hand INT NOT NULL DEFAULT 0,
    minimum_qty INT NOT NULL DEFAULT 0,
    supplier VARCHAR(100) NOT NULL,
    tool_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    reorder_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Miscellaneous Inventory
CREATE TABLE IF NOT EXISTS misc_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    workcenter VARCHAR(100) NOT NULL,
    qty_on_hand INT NOT NULL DEFAULT 0,
    minimum_qty INT NOT NULL DEFAULT 0,
    reorder_link TEXT,
    item_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================

-- Materials indexes
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
CREATE INDEX IF NOT EXISTS idx_materials_supplier ON materials(supplier);
CREATE INDEX IF NOT EXISTS idx_materials_qty ON materials(qty_on_hand);

-- Tooling indexes
CREATE INDEX IF NOT EXISTS idx_tooling_name ON tooling(name);
CREATE INDEX IF NOT EXISTS idx_tooling_supplier ON tooling(supplier);
CREATE INDEX IF NOT EXISTS idx_tooling_operation ON tooling(operation);

-- Misc items indexes
CREATE INDEX IF NOT EXISTS idx_misc_name ON misc_items(name);
CREATE INDEX IF NOT EXISTS idx_misc_workcenter ON misc_items(workcenter);

-- ==================== SAMPLE DATA ====================

-- Insert sample materials (only if table is empty)
INSERT INTO materials (name, material_type, material_shape, qty_on_hand, length_unit, unit_price, supplier, minimum_qty, reorder_link)
SELECT * FROM (VALUES
    ('Aluminum 6061', 'Aluminum Alloy', 'Round Bar', 145, '12 in', 12.50, 'McMaster-Carr', 25, 'https://www.mcmaster.com/aluminum-6061'),
    ('Stainless Steel 304', 'Stainless Steel', 'Flat Stock', 35, '6 in', 18.75, 'Online Metals', 50, 'https://www.onlinemetals.com/ss304'),
    ('Brass Rod', 'Brass', 'Hexagonal Bar', 12, '8 in', 22.00, 'McMaster-Carr', 20, 'https://www.mcmaster.com/brass-rod'),
    ('Carbon Steel 1018', 'Carbon Steel', 'Square Bar', 78, '10 in', 8.25, 'Metal Supermarkets', 30, 'https://www.metalsupermarkets.com/1018'),
    ('Titanium Grade 5', 'Titanium', 'Round Bar', 8, '6 in', 145.00, 'Specialty Metals', 10, 'https://www.specialtymetals.com/ti-gr5')
) AS v(name, material_type, material_shape, qty_on_hand, length_unit, unit_price, supplier, minimum_qty, reorder_link)
WHERE NOT EXISTS (SELECT 1 FROM materials LIMIT 1);

-- Insert sample tooling (only if table is empty)
INSERT INTO tooling (name, tool_type, operation, qty_on_hand, minimum_qty, supplier, tool_price, reorder_link)
SELECT * FROM (VALUES
    ('1/4" End Mill', 'Carbide End Mill', 'Milling', 25, 10, 'MSC Industrial', 45.99, 'https://www.mscdirect.com/endmill-1-4'),
    ('3/8" Drill Bit', 'HSS Drill', 'Drilling', 8, 15, 'McMaster-Carr', 12.50, 'https://www.mcmaster.com/drill-3-8'),
    ('Boring Bar 1"', 'Carbide Insert', 'Boring', 3, 5, 'Kennametal', 125.00, 'https://www.kennametal.com/boring-bar'),
    ('Face Mill 3"', 'Indexable Face Mill', 'Milling', 2, 2, 'Sandvik', 450.00, 'https://www.sandvik.com/facemill'),
    ('Threading Tap M8', 'HSS Tap', 'Threading', 12, 8, 'OSG', 28.50, 'https://www.osgusa.com/m8-tap')
) AS v(name, tool_type, operation, qty_on_hand, minimum_qty, supplier, tool_price, reorder_link)
WHERE NOT EXISTS (SELECT 1 FROM tooling LIMIT 1);

-- Insert sample misc items (only if table is empty)
INSERT INTO misc_items (name, workcenter, qty_on_hand, minimum_qty, reorder_link, item_price)
SELECT * FROM (VALUES
    ('Safety Glasses', 'All Stations', 50, 20, 'https://www.safetyequipment.com/glasses', 12.99),
    ('Shop Rags', 'Maintenance', 15, 30, 'https://www.industrialsupply.com/rags', 8.50),
    ('Coolant Concentrate', 'CNC Area', 5, 10, 'https://www.coolants.com/concentrate', 45.00),
    ('Nitrile Gloves (Box)', 'All Stations', 8, 12, 'https://www.safetyequipment.com/gloves', 18.99),
    ('Cutting Oil', 'Manual Machines', 6, 8, 'https://www.industrialsupply.com/cutting-oil', 32.00)
) AS v(name, workcenter, qty_on_hand, minimum_qty, reorder_link, item_price)
WHERE NOT EXISTS (SELECT 1 FROM misc_items LIMIT 1);

-- ==================== TRIGGER FOR UPDATED_AT ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for each inventory table
DROP TRIGGER IF EXISTS update_materials_updated_at ON materials;
CREATE TRIGGER update_materials_updated_at
    BEFORE UPDATE ON materials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tooling_updated_at ON tooling;
CREATE TRIGGER update_tooling_updated_at
    BEFORE UPDATE ON tooling
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_misc_items_updated_at ON misc_items;
CREATE TRIGGER update_misc_items_updated_at
    BEFORE UPDATE ON misc_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
