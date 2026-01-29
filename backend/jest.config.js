/**
 * Jest Configuration for BPERP Backend
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',

    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/'
    ],

    // Coverage settings
    collectCoverageFrom: [
        'routes/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**'
    ],

    // Coverage thresholds (can be increased over time)
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },

    // Setup files
    setupFilesAfterEnv: ['./tests/setup.js'],

    // Timeout for tests
    testTimeout: 10000,

    // Verbose output
    verbose: true
};
