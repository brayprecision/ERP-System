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

// ==================== CUSTOMER SCHEMAS (camelCase for API) ====================

const customerSchema = z.object({
    name: z.string()
        .min(1, 'Customer name is required')
        .max(200, 'Name too long')
        .trim(),
    addressLine1: z.string().max(500).optional().nullable(),
    addressLine2: z.string().max(500).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    zipCode: z.string().max(20).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    fax: z.string().max(50).optional().nullable(),
    website: z.string().max(255).optional().nullable(),
    defaultTerms: z.string().max(100).optional().nullable(),
    taxId: z.string().max(50).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    contacts: z.array(z.object({
        name: z.string().min(1).max(100),
        role: z.string().max(100).optional().nullable(),
        email: z.string().email().max(255).optional().nullable(),
        phone: z.string().max(50).optional().nullable(),
        mobile: z.string().max(50).optional().nullable(),
        isPrimary: z.boolean().optional()
    })).optional()
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
    phone: z.string().max(50).optional().nullable(),
    mobile: z.string().max(50).optional().nullable(),
    role: z.string().max(100).optional().nullable(),
    isPrimary: z.boolean().optional().default(false),
    notes: z.string().max(500).optional().nullable()
});

// ==================== INVENTORY SCHEMAS (camelCase for API) ====================

const materialSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(200, 'Name too long')
        .trim(),
    materialType: z.string()
        .min(1, 'Material type is required')
        .max(100)
        .trim(),
    materialShape: z.string()
        .min(1, 'Material shape is required')
        .max(100)
        .trim(),
    qtyOnHand: z.coerce.number()
        .min(0, 'Quantity cannot be negative'),
    lengthUnit: z.string()
        .min(1, 'Length unit is required')
        .max(20)
        .trim(),
    unitPrice: z.coerce.number()
        .min(0, 'Price cannot be negative'),
    supplier: z.string()
        .min(1, 'Supplier is required')
        .max(200)
        .trim(),
    minimumQty: z.coerce.number()
        .min(0, 'Minimum quantity cannot be negative'),
    reorderLink: z.string().max(500).optional().nullable()
});

const toolSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200).trim(),
    toolType: z.string().min(1, 'Tool type is required').max(100).trim(),
    operation: z.string().min(1, 'Operation is required').max(100).trim(),
    qtyOnHand: z.number().min(0),
    minimumQty: z.number().min(0),
    supplier: z.string().min(1, 'Supplier is required').max(200).trim(),
    toolPrice: z.number().min(0)
});

const miscItemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200).trim(),
    workcenter: z.string().min(1, 'Workcenter is required').max(100).trim(),
    qtyOnHand: z.number().min(0),
    minimumQty: z.number().min(0),
    itemPrice: z.number().min(0)
});

const productSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200).trim(),
    partNumber: z.string().max(100).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    qtyOnHand: z.coerce.number().min(0),
    minimumQty: z.coerce.number().min(0),
    unit: z.string().max(20).optional().nullable(),
    supplier: z.string().max(200).optional().nullable(),
    unitPrice: z.coerce.number().min(0),
    location: z.string().max(200).optional().nullable(),
    reorderLink: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable()
});

const partSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200).trim(),
    partNumber: z.string().max(100).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    source: z.enum(['purchased', 'manufactured']).optional().default('purchased'),
    description: z.string().max(1000).optional().nullable(),
    qtyOnHand: z.coerce.number().min(0),
    minimumQty: z.coerce.number().min(0),
    unit: z.string().max(20).optional().nullable(),
    supplier: z.string().max(200).optional().nullable(),
    unitPrice: z.coerce.number().min(0),
    location: z.string().max(200).optional().nullable(),
    reorderLink: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable()
});

const productBomSchema = z.object({
    partId: z.coerce.number().int().positive('Part ID is required'),
    quantityPerAssembly: z.coerce.number().min(0.001, 'Quantity must be positive')
});

// ==================== QUOTE SCHEMAS (camelCase for API) ====================

