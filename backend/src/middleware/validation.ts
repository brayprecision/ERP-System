/**
 * Request Validation Middleware
 * Uses Zod for schema validation
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodIssue } from 'zod';

// ==================== SCHEMAS ====================

/**
 * Login request schema
 */
export const loginSchema = z.object({
    username: z.string()
        .min(1, 'Username is required')
        .max(50, 'Username too long')
        .trim(),
    password: z.string()
        .min(1, 'Password is required')
        .max(128, 'Password too long')
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Create user request schema
 */
export const createUserSchema = z.object({
    username: z.string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username too long')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
        .trim(),
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name too long')
        .trim(),
    email: z.string()
        .email('Invalid email format')
        .max(255, 'Email too long')
        .optional()
        .nullable(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    role: z.enum(['Administrator', 'Machinist', 'Operator']).default('Operator')
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Update user request schema
 */
export const updateUserSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name too long')
        .trim()
        .optional(),
    email: z.string()
        .email('Invalid email format')
        .max(255, 'Email too long')
        .optional()
        .nullable(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password too long')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .optional(),
    role: z.enum(['Administrator', 'Machinist', 'Operator']).optional(),
    is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Update permissions schema
 */
export const updatePermissionsSchema = z.object({
    tab_permissions: z.object({
        dashboard: z.boolean().optional(),
        workcenter: z.boolean().optional(),
        inventory: z.boolean().optional(),
        sales: z.boolean().optional(),
        tasks: z.boolean().optional(),
        settings: z.boolean().optional()
    })
});

export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;

/**
 * Appearance settings schema
 */
export const appearanceSettingsSchema = z.object({
    appearance_settings: z.object({
        theme: z.string().optional(),
        showGrid: z.boolean().optional(),
        showGlow: z.boolean().optional(),
        animations: z.boolean().optional(),
        transparency: z.number().min(0).max(100).optional()
    })
});

export type AppearanceSettingsInput = z.infer<typeof appearanceSettingsSchema>;

/**
 * Customer schema
 */
export const customerSchema = z.object({
    name: z.string()
        .min(1, 'Customer name is required')
        .max(200, 'Name too long')
        .trim(),
    address: z.string().max(500, 'Address too long').optional().nullable(),
    phone: z.string().max(50, 'Phone too long').optional().nullable(),
    terms: z.string().max(100, 'Terms too long').optional().nullable(),
    notes: z.string().max(2000, 'Notes too long').optional().nullable()
});

export type CustomerInput = z.infer<typeof customerSchema>;

/**
 * Contact schema
 */
export const contactSchema = z.object({
    name: z.string()
        .min(1, 'Contact name is required')
        .max(100, 'Name too long')
        .trim(),
    email: z.string().email('Invalid email').max(255).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    role: z.string().max(100).optional().nullable(),
    is_primary: z.boolean().optional()
});

export type ContactInput = z.infer<typeof contactSchema>;

/**
 * Material/Inventory schema
 */
export const materialSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(200, 'Name too long')
        .trim(),
    part_number: z.string().max(100).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    qty_on_hand: z.number().int().min(0).default(0),
    minimum_qty: z.number().int().min(0).default(0),
    unit: z.string().max(20).default('EA'),
    supplier: z.string().max(200).optional().nullable(),
    unit_price: z.number().min(0).optional().nullable(),
    location: z.string().max(100).optional().nullable()
});

export type MaterialInput = z.infer<typeof materialSchema>;

/**
 * Quote schema
 */
export const quoteSchema = z.object({
    customer_id: z.number().int().positive().optional().nullable(),
    customer_name: z.string().max(200).optional().nullable(),
    rfq_number: z.string().max(100).optional().nullable(),
    rfq_date: z.string().datetime().optional().nullable(),
    part_number: z.string().max(100).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    quantity: z.number().int().positive().default(1),
    status: z.enum(['New', 'In Progress', 'Sent', 'Won', 'Lost']).default('New'),
    requested_date: z.string().datetime().optional().nullable(),
    due_date: z.string().datetime().optional().nullable(),
    total_amount: z.number().min(0).default(0),
    notes: z.string().max(2000).optional().nullable()
});

export type QuoteInput = z.infer<typeof quoteSchema>;

/**
 * Work order schema
 */
export const workOrderSchema = z.object({
    customer_id: z.number().int().positive().optional().nullable(),
    customer_name: z.string().max(200).optional().nullable(),
    quote_id: z.number().int().positive().optional().nullable(),
    due_date: z.string().datetime().optional().nullable(),
    status: z.enum(['Active', 'On Hold', 'Complete', 'Cancelled']).default('Active'),
    notes: z.string().max(2000).optional().nullable()
});

export type WorkOrderInput = z.infer<typeof workOrderSchema>;

/**
 * Task schema
 */
export const taskSchema = z.object({
    type: z.enum(['ordering', 'processing', 'machining', 'inspection', 'shipping', 'receiving', 'maintenance', 'misc']),
    title: z.string().min(1, 'Title is required').max(200).trim(),
    description: z.string().max(2000).optional().nullable(),
    work_order_id: z.number().int().positive().optional().nullable(),
    part_number: z.string().max(100).optional().nullable(),
    quantity: z.number().int().positive().optional().nullable(),
    assigned_to_name: z.string().max(100).optional().nullable(),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
    due_date: z.string().datetime().optional().nullable(),
    estimated_duration: z.number().int().positive().optional().nullable()
});

export type TaskInput = z.infer<typeof taskSchema>;

/**
 * ID parameter schema
 */
export const idParamSchema = z.object({
    id: z.string()
        .regex(/^\d+$/, 'ID must be a positive integer')
        .transform(val => parseInt(val, 10))
});

export type IdParam = z.infer<typeof idParamSchema>;

// ==================== SCHEMA COLLECTION ====================

export const schemas = {
    login: loginSchema,
    createUser: createUserSchema,
    updateUser: updateUserSchema,
    updatePermissions: updatePermissionsSchema,
    appearanceSettings: appearanceSettingsSchema,
    customer: customerSchema,
    contact: contactSchema,
    material: materialSchema,
    quote: quoteSchema,
    workOrder: workOrderSchema,
    task: taskSchema,
    idParam: idParamSchema
} as const;

// ==================== VALIDATION MIDDLEWARE ====================

interface ValidationError {
    field: string;
    message: string;
}

/**
 * Extract errors from Zod result (handles both v3 and v4 formats)
 */
function extractZodErrors(error: ZodError): ValidationError[] {
    const issues: ZodIssue[] = error.issues || (error as any).errors || [];
    return issues.map(e => ({
        field: (e.path || []).join('.'),
        message: e.message
    }));
}

/**
 * Extended Request with validated data
 */
export interface ValidatedRequest<
    TBody = any,
    TParams = any,
    TQuery = any
> extends Request {
    validatedBody?: TBody;
    validatedParams?: TParams;
    validatedQuery?: TQuery;
}

/**
 * Creates validation middleware for request body
 */
export function validateBody<T extends ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const errors = extractZodErrors(result.error);
                const firstError = errors[0];
                res.status(400).json({
                    success: false,
                    error: firstError?.message || 'Validation failed',
                    details: errors
                });
                return;
            }
            req.body = result.data;
            (req as ValidatedRequest).validatedBody = result.data;
            next();
        } catch (err) {
            console.error('Validation error:', err);
            res.status(500).json({ success: false, error: 'Validation error' });
        }
    };
}

/**
 * Creates validation middleware for request params
 */
export function validateParams<T extends ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const result = schema.safeParse(req.params);
            if (!result.success) {
                const errors = extractZodErrors(result.error);
                const firstError = errors[0];
                res.status(400).json({
                    success: false,
                    error: firstError?.message || 'Invalid parameters',
                    details: errors
                });
                return;
            }
            // Store validated params separately, don't replace req.params
            (req as ValidatedRequest).validatedParams = result.data;
            next();
        } catch (err) {
            console.error('Param validation error:', err);
            res.status(500).json({ success: false, error: 'Validation error' });
        }
    };
}

/**
 * Creates validation middleware for query parameters
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success) {
                const errors = extractZodErrors(result.error);
                const firstError = errors[0];
                res.status(400).json({
                    success: false,
                    error: firstError?.message || 'Invalid query parameters',
                    details: errors
                });
                return;
            }
            // Store validated query separately, don't replace req.query
            (req as ValidatedRequest).validatedQuery = result.data;
            next();
        } catch (err) {
            console.error('Query validation error:', err);
            res.status(500).json({ success: false, error: 'Validation error' });
        }
    };
}

// Default export for CommonJS compatibility
export default {
    schemas,
    validateBody,
    validateParams,
    validateQuery
};
