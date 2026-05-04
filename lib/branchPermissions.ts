/**
 * Branch-based Access Control Utilities
 * Ensures data segregation between branches: Kota Kinabalu & Kinabatangan
 */

export type UserRole = 'Main Admin' | 'Admin' | 'Sales' | 'Merchandiser';
export type Branch = 'Kota Kinabalu' | 'Kinabatangan' | 'HQ';

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  branch: Branch;
}

/**
 * Check if a user can access data from a specific branch
 * - Main Admin: can access all branches
 * - Admin: can only access their own branch
 * - Sales: can only access their own data
 * - Merchandiser: can only access their own data
 */
export function canAccessBranch(
  userRole: UserRole,
  userBranch: Branch,
  targetBranch: Branch
): boolean {
  // Main Admin dapat akses semua
  if (userRole === 'Main Admin') return true;
  
  // Admin hanya access branch mereka
  if (userRole === 'Admin') return userBranch === targetBranch;
  
  // Sales dan Merchandiser tidak boleh access user management
  return false;
}

/**
 * Check if user can perform sales transactions
 * Only Sales, Admin, and Main Admin can create sales
 * Merchandiser CANNOT perform sales
 */
export function canPerformSales(role: UserRole): boolean {
  return role === 'Sales' || role === 'Admin' || role === 'Main Admin';
}

/**
 * Check if user can perform store audits
 * Both Merchandiser and Sales can do audits
 * Admin and Main Admin can also audit
 */
export function canPerformAudit(role: UserRole): boolean {
  return role === 'Merchandiser' || role === 'Sales' || role === 'Admin' || role === 'Main Admin';
}

/**
 * Get the appropriate sales table name based on branch.
 * @deprecated All sales data is now stored in the single 'sales_transactions'
 * table with a branch column. Use sales_transactions with .eq('branch', ...).
 * This function is kept only for backward-compat with any callers not yet updated.
 */
export function getSalesTableByBranch(_branch: Branch): 'sales_transactions' {
  return 'sales_transactions';
}

/**
 * Get the appropriate customers table name based on branch
 * - Kinabatangan / KB -> customers_kb
 * - Kota Kinabalu / KK -> customers_kk
 */
export function getCustomersTableByBranch(branch?: string): 'customers_kb' | 'customers_kk' {
  const normalized = (branch || '').trim().toLowerCase();

  if (!normalized) {
    return 'customers_kb';
  }

  // KB admin/branch must write to customers_kb.
  if (normalized === 'kinabatangan' || normalized === 'kb') {
    return 'customers_kb';
  }

  // KK admin/branch must write to customers_kk.
  if (normalized === 'kota kinabalu' || normalized === 'kk') {
    return 'customers_kk';
  }

  // Tolerate variant spellings/labels from legacy data.
  if (normalized.includes('kinabatangan')) {
    return 'customers_kb';
  }
  if (normalized.includes('kota kinabalu')) {
    return 'customers_kk';
  }

  return 'customers_kb';
}

