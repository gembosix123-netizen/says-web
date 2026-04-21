-- Quick fix: Update existing sales table to support current sales app
-- This adds the missing columns needed by the frontend

-- Deprecated note:
-- The canonical schema now uses sales_transactions + sales_items.
-- This script is kept only for backward compatibility on environments
-- where public.sales still exists.

-- Add missing columns to sales table
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_name = 'sales'
	) THEN
		ALTER TABLE public.sales
		ADD COLUMN IF NOT EXISTS customer_id UUID,
		ADD COLUMN IF NOT EXISTS user_id UUID,
		ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2),
		ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
		ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed',
		ADD COLUMN IF NOT EXISTS items JSONB;

		DROP POLICY IF EXISTS "Allow all operations on sales" ON public.sales;
		CREATE POLICY "Allow all operations on sales" ON public.sales FOR ALL USING (true);
	END IF;
END $$;

-- Rename 'amount' to keep backward compatibility but add total_amount as main column
-- Note: We keep both for now

-- Add foreign key constraints (optional, can be added later if needed)
-- ALTER TABLE sales ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
-- ALTER TABLE sales ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);

-- If public.sales does not exist, this script safely performs no-op.
