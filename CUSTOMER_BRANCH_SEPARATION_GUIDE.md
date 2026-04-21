# Customer Branch Separation — Implementation Guide

> **Status:** Production — deployed March 26, 2026  
> **Latest update:** April 1, 2026 (added ownership, district columns, RLS)

## Table Naming Convention

> ⚠️ **Important:** The suffix letters are NOT abbreviations for the branch in the conventional sense. The canonical mapping is:

| Table | Branch | Reason |
|---|---|---|
| `customers_kb` | **Kota Kinabalu** | KB = Kota Kinabalu (local shorthand) |
| `customers_kk` | **Kinabatangan** | KK = Kinabatangan |

Always use `getCustomersTableByBranch(branch)` from `lib/branchPermissions.ts` to resolve — never hardcode the table names.

```typescript
// lib/branchPermissions.ts
export function getCustomersTableByBranch(branch?: string): 'customers_kb' | 'customers_kk' {
  if (!branch || branch === 'Kota Kinabalu' || branch === 'KB') return 'customers_kb';
  if (branch === 'Kinabatangan' || branch === 'KK') return 'customers_kk';
  return 'customers_kb'; // default
}
```

---

## Summary

Complete branch isolation for customers via separate database tables. Ensures no accidental cross-branch customer visibility.

## Changes Made

### 1. Database Migration (New File)
**File:** `migrations/20260326_separate_customers_by_branch.sql`

Creates three new tables:
- `customers_kb` - **Kota Kinabalu** customers (migrated from old `customers` table filtered by branch)
- `customers_kk` - **Kinabatangan** customers (migrated from old `customers` table filtered by branch)
- Archives old `customers` table as `customers_archive` for backup

**Key Actions:**
- Migrates existing customers to appropriate branch tables
- Creates indexes for performance
- Sets up proper permissions

### 2. Helper Function Added
**File:** `lib/branchPermissions.ts`

Added new function:
```typescript
export function getCustomersTableByBranch(branch?: Branch): 'customers_kb' | 'customers_kk'
```

This function:
- Returns the correct table name based on user's branch
- `'Kota Kinabalu'` or `'KB'` → `customers_kb`
- `'Kinabatangan'` or `'KK'` → `customers_kk`
- Defaults to `customers_kb` if branch is undefined/unknown

### 3. Updated API Endpoints

#### `app/api/customers/route.ts`
- **GET**: Now requires authentication and fetches from user's branch table only
- **POST**: Creates customers in the correct branch table
- **PUT**: Updates only customers from user's branch
- **DELETE**: Deletes only customers from user's branch
- Import added: `getCustomersTableByBranch`

#### `app/api/sales/route.ts`
- Updated GET handler to fetch customers from branch-specific table
- Updated POST handler to update customer balance in correct table
- Import added: `getCustomersTableByBranch`

#### `app/api/sales/collect-payment/route.ts`
- Updated customer balance updates to use branch-specific table
- Import added: `getCustomersTableByBranch`

#### `app/api/admin/backdated-import/route.ts`
- Updated customer lookup to search in user's branch table
- Updated GET to return all customers for Main Admin (combining both tables) or branch-specific for Admin
- Import added: `getCustomersTableByBranch`

### 4. Service/Analytics Updates

#### `lib/adminAnalyticsData.ts`
- Updated customer fetching to use `getCustomersTableByBranch`
- Customers are now fetched only from the appropriate branch table
- Import added: `getCustomersTableByBranch`

### 5. Seed Scripts Updated

#### `scripts/seed-supabase.js`
- Updated to insert customers into correct branch table based on customer data
- Reads branch field from customer data, defaults to KB

#### `scripts/run-sales-migration.js`
- Updated to check for both `customers_kb` and `customers_kk` tables

## Security Improvements

### Data Isolation
- ✅ Staff from KB cannot query customers from KK table
- ✅ Staff from KK cannot query customers from KB table
- ✅ Admin users can only see/manage customers from their own branch
- ✅ Main Admin can access customers from all branches

### Query-Level Security
- All API endpoints now validate user's branch
- Queries are directed to the correct table automatically
- No possibility of accidental cross-branch data leaks

