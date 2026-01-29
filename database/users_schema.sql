-- BPERP Users & Permissions Schema
-- Run this script to set up the users, roles, and permissions tables

-- ==================== USER ROLES ====================
-- Available roles:
--   - Administrator: Full access to all tabs and can manage users/permissions
--   - Machinist: Access to workcenter, inventory, and tasks (configurable)
--   - Operator: Limited access (configurable by admin)

-- ==================== USERS TABLE ====================
-- Drop and recreate users table with enhanced fields
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Operator',  -- 'Administrator', 'Machinist', 'Operator'
    
    -- Appearance settings stored as JSON
    -- Includes: theme, showGrid, showGlow, animations, transparency
    appearance_settings JSONB DEFAULT '{
        "theme": "automation",
        "showGrid": true,
        "showGlow": true,
        "animations": true,
        "transparency": 50
    }'::jsonb,
    
    -- Tab permissions stored as JSON
    -- Each tab can be true (allowed) or false (denied)
    -- Administrators always have full access regardless of this field
    tab_permissions JSONB DEFAULT '{
        "dashboard": true,
        "workcenter": true,
        "inventory": true,
        "sales": true,
        "tasks": true,
        "settings": false
    }'::jsonb,
    
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== SESSION TOKENS TABLE ====================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

-- ==================== TRIGGER FOR UPDATED_AT ====================
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== DEFAULT USERS ====================
-- Insert default administrator (password: 'admin123' - should be changed!)
-- Password hash is bcrypt hash of 'admin123'
INSERT INTO users (username, name, email, password_hash, role, tab_permissions)
VALUES (
    'admin',
    'Administrator',
    'admin@bperp.local',
    '$2b$10$rOzJqQZQZQZQZQZQZQZQZ.placeholder_hash_change_me',
    'Administrator',
    '{
        "dashboard": true,
        "workcenter": true,
        "inventory": true,
        "sales": true,
        "tasks": true,
        "settings": true
    }'::jsonb
) ON CONFLICT (username) DO NOTHING;

-- Insert sample machinist user
INSERT INTO users (username, name, email, password_hash, role, tab_permissions)
VALUES (
    'machinist1',
    'John Smith',
    'john.smith@bperp.local',
    '$2b$10$rOzJqQZQZQZQZQZQZQZQZ.placeholder_hash_change_me',
    'Machinist',
    '{
        "dashboard": true,
        "workcenter": true,
        "inventory": true,
        "sales": false,
        "tasks": true,
        "settings": false
    }'::jsonb
) ON CONFLICT (username) DO NOTHING;

-- Insert sample operator user
INSERT INTO users (username, name, email, password_hash, role, tab_permissions)
VALUES (
    'operator1',
    'Jane Doe',
    'jane.doe@bperp.local',
    '$2b$10$rOzJqQZQZQZQZQZQZQZQZ.placeholder_hash_change_me',
    'Operator',
    '{
        "dashboard": true,
        "workcenter": true,
        "inventory": false,
        "sales": false,
        "tasks": true,
        "settings": false
    }'::jsonb
) ON CONFLICT (username) DO NOTHING;

-- ==================== ROLE PERMISSION DEFAULTS ====================
-- This table stores default permissions for each role
-- When a new user is created, their permissions are copied from here
CREATE TABLE IF NOT EXISTS role_defaults (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) UNIQUE NOT NULL,
    tab_permissions JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO role_defaults (role, tab_permissions, description)
VALUES 
    ('Administrator', '{
        "dashboard": true,
        "workcenter": true,
        "inventory": true,
        "sales": true,
        "tasks": true,
        "settings": true
    }'::jsonb, 'Full access to all system features including user management'),
    
    ('Machinist', '{
        "dashboard": true,
        "workcenter": true,
        "inventory": true,
        "sales": false,
        "tasks": true,
        "settings": false
    }'::jsonb, 'Access to workcenter, inventory, and tasks. No access to sales or settings.'),
    
    ('Operator', '{
        "dashboard": true,
        "workcenter": true,
        "inventory": false,
        "sales": false,
        "tasks": true,
        "settings": false
    }'::jsonb, 'Basic access to dashboard, workcenter views, and tasks only.')
ON CONFLICT (role) DO NOTHING;

-- ==================== ACTIVITY LOG FOR USERS ====================
CREATE TABLE IF NOT EXISTS user_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,  -- 'login', 'logout', 'permission_change', 'profile_update', etc.
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity_log(created_at);
