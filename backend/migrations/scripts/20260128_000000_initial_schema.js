/**
 * Migration: Initial Schema
 * Created: 2026-01-28
 * 
 * This consolidates all schema files into a single migration:
 * - schema.sql (core tables)
 * - sales_schema.sql (customers, quotes, work orders)
 * - tasks_schema.sql (tasks, workcenters, machines, maintenance, orders)
 * - users_schema.sql (users, sessions, permissions)
 */

module.exports = {
    async up(client) {
        // ==================== UTILITY FUNCTIONS ====================
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // ==================== USERS & AUTHENTICATION ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(30) DEFAULT 'Operator',
                appearance_settings JSONB DEFAULT '{"theme": "automation", "showGrid": true, "showGlow": true, "animations": true, "transparency": 50}',
                tab_permissions JSONB DEFAULT '{"dashboard": true, "workcenter": true, "inventory": false, "sales": false, "tasks": true, "settings": false}',
                is_active BOOLEAN DEFAULT TRUE,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS role_defaults (
                id SERIAL PRIMARY KEY,
                role VARCHAR(30) NOT NULL UNIQUE,
                tab_permissions JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_activity_log (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                details JSONB,
                ip_address VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== CUSTOMERS & CONTACTS ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                address TEXT,
                phone VARCHAR(50),
                terms VARCHAR(100),
                notes TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id SERIAL PRIMARY KEY,
                customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                role VARCHAR(100),
                is_primary BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== INVENTORY ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS materials (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                part_number VARCHAR(100),
                category VARCHAR(100),
                description TEXT,
                qty_on_hand INT DEFAULT 0,
                minimum_qty INT DEFAULT 0,
                unit VARCHAR(20) DEFAULT 'EA',
                supplier VARCHAR(200),
                unit_price DECIMAL(10,2),
                location VARCHAR(100),
                last_ordered DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tooling (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                part_number VARCHAR(100),
                category VARCHAR(100),
                description TEXT,
                qty_on_hand INT DEFAULT 0,
                minimum_qty INT DEFAULT 0,
                unit VARCHAR(20) DEFAULT 'EA',
                supplier VARCHAR(200),
                unit_price DECIMAL(10,2),
                location VARCHAR(100),
                condition VARCHAR(50),
                last_ordered DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS misc_items (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                part_number VARCHAR(100),
                category VARCHAR(100),
                description TEXT,
                qty_on_hand INT DEFAULT 0,
                minimum_qty INT DEFAULT 0,
                unit VARCHAR(20) DEFAULT 'EA',
                supplier VARCHAR(200),
                unit_price DECIMAL(10,2),
                location VARCHAR(100),
                last_ordered DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );
        `);

        // ==================== QUOTES ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS quotes (
                id SERIAL PRIMARY KEY,
                quote_number VARCHAR(50) NOT NULL UNIQUE,
                customer_id INT REFERENCES customers(id),
                customer_name VARCHAR(200),
                rfq_number VARCHAR(100),
                rfq_date DATE,
                part_number VARCHAR(100),
                description TEXT,
                quantity INT DEFAULT 1,
                status VARCHAR(30) DEFAULT 'New',
                requested_date DATE,
                due_date DATE,
                total_amount DECIMAL(12,2) DEFAULT 0,
                notes TEXT,
                internal_notes TEXT,
                sent_at TIMESTAMP,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quote_items (
                id SERIAL PRIMARY KEY,
                quote_id INT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
                line_number INT DEFAULT 1,
                part_number VARCHAR(100),
                description TEXT,
                quantity INT DEFAULT 1,
                unit VARCHAR(20) DEFAULT 'EA',
                unit_price DECIMAL(10,2) DEFAULT 0,
                extended_price DECIMAL(12,2) DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS quote_documents (
                id SERIAL PRIMARY KEY,
                quote_id INT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
                filename VARCHAR(255) NOT NULL,
                original_name VARCHAR(255),
                file_type VARCHAR(100),
                file_size INT,
                file_data TEXT,
                uploaded_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== WORK ORDERS ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS work_orders (
                id SERIAL PRIMARY KEY,
                wo_number VARCHAR(50) NOT NULL UNIQUE,
                customer_id INT REFERENCES customers(id),
                customer_name VARCHAR(200),
                quote_id INT REFERENCES quotes(id),
                due_date DATE,
                status VARCHAR(30) DEFAULT 'Active',
                completion_percentage INT DEFAULT 0,
                notes TEXT,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS wo_checklist (
                id SERIAL PRIMARY KEY,
                work_order_id INT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
                step_number INT NOT NULL,
                step_name VARCHAR(100) NOT NULL,
                is_completed BOOLEAN DEFAULT FALSE,
                completed_by INT REFERENCES users(id),
                completed_by_name VARCHAR(100),
                completed_at TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(work_order_id, step_number)
            );

            CREATE TABLE IF NOT EXISTS wo_checklist_audit (
                id SERIAL PRIMARY KEY,
                work_order_id INT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
                step_number INT NOT NULL,
                action VARCHAR(50) NOT NULL,
                changed_by INT REFERENCES users(id),
                changed_by_name VARCHAR(100),
                old_value JSONB,
                new_value JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS work_order_archive (
                id SERIAL PRIMARY KEY,
                original_id INT,
                wo_number VARCHAR(50),
                customer_id INT,
                customer_name VARCHAR(200),
                quote_id INT,
                due_date DATE,
                status VARCHAR(30),
                completion_percentage INT,
                notes TEXT,
                archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived_by INT REFERENCES users(id),
                checklist_data JSONB,
                original_created_at TIMESTAMP
            );
        `);

        // ==================== TASKS ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                work_order_id INT REFERENCES work_orders(id),
                part_number VARCHAR(100),
                quantity INT,
                assigned_to INT REFERENCES users(id),
                assigned_to_name VARCHAR(100),
                assigned_at TIMESTAMP,
                status VARCHAR(30) DEFAULT 'Not Started',
                priority VARCHAR(20) DEFAULT 'Medium',
                due_date TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                estimated_duration INT,
                actual_duration INT,
                task_data JSONB DEFAULT '{}',
                is_recurring BOOLEAN DEFAULT FALSE,
                recurrence_pattern VARCHAR(20),
                parent_task_id INT REFERENCES tasks(id),
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP
            );

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

            CREATE TABLE IF NOT EXISTS task_history (
                id SERIAL PRIMARY KEY,
                task_id INT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                action VARCHAR(50) NOT NULL,
                old_value JSONB,
                new_value JSONB,
                user_id INT REFERENCES users(id),
                user_name VARCHAR(100),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                ip_address VARCHAR(50)
            );
        `);

        // ==================== WORKCENTERS & QUEUES ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS workcenters (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                description TEXT,
                location VARCHAR(100),
                capacity INT DEFAULT 1,
                is_active BOOLEAN DEFAULT TRUE,
                display_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS workcenter_queue (
                id SERIAL PRIMARY KEY,
                workcenter_id INT NOT NULL REFERENCES workcenters(id),
                work_order_id INT REFERENCES work_orders(id),
                task_id INT REFERENCES tasks(id),
                sequence INT NOT NULL DEFAULT 0,
                status VARCHAR(30) DEFAULT 'Waiting',
                priority INT DEFAULT 5,
                part_number VARCHAR(100),
                quantity INT,
                quantity_complete INT,
                operation_number INT,
                operation_description TEXT,
                estimated_time INT,
                setup_notes TEXT,
                wo_number VARCHAR(50),
                material VARCHAR(100),
                queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                setup_started_at TIMESTAMP,
                processing_started_at TIMESTAMP,
                completed_at TIMESTAMP,
                actual_time INT,
                operator_id INT REFERENCES users(id),
                operator_name VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== MACHINES ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS machines (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                machine_id VARCHAR(50) UNIQUE,
                type VARCHAR(50) NOT NULL,
                manufacturer VARCHAR(100),
                model VARCHAR(100),
                serial_number VARCHAR(100),
                year_installed INT,
                workcenter_id INT REFERENCES workcenters(id),
                location VARCHAR(100),
                status VARCHAR(30) DEFAULT 'Idle',
                current_job_id INT,
                current_operator_id INT REFERENCES users(id),
                current_operator_name VARCHAR(100),
                maintenance_hours DECIMAL(10,2) DEFAULT 0,
                maintenance_cycles INT DEFAULT 0,
                last_maintenance_date DATE,
                next_maintenance_date DATE,
                maintenance_interval_hours INT,
                maintenance_interval_days INT,
                total_run_hours DECIMAL(10,2) DEFAULT 0,
                total_cycles INT DEFAULT 0,
                notes TEXT,
                specifications JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

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
        `);

        // ==================== MAINTENANCE ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS maintenance_task_definitions (
                id SERIAL PRIMARY KEY,
                machine_id INT REFERENCES machines(id),
                machine_type VARCHAR(50),
                task_name VARCHAR(200) NOT NULL,
                description TEXT,
                category VARCHAR(50),
                frequency_type VARCHAR(20) NOT NULL,
                frequency_value INT,
                estimated_duration INT,
                requires_shutdown BOOLEAN DEFAULT FALSE,
                skill_level VARCHAR(20),
                instructions TEXT,
                safety_notes TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS maintenance_materials (
                id SERIAL PRIMARY KEY,
                task_definition_id INT NOT NULL REFERENCES maintenance_task_definitions(id) ON DELETE CASCADE,
                material_name VARCHAR(200) NOT NULL,
                part_number VARCHAR(100),
                quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
                unit VARCHAR(20) DEFAULT 'EA',
                notes TEXT,
                is_critical BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS maintenance_tasks (
                id SERIAL PRIMARY KEY,
                definition_id INT REFERENCES maintenance_task_definitions(id),
                machine_id INT NOT NULL REFERENCES machines(id),
                task_name VARCHAR(200) NOT NULL,
                description TEXT,
                category VARCHAR(50),
                scheduled_date DATE,
                due_date DATE NOT NULL,
                frequency_type VARCHAR(20),
                status VARCHAR(30) DEFAULT 'Scheduled',
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                completed_by INT REFERENCES users(id),
                completed_by_name VARCHAR(100),
                actual_duration INT,
                deferred_to DATE,
                deferred_reason TEXT,
                deferred_by INT REFERENCES users(id),
                issues_found TEXT,
                parts_replaced TEXT,
                notes TEXT,
                readings JSONB DEFAULT '{}',
                labor_cost DECIMAL(10,2),
                parts_cost DECIMAL(10,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS maintenance_history (
                id SERIAL PRIMARY KEY,
                machine_id INT NOT NULL REFERENCES machines(id),
                maintenance_task_id INT REFERENCES maintenance_tasks(id),
                action VARCHAR(50) NOT NULL,
                description TEXT,
                performed_by INT REFERENCES users(id),
                performed_by_name VARCHAR(100),
                performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                hours_at_time DECIMAL(10,2),
                cycles_at_time INT,
                notes TEXT
            );
        `);

        // ==================== PURCHASE ORDERS ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id SERIAL PRIMARY KEY,
                po_number VARCHAR(50) NOT NULL,
                supplier_id INT,
                supplier_name VARCHAR(200) NOT NULL,
                status VARCHAR(30) DEFAULT 'Pending',
                created_date DATE DEFAULT CURRENT_DATE,
                order_date DATE,
                expected_delivery DATE,
                received_date DATE,
                subtotal DECIMAL(12,2) DEFAULT 0,
                tax DECIMAL(10,2) DEFAULT 0,
                shipping DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(12,2) DEFAULT 0,
                work_order_id INT REFERENCES work_orders(id),
                tracking_number VARCHAR(100),
                carrier VARCHAR(50),
                notes TEXT,
                internal_notes TEXT,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS po_items (
                id SERIAL PRIMARY KEY,
                po_id INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                line_number INT DEFAULT 1,
                item_type VARCHAR(30),
                item_name VARCHAR(200) NOT NULL,
                part_number VARCHAR(100),
                description TEXT,
                quantity_ordered INT NOT NULL,
                quantity_received INT DEFAULT 0,
                unit VARCHAR(20) DEFAULT 'EA',
                unit_price DECIMAL(10,2) DEFAULT 0,
                extended_price DECIMAL(12,2) DEFAULT 0,
                received_date DATE,
                lot_number VARCHAR(100),
                location VARCHAR(100),
                inspection_required BOOLEAN DEFAULT FALSE,
                inspection_status VARCHAR(30),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS order_issues (
                id SERIAL PRIMARY KEY,
                po_id INT NOT NULL REFERENCES purchase_orders(id),
                po_item_id INT REFERENCES po_items(id),
                issue_type VARCHAR(50) NOT NULL,
                description TEXT NOT NULL,
                severity VARCHAR(20) DEFAULT 'Medium',
                status VARCHAR(30) DEFAULT 'Open',
                resolution TEXT,
                resolved_at TIMESTAMP,
                resolved_by INT REFERENCES users(id),
                reported_by INT REFERENCES users(id),
                reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== INSPECTION ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS inspection_tasks (
                id SERIAL PRIMARY KEY,
                task_id INT REFERENCES tasks(id),
                work_order_id INT REFERENCES work_orders(id),
                part_number VARCHAR(100),
                inspection_type VARCHAR(50) NOT NULL,
                quantity_to_inspect INT NOT NULL,
                quantity_inspected INT DEFAULT 0,
                quantity_passed INT DEFAULT 0,
                quantity_failed INT DEFAULT 0,
                status VARCHAR(30) DEFAULT 'Pending',
                drawing_number VARCHAR(100),
                revision VARCHAR(20),
                spec_numbers TEXT,
                critical_dimensions JSONB DEFAULT '[]',
                inspection_results JSONB DEFAULT '{}',
                measurement_data JSONB DEFAULT '[]',
                inspector_id INT REFERENCES users(id),
                inspector_name VARCHAR(100),
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                report_number VARCHAR(100),
                coc_number VARCHAR(100),
                ncr_number VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== SHIPPING & RECEIVING ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS shipping_tasks (
                id SERIAL PRIMARY KEY,
                task_id INT REFERENCES tasks(id),
                work_order_id INT REFERENCES work_orders(id),
                customer_id INT REFERENCES customers(id),
                customer_name VARCHAR(200),
                status VARCHAR(30) DEFAULT 'Ready',
                items JSONB DEFAULT '[]',
                packing_requirements TEXT,
                package_count INT,
                total_weight DECIMAL(10,2),
                dimensions VARCHAR(100),
                shipping_method VARCHAR(50),
                carrier VARCHAR(50),
                service_level VARCHAR(50),
                tracking_number VARCHAR(100),
                shipping_cost DECIMAL(10,2),
                ship_date DATE,
                delivery_date DATE,
                packing_slip_number VARCHAR(100),
                bol_number VARCHAR(100),
                packed_by INT REFERENCES users(id),
                packed_at TIMESTAMP,
                shipped_by INT REFERENCES users(id),
                shipped_at TIMESTAMP,
                notes TEXT,
                special_instructions TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS receiving_tasks (
                id SERIAL PRIMARY KEY,
                task_id INT REFERENCES tasks(id),
                po_id INT REFERENCES purchase_orders(id),
                vendor_name VARCHAR(200),
                expected_date DATE,
                status VARCHAR(30) DEFAULT 'Expected',
                received_date DATE,
                received_by INT REFERENCES users(id),
                received_by_name VARCHAR(100),
                expected_items JSONB DEFAULT '[]',
                received_items JSONB DEFAULT '[]',
                count_verified BOOLEAN DEFAULT FALSE,
                condition_checked BOOLEAN DEFAULT FALSE,
                paperwork_received BOOLEAN DEFAULT FALSE,
                put_away_complete BOOLEAN DEFAULT FALSE,
                has_discrepancy BOOLEAN DEFAULT FALSE,
                discrepancy_notes TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== ACTIVITY LOG ====================
        await client.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                entity_type VARCHAR(50),
                entity_id INT,
                action VARCHAR(50) NOT NULL,
                description TEXT,
                user_id INT REFERENCES users(id),
                user_name VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // ==================== INDEXES ====================
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
            CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
            CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
            CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id);
            CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
            CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
            CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
            CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
            CREATE INDEX IF NOT EXISTS idx_queue_workcenter ON workcenter_queue(workcenter_id);
            CREATE INDEX IF NOT EXISTS idx_queue_status ON workcenter_queue(status);
            CREATE INDEX IF NOT EXISTS idx_machines_type ON machines(type);
            CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
            CREATE INDEX IF NOT EXISTS idx_maintenance_machine ON maintenance_tasks(machine_id);
            CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tasks(status);
            CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
        `);

        // ==================== DEFAULT DATA ====================
        await client.query(`
            INSERT INTO role_defaults (role, tab_permissions)
            SELECT * FROM (VALUES
                ('Administrator', '{"dashboard": true, "workcenter": true, "inventory": true, "sales": true, "tasks": true, "settings": true}'::jsonb),
                ('Machinist', '{"dashboard": true, "workcenter": true, "inventory": true, "sales": false, "tasks": true, "settings": false}'::jsonb),
                ('Operator', '{"dashboard": true, "workcenter": true, "inventory": false, "sales": false, "tasks": true, "settings": false}'::jsonb)
            ) AS v(role, tab_permissions)
            WHERE NOT EXISTS (SELECT 1 FROM role_defaults LIMIT 1);
        `);

        console.log('Initial schema created successfully.');
    },

    async down(client) {
        // Drop tables in reverse order of dependencies
        const tables = [
            'receiving_tasks', 'shipping_tasks', 'inspection_tasks',
            'order_issues', 'po_items', 'purchase_orders',
            'maintenance_history', 'maintenance_tasks', 'maintenance_materials', 'maintenance_task_definitions',
            'machine_status_history', 'machines',
            'workcenter_queue', 'workcenters',
            'task_history', 'task_assignments', 'tasks',
            'work_order_archive', 'wo_checklist_audit', 'wo_checklist', 'work_orders',
            'quote_documents', 'quote_items', 'quotes',
            'misc_items', 'tooling', 'materials',
            'contacts', 'customers',
            'activity_log', 'user_activity_log', 'role_defaults', 'user_sessions', 'users'
        ];

        for (const table of tables) {
            await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        }

        await client.query('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE');

        console.log('Initial schema dropped.');
    }
};
