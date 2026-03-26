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
 * Get the appropriate sales table name based on branch
 */
export function getSalesTableByBranch(branch: Branch): 'sales_kota_kinabalu' | 'sales_kinabatangan' {
  switch (branch) {
    case 'Kota Kinabalu':
      return 'sales_kota_kinabalu';
    case 'Kinabatangan':
      return 'sales_kinabatangan';
    default:
      throw new Error(`Invalid branch: ${branch}`);
  }
}

/**
 * Get the appropriate customers table name based on branch
 * - Kota Kinabalu -> customers_kb
 * - Kinabatangan -> customers_kk
 */
export function getCustomersTableByBranch(branch?: Branch): 'customers_kb' | 'customers_kk' {
  if (!branch || branch === 'Kota Kinabalu' || branch === 'KB') {
    return 'customers_kb';
  }
  if (branch === 'Kinabatangan' || branch === 'KK') {
    return 'customers_kk';
  }
  // Default to KB if branch is unclear
  return 'customers_kb';
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
