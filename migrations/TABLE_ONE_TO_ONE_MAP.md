# Supabase Table ↔ SQL Migration Mapping (One-to-One)

Dokumen ini jadikan rujukan ringkas: setiap table utama di Supabase dipadankan dengan fail SQL sumber utamanya.

---

## Canonical Model (Current — April 2026)

### Core Tables

| Table | Migration File | Notes |
|---|---|---|
| `users` | `20260209_users_branch_permissions.sql` | + `assigned_districts[]` added in `20260401_customer_ownership.sql` |
| `stores` | `20260209_create_stores_and_policies.sql` | + `district`, `state`, `geo_group` added in `20260401_full_system_upgrade.sql` |
| `products` | `20260214_create_all_tables.sql` | + multi-price tiers in `20260401_product_prices.sql` |
| `orders` | `20260214_create_all_tables.sql` | |
| `transactions` | `20260214_create_all_tables.sql` | Legacy Firestore mirror — may not exist in all envs |

### Sales Tables (Canonical)

| Table / View | Migration File | Type |
|---|---|---|
| `sales_transactions` | `20260224_create_proper_sales_tables.sql` | Base table (single source of truth) |
| `sales_items` | `20260224_create_proper_sales_tables.sql` | Line items per transaction |
| `sales_kinabatangan` | `20260401_split_sales_as_views.sql` | VIEW — `WHERE branch = 'Kinabatangan'` |
| `sales_kota_kinabalu` | `20260401_split_sales_as_views.sql` | VIEW — `WHERE branch = 'Kota Kinabalu'` |

### Customer Tables (Branch-isolated)

| Table | Migration File | Branch |
|---|---|---|
| `customers_kb` | `20260326_separate_customers_by_branch.sql` | Kota Kinabalu |
| `customers_kk` | `20260326_separate_customers_by_branch.sql` | Kinabatangan |
| `customers_archive` | `20260326_separate_customers_by_branch.sql` | Backup of old `customers` table |

> **Important:** Use `getCustomersTableByBranch(branch)` from `lib/branchPermissions.ts` to resolve the correct table.  
> `'Kota Kinabalu'` → `customers_kb` | `'Kinabatangan'` → `customers_kk`

### Merchandiser & Visits

| Table | Migration File |
|---|---|
| `store_visits` | `20260219_add_merchandiser_tables.sql` |
| `store_audit_items` | `20260219_add_merchandiser_tables.sql` |

### Audit & Compliance

| Table | Migration File |
|---|---|
| `audit_events` | `20260226_add_audit_tables.sql` |
| `audit_event_changes` | `20260226_add_audit_tables.sql` |
| `audit_import_batches` | `20260226_add_audit_tables.sql` |

### Exchange & Returns

| Table | Migration File |
|---|---|
| `exchange_returns` | `20260303_create_exchange_returns.sql` |

### Financial (April 2026)

| Table | Migration File | Notes |
|---|---|---|
| `expenses` | `20260401_full_system_upgrade.sql` | Field expense claims by salesman |
| `inventory_movements` | `20260401_full_system_upgrade.sql` | Van stock movements (sale_deduct, freezer_in, carry_forward, etc.) |
| `weekly_report_history` | `20260326_create_monthly_report_history.sql` | Archived weekly summaries |
| `customer_ownership_log` | `20260401_customer_ownership.sql` | Audit trail for customer assign/handover/release |

### Payment Reference Columns (added March 2026)

Added to `sales_transactions` via `20260326_add_payment_reference_columns.sql`:
- `billing_ref_no`, `transfer_ref_no`, `qr_txn_ref_no`
- `proof_photo_url` (single), migrated to → `proof_photo_urls` (JSONB array) via `20260326_add_sales_proof_photo_urls.sql`

### Backdated Import (April 2026)

Added to `sales_transactions` via `20260401_backdated_import_columns.sql`:
- `is_backdated`, `is_locked`, `imported_by`, `imported_at`

---

## Legacy Tables (Decommissioned)

| Table | Reason | Replaced By |
|---|---|---|
| `sales` (lama) | Asal dari `create-tables.sql` | `sales_transactions` |
| `sales_kota_kinabalu` (base table) | `20260209_split_sales.sql` | VIEW in `20260401_split_sales_as_views.sql` |
| `sales_kinabatangan` (base table) | `20260209_split_sales.sql` | VIEW in `20260401_split_sales_as_views.sql` |
| `sales_history` (view) | `20260209_split_sales.sql` | `sales_transactions` with branch filter |
| `customers` (old unified) | `20260326_separate_customers_by_branch.sql` | `customers_kb` + `customers_kk` |

---

## RLS Policy

All tables have RLS enabled via `20260401_rls_branch_isolation.sql`:
- **anon key** → denied all access (`USING (false)`)
- **service_role** → full access (`USING (true)`)
- All data access goes through server-side API routes using `supabaseAdmin` (service role)

---

## Nota Pelaksanaan

- `migrations/20260224_quick_fix_sales_table.sql` adalah no-op (hanya fallback jika `public.sales` tidak wujud).
- Untuk semua query baru, guna model sales canonical: `sales_transactions` (header) + `sales_items` (line items).
- Jangan query `sales_kinabatangan` / `sales_kota_kinabalu` sebagai base table lagi \u2014 ia kini VIEW sahaja.
- `getSalesTableByBranch()` dari `lib/branchPermissions.ts` adalah **deprecated**; ia sentiasa return `'sales_transactions'`.
