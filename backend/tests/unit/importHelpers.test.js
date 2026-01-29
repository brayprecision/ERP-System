/**
 * Import Helper Functions - Unit Tests
 * Tests for CSV parsing and field mapping logic (no database required)
 */

// Mock the field mappings from the import route
const FIELD_MAPPINGS = {
    customers: {
        name: { required: true, aliases: ['customer', 'customer_name', 'customername', 'company', 'company_name', 'companyname', 'business', 'businessname'] },
        address: { required: false, aliases: ['street', 'street_address', 'streetaddress', 'addr', 'location', 'mailing_address', 'mailingaddress'] },
        phone: { required: false, aliases: ['telephone', 'tel', 'phone_number', 'phonenumber', 'contact_phone', 'contactphone', 'main_phone', 'mainphone'] },
        terms: { required: false, aliases: ['payment_terms', 'paymentterms', 'net_terms', 'netterms', 'credit_terms', 'creditterms'] },
        notes: { required: false, aliases: ['comments', 'remarks', 'description', 'memo', 'info'] }
    },
    materials: {
        name: { required: true, aliases: ['material', 'material_name', 'materialname', 'item', 'item_name', 'itemname', 'description'] },
        part_number: { required: false, aliases: ['partnumber', 'part_no', 'partno', 'pn', 'sku', 'item_number', 'itemnumber', 'item_no', 'itemno'] },
        category: { required: false, aliases: ['type', 'material_type', 'materialtype', 'class', 'group'] },
        qty_on_hand: { required: false, aliases: ['quantity', 'qty', 'qtyonhand', 'on_hand', 'onhand', 'stock', 'stock_qty', 'stockqty', 'inventory'] },
        minimum_qty: { required: false, aliases: ['min_qty', 'minqty', 'minimumqty', 'reorder_point', 'reorderpoint', 'min_stock', 'minstock'] },
        unit: { required: false, aliases: ['uom', 'unit_of_measure', 'unitofmeasure', 'measure'] },
        supplier: { required: false, aliases: ['vendor', 'vendor_name', 'vendorname', 'manufacturer', 'mfg', 'source'] },
        unit_price: { required: false, aliases: ['price', 'cost', 'unit_cost', 'unitcost', 'unitprice', 'each_price', 'eachprice'] },
        location: { required: false, aliases: ['bin', 'bin_location', 'binlocation', 'shelf', 'storage', 'warehouse', 'area'] }
    }
};

/**
 * Normalize header string for matching
 */
function normalizeHeader(header) {
    return header.toLowerCase().replace(/[\s_-]+/g, '').trim();
}

/**
 * Map source columns to entity fields
 */
function mapColumns(sourceColumns, entityType) {
    const mapping = {};
    const unmapped = [];
    const fieldDefs = FIELD_MAPPINGS[entityType];
    
    if (!fieldDefs) {
        return { mapping: {}, unmapped: sourceColumns };
    }
    
    for (const col of sourceColumns) {
        const normalizedCol = normalizeHeader(col);
        let matched = false;
        
        for (const [fieldName, fieldDef] of Object.entries(fieldDefs)) {
            const normalizedFieldName = normalizeHeader(fieldName);
            const normalizedAliases = fieldDef.aliases.map(a => normalizeHeader(a));
            
            if (normalizedCol === normalizedFieldName || normalizedAliases.includes(normalizedCol)) {
                mapping[col] = fieldName;
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            unmapped.push(col);
        }
    }
    
    return { mapping, unmapped };
}

/**
 * Validate a single row against field requirements
 */
function validateRow(row, entityType, columnMapping) {
    const errors = [];
    const fieldDefs = FIELD_MAPPINGS[entityType];
    
    if (!fieldDefs) {
        return errors;
    }
    
    // Check required fields
    for (const [fieldName, fieldDef] of Object.entries(fieldDefs)) {
        if (fieldDef.required) {
            // Find the source column that maps to this field
            const sourceCol = Object.entries(columnMapping).find(([_, target]) => target === fieldName)?.[0];
            const value = sourceCol ? row[sourceCol] : undefined;
            
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                errors.push(`Missing required field: ${fieldName}`);
            }
        }
    }
    
    return errors;
}

