// Sales Module Zod Validation Schemas for BPERP
import { z } from 'zod';

// ==================== ENUMS ====================

export const paymentTermsEnum = z.enum([
  'NET 15', 'NET 30', 'NET 45', 'NET 60', 'COD', 'Due on Receipt', 'Custom'
]);

export const quoteStatusEnum = z.enum([
  'New', 'In Progress', 'Sent', 'Won', 'Lost', 'Expired'
]);

export const priorityEnum = z.enum(['Low', 'Normal', 'High', 'Urgent']);

export const workOrderStatusEnum = z.enum([
  'Open', 'In Progress', 'On Hold', 'Complete', 'Shipped', 'Cancelled'
]);

export const checklistStepKeyEnum = z.enum([
  'material_ordered', 'tooling_ordered', 'part_programmed',
  'material_received', 'tooling_received', 'material_processed',
  'machining_complete', 'post_processing', 'inspection_complete',
  'ready_for_shipment'
]);

// ==================== CONTACT SCHEMAS ====================

export const contactSchema = z.object({
  name: z.string()
    .min(1, 'Contact name is required')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  role: z.string()
    .max(100, 'Role must be less than 100 characters')
    .trim()
    .optional(),
  email: z.string()
    .email('Please enter a valid email address')
    .max(200, 'Email must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .max(50, 'Phone must be less than 50 characters')
    .trim()
    .optional(),
  mobile: z.string()
    .max(50, 'Mobile must be less than 50 characters')
    .trim()
    .optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
});

export const updateContactSchema = contactSchema.partial().extend({
  id: z.number().int().positive('Contact ID is required'),
});

// ==================== CUSTOMER SCHEMAS ====================

export const customerSchema = z.object({
  name: z.string()
    .min(1, 'Company name is required')
    .max(200, 'Company name must be less than 200 characters')
    .trim(),
  addressLine1: z.string()
    .max(200, 'Address must be less than 200 characters')
    .trim()
    .optional(),
  addressLine2: z.string()
    .max(200, 'Address must be less than 200 characters')
    .trim()
    .optional(),
  city: z.string()
    .max(100, 'City must be less than 100 characters')
    .trim()
    .optional(),
  state: z.string()
    .max(50, 'State must be less than 50 characters')
    .trim()
    .optional(),
  zipCode: z.string()
    .max(20, 'Zip code must be less than 20 characters')
    .trim()
    .optional(),
  country: z.string()
    .max(100, 'Country must be less than 100 characters')
    .default('USA'),
  phone: z.string()
    .max(50, 'Phone must be less than 50 characters')
    .trim()
    .optional(),
  fax: z.string()
    .max(50, 'Fax must be less than 50 characters')
    .trim()
    .optional(),
  website: z.string()
    .url('Please enter a valid website URL')
    .max(200, 'Website must be less than 200 characters')
    .optional()
    .or(z.literal('')),
  defaultTerms: paymentTermsEnum.default('NET 30'),
  taxId: z.string()
    .max(50, 'Tax ID must be less than 50 characters')
    .trim()
    .optional(),
  notes: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
});

export const updateCustomerSchema = customerSchema.partial().extend({
  id: z.number().int().positive('Customer ID is required'),
});

// ==================== QUOTE ITEM SCHEMAS ====================

export const quoteItemSchema = z.object({
  partNumber: z.string()
    .min(1, 'Part number is required')
    .max(100, 'Part number must be less than 100 characters')
    .trim(),
  revision: z.string()
    .max(20, 'Revision must be less than 20 characters')
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  quantity: z.number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
  unit: z.string()
    .max(20, 'Unit must be less than 20 characters')
    .default('EA'),
  material: z.string()
    .max(200, 'Material must be less than 200 characters')
    .optional(),
  materialCost: z.number()
    .min(0, 'Material cost cannot be negative')
    .default(0),
  unitPrice: z.number()
    .min(0, 'Unit price cannot be negative'),
  setupCost: z.number()
    .min(0, 'Setup cost cannot be negative')
    .default(0),
  leadTimeDays: z.number()
    .int('Lead time must be a whole number')
    .min(0, 'Lead time cannot be negative')
    .optional(),
  notes: z.string().optional(),
});

export const updateQuoteItemSchema = quoteItemSchema.partial().extend({
  id: z.number().int().positive('Quote item ID is required'),
});

// ==================== QUOTE SCHEMAS ====================

export const quoteSchema = z.object({
  customerId: z.number()
    .int('Customer ID must be a number')
    .positive('Please select a customer'),
  contactId: z.number()
    .int()
    .positive()
    .optional(),
  priority: priorityEnum.default('Normal'),
  rfqNumber: z.string()
    .max(100, 'RFQ number must be less than 100 characters')
    .trim()
    .optional(),
  rfqReceivedDate: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), 'Invalid date format')
    .optional(),
  quoteDueDate: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), 'Invalid date format')
    .optional(),
  validUntil: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), 'Invalid date format')
    .optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  items: z.array(quoteItemSchema).optional(),
});

