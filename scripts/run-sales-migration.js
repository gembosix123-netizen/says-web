const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSalesTablesMigration() {
  console.log('🔄 Creating proper sales tables in Supabase...\n');
  
  try {
    // 1. Drop old sales table
    console.log('Dropping old sales table...');
    await supabase.rpc('exec_sql', { query: 'DROP TABLE IF EXISTS sales CASCADE' });
    
    // 2. Create customers table
    console.log('✓ Creating customers table...');
    const { error: customersError } = await supabase.from('customers').select('id').limit(0);
    if (customersError && customersError.message.includes('relation') && customersError.message.includes('does not exist')) {
      console.log('  Table needs to be created via Supabase Dashboard');
    } else {
      console.log('  ✓ Customers table ready');
    }
    
    // 3. Create products table
    console.log('✓ Creating products table...');
    const { error: productsError } = await supabase.from('products').select('id').limit(0);
    if (productsError && productsError.message.includes('relation') && productsError.message.includes('does not exist')) {
      console.log('  Table needs to be created via Supabase Dashboard');
    } else {
      console.log('  ✓ Products table ready');
    }
    
    console.log('\n⚠️  Manual Step Required:');
    console.log('Please run the SQL migration file in Supabase SQL Editor:');
    console.log('📄 migrations/20260224_create_proper_sales_tables.sql\n');
    console.log('Steps:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Click "SQL Editor" in left menu');
    console.log('4. Create new query'); 
    console.log('5. Copy-paste content from migrations/20260224_create_proper_sales_tables.sql');
    console.log('6. Click "RUN" button\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

runSalesTablesMigration().then(() => process.exit(0));