const quoteSchema = z.object({
    customerId: z.coerce.number()
        .int('Customer ID must be an integer')
        .positive('Customer ID must be positive'),
    contactId: z.coerce.number().int().positive().optional().nullable(),
    priority: z.string().max(50).optional(),
    rfqNumber: z.string().max(100).optional().nullable(),
    rfqReceivedDate: z.string().optional().nullable(),
    quoteDueDate: z.string().optional().nullable(),
    validUntil: z.string().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    internalNotes: z.string().max(2000).optional().nullable(),
    items: z.array(z.object({
        partNumber: z.string().min(1, 'Part number is required').max(100),
        revision: z.string().max(50).optional().nullable(),
        description: z.string().max(1000).optional().nullable(),
        quantity: z.coerce.number().min(0.0001, 'Quantity must be positive'),
        unit: z.string().max(20).optional(),
        material: z.string().max(200).optional().nullable(),
        materialCost: z.number().min(0).optional(),
        unitPrice: z.coerce.number().min(0, 'Unit price is required'),
        setupCost: z.number().min(0).optional(),
        leadTimeDays: z.number().int().min(0).optional().nullable(),
        notes: z.string().max(500).optional().nullable()
    })).optional()
});

const quoteItemSchema = z.object({
    partNumber: z.string()
        .min(1, 'Part number is required')
        .max(100)
        .trim(),
    revision: z.string().max(50).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    quantity: z.coerce.number()
        .min(0.0001, 'Quantity must be positive'),
    unit: z.string().max(20).optional(),
    material: z.string().max(200).optional().nullable(),
    materialCost: z.number().min(0).optional(),
    unitPrice: z.coerce.number()
        .min(0, 'Unit price is required'),
    setupCost: z.number().min(0).optional(),
    leadTimeDays: z.number().int().min(0).optional().nullable(),
    notes: z.string().max(500).optional().nullable()
});

// ==================== WORK ORDER SCHEMAS (camelCase for API) ====================

const workOrderSchema = z.object({
    customerId: z.coerce.number()
        .int('Customer ID must be an integer')
        .positive('Please select a customer'),
    quoteId: z.coerce.number().int().positive().optional().nullable(),
    quoteItemId: z.coerce.number().int().positive().optional().nullable(),
    partNumber: z.string()
        .min(1, 'Part number is required')
        .max(100)
        .trim(),
    revision: z.string().max(50).optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    quantity: z.coerce.number()
        .min(0.0001, 'Quantity must be positive'),
    unit: z.string().max(20).optional(),
    material: z.string().max(200).optional().nullable(),
    dueDate: z.string().min(1, 'Due date is required'),
    priority: z.string().max(50).optional(),
    customerPo: z.string().max(100).optional().nullable(),
    quotedPrice: z.coerce.number().min(0).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    internalNotes: z.string().max(2000).optional().nullable()
});

// ==================== LABOR / TIME TRACKING ====================

const laborSegmentStartSchema = z.object({
    workOrderId: z.coerce.number().int().positive(),
    workflowStepKey: z.string().min(1).max(120).trim(),
    lineItemId: z.coerce.number().int().positive().optional().nullable()
});

const laborSegmentStopSchema = z.object({
    workOrderId: z.coerce.number().int().positive(),
    workflowStepKey: z.string().min(1).max(120).trim(),
    lineItemId: z.coerce.number().int().positive().optional().nullable()
});

const laborHistoryQuerySchema = z.object({
    userId: z.coerce.number().int().positive(),
    from: z.string().min(1),
    to: z.string().min(1)
});

const laborMiscSegmentStartSchema = z.object({
    miscTaskId: z.union([z.coerce.number(), z.string().min(1).max(80)]),
    miscTaskTitle: z.string().max(500).optional().nullable()
});

const laborMiscSegmentStopSchema = z.object({
    miscTaskId: z.union([z.coerce.number(), z.string().min(1).max(80)])
});

/** Manual correction of shop shift times (ISO 8601 strings; endedAt null = still on shift) */
const laborShiftPatchSchema = z
    .object({
        startedAt: z.string().min(1, 'Clock in time is required'),
        endedAt: z.string().optional().nullable()
    })
    .refine(
        (data) => {
            if (!data.endedAt) return true;
            return new Date(data.endedAt) >= new Date(data.startedAt);
        },
        { message: 'Clock out must be at or after clock in' }
    );

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
        tool: toolSchema,
        miscItem: miscItemSchema,
        product: productSchema,
        part: partSchema,
        productBom: productBomSchema,
        quote: quoteSchema,
        quoteItem: quoteItemSchema,
        workOrder: workOrderSchema,
        laborSegmentStart: laborSegmentStartSchema,
        laborSegmentStop: laborSegmentStopSchema,
        laborHistoryQuery: laborHistoryQuerySchema,
        laborShiftPatch: laborShiftPatchSchema,
        laborMiscSegmentStart: laborMiscSegmentStartSchema,
        laborMiscSegmentStop: laborMiscSegmentStopSchema,
        idParam: idParamSchema
    },
    // Middleware creators
    validateBody,
    validateParams,
    validateQuery
};
