/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

import rateLimit, { RateLimitRequestHandler, Options } from 'express-rate-limit';
import { Request } from 'express';

// ==================== TYPES ====================

interface RateLimitConfig {
    windowMs: number;
    max: number;
    message: {
        success: boolean;
        error: string;
    };
    standardHeaders: boolean;
    legacyHeaders: boolean;
}

// ==================== RATE LIMITERS ====================

/**
 * Login rate limiter - stricter limits for auth endpoints
 * 5 attempts per 15 minutes per IP+username combination
 */
export const loginLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        success: false,
        error: 'Too many login attempts. Please try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req: Request): string => {
        const username = (req.body as { username?: string })?.username || 'unknown';
        return `${req.ip}-${username}`;
    }
});

/**
 * Password reset rate limiter
 * 3 attempts per hour per IP
 */
export const passwordResetLimiter: RateLimitRequestHandler = rateLimit({
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
 * 100 requests per minute
 */
export const apiLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        success: false,
        error: 'Too many requests. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request): boolean => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    }
});

/**
 * Create user rate limiter
 * 10 new users per hour (admin only, but still limited)
 */
export const createUserLimiter: RateLimitRequestHandler = rateLimit({
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
 * Export/backup rate limiter
 * 10 exports per hour
 */
export const exportLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
    message: {
        success: false,
        error: 'Too many export requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Import rate limiter
 * 20 imports per hour
 */
export const importLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 imports per hour
    message: {
        success: false,
        error: 'Too many import requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Strict limiter for sensitive operations
 * 5 requests per 10 minutes
 */
export const strictLimiter: RateLimitRequestHandler = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // 5 requests per 10 minutes
    message: {
        success: false,
        error: 'Rate limit exceeded for this operation. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Create custom rate limiter with specified options
 */
export function createRateLimiter(options: Partial<Options>): RateLimitRequestHandler {
    return rateLimit({
        windowMs: options.windowMs || 60 * 1000,
        max: options.max || 100,
        message: options.message || {
            success: false,
            error: 'Rate limit exceeded'
        },
        standardHeaders: true,
        legacyHeaders: false,
        ...options
    });
}

// ==================== DEFAULT EXPORT ====================

export default {
    loginLimiter,
    passwordResetLimiter,
    apiLimiter,
    createUserLimiter,
    exportLimiter,
    importLimiter,
    strictLimiter,
    createRateLimiter
};
