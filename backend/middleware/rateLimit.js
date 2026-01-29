// backend/middleware/rateLimit.js
// Rate limiting middleware for API protection

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login attempts
 * Stricter limits to prevent brute force attacks
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests (don't count them against the limit)
    skipSuccessfulRequests: false,
    // Use IP + username as key to prevent distributed attacks on single account
    keyGenerator: (req) => {
        const username = req.body?.username || 'unknown';
        return `${req.ip}-${username}`;
    }
});

/**
 * Rate limiter for password reset/recovery
 * Very strict to prevent abuse
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: {
        success: false,
        error: 'Too many password reset attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * General API rate limiter
 * More lenient for normal operations
 */
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        success: false,
        error: 'Too many requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for authenticated admins if needed
    skip: (req) => {
        // Could add logic here to skip for certain users
        return false;
    }
});

/**
 * Rate limiter for user creation
 * Prevent mass account creation
 */
const createUserLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 new users per hour
    message: {
        success: false,
        error: 'Too many user creation attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiter for data exports
 * Prevent abuse of export functionality
 */
const exportLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 exports per 5 minutes
    message: {
        success: false,
        error: 'Too many export requests. Please wait a few minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    loginLimiter,
    passwordResetLimiter,
    apiLimiter,
    createUserLimiter,
    exportLimiter
};
