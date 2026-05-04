-- ============================================================================
-- BACKFILL: sales_transactions.customer_id daripada customers_kk / customers_kb
-- Date: 2026-05-06
--
-- PRASYARAT: Jalankan `20260507_sync_branch_customers_into_customers_archive.sql`
--            DAHULU jika FK `sales_transactions_customer_id_fkey` → customers_archive
--            (tanpa sync, UPDATE gagal: Key (customer_id)=(CUST-…) not present in
--            customers_archive).
--
-- Kenapa:
--   20260505_data_cleanup.sql bahagian C2 hanya JOIN ke customers_archive atau
--   customers. Selepas 20260326_separate_customers_by_branch.sql, pelanggan ada
--   pada customers_kk (Kota Kinabalu) dan customers_kb (Kinabatangan). Baris
--   jualan dengan tag [Customer: Nama] dalam notes masih customer_id NULL.
--
-- Cara padanan: sama seperti C2 — kunci nama alphanumeric lowercase.
-- Hadkan UPDATE ikut branch supaya ID pelanggan sepadan dengan jadual yang betul.
--
-- Jalankan di Supabase SQL Editor. Dry-run: tukar UPDATE kepada SELECT untuk semak.
-- ============================================================================

BEGIN;

-- Kota Kinabalu / KK  -> customers_kk
WITH tagged AS (
  SELECT
    s.id,
    lower(regexp_replace(
      coalesce((regexp_match(s.notes, '\[Customer:\s*(.*?)\]'))[1], ''),
      '[^a-z0-9]', '', 'gi'
    )) AS key
  FROM public.sales_transactions s
  WHERE s.customer_id IS NULL
    AND s.notes ILIKE '%[Customer:%'
    AND (
      lower(trim(coalesce(s.branch, ''))) IN ('kota kinabalu', 'kk')
      OR lower(coalesce(s.branch, '')) LIKE '%kota%kinabalu%'
      OR lower(trim(coalesce(s.branch, ''))) LIKE 'kk %'
      OR lower(trim(coalesce(s.branch, ''))) LIKE '% kk'
    )
),
candidates AS (
  SELECT DISTINCT ON (t.id)
    t.id AS sale_id,
    ck.id AS canonical_id
  FROM tagged t
  INNER JOIN public.customers_kk ck
    ON lower(regexp_replace(ck.name, '[^a-z0-9]', '', 'gi')) = t.key
   AND t.key <> ''
  ORDER BY t.id, ck.id
)
UPDATE public.sales_transactions s
SET
  customer_id = c.canonical_id,
  notes = NULLIF(
    btrim(regexp_replace(
      coalesce(s.notes, ''),
      '\s*\[Customer:\s*[^\]]*\]\s*', ' ', 'gi'
    )),
    ''
  )
FROM candidates c
WHERE s.id = c.sale_id;

-- Kinabatangan / KB -> customers_kb
WITH tagged AS (
  SELECT
    s.id,
    lower(regexp_replace(
      coalesce((regexp_match(s.notes, '\[Customer:\s*(.*?)\]'))[1], ''),
      '[^a-z0-9]', '', 'gi'
    )) AS key
  FROM public.sales_transactions s
  WHERE s.customer_id IS NULL
    AND s.notes ILIKE '%[Customer:%'
    AND (
      lower(trim(coalesce(s.branch, ''))) IN ('kinabatangan', 'kb')
      OR lower(coalesce(s.branch, '')) LIKE '%kinabatangan%'
      OR lower(trim(coalesce(s.branch, ''))) LIKE 'kb %'
      OR lower(trim(coalesce(s.branch, ''))) LIKE '% kb'
    )
),
candidates AS (
  SELECT DISTINCT ON (t.id)
    t.id AS sale_id,
    ck.id AS canonical_id
  FROM tagged t
  INNER JOIN public.customers_kb ck
    ON lower(regexp_replace(ck.name, '[^a-z0-9]', '', 'gi')) = t.key
   AND t.key <> ''
  ORDER BY t.id, ck.id
)
UPDATE public.sales_transactions s
SET
  customer_id = c.canonical_id,
  notes = NULLIF(
    btrim(regexp_replace(
      coalesce(s.notes, ''),
      '\s*\[Customer:\s*[^\]]*\]\s*', ' ', 'gi'
    )),
    ''
  )
FROM candidates c
WHERE s.id = c.sale_id;

COMMIT;
