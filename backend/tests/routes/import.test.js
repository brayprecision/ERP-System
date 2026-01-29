/**
 * Import Routes Tests
 */

const request = require('supertest');
const express = require('express');
const { getPool, closePool, clearTables } = require('../helpers/testDb');

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    
    const pool = getPool();
    const importRoutes = require('../../routes/import')(pool);
    app.use('/api/import', importRoutes);
    
    return app;
}

describe('Import Routes', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    afterAll(async () => {
        await closePool();
    });

    describe('GET /api/import/supported-types', () => {
        it('should return list of supported import types', async () => {
            const res = await request(app)
                .get('/api/import/supported-types')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data.length).toBeGreaterThan(0);
            
            // Check that customers type exists
            const customersType = res.body.data.find(t => t.type === 'customers');
            expect(customersType).toBeDefined();
            expect(customersType.requiredFields).toContain('name');
        });
    });

    describe('GET /api/import/template/:entityType', () => {
        it('should return CSV template for customers', async () => {
            const res = await request(app)
                .get('/api/import/template/customers')
                .expect(200);

            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.headers['content-disposition']).toContain('customers_template.csv');
            expect(res.text).toContain('name');
        });

        it('should return CSV template for materials', async () => {
            const res = await request(app)
                .get('/api/import/template/materials')
                .expect(200);

            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.text).toContain('name');
            expect(res.text).toContain('part_number');
        });

        it('should return 400 for invalid entity type', async () => {
            const res = await request(app)
                .get('/api/import/template/invalid')
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid entity type');
        });
    });

    describe('POST /api/import/preview', () => {
        it('should return 400 when no file uploaded', async () => {
            const res = await request(app)
                .post('/api/import/preview')
                .field('entityType', 'customers')
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('No file');
        });

        it('should preview valid CSV data', async () => {
            const csvContent = 'Name,Address,Phone\nTest Company,123 Main St,555-1234\nAnother Co,456 Oak Ave,555-5678';
            
            const res = await request(app)
                .post('/api/import/preview')
                .field('entityType', 'customers')
                .attach('file', Buffer.from(csvContent), 'test.csv')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRows).toBe(2);
            expect(res.body.data.validRows).toBe(2);
            expect(res.body.data.columnMapping).toHaveProperty('Name');
        });

        it('should detect validation errors in CSV', async () => {
            const csvContent = 'Address,Phone\n123 Main St,555-1234\n456 Oak Ave,555-5678';
            
            const res = await request(app)
                .post('/api/import/preview')
                .field('entityType', 'customers')
                .attach('file', Buffer.from(csvContent), 'test.csv')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.errorRows).toBe(2); // Both missing required 'name'
        });
    });
});

describe('Import Field Mapping', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    afterAll(async () => {
        await closePool();
    });

    it('should map various column name formats', async () => {
        // Test that different header formats all map correctly
        const csvContent = 'Company Name,Street Address,Telephone\nTest Inc,123 Main,555-1234';
        
        const res = await request(app)
            .post('/api/import/preview')
            .field('entityType', 'customers')
            .attach('file', Buffer.from(csvContent), 'test.csv')
            .expect(200);

        // "Company Name" should map to "name" (companyname alias)
        expect(res.body.data.columnMapping['Company Name']).toBe('name');
    });

    it('should report unmapped columns', async () => {
        const csvContent = 'Name,Custom Field,Another Custom\nTest,value1,value2';
        
        const res = await request(app)
            .post('/api/import/preview')
            .field('entityType', 'customers')
            .attach('file', Buffer.from(csvContent), 'test.csv')
            .expect(200);

        expect(res.body.data.unmappedColumns).toContain('Custom Field');
        expect(res.body.data.unmappedColumns).toContain('Another Custom');
    });
});
