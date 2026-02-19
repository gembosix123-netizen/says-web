import { z } from 'zod';

// Order status
const ORDER_STATUS = ['pending', 'confirmed', 'processing', 'completed', 'cancelled', 'failed'] as const;
const ORDER_TYPES = ['purchase', 'sale', 'return', 'transfer'] as const;

// Custom error messages in Bahasa Melayu
const errorMessages = {
  required: 'Wajib diisi',
  minValue: (min: number) => `Nilai minimum ${min}`,
  invalidFormat: 'Format tidak sah',
};

// ===================================
// Order Item Schema
// ===================================
export const orderItemSchema = z.object({
  productId: z.string().min(1, 'ID produk wajib diisi'),
  productName: z.string().min(1, 'Nama produk wajib diisi'),
  quantity: z
    .number()
    .int('Kuantiti mesti nombor bulat')
    .min(1, 'Kuantiti minimum 1'),
  price: z
    .number()
    .min(0, 'Harga tidak boleh negatif'),
  subtotal: z
    .number()
    .min(0, 'Subtotal tidak boleh negatif'),
  unit: z.string().default('pkt'),
  discount: z.number().min(0).default(0)
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

// ===================================
// Create Order Schema
// ===================================
export const createOrderSchema = z.object({
  branch: z
    .string()
    .min(1, 'Cawangan wajib diisi')
    .trim(),
  orderType: z.enum(ORDER_TYPES).default('purchase'),
  customerId: z
    .string()
    .optional()
    .nullable(),
  customerName: z
    .string()
    .max(200, 'Nama pelanggan terlalu panjang')
    .trim()
    .optional()
    .nullable(),
  supplierId: z
    .string()
    .optional()
    .nullable(),
  supplierName: z
    .string()
    .max(200, 'Nama pembekal terlalu panjang')
    .trim()
    .optional()
    .nullable(),
  items: z
    .array(orderItemSchema)
    .min(1, 'Sekurang-kurangnya 1 item diperlukan')
    .max(500, 'Maksimum 500 item'),
  totalAmount: z
    .number()
    .min(0, 'Jumlah tidak boleh negatif')
    .max(999999999, 'Jumlah terlalu tinggi'),
  discount: z
    .number()
    .min(0, 'Diskaun tidak boleh negatif')
    .default(0),
  tax: z
    .number()
    .min(0, 'Cukai tidak boleh negatif')
    .default(0),
  shippingCost: z
    .number()
    .min(0, 'Kos penghantaran tidak boleh negatif')
    .default(0),
  status: z.enum(ORDER_STATUS).default('pending'),
  orderDate: z
    .string()
    .datetime('Format tarikh tidak sah')
    .optional(),
  expectedDeliveryDate: z
    .string()
    .datetime('Format tarikh tidak sah')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, 'Nota terlalu panjang')
    .trim()
    .optional()
    .nullable(),
  createdBy: z
    .string()
    .optional()
    .nullable()
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ===================================
// Update Order Schema
// ===================================
export const updateOrderSchema = z.object({
  id: z.string().min(1, 'ID pesanan wajib diisi'),
  status: z.enum(ORDER_STATUS).optional(),
  items: z.array(orderItemSchema).optional(),
  totalAmount: z
    .number()
    .min(0, 'Jumlah tidak boleh negatif')
    .optional(),
  discount: z
    .number()
    .min(0, 'Diskaun tidak boleh negatif')
    .optional(),
  tax: z
    .number()
    .min(0, 'Cukai tidak boleh negatif')
    .optional(),
  shippingCost: z
    .number()
    .min(0, 'Kos penghantaran tidak boleh negatif')
    .optional(),
  expectedDeliveryDate: z
    .string()
    .datetime('Format tarikh tidak sah')
    .optional()
    .nullable(),
  actualDeliveryDate: z
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

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

// ===================================
// Order Query Schema
// ===================================
export const orderQuerySchema = z.object({
  id: z.string().optional(),
  branch: z.string().optional(),
  orderType: z.enum(ORDER_TYPES).optional(),
  customerId: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(ORDER_STATUS).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
});

export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
