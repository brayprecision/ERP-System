/**
 * Jest Test Setup
 * Runs before each test file
 */

// Load environment variables
require('dotenv').config({ path: '.env.test' });

// Set test environment defaults
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || 3001;
process.env.DB_NAME = process.env.DB_NAME || 'airshop_test';

// Increase timeout for database operations
jest.setTimeout(10000);

// Global teardown
afterAll(async () => {
    // Clean up any remaining connections
    await new Promise(resolve => setTimeout(resolve, 100));
});
