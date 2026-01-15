// Zod Validation Schemas for BPERP Inventory
import { z } from 'zod';

// Common validation patterns
const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

// Base schema for common fields
const baseInventorySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters')
    .trim(),
  qtyOnHand: z.number()
    .int('Quantity must be a whole number')
    .min(0, 'Quantity cannot be negative'),
  minimumQty: z.number()
    .int('Minimum quantity must be a whole number')
    .min(0, 'Minimum quantity cannot be negative'),
  reorderLink: z.string()
    .url('Please enter a valid URL')
    .or(z.literal(''))
    .optional()
    .transform(val => val || ''),
});

// Material validation schema
export const materialSchema = baseInventorySchema.extend({
  materialType: z.string()
    .min(1, 'Material type is required')
    .max(100, 'Material type must be less than 100 characters')
    .trim(),
  materialShape: z.string()
    .min(1, 'Material shape is required')
    .max(100, 'Material shape must be less than 100 characters')
    .trim(),
  lengthUnit: z.string()
    .min(1, 'Length unit is required')
    .max(50, 'Length unit must be less than 50 characters')
    .trim(),
  unitPrice: z.number()
    .min(0, 'Unit price cannot be negative')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),
  supplier: z.string()
    .min(1, 'Supplier is required')
    .max(100, 'Supplier must be less than 100 characters')
    .trim(),
});

// Tool validation schema
export const toolSchema = baseInventorySchema.extend({
  toolType: z.string()
    .min(1, 'Tool type is required')
    .max(100, 'Tool type must be less than 100 characters')
    .trim(),
  operation: z.string()
    .min(1, 'Operation is required')
    .max(100, 'Operation must be less than 100 characters')
    .trim(),
  supplier: z.string()
    .min(1, 'Supplier is required')
    .max(100, 'Supplier must be less than 100 characters')
    .trim(),
  toolPrice: z.number()
    .min(0, 'Tool price cannot be negative')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),
});

// Misc item validation schema
export const miscSchema = baseInventorySchema.extend({
  workcenter: z.string()
    .min(1, 'Workcenter is required')
    .max(100, 'Workcenter must be less than 100 characters')
    .trim(),
  itemPrice: z.number()
    .min(0, 'Item price cannot be negative')
    .multipleOf(0.01, 'Price must have at most 2 decimal places'),
});

// Update schemas (all fields optional except id)
export const updateMaterialSchema = materialSchema.partial().extend({
  id: z.string().min(1, 'ID is required'),
});

export const updateToolSchema = toolSchema.partial().extend({
  id: z.string().min(1, 'ID is required'),
});

export const updateMiscSchema = miscSchema.partial().extend({
  id: z.string().min(1, 'ID is required'),
});

// Query params validation
export const inventoryQuerySchema = z.object({
  search: z.string().optional(),
  category: z.enum(['material', 'tool', 'misc', 'all']).optional(),
  supplier: z.string().optional(),
  status: z.enum(['critical', 'low', 'monitor', 'good']).optional(),
  minQty: z.coerce.number().int().min(0).optional(),
  maxQty: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.enum(['name', 'qtyOnHand', 'minimumQty', 'price', 'supplier', 'status', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// Type exports from schemas
export type MaterialInput = z.infer<typeof materialSchema>;
export type ToolInput = z.infer<typeof toolSchema>;
export type MiscInput = z.infer<typeof miscSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type UpdateToolInput = z.infer<typeof updateToolSchema>;
export type UpdateMiscInput = z.infer<typeof updateMiscSchema>;
export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;

// Validation helper function
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean; 
  data?: T; 
  errors?: Array<{ field: string; message: string }>;
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));
  
  return { success: false, errors };
}

// Frontend validation helper (for use in browser)
export function validateMaterial(data: unknown) {
  return validateWithSchema(materialSchema, data);
}

export function validateTool(data: unknown) {
  return validateWithSchema(toolSchema, data);
}

export function validateMisc(data: unknown) {
  return validateWithSchema(miscSchema, data);
}
