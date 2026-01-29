// backend/middleware/validation.js
// Input validation using Zod schemas

const { z } = require('zod');

// ==================== USER SCHEMAS ====================

const loginSchema = z.object({
    username: z.string()
        .min(1, 'Username is required')
        .max(50, 'Username too long')
        .trim(),
    password: z.string()
        .min(1, 'Password is required')
        .max(128, 'Password too long')
});

const createUserSchema = z.object({
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
    role: z.enum(['Administrator', 'Machinist', 'Operator'])
        .optional()
        .default('Operator')
});

const updateUserSchema = z.object({
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
    role: z.enum(['Administrator', 'Machinist', 'Operator'])
        .optional(),
    is_active: z.boolean()
        .optional()
});

const updatePermissionsSchema = z.object({
    tab_permissions: z.object({
        dashboard: z.boolean().optional(),
        workcenter: z.boolean().optional(),
        inventory: z.boolean().optional(),
        sales: z.boolean().optional(),
        tasks: z.boolean().optional(),
        settings: z.boolean().optional()
    })
});

const appearanceSettingsSchema = z.object({
    appearance_settings: z.object({
        theme: z.string().max(50).optional(),
        showGrid: z.boolean().optional(),
        showGlow: z.boolean().optional(),
        animations: z.boolean().optional(),
        transparency: z.number().min(0).max(100).optional()
    })
});

// ==================== CUSTOMER SCHEMAS ====================

const customerSchema = z.object({
    name: z.string()
        .min(1, 'Customer name is required')
        .max(200, 'Name too long')
        .trim(),
    address: z.string()
        .max(500, 'Address too long')
        .optional()
        .nullable(),
    phone: z.string()
        .max(50, 'Phone number too long')
        .optional()
        .nullable(),
    terms: z.string()
        .max(100, 'Terms too long')
        .optional()
        .nullable()
});

const contactSchema = z.object({
    name: z.string()
        .min(1, 'Contact name is required')
        .max(100, 'Name too long')
        .trim(),
    email: z.string()
        .email('Invalid email format')
        .max(255, 'Email too long')
        .optional()
        .nullable(),
    phone: z.string()
        .max(50, 'Phone number too long')
        .optional()
        .nullable(),
    role: z.string()
        .max(100, 'Role too long')
        .optional()
        .nullable(),
    is_primary: z.boolean()
        .optional()
        .default(false)
});

// ==================== INVENTORY SCHEMAS ====================

const materialSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(200, 'Name too long')
        .trim(),
    part_number: z.string()
        .max(100, 'Part number too long')
        .optional()
        .nullable(),
    category: z.string()
        .max(100, 'Category too long')
        .optional()
        .nullable(),
    qty_on_hand: z.number()
        .int('Quantity must be an integer')
        .min(0, 'Quantity cannot be negative')
        .optional()
        .default(0),
    minimum_qty: z.number()
        .int('Minimum quantity must be an integer')
        .min(0, 'Minimum quantity cannot be negative')
        .optional()
        .default(0),
    supplier: z.string()
        .max(200, 'Supplier name too long')
        .optional()
        .nullable(),
    unit_price: z.number()
        .min(0, 'Price cannot be negative')
        .optional()
        .nullable()
});

// ==================== QUOTE SCHEMAS ====================

const quoteSchema = z.object({
    customer_id: z.number()
        .int('Customer ID must be an integer')
        .positive('Customer ID must be positive'),
    part_number: z.string()
        .max(100, 'Part number too long')
        .optional()
        .nullable(),
    description: z.string()
        .max(1000, 'Description too long')
        .optional()
        .nullable(),
    quantity: z.number()
        .int('Quantity must be an integer')
        .positive('Quantity must be positive')
        .optional()
        .default(1),
    requested_date: z.string()
        .datetime()
        .optional()
        .nullable(),
    due_date: z.string()
        .datetime()
        .optional()
        .nullable()
});

// ==================== WORK ORDER SCHEMAS ====================

const workOrderSchema = z.object({
    customer_id: z.number()
        .int('Customer ID must be an integer')
        .positive('Customer ID must be positive'),
    quote_id: z.number()
        .int('Quote ID must be an integer')
        .positive('Quote ID must be positive')
        .optional()
        .nullable(),
    due_date: z.string()
        .optional()
        .nullable(),
    notes: z.string()
        .max(2000, 'Notes too long')
        .optional()
        .nullable()
});

// ==================== ID PARAMETER SCHEMA ====================

const idParamSchema = z.object({
    id: z.string()
        .regex(/^\d+$/, 'ID must be a positive integer')
        .transform(val => parseInt(val, 10))
});

// ==================== VALIDATION MIDDLEWARE ====================

/**
 * Helper to extract errors from Zod result (handles both v3 and v4 formats)
 */
function extractZodErrors(error) {
    // Zod v4 uses error.issues, v3 uses error.errors
    const issues = error.issues || error.errors || [];
    return issues.map(e => ({
        field: (e.path || []).join('.'),
        message: e.message
    }));
}

/**
 * Creates validation middleware for request body
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
function validateBody(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const errors = extractZodErrors(result.error);
                return res.status(400).json({
                    success: false,
                    error: errors.length > 0 ? errors[0].message : 'Validation failed',
                    details: errors
                });
            }
            req.body = result.data; // Replace body with validated/transformed data
            req.validatedBody = result.data;
            next();
        } catch (err) {
            console.error('Validation error:', err);
            res.status(500).json({ success: false, error: 'Validation error' });
        }
    };
}

/**
 * Creates validation middleware for request params
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
function validateParams(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.params);
            if (!result.success) {
                const errors = extractZodErrors(result.error);
                return res.status(400).json({
                    success: false,
                    error: errors.length > 0 ? errors[0].message : 'Invalid parameters',
                    details: errors
                });
            }
            req.params = result.data; // Replace params with validated/transformed data
            req.validatedParams = result.data;
            next();
        } catch (err) {
            console.error('Param validation error:', err);
            res.status(500).json({ success: false, error: 'Validation error' });
        }
    };
}

/**
 * Creates validation middleware for query parameters
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
function validateQuery(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success) {
                const errors = extractZodErrors(result.error);
                return res.status(400).json({
                    success: false,
                    error: errors.length > 0 ? errors[0].message : 'Invalid query parameters',
                    details: errors
                });
            }
            req.validatedQuery = result.data;
            next();
        } catch (err) {
            console.error('Query validation error:', err);
            res.status(500).json({ success: false, error: 'Validation error' });
        }
    };
}

module.exports = {
    // Schemas
    schemas: {
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
        idParam: idParamSchema
    },
    // Middleware creators
    validateBody,
    validateParams,
    validateQuery
};
