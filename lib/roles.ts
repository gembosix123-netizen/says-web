import { Role } from '@/types';

const ROLE_MAP: Record<string, Role> = {
  'main admin': 'Super Admin',
  'super admin': 'Super Admin',
  founder: 'Super Admin',
  admin: 'Admin',
  sales: 'Sales',
  merchandiser: 'Merchandiser',
};

export function normalizeRole(role?: string | null): string {
  if (!role) return '';

  const normalized = String(role)
    .trim()
    .replace(/[_-]/g, ' ')
    .toLowerCase();

  return ROLE_MAP[normalized] ?? role.trim();
}