/** Lowercase, trim, collapse spaces — for comparing branch labels from DB vs session. */
export function normalizeBranchLabel(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * True when two branch labels refer to the same operating branch.
 * Treats KK ↔ Kota Kinabalu and KB ↔ Kinabatangan as equivalent (legacy/alternate spellings).
 */
function isKotaKinabaluBucket(n: string): boolean {
  if (!n) return false;
  if (n === 'kota kinabalu') return true;
  if (n.includes('kota') && n.includes('kinabalu')) return true;
  return /\bkk\b/.test(n);
}

function isKinabatanganBucket(n: string): boolean {
  if (!n) return false;
  if (n === 'kinabatangan') return true;
  if (n.includes('kinabatangan')) return true;
  return /\bkb\b/.test(n);
}

export function branchLabelsEquivalent(a?: string | null, b?: string | null): boolean {
  const left = normalizeBranchLabel(a);
  const right = normalizeBranchLabel(b);
  if (!right || right === 'all') return true;
  if (!left) return false;
  if (left === right) return true;

  if (isKotaKinabaluBucket(left) && isKotaKinabaluBucket(right)) return true;
  if (isKinabatanganBucket(left) && isKinabatanganBucket(right)) return true;

  return false;
}

/**
 * PostgREST `.or()` fragment to fetch rows when session branch may not match DB spelling.
 * Returns null when a single `ilike(normalized)` is enough.
 */
export function buildSalesBranchOrFilter(sessionBranch: string): string | null {
  const n = normalizeBranchLabel(sessionBranch);
  if (n === 'kota kinabalu' || n === 'kk') {
    return [
      'branch.ilike.KK',
      'branch.ilike.kk',
      'branch.ilike."Kota Kinabalu"',
      'branch.ilike."kota kinabalu"',
    ].join(',');
  }
  if (n === 'kinabatangan' || n === 'kb') {
    return [
      'branch.ilike.KB',
      'branch.ilike.kb',
      'branch.ilike.Kinabatangan',
      'branch.ilike.kinabatangan',
    ].join(',');
  }
  return null;
}

/**
 * Filter data query by user's branch
 * Used in API routes to enforce data segregation at query level
 */
export function buildBranchFilter(
  userRole: UserRole,
  userBranch: Branch
): { filterByBranch: boolean; branchValue?: Branch } {
  // Main Admin sees all (no filter)
  if (userRole === 'Main Admin') {
    return { filterByBranch: false };
  }
  
  // Admin, Sales, and Merchandiser see only their branch
  return {
    filterByBranch: true,
    branchValue: userBranch,
  };
}

/**
 * Validate branch assignment
 * Ensures Admin can only assign users to their branch
 */
export function validateBranchAssignment(
  creatorRole: UserRole,
  creatorBranch: Branch,
  targetBranch: Branch
): boolean {
  // Main Admin dapat assign ke mana-mana
  if (creatorRole === 'Main Admin') return true;
  
  // Admin hanya boleh assign ke branch mereka
  if (creatorRole === 'Admin') return creatorBranch === targetBranch;
  
  return false;
}

/**
 * Validate role escalation
 * Prevents users dari creating higher-privilege roles
 */
export function validateRoleCreation(
  creatorRole: UserRole,
  targetRole: UserRole
): boolean {
  // Main Admin dapat create semua role
  if (creatorRole === 'Main Admin') return true;
  
  // Admin hanya boleh create Sales dan Merchandiser, tidak boleh create Admin atau Main Admin
  if (creatorRole === 'Admin') return targetRole === 'Sales' || targetRole === 'Merchandiser';
  
  // Sales dan Merchandiser tidak boleh create user
  return false;
}

/**
 * Get accessible branches for a user
 * Used for dropdown filtering in UI
 */
export function getAccessibleBranches(userRole: UserRole, userBranch: Branch): Branch[] {
  // Main Admin dapat access semua
  if (userRole === 'Main Admin') {
    return ['Kota Kinabalu', 'Kinabatangan', 'HQ'];
  }
  
  // Admin hanya access branch mereka
  if (userRole === 'Admin') {
    return [userBranch];
  }
  
  // Sales dan Merchandiser hanya access branch mereka (untuk display only)
  return [userBranch];
}

/**
 * Log audit trail untuk branch access
 */
export interface AuditLog {
  action: 'create' | 'read' | 'update' | 'delete';
  userId: string;
  userBranch: Branch;
  targetEntity: 'user' | 'sale' | 'product' | 'store';
  targetId: string;
  targetBranch?: Branch;
  timestamp: ISO8601String;
  status: 'success' | 'denied';
  reason?: string;
}

export type ISO8601String = string; // YYYY-MM-DDTHH:mm:ssZ

export function createAuditLog(
  action: AuditLog['action'],
  userId: string,
  userBranch: Branch,
  targetEntity: AuditLog['targetEntity'],
  targetId: string,
  status: 'success' | 'denied',
  targetBranch?: Branch,
  reason?: string
): AuditLog {
  return {
    action,
    userId,
    userBranch,
    targetEntity,
    targetId,
    targetBranch,
    timestamp: new Date().toISOString() as ISO8601String,
    status,
    reason,
  };
}