describe('Import Helper Functions', () => {
    describe('normalizeHeader', () => {
        it('should lowercase headers', () => {
            expect(normalizeHeader('Name')).toBe('name');
            expect(normalizeHeader('COMPANY')).toBe('company');
        });

        it('should remove spaces', () => {
            expect(normalizeHeader('Company Name')).toBe('companyname');
            expect(normalizeHeader('Part Number')).toBe('partnumber');
        });

        it('should remove underscores and dashes', () => {
            expect(normalizeHeader('company_name')).toBe('companyname');
            expect(normalizeHeader('part-number')).toBe('partnumber');
        });

        it('should handle mixed formatting', () => {
            expect(normalizeHeader('Company_Name Test')).toBe('companynametest');
            expect(normalizeHeader('  Part Number  ')).toBe('partnumber');
        });
    });

    describe('mapColumns', () => {
        it('should map exact field names', () => {
            const result = mapColumns(['name', 'address', 'phone'], 'customers');
            
            expect(result.mapping['name']).toBe('name');
            expect(result.mapping['address']).toBe('address');
            expect(result.mapping['phone']).toBe('phone');
            expect(result.unmapped.length).toBe(0);
        });

        it('should map known aliases', () => {
            const result = mapColumns(['Company Name', 'Telephone', 'Street Address'], 'customers');
            
            expect(result.mapping['Company Name']).toBe('name');
            expect(result.mapping['Telephone']).toBe('phone');
            expect(result.mapping['Street Address']).toBe('address');
        });

        it('should identify unmapped columns', () => {
            const result = mapColumns(['name', 'Custom Field', 'Unknown Column'], 'customers');
            
            expect(result.mapping['name']).toBe('name');
            expect(result.unmapped).toContain('Custom Field');
            expect(result.unmapped).toContain('Unknown Column');
        });

        it('should handle case insensitive matching', () => {
            const result = mapColumns(['NAME', 'ADDRESS', 'PHONE'], 'customers');
            
            expect(result.mapping['NAME']).toBe('name');
            expect(result.mapping['ADDRESS']).toBe('address');
            expect(result.mapping['PHONE']).toBe('phone');
        });

        it('should handle material field mappings', () => {
            const result = mapColumns(['Item Name', 'Part No', 'Quantity', 'Vendor'], 'materials');
            
            expect(result.mapping['Item Name']).toBe('name');
            expect(result.mapping['Part No']).toBe('part_number');
            expect(result.mapping['Quantity']).toBe('qty_on_hand');
            expect(result.mapping['Vendor']).toBe('supplier');
        });

        it('should handle unknown entity type', () => {
            const result = mapColumns(['name', 'address'], 'unknown');
            
            expect(Object.keys(result.mapping).length).toBe(0);
            expect(result.unmapped).toContain('name');
            expect(result.unmapped).toContain('address');
        });

        it('should handle empty columns', () => {
            const result = mapColumns([], 'customers');
            
            expect(Object.keys(result.mapping).length).toBe(0);
            expect(result.unmapped.length).toBe(0);
        });
    });

    describe('validateRow', () => {
        it('should pass valid customer row', () => {
            const row = { 'Name': 'Test Company', 'Address': '123 Main St' };
            const columnMapping = { 'Name': 'name', 'Address': 'address' };
            
            const errors = validateRow(row, 'customers', columnMapping);
            expect(errors.length).toBe(0);
        });

        it('should fail when required field is missing', () => {
            const row = { 'Address': '123 Main St' };
            const columnMapping = { 'Address': 'address' };
            
            const errors = validateRow(row, 'customers', columnMapping);
            expect(errors.length).toBe(1);
            expect(errors[0]).toContain('name');
        });

        it('should fail when required field is empty', () => {
            const row = { 'Name': '', 'Address': '123 Main St' };
            const columnMapping = { 'Name': 'name', 'Address': 'address' };
            
            const errors = validateRow(row, 'customers', columnMapping);
            expect(errors.length).toBe(1);
            expect(errors[0]).toContain('name');
        });

        it('should fail when required field is whitespace only', () => {
            const row = { 'Name': '   ', 'Address': '123 Main St' };
            const columnMapping = { 'Name': 'name', 'Address': 'address' };
            
            const errors = validateRow(row, 'customers', columnMapping);
            expect(errors.length).toBe(1);
        });

        it('should pass when only required fields are present', () => {
            const row = { 'Item': 'Steel Bar' };
            const columnMapping = { 'Item': 'name' };
            
            const errors = validateRow(row, 'materials', columnMapping);
            expect(errors.length).toBe(0);
        });

        it('should handle unknown entity type gracefully', () => {
            const row = { 'Name': 'Test' };
            const columnMapping = { 'Name': 'name' };
            
            const errors = validateRow(row, 'unknown_type', columnMapping);
            expect(errors.length).toBe(0); // No validation for unknown type
        });
    });

    describe('Field Mapping Coverage', () => {
        describe('customers aliases', () => {
            const customerAliases = [
                ['customer', 'name'],
                ['customer_name', 'name'],
                ['company', 'name'],
                ['company_name', 'name'],
                ['business', 'name'],
                ['telephone', 'phone'],
                ['tel', 'phone'],
                ['phone_number', 'phone'],
                ['street', 'address'],
                ['street_address', 'address'],
                ['location', 'address'],
                ['payment_terms', 'terms'],
                ['net_terms', 'terms'],
                ['comments', 'notes'],
                ['remarks', 'notes'],
                ['memo', 'notes']
            ];

            test.each(customerAliases)('"%s" should map to "%s"', (alias, expected) => {
                const result = mapColumns([alias], 'customers');
                expect(result.mapping[alias]).toBe(expected);
            });
        });

        describe('materials aliases', () => {
            const materialAliases = [
                ['material', 'name'],
                ['item', 'name'],
                ['description', 'name'],
                ['partnumber', 'part_number'],
                ['part_no', 'part_number'],
                ['sku', 'part_number'],
                ['quantity', 'qty_on_hand'],
                ['qty', 'qty_on_hand'],
                ['stock', 'qty_on_hand'],
                ['inventory', 'qty_on_hand'],
                ['min_qty', 'minimum_qty'],
                ['reorder_point', 'minimum_qty'],
                ['uom', 'unit'],
                ['vendor', 'supplier'],
                ['manufacturer', 'supplier'],
                ['price', 'unit_price'],
                ['cost', 'unit_price'],
                ['bin', 'location'],
                ['shelf', 'location'],
                ['warehouse', 'location']
            ];

            test.each(materialAliases)('"%s" should map to "%s"', (alias, expected) => {
                const result = mapColumns([alias], 'materials');
                expect(result.mapping[alias]).toBe(expected);
            });
        });
    });
});

