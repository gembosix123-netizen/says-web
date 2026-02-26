# Supabase Table ↔ SQL Migration Mapping (One-to-One)

Dokumen ini jadikan rujukan ringkas: setiap table utama di Supabase dipadankan dengan fail SQL sumber utamanya.

## Canonical model (tersusun, tidak bercampur branch sales lama)

- `users` → `migrations/20260209_users_branch_permissions.sql`
- `stores` → `migrations/20260209_create_stores_and_policies.sql` (kemudian juga didefinisikan di `20260214_create_all_tables.sql`)
- `customers` → `migrations/20260214_create_all_tables.sql` (diperkukuh dalam `20260224_create_proper_sales_tables.sql`)
- `products` → `migrations/20260214_create_all_tables.sql` (diperkukuh dalam `20260224_create_proper_sales_tables.sql`)
- `orders` → `migrations/20260214_create_all_tables.sql`
- `transactions` → `migrations/20260214_create_all_tables.sql`
- `store_visits` → `migrations/20260219_add_merchandiser_tables.sql`
- `store_audit_items` → `migrations/20260219_add_merchandiser_tables.sql`
- `sales_transactions` → `migrations/20260224_create_proper_sales_tables.sql`
- `sales_items` → `migrations/20260224_create_proper_sales_tables.sql`

## Legacy sales structures (decommissioned by canonical migration)

- `sales` (lama) → asal dari `scripts/create-tables.sql`, kini dipadam dalam `migrations/20260224_create_proper_sales_tables.sql`
- `sales_kota_kinabalu` (lama) → `migrations/20260209_split_sales.sql`, kini dipadam dalam `migrations/20260224_create_proper_sales_tables.sql`
- `sales_kinabatangan` (lama) → `migrations/20260209_split_sales.sql`, kini dipadam dalam `migrations/20260224_create_proper_sales_tables.sql`
- `sales_history` (legacy view) → `migrations/20260209_split_sales.sql`, kini dipadam dalam `migrations/20260224_create_proper_sales_tables.sql`

## Nota pelaksanaan

- `migrations/20260224_quick_fix_sales_table.sql` kini hanya fallback (no-op jika `public.sales` tidak wujud).
- Untuk elak schema bercampur, guna model sales canonical sahaja:
  - `sales_transactions` (header)
  - `sales_items` (line items)
