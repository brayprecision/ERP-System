/**
 * Authentication Middleware
 * Provides token-based authentication and authorization
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { User, UserRole, TabPermissions, AppearanceSettings } from '../types';

// ==================== TYPES ====================

export interface AuthenticatedUser {
    id: number;
    username: string;
    name: string;
    email: string | null;
    role: UserRole;
    appearanceSettings: AppearanceSettings;
    tabPermissions: TabPermissions;
    isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
    token?: string;
}

export type AuthMiddleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => Promise<void>;

// ==================== USER ROW TYPE ====================

interface UserRow {
    id: number;
    username: string;
    name: string;
    email: string | null;
    role: string;
    appearance_settings: AppearanceSettings | null;
    tab_permissions: TabPermissions | null;
    is_active: boolean;
}

// ==================== AUTH MIDDLEWARE FACTORY ====================

/**
 * Creates authentication middleware with database pool
 */
export function createAuthMiddleware(pool: Pool) {
    
    /**
     * Get user from session token
     */
    async function getUserFromToken(token: string): Promise<AuthenticatedUser | null> {
        try {
            const result = await pool.query<UserRow>(`
                SELECT u.id, u.username, u.name, u.email, u.role, 
                       u.appearance_settings, u.tab_permissions, u.is_active
                FROM users u
                JOIN user_sessions s ON u.id = s.user_id
                WHERE s.token = $1 
                  AND s.expires_at > NOW() 
                  AND u.is_active = TRUE
            `, [token]);

            const row = result.rows[0];
            if (!row) {
                return null;
            }

            return {
                id: row.id,
                username: row.username,
                name: row.name,
                email: row.email,
                role: row.role as UserRole,
                appearanceSettings: row.appearance_settings || {
                    theme: 'automation',
                    showGrid: true,
                    showGlow: true,
                    animations: true,
                    transparency: 50
                },
                tabPermissions: row.tab_permissions || {
                    dashboard: true,
                    workcenter: true,
                    inventory: false,
                    sales: false,
                    tasks: true,
                    settings: false
                },
                isActive: row.is_active
            };
        } catch (err) {
            console.error('Error getting user from token:', err);
            return null;
        }
    }

    /**
     * Extract token from request headers
     */
    function extractToken(req: Request): string | null {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return null;
    }

    /**
     * Middleware: Require authentication
     */
    const requireAuth: AuthMiddleware = async (req, res, next) => {
        try {
            const token = extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            const user = await getUserFromToken(token);
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session'
                });
                return;
            }

            req.user = user;
            req.token = token;
            next();
        } catch (err) {
            console.error('Auth middleware error:', err);
            res.status(500).json({ success: false, error: 'Authentication error' });
        }
    };

    /**
     * Middleware: Require admin role
     */
    const requireAdmin: AuthMiddleware = async (req, res, next) => {
        try {
            const token = extractToken(req);
            if (!token) {
                res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
                return;
            }

            const user = await getUserFromToken(token);
            if (!user) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid or expired session'
                });
                return;
            }

            if (user.role !== 'Administrator') {
                res.status(403).json({
                    success: false,
                    error: 'Administrator access required'
                });
                return;
            }

            req.user = user;
            req.token = token;
            next();
        } catch (err) {
            console.error('Admin middleware error:', err);
            res.status(500).json({ success: false, error: 'Authentication error' });
        }
    };

    /**
     * Middleware: Optional authentication (sets user if token valid)
     */
    const optionalAuth: AuthMiddleware = async (req, res, next) => {
        try {
            const token = extractToken(req);
            if (token) {
                const user = await getUserFromToken(token);
                if (user) {
                    req.user = user;
                    req.token = token;
                }
            }
            next();
        } catch (err) {
            // Don't fail for optional auth
            next();
        }
    };

    /**
     * Creates middleware that requires specific role(s)
     */
    function requireRole(...allowedRoles: UserRole[]): AuthMiddleware {
        return async (req, res, next) => {
            try {
                const token = extractToken(req);
                if (!token) {
                    res.status(401).json({
                        success: false,
                        error: 'Authentication required'
                    });
                    return;
                }

                const user = await getUserFromToken(token);
                if (!user) {
                    res.status(401).json({
                        success: false,
                        error: 'Invalid or expired session'
                    });
                    return;
                }

                if (!allowedRoles.includes(user.role)) {
                    res.status(403).json({
                        success: false,
                        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
                    });
                    return;
                }

                req.user = user;
                req.token = token;
                next();
            } catch (err) {
                console.error('Role middleware error:', err);
                res.status(500).json({ success: false, error: 'Authentication error' });
            }
        };
    }

    /**
     * Middleware: Require self or admin (for user profile operations)
     */
    function requireSelfOrAdmin(userIdParam: string = 'id'): AuthMiddleware {
        return async (req, res, next) => {
            try {
                const token = extractToken(req);
                if (!token) {
                    res.status(401).json({
                        success: false,
                        error: 'Authentication required'
                    });
                    return;
                }

                const user = await getUserFromToken(token);
                if (!user) {
                    res.status(401).json({
                        success: false,
                        error: 'Invalid or expired session'
                    });
                    return;
                }

                const paramValue = req.params[userIdParam];
                const idString = Array.isArray(paramValue) ? paramValue[0] : paramValue;
                const targetUserId = parseInt(idString || '0', 10);
                const isSelf = user.id === targetUserId;
                const isAdmin = user.role === 'Administrator';

                if (!isSelf && !isAdmin) {
                    res.status(403).json({
                        success: false,
                        error: 'You can only modify your own profile'
                    });
                    return;
                }

                req.user = user;
                req.token = token;
                next();
            } catch (err) {
                console.error('Self/admin middleware error:', err);
                res.status(500).json({ success: false, error: 'Authentication error' });
            }
        };
    }

    return {
        getUserFromToken,
        extractToken,
        requireAuth,
        requireAdmin,
        optionalAuth,
        requireRole,
        requireSelfOrAdmin
    };
}

export default createAuthMiddleware;
