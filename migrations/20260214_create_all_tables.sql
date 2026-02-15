-- Proper migration for products and customers tables
-- Run this in Supabase SQL editor first

BEGIN;

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  price DECIMAL(10, 2) NOT NULL,
  unit TEXT DEFAULT 'pkt',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products (is_active);

-- 2. Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  address TEXT,
  town TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_is_active ON public.customers (is_active);

-- 3. Add commission_rate to users if not exists
ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 4) DEFAULT 0;

-- 4. Create stores table for shop management
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  address TEXT,
  branch TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_branch ON public.stores (branch);

-- 5. Create order tracking table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT,
  customer_id TEXT REFERENCES public.customers(id),
  amount DECIMAL(12, 2),
  branch TEXT,
  salesman TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_branch ON public.orders (branch);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- 6. Create transactions table for audit trail
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES public.customers(id),
  amount DECIMAL(12, 2),
  branch TEXT,
  salesman TEXT,
  date TIMESTAMPTZ DEFAULT now(),
  item_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_branch ON public.transactions (branch);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);

COMMIT;
