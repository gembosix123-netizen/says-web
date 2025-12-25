-- A.P NETSA x Haja Yanong Industries
-- Sales Reporting System Schema
-- Database: PostgreSQL

-- 1. USERS (Salesmen & Admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'salesman', 'driver')) DEFAULT 'salesman',
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. CUSTOMERS (Stores)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    gps_lat DECIMAL(10, 8),
    gps_long DECIMAL(11, 8),
    current_balance DECIMAL(12, 2) DEFAULT 0.00, -- Positive = Customer Owes Us (Credit)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PRODUCTS (Inventory)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE, -- SKU or Short Code
    price DECIMAL(10, 2) NOT NULL, -- Current Selling Price
    unit VARCHAR(20) DEFAULT 'pkt', -- e.g., pkt, kg, pcs
    current_stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SALES TRANSACTIONS (The "Header" of the receipt)
CREATE TABLE sales_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salesman_id UUID REFERENCES users(id),
    customer_id UUID REFERENCES customers(id),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Location Tracking
    check_in_time TIMESTAMP WITH TIME ZONE,
    gps_lat DECIMAL(10, 8),
    gps_long DECIMAL(11, 8),
    
    -- Financials
    subtotal_amount DECIMAL(12, 2) NOT NULL, -- Sum of items
    
    -- Adjustments (from UI Step 4)
    return_amount DECIMAL(12, 2) DEFAULT 0.00,
    exchange_amount DECIMAL(12, 2) DEFAULT 0.00,
    foc_amount DECIMAL(12, 2) DEFAULT 0.00,
    
    grand_total DECIMAL(12, 2) NOT NULL, -- Final amount to be paid/recorded
    
    -- Payment
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'transfer', 'credit')),
    payment_status VARCHAR(20) DEFAULT 'completed', -- completed, pending (for credit)
    
    -- Proof
    signature_url TEXT,
    proof_photo_url TEXT,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SALES ITEMS (The "Line Items" - what was actually sold)
CREATE TABLE sales_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES sales_transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL, -- Price at the moment of sale
    total_price DECIMAL(12, 2) NOT NULL, -- quantity * unit_price
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. INVENTORY LOGS (Stock Movement)
CREATE TABLE inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id),
    user_id UUID REFERENCES users(id), -- Who moved the stock
    change_amount INTEGER NOT NULL, -- Positive for Stock In, Negative for Stock Out (Sale)
    reason VARCHAR(50), -- 'sale', 'restock', 'return', 'damage'
    reference_id UUID, -- Can link to sales_transactions.id if reason is 'sale'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CUSTOMER LEDGER (Credit/Debt History)
-- Tracks every change to customer balance
CREATE TABLE customer_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    transaction_id UUID REFERENCES sales_transactions(id),
    amount DECIMAL(12, 2) NOT NULL, -- Positive adds to debt, Negative reduces debt (payment)
    balance_after DECIMAL(12, 2) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sales_customer ON sales_transactions(customer_id);
CREATE INDEX idx_sales_salesman ON sales_transactions(salesman_id);
CREATE INDEX idx_sales_date ON sales_transactions(transaction_date);
CREATE INDEX idx_ledger_customer ON customer_ledger(customer_id);
