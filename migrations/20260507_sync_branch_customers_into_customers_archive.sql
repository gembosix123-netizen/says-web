-- ============================================================================
-- SYNC: Salin baris dari customers_kk / customers_kb → customers_archive
-- Date: 2026-05-07
--
-- Masalah:
--   FK `sales_transactions_customer_id_fkey` merujuk ke `customers_archive`
--   (bekas `customers`). Pelanggan baharu hanya ada dalam `customers_kk` /
--   `customers_kb`, jadi UPDATE sales_transactions.customer_id = 'CUST-KK-…'
--   gagal dengan ERROR 23503.
--
-- Penyelesaian:
--   Salin ID + medan asas ke `customers_archive` supaya FK dipatuhi.
--   Selamat dijalankan berulang — skip jika id sudah wujud.
--
-- Urutan: jalankan FAIL ini DAHULU, kemudian
--   `20260506_backfill_sales_customer_id_branch_tables.sql`.
-- ============================================================================

BEGIN;

-- Nota: Skema `customers_archive` sering hanya 6 kolum (id, name, code, phone,
-- address, town) — tiada is_active / created_at / updated_at. Sesuaikan dengan:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='customers_archive';

INSERT INTO public.customers_archive (
  id,
  name,
  code,
  phone,
  address,
  town
)
SELECT
  k.id,
  k.name,
  k.code,
  k.phone,
  k.address,
  k.town
FROM public.customers_kk k
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers_archive a WHERE a.id = k.id
);

INSERT INTO public.customers_archive (
  id,
  name,
  code,
  phone,
  address,
  town
)
SELECT
  k.id,
  k.name,
  k.code,
  k.phone,
  k.address,
  k.town
FROM public.customers_kb k
WHERE NOT EXISTS (
  SELECT 1 FROM public.customers_archive a WHERE a.id = k.id
);

COMMIT;
