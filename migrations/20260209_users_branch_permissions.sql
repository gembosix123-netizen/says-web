-- ============================================================================
-- Users Branch-Based Access Control & Permission Management Migration
-- ============================================================================
-- This migration implements:
-- 1. Users table with branch assignment
-- 2. Row-Level Security (RLS) policies for data segregation
-- 3. Performance indexes on branch & role columns
-- 4. Audit logging support
--
-- Branch Structure:
-- - Kota Kinabalu: Regional office for KB area
-- - Kinabatangan: Regional office for KB area
-- - HQ: Headquarters / Main Admin only
--
-- Roles & Permissions:
-- - Main Admin: Can access and manage all data across all branches (HQ)
-- - Admin: Regional admin - can only manage users and sales from their branch
-- - Sales: Sales staff - can only see/manage their own data

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,  -- Should be hashed with bcrypt in production
  role TEXT NOT NULL CHECK (role IN ('Main Admin', 'Admin', 'Sales')),
  branch TEXT NOT NULL CHECK (branch IN ('Kota Kinabalu', 'Kinabatangan', 'HQ')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_branch_for_admin CHECK (
    role IN ('Main Admin', 'Sales') OR branch IN ('Kota Kinabalu', 'Kinabatangan')
  ),
  CONSTRAINT main_admin_only_hq CHECK (
    role = 'Main Admin' OR branch != 'HQ'
  )
);

COMMENT ON TABLE users IS 'All system users with branch assignment and role-based access control';
COMMENT ON COLUMN users.role IS 'Main Admin (HQ only), Admin (regional), or Sales (staff)';
COMMENT ON COLUMN users.branch IS 'Branch/office assignment: Kota Kinabalu, Kinabatangan, or HQ';

-- ============================================================================
-- 2. PERFORMANCE INDEXES
-- ============================================================================
-- Critical indexes for fast queries with branch filtering
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_branch_role ON users(branch, role);  -- Composite index
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Indexes for sales tables (split by branch)
CREATE INDEX IF NOT EXISTS idx_sales_kk_branch ON sales_kota_kinabalu(branch);
CREATE INDEX IF NOT EXISTS idx_sales_kk_user_id ON sales_kota_kinabalu(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_kk_created_at ON sales_kota_kinabalu(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_kb_branch ON sales_kinabatangan(branch);
CREATE INDEX IF NOT EXISTS idx_sales_kb_user_id ON sales_kinabatangan(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_kb_created_at ON sales_kinabatangan(created_at DESC);

-- ============================================================================
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "main_admin_all_users" ON users;
DROP POLICY IF EXISTS "admin_own_branch" ON users;
DROP POLICY IF EXISTS "sales_own_profile" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;

-- SELECT Policies
CREATE POLICY "main_admin_all_users" ON users
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Main Admin'
  );

CREATE POLICY "admin_own_branch" ON users
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Admin'
    AND branch = (SELECT branch FROM users WHERE id = auth.uid())
  );

CREATE POLICY "sales_own_profile" ON users
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Sales'
    AND id = auth.uid()
  );

-- INSERT Policy: Only admins can create users
CREATE POLICY "users_insert_policy" ON users
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('Main Admin', 'Admin')
  );

-- UPDATE Policy: Admins can update users in their branch
CREATE POLICY "users_update_policy" ON users
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Main Admin'
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'Admin'
      AND branch = (SELECT branch FROM users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Main Admin'
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'Admin'
      AND branch = (SELECT branch FROM users WHERE id = auth.uid())
    )
  );

-- DELETE Policy: Only admins can delete users
CREATE POLICY "users_delete_policy" ON users
  FOR DELETE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Main Admin'
    OR (
      (SELECT role FROM users WHERE id = auth.uid()) = 'Admin'
      AND branch = (SELECT branch FROM users WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- 4. SALES TABLES RLS
-- ============================================================================
-- Enable RLS on sales tables
ALTER TABLE sales_kota_kinabalu ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_kinabatangan ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "kk_admin_sales" ON sales_kota_kinabalu;
DROP POLICY IF EXISTS "kb_admin_sales" ON sales_kinabatangan;

-- KK Sales: Only accessible by Kota Kinabalu branch users and Main Admin
CREATE POLICY "kk_admin_sales" ON sales_kota_kinabalu
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Main Admin'
    OR (SELECT branch FROM users WHERE id = auth.uid()) = 'Kota Kinabalu'
  );

-- KB Sales: Only accessible by Kinabatangan branch users and Main Admin
CREATE POLICY "kb_admin_sales" ON sales_kinabatangan
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'Main Admin'
    OR (SELECT branch FROM users WHERE id = auth.uid()) = 'Kinabatangan'
  );

-- ============================================================================
-- 5. AUDIT LOG TABLE (Optional but recommended)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  user_branch TEXT,
  target_entity TEXT,
  target_id TEXT,
  target_branch TEXT,
  status TEXT CHECK (status IN ('success', 'denied')),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_branch ON audit_logs(user_branch);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- 6. SEED DATA (Optional)
-- ============================================================================
-- Insert default users (if needed for testing)
INSERT INTO users (full_name, username, password, role, branch)
VALUES 
  ('Main Administrator', 'founder', 'Founder2024!', 'Main Admin', 'HQ'),
  ('Admin Kota Kinabalu', 'admin_kk', 'AdminKK2024!', 'Admin', 'Kota Kinabalu'),
  ('Admin Kinabatangan', 'admin_kb', 'AdminKB2024!', 'Admin', 'Kinabatangan'),
  ('Sales Kota Kinabalu', 'sales_kk', 'SalesKK2024!', 'Sales', 'Kota Kinabalu'),
  ('Sales Kinabatangan', 'sales_kb', 'SalesKB2024!', 'Sales', 'Kinabatangan')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. PASSWORD HASHING:
--    In production, use bcrypt or Argon2 for password hashing.
--    Example:
--      UPDATE users SET password = crypt(password, gen_salt('bf', 4));
--
-- 2. RLS PERFORMANCE:
--    RLS adds a small overhead to each query. For high-traffic systems,
--    consider combining RLS with application-level filtering.
--
-- 3. BACKUP & RECOVERY:
--    Regularly backup RLS policies along with data.
--    Test recovery procedures in development environment.
--
-- 4. AUDIT TRAIL:
--    Implement triggers on audit_logs table to auto-log all user changes:
--      UPDATE users -> INSERT INTO audit_logs
--      DELETE from users -> INSERT INTO audit_logs (with old data backup)
--
-- 5. SCALABILITY:
--    With 100+ users per branch:
--    - Composite indexes (branch, role) improve query speed
--    - Implement pagination in user listing (LIMIT/OFFSET)
--    - Use materialized views for reports if needed
