import { z } from 'zod';

// Payment methods and status
const PAYMENT_METHODS = ['cash', 'bill_to_bill', 'bank_transfer', 'qr_code', 'card', 'ewallet', 'credit'] as const;
const PAYMENT_STATUS = ['paid', 'pending', 'partial', 'cancelled'] as const;

// Custom error messages in Bahasa Melayu
const errorMessages = {
  required: 'Wajib diisi',
  minValue: (min: number) => `Nilai minimum ${min}`,
  maxValue: (max: number) => `Nilai maksimum ${max}`,
  invalidFormat: 'Format tidak sah',
};

// ===================================
// Sale Item Schema
// ===================================
export const saleItemSchema = z.object({
  productId: z.string().min(1, 'ID produk wajib diisi'),
  name: z.string().min(1, 'Nama produk wajib diisi'),
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
  discount: z.number().min(0).default(0),
  type: z.enum(['sale', 'return', 'exchange', 'foc']).default('sale')
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;

// ===================================
// Create Sale Schema
// ===================================
export const createSaleSchema = z.object({
  branch: z
    .string()
    .min(1, 'Cawangan wajib diisi')
    .trim(),
  invoice: z
    .string()
    .optional()
    .nullable(),
  items: z
    .array(saleItemSchema)
    .min(1, 'Sekurang-kurangnya 1 item diperlukan')
    .max(100, 'Maksimum 100 item setiap transaksi'),
  total_amount: z
    .number()
    .min(0, 'Jumlah tidak boleh negatif')
    .max(999999999, 'Jumlah terlalu tinggi'),
  payment_method: z
    .enum(PAYMENT_METHODS)
    .default('cash'),
  payment_status: z
    .enum(PAYMENT_STATUS)
    .optional(),
  customer_id: z
    .string()
    .optional()
    .nullable(),
  customer_name: z
    .string()
    .max(200, 'Nama pelanggan terlalu panjang')
    .trim()
    .optional()
    .nullable(),
  salesman_id: z
    .string()
    .optional()
    .nullable(),
  salesman_name: z
    .string()
    .optional()
    .nullable(),
  return_amount: z
    .number()
    .min(0, 'Jumlah pulangan tidak boleh negatif')
    .default(0),
  exchange_amount: z
    .number()
    .min(0, 'Jumlah tukar tidak boleh negatif')
    .default(0),
  foc_amount: z
    .number()
    .min(0, 'Jumlah FOC tidak boleh negatif')
    .default(0),
  discount: z
    .number()
    .min(0, 'Diskaun tidak boleh negatif')
    .max(100, 'Diskaun maksimum 100%')
    .default(0),
  notes: z
    .string()
    .max(500, 'Nota terlalu panjang')
    .trim()
    .optional()
    .nullable(),
  // Payment reference numbers — required depends on payment_method (validated in API/frontend)
  receipt_no: z
    .string()
    .max(100)
    .trim()
    .optional()
    .nullable(),
  billing_ref_no: z
    .string()
    .max(100)
    .trim()
    .optional()
    .nullable(),
  transfer_ref_no: z
    .string()
    .max(100)
    .trim()
    .optional()
    .nullable(),
  qr_txn_ref_no: z
    .string()
    .max(100)
    .trim()
    .optional()
    .nullable(),
  receipt_url: z
    .string()
    .url('URL resit tidak sah')
    .optional()
    .nullable()
    .or(z.literal('')),
  proof_photo_url: z
    .string()
    .url('URL gambar tidak sah')
    .optional()
    .nullable()
    .or(z.literal('')),
  proof_photo_urls: z
    .array(z.string().url('URL gambar tidak sah'))
    .max(4, 'Maksimum 4 gambar bukti pembayaran')
    .optional()
    .nullable(),
  check_in_time: z
    .string()
    .datetime('Format tarikh tidak sah')
    .optional()
    .nullable(),
  gps_lat: z
    .number()
    .min(-90, 'Latitude tidak sah')
    .max(90, 'Latitude tidak sah')
    .optional()
    .nullable(),
  gps_long: z
    .number()
    .min(-180, 'Longitude tidak sah')
    .max(180, 'Longitude tidak sah')
    .optional()
    .nullable()
}).refine(
  (data) => {
    // If payment method is credit, customer_id is required
    if (data.payment_method === 'credit' && !data.customer_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Pelanggan diperlukan untuk pembayaran kredit',
    path: ['customer_id']
  }
).refine(
  (data) => {
    if (data.payment_method !== 'bank_transfer' && data.payment_method !== 'qr_code') {
      return true;
    }

    const hasSingleProof = Boolean(String(data.proof_photo_url || data.receipt_url || '').trim());
    const hasMultipleProofs = Array.isArray(data.proof_photo_urls) && data.proof_photo_urls.length > 0;

    return hasSingleProof || hasMultipleProofs;
  },
  {
    message: 'Bukti pembayaran wajib untuk bank transfer atau QR code',
    path: ['proof_photo_urls']
  }
).refine(
  (data) => {
    // Total should match sum of items
    const itemsTotal = data.items.reduce((sum, item) => sum + item.subtotal, 0);
    const calculatedTotal = itemsTotal - data.discount + data.return_amount + data.exchange_amount + data.foc_amount;
    // Allow small floating point differences
    return Math.abs(calculatedTotal - data.total_amount) < 0.01;
  },
  {
    message: 'Jumlah tidak sepadan dengan item',
    path: ['total_amount']
  }
);

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

// ===================================
// Collect Payment Schema
// ===================================
export const collectPaymentSchema = z.object({
  saleId: z.string().min(1, 'ID jualan wajib diisi'),
  customerId: z.string().min(1, 'ID pelanggan wajib diisi'),
  amount: z
    .number()
    .min(0.01, 'Jumlah minimum RM 0.01')
    .max(999999999, 'Jumlah terlalu tinggi'),
  payment_method: z
    .enum(PAYMENT_METHODS)
    .default('cash'),
  reference_number: z
    .string()
    .max(100, 'Nombor rujukan terlalu panjang')
    .trim()
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, 'Nota terlalu panjang')
    .trim()
    .optional()
    .nullable(),
  receipt_url: z
    .string()
    .url('URL resit tidak sah')
    .optional()
    .nullable()
    .or(z.literal(''))
});

export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;

// ===================================
// Sale Query Schema
// ===================================
export const saleQuerySchema = z.object({
  id: z.string().optional(),
  invoice: z.string().optional(),
  branch: z.string().optional(),
  customerId: z.string().optional(),
  salesmanId: z.string().optional(),
  payment_method: z.enum(PAYMENT_METHODS).optional(),
  payment_status: z.enum(PAYMENT_STATUS).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0)
});

export type SaleQueryInput = z.infer<typeof saleQuerySchema>;
