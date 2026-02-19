import { z } from 'zod';

// Custom error messages in Bahasa Melayu
const errorMessages = {
  required: 'Wajib diisi',
  minValue: (min: number) => `Nilai minimum ${min}`,
  maxValue: (max: number) => `Nilai maksimum ${max}`,
  minLength: (min: number) => `Minimum ${min} aksara diperlukan`,
  maxLength: (max: number) => `Maksimum ${max} aksara sahaja`,
  invalidFormat: 'Format tidak sah',
};

// ===================================
// Create Product Schema
// ===================================
export const createProductSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama produk wajib diisi')
    .max(200, 'Nama produk ' + errorMessages.maxLength(200))
    .trim(),
  code: z
    .string()
    .max(50, 'Kod produk ' + errorMessages.maxLength(50))
    .trim()
    .optional()
    .nullable(),
  sku: z
    .string()
    .min(1, 'SKU wajib diisi')
    .max(100, 'SKU ' + errorMessages.maxLength(100))
    .trim(),
  price: z
    .number()
    .min(0, 'Harga tidak boleh negatif')
    .max(999999.99, 'Harga terlalu tinggi'),
  unit: z
    .string()
    .max(20, 'Unit ' + errorMessages.maxLength(20))
    .trim()
    .default('pkt'),
  category: z
    .string()
    .max(50, 'Kategori ' + errorMessages.maxLength(50))
    .trim()
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, 'Penerangan ' + errorMessages.maxLength(500))
    .trim()
    .optional()
    .nullable(),
  barcode: z
    .string()
    .max(50, 'Barcode ' + errorMessages.maxLength(50))
    .trim()
    .optional()
    .nullable(),
  isActive: z.boolean().default(true)
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ===================================
// Update Product Schema
// ===================================
export const updateProductSchema = z.object({
  id: z.string().min(1, 'ID produk wajib diisi'),
  name: z
    .string()
    .min(1, 'Nama produk wajib diisi')
    .max(200, errorMessages.maxLength(200))
    .trim()
    .optional(),
  code: z
    .string()
    .max(50, errorMessages.maxLength(50))
    .trim()
    .optional()
    .nullable(),
  sku: z
    .string()
    .max(100, errorMessages.maxLength(100))
    .trim()
    .optional(),
  price: z
    .number()
    .min(0, 'Harga tidak boleh negatif')
    .max(999999.99, 'Harga terlalu tinggi')
    .optional(),
  unit: z
    .string()
    .max(20, errorMessages.maxLength(20))
    .trim()
    .optional(),
  category: z
    .string()
    .max(50, errorMessages.maxLength(50))
    .trim()
    .optional()
    .nullable(),
  description: z
    .string()
    .max(500, errorMessages.maxLength(500))
    .trim()
    .optional()
    .nullable(),
  barcode: z
    .string()
    .max(50, errorMessages.maxLength(50))
    .trim()
    .optional()
    .nullable(),
  isActive: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ===================================
// Product Query Schema
// ===================================
export const productQuerySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
});

export type ProductQueryInput = z.infer<typeof productQuerySchema>;
