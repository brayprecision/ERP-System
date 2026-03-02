/**
 * Migration: Initial Schema (SQLite)
 * Created: 2026-01-28
 *
 * This consolidates all schema files into a single migration:
 * - Users, sessions, permissions
 * - Customers, contacts
 * - Inventory (materials, tooling, misc)
 * - Quotes, quote items, quote documents
 * - Work orders, checklists, archive
 * - Tasks, assignments, history
 * - Workcenters, queues
 * - Machines, status history
 * - Maintenance definitions, tasks, materials, history
 * - Purchase orders, PO items, order issues
 * - Inspection, shipping, receiving
 * - Activity log
 */

module.exports = {
    up(client) {
        // ==================== USERS & AUTHENTICATION ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'Operator',
                appearance_settings TEXT DEFAULT '{"theme": "automation", "showGrid": true, "showGlow": true, "animations": true, "transparency": 50}',
                tab_permissions TEXT DEFAULT '{"dashboard": true, "workcenter": true, "inventory": false, "sales": false, "tasks": true, "settings": false}',
                is_active INTEGER DEFAULT 1,
                last_login TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS role_defaults (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL UNIQUE,
                tab_permissions TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS user_activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== CUSTOMERS & CONTACTS ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                phone TEXT,
                terms TEXT,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                role TEXT,
                is_primary INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== INVENTORY ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                part_number TEXT,
                category TEXT,
                material_type TEXT,
                material_shape TEXT,
                description TEXT,
                qty_on_hand INTEGER DEFAULT 0,
                minimum_qty INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'EA',
                length_unit TEXT,
                supplier TEXT,
                unit_price REAL,
                location TEXT,
                reorder_link TEXT,
                last_ordered TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS tooling (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                part_number TEXT,
                category TEXT,
                tool_type TEXT,
                operation TEXT,
                description TEXT,
                qty_on_hand INTEGER DEFAULT 0,
                minimum_qty INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'EA',
                supplier TEXT,
                unit_price REAL,
                tool_price REAL,
                location TEXT,
                condition TEXT,
                reorder_link TEXT,
                last_ordered TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS misc_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                part_number TEXT,
                category TEXT,
                workcenter TEXT,
                description TEXT,
                qty_on_hand INTEGER DEFAULT 0,
                minimum_qty INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'EA',
                supplier TEXT,
                unit_price REAL,
                item_price REAL,
                location TEXT,
                reorder_link TEXT,
                last_ordered TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        // ==================== QUOTES ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS quotes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quote_number TEXT NOT NULL UNIQUE,
                customer_id INTEGER REFERENCES customers(id),
                customer_name TEXT,
                rfq_number TEXT,
                rfq_date TEXT,
                part_number TEXT,
                description TEXT,
                quantity INTEGER DEFAULT 1,
                status TEXT DEFAULT 'New',
                requested_date TEXT,
                due_date TEXT,
                total_amount REAL DEFAULT 0,
                notes TEXT,
                internal_notes TEXT,
                sent_at TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS quote_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
                line_number INTEGER DEFAULT 1,
                part_number TEXT,
                description TEXT,
                quantity INTEGER DEFAULT 1,
                unit TEXT DEFAULT 'EA',
                unit_price REAL DEFAULT 0,
                extended_price REAL DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS quote_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                original_name TEXT,
                file_type TEXT,
                file_size INTEGER,
                file_data TEXT,
                uploaded_by INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== WORK ORDERS ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS work_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wo_number TEXT NOT NULL UNIQUE,
                customer_id INTEGER REFERENCES customers(id),
                customer_name TEXT,
                quote_id INTEGER REFERENCES quotes(id),
                due_date TEXT,
                status TEXT DEFAULT 'Active',
                completion_percentage INTEGER DEFAULT 0,
                notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS wo_checklist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
                step_number INTEGER NOT NULL,
                step_name TEXT NOT NULL,
                is_completed INTEGER DEFAULT 0,
                completed_by INTEGER REFERENCES users(id),
                completed_by_name TEXT,
                completed_at TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(work_order_id, step_number)
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS wo_checklist_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
                step_number INTEGER NOT NULL,
                action TEXT NOT NULL,
                changed_by INTEGER REFERENCES users(id),
                changed_by_name TEXT,
                old_value TEXT,
                new_value TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS work_order_archive (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_id INTEGER,
                wo_number TEXT,
                customer_id INTEGER,
                customer_name TEXT,
                quote_id INTEGER,
                due_date TEXT,
                status TEXT,
                completion_percentage INTEGER,
                notes TEXT,
                archived_at TEXT DEFAULT CURRENT_TIMESTAMP,
                archived_by INTEGER REFERENCES users(id),
                checklist_data TEXT,
                original_created_at TEXT
            )
        `);

        // ==================== TASKS ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                work_order_id INTEGER REFERENCES work_orders(id),
                part_number TEXT,
                quantity INTEGER,
                assigned_to INTEGER REFERENCES users(id),
                assigned_to_name TEXT,
                assigned_at TEXT,
                status TEXT DEFAULT 'Not Started',
                priority TEXT DEFAULT 'Medium',
                due_date TEXT,
                started_at TEXT,
                completed_at TEXT,
                estimated_duration INTEGER,
                actual_duration INTEGER,
                task_data TEXT DEFAULT '{}',
                is_recurring INTEGER DEFAULT 0,
                recurrence_pattern TEXT,
                parent_task_id INTEGER REFERENCES tasks(id),
                created_by INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS task_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id),
                user_name TEXT,
                assigned_by INTEGER REFERENCES users(id),
                assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
                removed_at TEXT,
                notes TEXT
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS task_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                action TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                user_id INTEGER REFERENCES users(id),
                user_name TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                ip_address TEXT
            )
        `);

        // ==================== WORKCENTERS & QUEUES ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS workcenters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                location TEXT,
                capacity INTEGER DEFAULT 1,
                is_active INTEGER DEFAULT 1,
                display_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS workcenter_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workcenter_id INTEGER NOT NULL REFERENCES workcenters(id),
                work_order_id INTEGER REFERENCES work_orders(id),
                task_id INTEGER REFERENCES tasks(id),
                sequence INTEGER NOT NULL DEFAULT 0,
                status TEXT DEFAULT 'Waiting',
                priority INTEGER DEFAULT 5,
                part_number TEXT,
                quantity INTEGER,
                quantity_complete INTEGER,
                operation_number INTEGER,
                operation_description TEXT,
                estimated_time INTEGER,
                setup_notes TEXT,
                wo_number TEXT,
                material TEXT,
                queued_at TEXT DEFAULT CURRENT_TIMESTAMP,
                setup_started_at TEXT,
                processing_started_at TEXT,
                completed_at TEXT,
                actual_time INTEGER,
                operator_id INTEGER REFERENCES users(id),
                operator_name TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== MACHINES ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS machines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                machine_id TEXT UNIQUE,
                type TEXT NOT NULL,
                manufacturer TEXT,
                model TEXT,
                serial_number TEXT,
                year_installed INTEGER,
                workcenter_id INTEGER REFERENCES workcenters(id),
                location TEXT,
                status TEXT DEFAULT 'Idle',
                current_job_id INTEGER,
                current_operator_id INTEGER REFERENCES users(id),
                current_operator_name TEXT,
                maintenance_hours REAL DEFAULT 0,
                maintenance_cycles INTEGER DEFAULT 0,
                last_maintenance_date TEXT,
                next_maintenance_date TEXT,
                maintenance_interval_hours INTEGER,
                maintenance_interval_days INTEGER,
                total_run_hours REAL DEFAULT 0,
                total_cycles INTEGER DEFAULT 0,
                notes TEXT,
                specifications TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS machine_status_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                machine_id INTEGER NOT NULL REFERENCES machines(id),
                status TEXT NOT NULL,
                previous_status TEXT,
                work_order_id INTEGER,
                operator_id INTEGER REFERENCES users(id),
                operator_name TEXT,
                changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        `);

        // ==================== MAINTENANCE ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS maintenance_task_definitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                machine_id INTEGER REFERENCES machines(id),
                machine_type TEXT,
                task_name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                frequency_type TEXT NOT NULL,
                frequency_value INTEGER,
                estimated_duration INTEGER,
                requires_shutdown INTEGER DEFAULT 0,
                skill_level TEXT,
                instructions TEXT,
                safety_notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS maintenance_materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_definition_id INTEGER NOT NULL REFERENCES maintenance_task_definitions(id) ON DELETE CASCADE,
                material_name TEXT NOT NULL,
                part_number TEXT,
                quantity REAL NOT NULL DEFAULT 1,
                unit TEXT DEFAULT 'EA',
                notes TEXT,
                is_critical INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS maintenance_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                definition_id INTEGER REFERENCES maintenance_task_definitions(id),
                machine_id INTEGER NOT NULL REFERENCES machines(id),
                task_name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                scheduled_date TEXT,
                due_date TEXT NOT NULL,
                frequency_type TEXT,
                status TEXT DEFAULT 'Scheduled',
                started_at TEXT,
                completed_at TEXT,
                completed_by INTEGER REFERENCES users(id),
                completed_by_name TEXT,
                actual_duration INTEGER,
                deferred_to TEXT,
                deferred_reason TEXT,
                deferred_by INTEGER REFERENCES users(id),
                issues_found TEXT,
                parts_replaced TEXT,
                notes TEXT,
                readings TEXT DEFAULT '{}',
                labor_cost REAL,
                parts_cost REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS maintenance_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                machine_id INTEGER NOT NULL REFERENCES machines(id),
                maintenance_task_id INTEGER REFERENCES maintenance_tasks(id),
                action TEXT NOT NULL,
                description TEXT,
                performed_by INTEGER REFERENCES users(id),
                performed_by_name TEXT,
                performed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                hours_at_time REAL,
                cycles_at_time INTEGER,
                notes TEXT
            )
        `);

        // ==================== PURCHASE ORDERS ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_number TEXT NOT NULL,
                supplier_id INTEGER,
                supplier_name TEXT NOT NULL,
                status TEXT DEFAULT 'Pending',
                created_date TEXT DEFAULT CURRENT_DATE,
                order_date TEXT,
                expected_delivery TEXT,
                received_date TEXT,
                subtotal REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                shipping REAL DEFAULT 0,
                total REAL DEFAULT 0,
                work_order_id INTEGER REFERENCES work_orders(id),
                tracking_number TEXT,
                carrier TEXT,
                notes TEXT,
                internal_notes TEXT,
                created_by INTEGER REFERENCES users(id),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS po_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                line_number INTEGER DEFAULT 1,
                item_type TEXT,
                item_name TEXT NOT NULL,
                part_number TEXT,
                description TEXT,
                quantity_ordered INTEGER NOT NULL,
                quantity_received INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'EA',
                unit_price REAL DEFAULT 0,
                extended_price REAL DEFAULT 0,
                received_date TEXT,
                lot_number TEXT,
                location TEXT,
                inspection_required INTEGER DEFAULT 0,
                inspection_status TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS order_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
                po_item_id INTEGER REFERENCES po_items(id),
                issue_type TEXT NOT NULL,
                description TEXT NOT NULL,
                severity TEXT DEFAULT 'Medium',
                status TEXT DEFAULT 'Open',
                resolution TEXT,
                resolved_at TEXT,
                resolved_by INTEGER REFERENCES users(id),
                reported_by INTEGER REFERENCES users(id),
                reported_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== INSPECTION ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS inspection_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER REFERENCES tasks(id),
                work_order_id INTEGER REFERENCES work_orders(id),
                part_number TEXT,
                inspection_type TEXT NOT NULL,
                quantity_to_inspect INTEGER NOT NULL,
                quantity_inspected INTEGER DEFAULT 0,
                quantity_passed INTEGER DEFAULT 0,
                quantity_failed INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Pending',
                drawing_number TEXT,
                revision TEXT,
                spec_numbers TEXT,
                critical_dimensions TEXT DEFAULT '[]',
                inspection_results TEXT DEFAULT '{}',
                measurement_data TEXT DEFAULT '[]',
                inspector_id INTEGER REFERENCES users(id),
                inspector_name TEXT,
                started_at TEXT,
                completed_at TEXT,
                report_number TEXT,
                coc_number TEXT,
                ncr_number TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== SHIPPING & RECEIVING ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS shipping_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER REFERENCES tasks(id),
                work_order_id INTEGER REFERENCES work_orders(id),
                customer_id INTEGER REFERENCES customers(id),
                customer_name TEXT,
                status TEXT DEFAULT 'Ready',
                items TEXT DEFAULT '[]',
                packing_requirements TEXT,
                package_count INTEGER,
                total_weight REAL,
                dimensions TEXT,
                shipping_method TEXT,
                carrier TEXT,
                service_level TEXT,
                tracking_number TEXT,
                shipping_cost REAL,
                ship_date TEXT,
                delivery_date TEXT,
                packing_slip_number TEXT,
                bol_number TEXT,
                packed_by INTEGER REFERENCES users(id),
                packed_at TEXT,
                shipped_by INTEGER REFERENCES users(id),
                shipped_at TEXT,
                notes TEXT,
                special_instructions TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        client.query(`
            CREATE TABLE IF NOT EXISTS receiving_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER REFERENCES tasks(id),
                po_id INTEGER REFERENCES purchase_orders(id),
                vendor_name TEXT,
                expected_date TEXT,
                status TEXT DEFAULT 'Expected',
                received_date TEXT,
                received_by INTEGER REFERENCES users(id),
                received_by_name TEXT,
                expected_items TEXT DEFAULT '[]',
                received_items TEXT DEFAULT '[]',
                count_verified INTEGER DEFAULT 0,
                condition_checked INTEGER DEFAULT 0,
                paperwork_received INTEGER DEFAULT 0,
                put_away_complete INTEGER DEFAULT 0,
                has_discrepancy INTEGER DEFAULT 0,
                discrepancy_notes TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== ACTIVITY LOG ====================
        client.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT,
                entity_id INTEGER,
                action TEXT NOT NULL,
                description TEXT,
                user_id INTEGER REFERENCES users(id),
                user_name TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== INDEXES ====================
        client.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_quotes_customer ON quotes(customer_id)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_queue_workcenter ON workcenter_queue(workcenter_id)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_queue_status ON workcenter_queue(status)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_machines_type ON machines(type)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_machine ON maintenance_tasks(machine_id)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tasks(status)`);
        client.query(`CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status)`);

        // ==================== DEFAULT DATA ====================
        client.query(`INSERT OR IGNORE INTO role_defaults (role, tab_permissions) VALUES ('Administrator', '{"dashboard": true, "workcenter": true, "inventory": true, "sales": true, "tasks": true, "settings": true}')`);
        client.query(`INSERT OR IGNORE INTO role_defaults (role, tab_permissions) VALUES ('Machinist', '{"dashboard": true, "workcenter": true, "inventory": true, "sales": false, "tasks": true, "settings": false}')`);
        client.query(`INSERT OR IGNORE INTO role_defaults (role, tab_permissions) VALUES ('Operator', '{"dashboard": true, "workcenter": true, "inventory": false, "sales": false, "tasks": true, "settings": false}')`);

        console.log('Initial schema created successfully.');
    },

    down(client) {
        // Disable FK checks during drop
        client.query('PRAGMA foreign_keys = OFF');

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
            client.query(`DROP TABLE IF EXISTS ${table}`);
        }

        client.query('PRAGMA foreign_keys = ON');

        console.log('Initial schema dropped.');
    }
};
