export type NormalizedRole = 'Main Admin' | 'Admin' | 'Sales' | 'Merchandiser' | '';

export function normalizeRole(role: string | null | undefined): NormalizedRole {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'main admin' || value === 'founder' || value === 'owner' || value === 'super admin') return 'Main Admin';
  if (value === 'admin') return 'Admin';
  if (value === 'sales' || value === 'salesman' || value === 'sale') return 'Sales';
  if (value === 'merchandiser') return 'Merchandiser';
  return '';
}
