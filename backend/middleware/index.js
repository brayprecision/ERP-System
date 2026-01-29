// backend/middleware/index.js
// Central export for all middleware

const createAuthMiddleware = require('./auth');
const rateLimiters = require('./rateLimit');
const validation = require('./validation');

module.exports = {
    createAuthMiddleware,
    ...rateLimiters,
    ...validation
};
