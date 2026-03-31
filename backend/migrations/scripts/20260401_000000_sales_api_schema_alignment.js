/**
 * Migration: Align SQLite schema with sales API routes (customers, quotes, work orders, checklist).
 * Safe to run on existing DBs: uses try/catch for duplicate columns.
 */

function safeAddColumn(client, sql) {
    try {
        client.query(sql);
    } catch (e) {
        if (!String(e.message).toLowerCase().includes('duplicate column')) {
            throw e;
        }
    }
}

module.exports = {
    up(client) {
        // ---------- customers ----------
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN address_line1 TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN address_line2 TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN city TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN state TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN zip_code TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN country TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN fax TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN website TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN default_terms TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN tax_id TEXT');
        safeAddColumn(client, 'ALTER TABLE customers ADD COLUMN email TEXT');

        client.query(`
            UPDATE customers SET address_line1 = address
            WHERE address IS NOT NULL AND TRIM(address) != '' AND address_line1 IS NULL
        `);
        client.query(`
            UPDATE customers SET default_terms = terms
            WHERE terms IS NOT NULL AND default_terms IS NULL
        `);

        // ---------- contacts ----------
        safeAddColumn(client, 'ALTER TABLE contacts ADD COLUMN mobile TEXT');
        safeAddColumn(client, 'ALTER TABLE contacts ADD COLUMN notes TEXT');
        safeAddColumn(client, 'ALTER TABLE contacts ADD COLUMN is_active INTEGER DEFAULT 1');

        // ---------- quotes ----------
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN contact_id INTEGER');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN priority TEXT');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN rfq_received_date TEXT');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN quote_due_date TEXT');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN valid_until TEXT');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN subtotal REAL DEFAULT 0');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN tax_rate REAL DEFAULT 0');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN tax_amount REAL DEFAULT 0');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN shipping_cost REAL DEFAULT 0');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN sent_to TEXT');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN won_at TEXT');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN lost_at TEXT');
        safeAddColumn(client, 'ALTER TABLE quotes ADD COLUMN lost_reason TEXT');

        client.query(`
            UPDATE quotes SET rfq_received_date = rfq_date
            WHERE rfq_date IS NOT NULL AND rfq_received_date IS NULL
        `);
        client.query(`
            UPDATE quotes SET quote_due_date = due_date
            WHERE due_date IS NOT NULL AND quote_due_date IS NULL
        `);

        // ---------- quote_items ----------
        safeAddColumn(client, 'ALTER TABLE quote_items ADD COLUMN revision TEXT');
        safeAddColumn(client, 'ALTER TABLE quote_items ADD COLUMN material TEXT');
        safeAddColumn(client, 'ALTER TABLE quote_items ADD COLUMN material_cost REAL DEFAULT 0');
        safeAddColumn(client, 'ALTER TABLE quote_items ADD COLUMN setup_cost REAL DEFAULT 0');
        safeAddColumn(client, 'ALTER TABLE quote_items ADD COLUMN lead_time_days INTEGER');

        // ---------- quote_documents ----------
        safeAddColumn(client, 'ALTER TABLE quote_documents ADD COLUMN original_filename TEXT');
        safeAddColumn(client, 'ALTER TABLE quote_documents ADD COLUMN uploaded_at TEXT');
        safeAddColumn(client, 'ALTER TABLE quote_documents ADD COLUMN url TEXT');
        safeAddColumn(client, 'ALTER TABLE quote_documents ADD COLUMN description TEXT');

        client.query(`
            UPDATE quote_documents SET original_filename = original_name
            WHERE original_filename IS NULL AND original_name IS NOT NULL
        `);
        client.query(`
            UPDATE quote_documents SET uploaded_at = created_at
            WHERE uploaded_at IS NULL AND created_at IS NOT NULL
        `);

        // ---------- work_orders ----------
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN quote_item_id INTEGER');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN part_number TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN revision TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN description TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN quantity REAL DEFAULT 1');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN unit TEXT DEFAULT \'EA\'');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN material TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN order_date TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN ship_date TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN completed_date TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN priority TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN customer_po TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN quoted_price REAL');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN actual_cost REAL');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN internal_notes TEXT');
        safeAddColumn(client, 'ALTER TABLE work_orders ADD COLUMN current_step TEXT');

        // ---------- wo_checklist ----------
        safeAddColumn(client, 'ALTER TABLE wo_checklist ADD COLUMN step_order INTEGER');
        safeAddColumn(client, 'ALTER TABLE wo_checklist ADD COLUMN step_key TEXT');
        safeAddColumn(client, 'ALTER TABLE wo_checklist ADD COLUMN step_data TEXT');
        safeAddColumn(client, 'ALTER TABLE wo_checklist ADD COLUMN date_value TEXT');
        safeAddColumn(client, 'ALTER TABLE wo_checklist ADD COLUMN reference_number TEXT');
        safeAddColumn(client, 'ALTER TABLE wo_checklist ADD COLUMN vendor_supplier TEXT');
        safeAddColumn(client, 'ALTER TABLE wo_checklist ADD COLUMN operator_name TEXT');

        client.query(`
            UPDATE wo_checklist SET step_order = step_number WHERE step_order IS NULL
        `);
        client.query(`
            UPDATE wo_checklist SET step_key = lower(replace(replace(step_name, ' ', '_'), '/', '_'))
            WHERE step_key IS NULL AND step_name IS NOT NULL
        `);

        // ---------- wo_checklist_audit ----------
        safeAddColumn(client, 'ALTER TABLE wo_checklist_audit ADD COLUMN checklist_id INTEGER');
        safeAddColumn(client, 'ALTER TABLE wo_checklist_audit ADD COLUMN changed_at TEXT');
        safeAddColumn(client, 'ALTER TABLE wo_checklist_audit ADD COLUMN notes TEXT');

        client.query(`
            UPDATE wo_checklist_audit SET changed_at = created_at WHERE changed_at IS NULL
        `);
    },

    down(client) {
        // Non-destructive rollback not implemented (SQLite cannot DROP COLUMN easily in older versions)
        console.warn('20260401_000000_sales_api_schema_alignment: down() is a no-op');
    }
};
