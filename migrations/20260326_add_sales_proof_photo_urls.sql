BEGIN;

ALTER TABLE IF EXISTS public.sales_transactions
  ADD COLUMN IF NOT EXISTS proof_photo_urls jsonb;

UPDATE public.sales_transactions
SET proof_photo_urls = jsonb_build_array(proof_photo_url)
WHERE proof_photo_url IS NOT NULL
  AND (proof_photo_urls IS NULL OR proof_photo_urls = 'null'::jsonb);

COMMIT;