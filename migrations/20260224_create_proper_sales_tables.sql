-- Canonical sales schema migration
-- Keeps one clean sales model: sales_transactions + sales_items

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Decommission legacy sales structures to avoid mixed models
DROP VIEW IF EXISTS public.sales_history;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.sales_kota_kinabalu CASCADE;
DROP TABLE IF EXISTS public.sales_kinabatangan CASCADE;

-- Master tables (kept IF NOT EXISTS to avoid destructive changes)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    branch TEXT,
    gps_lat DECIMAL(10, 8),
    gps_long DECIMAL(11, 8),
    current_balance DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    price DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'pkt',
    current_stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Build sales tables with dynamic FK type compatibility
DO $$
DECLARE
    customer_id_type text;
    product_id_type text;
BEGIN
    SELECT data_type INTO customer_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'id';

    SELECT data_type INTO product_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id';

    customer_id_type := COALESCE(customer_id_type, 'uuid');
    product_id_type := COALESCE(product_id_type, 'uuid');

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS public.sales_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES public.users(id),
            customer_id %s REFERENCES public.customers(id),
            invoice VARCHAR(50),
            transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            subtotal_amount DECIMAL(12, 2) NOT NULL,
            grand_total DECIMAL(12, 2) NOT NULL,
            payment_method VARCHAR(20) CHECK (payment_method IN (''cash'', ''transfer'', ''credit'', ''Tunai'', ''Kad'', ''Transfer'')),
            status VARCHAR(20) DEFAULT ''completed'',
            notes TEXT,
            branch TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ', customer_id_type);

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS public.sales_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id UUID REFERENCES public.sales_transactions(id) ON DELETE CASCADE,
            product_id %s REFERENCES public.products(id),
            product_name VARCHAR(255),
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10, 2) NOT NULL,
            subtotal DECIMAL(12, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ', product_id_type);
END $$;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all on products" ON public.products;
DROP POLICY IF EXISTS "Allow all on sales_transactions" ON public.sales_transactions;
DROP POLICY IF EXISTS "Allow all on sales_items" ON public.sales_items;

CREATE POLICY "Allow all on customers" ON public.customers FOR ALL USING (true);
CREATE POLICY "Allow all on products" ON public.products FOR ALL USING (true);
CREATE POLICY "Allow all on sales_transactions" ON public.sales_transactions FOR ALL USING (true);
CREATE POLICY "Allow all on sales_items" ON public.sales_items FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_user_id ON public.sales_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_customer_id ON public.sales_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON public.sales_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_items_transaction_id ON public.sales_items(transaction_id);

COMMIT;
