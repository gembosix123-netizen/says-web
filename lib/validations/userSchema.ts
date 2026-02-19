import { z } from 'zod';

// Allowed values
const ALLOWED_ROLES = ['Main Admin', 'Admin', 'Sales', 'Merchandiser'] as const;
const ALLOWED_BRANCHES = ['HQ', 'Kota Kinabalu', 'Kinabatangan'] as const;

// Custom error messages in Bahasa Melayu
const errorMessages = {
  required: 'Wajib diisi',
  invalidEmail: 'Format email tidak sah',
  invalidPhone: 'Format nombor telefon tidak sah',
  minLength: (min: number) => `Minimum ${min} aksara diperlukan`,
  maxLength: (max: number) => `Maksimum ${max} aksara sahaja`,
  invalidRole: 'Peranan tidak sah',
  invalidBranch: 'Cawangan tidak sah',
  invalidFormat: 'Format tidak sah',
};

// ===================================
// Login Schema
// ===================================
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Nama pengguna wajib diisi')
    .trim(),
  password: z
    .string()
    .min(1, 'Kata laluan wajib diisi')
});

export type LoginInput = z.infer<typeof loginSchema>;

// ===================================
// User Registration/Creation Schema
// ===================================
export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama penuh wajib diisi')
    .max(100, 'Nama penuh ' + errorMessages.maxLength(100))
    .trim(),
  username: z
    .string()
    .min(3, errorMessages.minLength(3))
    .max(50, errorMessages.maxLength(50))
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]+$/, 'Nama pengguna hanya boleh mengandungi huruf kecil, nombor, - dan _'),
  password: z
    .string()
    .min(6, 'Kata laluan ' + errorMessages.minLength(6))
    .max(100, errorMessages.maxLength(100)),
  role: z.enum(ALLOWED_ROLES),
  branch: z.enum(ALLOWED_BRANCHES),
  commissionRate: z
    .number()
    .min(0, 'Kadar komisen tidak boleh negatif')
    .max(1, 'Kadar komisen maksimum 100%')
    .optional()
    .nullable()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ===================================
// Update User Schema
// ===================================
export const updateUserSchema = z.object({
  id: z.string().min(1, 'ID pengguna wajib diisi'),
  name: z
    .string()
    .min(1, 'Nama penuh wajib diisi')
    .max(100, errorMessages.maxLength(100))
    .trim()
    .optional(),
  username: z
    .string()
    .min(3, errorMessages.minLength(3))
    .max(50, errorMessages.maxLength(50))
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]+$/, 'Nama pengguna hanya boleh mengandungi huruf kecil, nombor, - dan _')
    .optional(),
  password: z
    .string()
    .min(6, errorMessages.minLength(6))
    .max(100, errorMessages.maxLength(100))
    .optional(),
  role: z.enum(ALLOWED_ROLES).optional(),
  branch: z.enum(ALLOWED_BRANCHES).optional(),
  commissionRate: z
    .number()
    .min(0, 'Kadar komisen tidak boleh negatif')
    .max(1, 'Kadar komisen maksimum 100%')
    .optional()
    .nullable(),
  isActive: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ===================================
// Change Password Schema
// ===================================
export const changePasswordSchema = z.object({
  userId: z.string().min(1, 'ID pengguna wajib diisi'),
  currentPassword: z.string().min(1, 'Kata laluan semasa wajib diisi'),
  newPassword: z
    .string()
    .min(6, 'Kata laluan baru ' + errorMessages.minLength(6))
    .max(100, errorMessages.maxLength(100)),
  confirmPassword: z.string().min(1, 'Sila sahkan kata laluan baru')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Kata laluan tidak sepadan',
  path: ['confirmPassword']
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
