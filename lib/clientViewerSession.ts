import { normalizeRole, type NormalizedRole } from '@/lib/roles';

export type ClientViewerInfo = {
  role: NormalizedRole | '';
  branch: string;
};

/**
 * Role/branch for client UI (workflow, branch forms). Tries /api/auth/me first;
 * on failure matches admin layout behaviour by falling back to localStorage `user`.
 */
export async function fetchViewerInfo(): Promise<ClientViewerInfo> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { role?: string; branch?: string };
      return {
        role: normalizeRole(data.role),
        branch: String(data.branch ?? ''),
      };
    }
  } catch {
    // network / parse
  }

  if (typeof window === 'undefined') {
    return { role: '', branch: '' };
  }

  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw) as { role?: string; branch?: string };
      return {
        role: normalizeRole(u.role),
        branch: String(u.branch ?? ''),
      };
    }
  } catch {
    // ignore
  }

  return { role: '', branch: '' };
}
