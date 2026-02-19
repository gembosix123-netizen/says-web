import { z } from 'zod';

// Custom error messages in Bahasa Melayu
const errorMessages = {
  required: 'Wajib diisi',
  minValue: (min: number) => `Nilai minimum ${min}`,
  invalidFormat: 'Format tidak sah',
};

// ===================================
// Inventory Item Schema
// ===================================
export const inventoryItemSchema = z.object({
  productId: z.string().min(1, 'ID produk wajib diisi'),
  productName: z.string().min(1, 'Nama produk wajib diisi'),
  quantity: z
    .number()
    .int('Kuantiti mesti nombor bulat')
    .min(0, 'Kuantiti tidak boleh negatif'),
  unit: z.string().default('pkt'),
  location: z.string().optional().nullable()
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;

// ===================================
// Load Inventory Schema
// ===================================
export const loadInventorySchema = z.object({
  branch: z
    .string()
    .min(1, 'Cawangan wajib diisi')
    .trim(),
  vanId: z
    .string()
    .optional()
    .nullable(),
  userId: z
    .string()
    .optional()
    .nullable(),
  items: z
    .array(inventoryItemSchema)
    .min(1, 'Sekurang-kurangnya 1 item diperlukan')
    .max(500, 'Maksimum 500 item'),
  loadDate: z
    .string()
    .datetime('Format tarikh tidak sah')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, 'Nota terlalu panjang')
    .trim()
    .optional()
    .nullable()
});

export type LoadInventoryInput = z.infer<typeof loadInventorySchema>;

// ===================================
// Update Van Inventory Schema
// ===================================
export const updateVanInventorySchema = z.object({
  vanId: z.string().min(1, 'ID van wajib diisi'),
  branch: z.string().min(1, 'Cawangan wajib diisi'),
  items: z.array(inventoryItemSchema).min(1, 'Sekurang-kurangnya 1 item diperlukan'),
  action: z.enum(['add', 'remove', 'set', 'adjust']).default('set')
});

export type UpdateVanInventoryInput = z.infer<typeof updateVanInventorySchema>;

// ===================================
// Stock Audit Schema
// ===================================
export const stockAuditSchema = z.object({
  branch: z
    .string()
    .min(1, 'Cawangan wajib diisi')
    .trim(),
  auditedBy: z
    .string()
    .min(1, 'Pengaudit wajib diisi'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'ID produk wajib diisi'),
        productName: z.string().min(1, 'Nama produk wajib diisi'),
        expectedQuantity: z.number().int().min(0, 'Kuantiti jangkaan tidak boleh negatif'),
        actualQuantity: z.number().int().min(0, 'Kuantiti sebenar tidak boleh negatif'),
        difference: z.number().int(),
        unit: z.string().default('pkt'),
        reason: z
          .string()
          .max(200, 'Sebab terlalu panjang')
          .optional()
          .nullable()
      })
    )
    .min(1, 'Sekurang-kurangnya 1 item diperlukan'),
  auditDate: z
    .string()
    .datetime('Format tarikh tidak sah')
    .optional(),
  notes: z
    .string()
    .max(500, 'Nota terlalu panjang')
    .trim()
    .optional()
    .nullable()
});

export type StockAuditInput = z.infer<typeof stockAuditSchema>;

// ===================================
// Inventory Query Schema
// ===================================
export const inventoryQuerySchema = z.object({
  branch: z.string().optional(),
  productId: z.string().optional(),
  vanId: z.string().optional(),
  minQuantity: z.number().min(0).optional(),
  maxQuantity: z.number().min(0).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
});

export type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;
