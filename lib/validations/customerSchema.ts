import { z } from 'zod';

// Customer types
const CUSTOMER_TYPES = ['retail', 'wholesale', 'vip'] as const;
const CUSTOMER_STATUS = ['active', 'inactive', 'blocked'] as const;

// Custom error messages in Bahasa Melayu
const errorMessages = {
  required: 'Wajib diisi',
  invalidEmail: 'Format email tidak sah',
  invalidPhone: 'Format nombor telefon tidak sah',
  minLength: (min: number) => `Minimum ${min} aksara diperlukan`,
  maxLength: (max: number) => `Maksimum ${max} aksara sahaja`,
  invalidFormat: 'Format tidak sah',
};

// ===================================
// Create Customer Schema
// ===================================
export const createCustomerSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama pelanggan wajib diisi')
    .max(200, 'Nama pelanggan ' + errorMessages.maxLength(200))
    .trim(),
  phone: z
    .string()
    .max(20, 'Nombor telefon ' + errorMessages.maxLength(20))
    .regex(/^[0-9\s\-\+\(\)]*$/, errorMessages.invalidPhone)
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .email(errorMessages.invalidEmail)
    .max(100, 'Email ' + errorMessages.maxLength(100))
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z
    .string()
    .max(300, 'Alamat ' + errorMessages.maxLength(300))
    .trim()
    .optional()
    .nullable(),
  city: z
    .string()
    .max(100, 'Bandar ' + errorMessages.maxLength(100))
    .trim()
    .optional()
    .nullable(),
  state: z
    .string()
    .max(100, 'Negeri ' + errorMessages.maxLength(100))
    .trim()
    .optional()
    .nullable(),
  postalCode: z
    .string()
    .max(10, 'Poskod ' + errorMessages.maxLength(10))
    .regex(/^[0-9]{5}$/, 'Poskod mesti 5 digit')
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  branch: z
    .string()
    .min(1, 'Cawangan wajib diisi')
    .trim(),
  type: z
    .enum(CUSTOMER_TYPES)
    .default('retail'),
  status: z
    .enum(CUSTOMER_STATUS)
    .default('active'),
  creditLimit: z
    .number()
    .min(0, 'Had kredit tidak boleh negatif')
    .max(999999999, 'Had kredit terlalu tinggi')
    .default(100000),
  credits: z
    .number()
    .default(0),
  notes: z
    .string()
    .max(500, 'Nota ' + errorMessages.maxLength(500))
    .trim()
    .optional()
    .nullable(),
  isActive: z.boolean().default(true)
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// ===================================
// Update Customer Schema
// ===================================
export const updateCustomerSchema = z.object({
  id: z.string().min(1, 'ID pelanggan wajib diisi'),
  name: z
    .string()
    .min(1, 'Nama pelanggan wajib diisi')
    .max(200, errorMessages.maxLength(200))
    .trim()
    .optional(),
  phone: z
    .string()
    .max(20, errorMessages.maxLength(20))
    .regex(/^[0-9\s\-\+\(\)]*$/, errorMessages.invalidPhone)
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .email(errorMessages.invalidEmail)
    .max(100, errorMessages.maxLength(100))
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z
    .string()
    .max(300, errorMessages.maxLength(300))
    .trim()
    .optional()
    .nullable(),
  city: z
    .string()
    .max(100, errorMessages.maxLength(100))
    .trim()
    .optional()
    .nullable(),
  state: z
    .string()
    .max(100, errorMessages.maxLength(100))
    .trim()
    .optional()
    .nullable(),
  postalCode: z
    .string()
    .max(10, errorMessages.maxLength(10))
    .regex(/^[0-9]{5}$/, 'Poskod mesti 5 digit')
    .trim()
    .optional()
    .nullable()
    .or(z.literal('')),
  branch: z
    .string()
    .trim()
    .optional(),
  type: z
    .enum(CUSTOMER_TYPES)
    .optional(),
  status: z
    .enum(CUSTOMER_STATUS)
    .optional(),
  creditLimit: z
    .number()
    .min(0, 'Had kredit tidak boleh negatif')
    .max(999999999, 'Had kredit terlalu tinggi')
    .optional(),
  credits: z
    .number()
    .optional(),
  totalPurchases: z
    .number()
    .min(0)
    .optional(),
  totalSpent: z
    .number()
    .min(0)
    .optional(),
  notes: z
    .string()
    .max(500, errorMessages.maxLength(500))
    .trim()
    .optional()
    .nullable(),
  isActive: z.boolean().optional()
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ===================================
// Customer Query Schema
// ===================================
export const customerQuerySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  branch: z.string().optional(),
  type: z.enum(CUSTOMER_TYPES).optional(),
  status: z.enum(CUSTOMER_STATUS).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
});

export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