export const updateQuoteSchema = quoteSchema.partial().extend({
  id: z.number().int().positive('Quote ID is required'),
  status: quoteStatusEnum.optional(),
  sentTo: z.string()
    .max(200, 'Sent to must be less than 200 characters')
    .optional(),
  lostReason: z.string()
    .max(200, 'Lost reason must be less than 200 characters')
    .optional(),
});

// ==================== WORK ORDER SCHEMAS ====================

export const workOrderSchema = z.object({
  customerId: z.number()
    .int('Customer ID must be a number')
    .positive('Please select a customer'),
  quoteId: z.number().int().positive().optional(),
  quoteItemId: z.number().int().positive().optional(),
  partNumber: z.string()
    .min(1, 'Part number is required')
    .max(100, 'Part number must be less than 100 characters')
    .trim(),
  revision: z.string()
    .max(20, 'Revision must be less than 20 characters')
    .trim()
    .optional(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  quantity: z.number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
  unit: z.string()
    .max(20, 'Unit must be less than 20 characters')
    .default('EA'),
  material: z.string()
    .max(200, 'Material must be less than 200 characters')
    .optional(),
  dueDate: z.string()
    .min(1, 'Due date is required')
    .refine(val => !isNaN(Date.parse(val)), 'Invalid date format'),
  priority: priorityEnum.default('Normal'),
  customerPo: z.string()
    .max(100, 'Customer PO must be less than 100 characters')
    .trim()
    .optional(),
  quotedPrice: z.number()
    .min(0, 'Quoted price cannot be negative')
    .optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const updateWorkOrderSchema = workOrderSchema.partial().extend({
  id: z.number().int().positive('Work order ID is required'),
  status: workOrderStatusEnum.optional(),
});

// ==================== CHECKLIST SCHEMAS ====================

export const checklistStepDataSchema = z.object({
  poNumber: z.string().optional(),
  supplier: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  lotNumber: z.string().optional(),
  certsReceived: z.boolean().optional(),
  toolList: z.array(z.string()).optional(),
  programmer: z.string().optional(),
  programNumber: z.string().optional(),
  machine: z.string().optional(),
  operator: z.string().optional(),
  processNotes: z.string().optional(),
  machineUsed: z.string().optional(),
  hours: z.number().min(0).optional(),
  processType: z.string().optional(),
  vendor: z.string().optional(),
  isOutsourced: z.boolean().optional(),
  inspector: z.string().optional(),
  firstArticle: z.boolean().optional(),
  cocNumber: z.string().optional(),
  packagingNotes: z.string().optional(),
  weight: z.number().min(0).optional(),
  dimensions: z.string().optional(),
}).partial();

export const updateChecklistItemSchema = z.object({
  id: z.number().int().positive('Checklist item ID is required'),
  isCompleted: z.boolean().optional(),
  dateValue: z.string()
    .refine(val => !val || !isNaN(Date.parse(val)), 'Invalid date format')
    .optional(),
  referenceNumber: z.string()
    .max(100, 'Reference number must be less than 100 characters')
    .optional(),
  vendorSupplier: z.string()
    .max(200, 'Vendor/Supplier must be less than 200 characters')
    .optional(),
  operatorName: z.string()
    .max(100, 'Operator name must be less than 100 characters')
    .optional(),
  notes: z.string().optional(),
  stepData: checklistStepDataSchema.optional(),
});

// ==================== FILTER SCHEMAS ====================

export const customerFilterSchema = z.object({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  hasOpenWorkOrders: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const quoteFilterSchema = z.object({
  search: z.string().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  status: z.union([quoteStatusEnum, z.array(quoteStatusEnum)]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  isOpen: z.coerce.boolean().optional(),
  isSent: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const workOrderFilterSchema = z.object({
  search: z.string().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  status: z.union([workOrderStatusEnum, z.array(workOrderStatusEnum)]).optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  isOverdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  sortField: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ==================== TYPE EXPORTS ====================

export type CustomerInput = z.infer<typeof customerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;
export type WorkOrderInput = z.infer<typeof workOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type ChecklistStepDataInput = z.infer<typeof checklistStepDataSchema>;

// ==================== VALIDATION HELPERS ====================

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

export const validateCustomer = (data: unknown) => validateWithSchema(customerSchema, data);
export const validateContact = (data: unknown) => validateWithSchema(contactSchema, data);
export const validateQuote = (data: unknown) => validateWithSchema(quoteSchema, data);
export const validateQuoteItem = (data: unknown) => validateWithSchema(quoteItemSchema, data);
export const validateWorkOrder = (data: unknown) => validateWithSchema(workOrderSchema, data);
export const validateChecklistItem = (data: unknown) => validateWithSchema(updateChecklistItemSchema, data);