describe('Edge Cases', () => {
    describe('Special Characters in Headers', () => {
        it('should handle headers with extra whitespace', () => {
            const result = mapColumns(['  name  ', '  address  '], 'customers');
            expect(result.mapping['  name  ']).toBe('name');
        });

        it('should handle mixed case headers', () => {
            const result = mapColumns(['NaMe', 'AdDrEsS', 'PhOnE'], 'customers');
            expect(result.mapping['NaMe']).toBe('name');
            expect(result.mapping['AdDrEsS']).toBe('address');
            expect(result.mapping['PhOnE']).toBe('phone');
        });
    });

    describe('Column Mapping Uniqueness', () => {
        it('should map first matching column when duplicates exist', () => {
            // If two columns could map to the same field, first one wins
            const result = mapColumns(['Company', 'Customer'], 'customers');
            // Both could map to 'name', but we get both mapped
            // The implementation maps each column independently
            expect(result.mapping['Company']).toBe('name');
            expect(result.mapping['Customer']).toBe('name');
        });
    });

    describe('Empty and Null Handling', () => {
        it('should handle null values in row', () => {
            const row = { 'Name': null, 'Address': '123 Main St' };
            const columnMapping = { 'Name': 'name', 'Address': 'address' };
            
            const errors = validateRow(row, 'customers', columnMapping);
            expect(errors.length).toBe(1);
            expect(errors[0]).toContain('name');
        });

        it('should handle undefined values in row', () => {
            const row = { 'Name': undefined, 'Address': '123 Main St' };
            const columnMapping = { 'Name': 'name', 'Address': 'address' };
            
            const errors = validateRow(row, 'customers', columnMapping);
            expect(errors.length).toBe(1);
        });
    });
});