### Access Control
- GET `/api/customers`: Requires authentication, returns only user's branch customers
- POST `/api/customers`: Creates in user's branch table only
- PUT `/api/customers`: Updates only if customer exists in user's branch table
- DELETE `/api/customers`: Deletes only if customer exists in user's branch table

## How to Deploy

### Step 1: Run the Migration
1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of `migrations/20260326_separate_customers_by_branch.sql`
4. Execute the migration
5. Verify both `customers_kb` and `customers_kk` tables were created

### Step 2: Verify Data Migration
```sql
-- Check KB customers
SELECT COUNT(*) FROM customers_kb;

-- Check KK customers
SELECT COUNT(*) FROM customers_kk;

-- Verify archive
SELECT COUNT(*) FROM customers_archive;
```

### Step 3: Update Application Code
- All changes are already in the files listed above
- No additional code changes needed
- Just restart the application

### Step 4: Test
1. Log in as KB Admin user
2. Try to fetch customers - should see only KB customers
3. Try to create customer - should save to customers_kb table
4. Log in as KK Admin user
5. Repeat steps - should see only KK customers
6. Log in as Main Admin
7. Verify can see customers from both branches (if endpoint allows)

## Rollback Plan

If needed to revert to single customers table:

1. Rename `customers_archive` back to `customers`:
```sql
ALTER TABLE customers_archive RENAME TO customers;
```

2. Revert all code changes (use git)
3. Restart application

## Testing Checklist

- [ ] Migration completed successfully in Supabase
- [ ] Both `customers_kb` and `customers_kk` tables exist with correct structure
- [ ] Old `customers` table archived
- [ ] Application starts without errors
- [ ] KB admin can fetch customers (see KB only)
- [ ] KK admin can fetch customers (see KK only)
- [ ] KB admin cannot fetch KK customers (error or empty result)
- [ ] KK admin cannot fetch KB customers (error or empty result)
- [ ] Main Admin can fetch all customers (if implemented)
- [ ] Customer creation works (saves to correct branch)
- [ ] Customer update works (updates correct branch)
- [ ] Customer deletion works (deletes from correct branch)
- [ ] Sales endpoints work correctly
- [ ] Payment collection updates correct branch customer

## Future Enhancements

1. Add audit logging to track which user accessed which customers
2. Add cross-branch reporting for Main Admin (if needed)
3. Add customer merge functionality (if customers move between branches)
4. Add customer transfer functionality between branches

## Notes

- Default branch for ambiguous customers is Kota Kinabalu → `customers_kb`
- Branch determination is from user's session data
- All new customers are created in user's branch table automatically
- RLS is enabled on both tables: anon key denied; service role only (via `supabaseAdmin`)

---

## April 2026 Updates

### Customer Ownership (`20260401_customer_ownership.sql`)

Both `customers_kb` and `customers_kk` now have ownership columns:

```sql
assigned_to        TEXT    -- salesman user ID
assigned_to_name   TEXT    -- snapshot of salesman name
assigned_at        TIMESTAMPTZ
district           TEXT
state              TEXT DEFAULT 'Sabah'
geo_group          TEXT
```

**Ownership Rules:**
- Customer with `assigned_to = NULL` → company customer, any salesman in branch can sell
- Customer with `assigned_to = salesmanId` → owned; only that salesman (or Admin/Main Admin) can sell
- Admin can assign/handover customers within their branch
- Main Admin can reassign across branches

**Audit Log:**
```sql
customer_ownership_log (
  customer_id, customer_name, customer_table,
  from_salesman_id, from_salesman_name,
  to_salesman_id, to_salesman_name,
  action,   -- 'assign' | 'handover' | 'release' | 'self_add'
  reason,
  done_by, done_by_name, branch,
  created_at
)
```

### District Filtering (`20260401_full_system_upgrade.sql`)

Both tables also have `district`, `state`, `geo_group` for geographic filtering.

Users table: `assigned_districts TEXT[]` — salesman coverage areas (e.g. `{Beaufort, Kota Belud}`).
