-- Migration: Add payment reference number columns to sales_transactions
-- Date: 2026-03-26
-- Purpose: Support cash (receipt_no), bill_to_bill (billing_ref_no),
--          bank_transfer (transfer_ref_no), qr_code (qr_txn_ref_no)

-- 1. Add reference number columns
ALTER TABLE public.sales_transactions
  ADD COLUMN IF NOT EXISTS receipt_no        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_ref_no    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS transfer_ref_no   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS qr_txn_ref_no     VARCHAR(100);

-- 2. Drop old CHECK constraint on payment_method and add updated one
ALTER TABLE public.sales_transactions
  DROP CONSTRAINT IF EXISTS sales_transactions_payment_method_check;

ALTER TABLE public.sales_transactions
  ADD CONSTRAINT sales_transactions_payment_method_check
  CHECK (payment_method IN (
    'cash',
    'bill_to_bill',
    'bank_transfer',
    'qr_code',
    'card',
    'transfer',
    'credit',
    'ewallet',
    'Tunai',
    'Kad',
    'Transfer'
  ));

-- 3. Migrate old 'credit' values to 'bill_to_bill'
UPDATE public.sales_transactions
  SET payment_method = 'bill_to_bill'
  WHERE payment_method = 'credit';

-- 4. Normalise old mixed-case values
UPDATE public.sales_transactions SET payment_method = 'cash'          WHERE payment_method = 'Tunai';
UPDATE public.sales_transactions SET payment_method = 'card'          WHERE payment_method = 'Kad';
UPDATE public.sales_transactions SET payment_method = 'bank_transfer' WHERE payment_method = 'Transfer';
UPDATE public.sales_transactions SET payment_method = 'bank_transfer' WHERE payment_method = 'transfer';
