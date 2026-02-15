/**
 * Database Audit Script
 * Run with: npx tsx scripts/audit-database.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES_TO_CHECK = [
  'users',
  'customers', 
  'products',
  'stores',
  'sales_kota_kinabalu',
  'sales_kinabatangan',
  'sales',
  'sales_history',
  'orders',
  'transactions'
];

// Expected columns for each table
const EXPECTED_SCHEMA: Record<string, string[]> = {
  users: ['id', 'username', 'password', 'role', 'branch', 'name', 'commission_rate', 'created_at'],
  customers: ['id', 'name', 'phone', 'address', 'town', 'code', 'is_active', 'created_at'],
  products: ['id', 'name', 'code', 'price', 'unit', 'is_active', 'created_at'],
  stores: ['id', 'name', 'code', 'phone', 'address', 'branch', 'created_at'],
  sales_kota_kinabalu: ['id', 'invoice', 'amount', 'total_amount', 'items', 'customer_name', 'customer_id', 'salesman_id', 'check_in_time', 'payment_method', 'branch', 'created_at'],
  sales_kinabatangan: ['id', 'invoice', 'amount', 'total_amount', 'items', 'customer_name', 'customer_id', 'salesman_id', 'check_in_time', 'payment_method', 'branch', 'created_at'],
};

async function getTableColumns(tableName: string): Promise<string[] | null> {
  try {
    // Try to fetch one row to see columns
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return null; // Table doesn't exist
      }
      console.error(`  Error querying ${tableName}:`, error.message);
      return null;
    }
    
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }
    
    // Table exists but empty - try to get schema info
    return [];
  } catch (e) {
    return null;
  }
}

async function getRowCount(tableName: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) return -1;
    return count || 0;
  } catch {
    return -1;
  }
}

async function auditDatabase() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           SAYS DATABASE AUDIT REPORT                         ║');
  console.log('║           ' + new Date().toISOString().slice(0, 19) + '                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results: {
    table: string;
    exists: boolean;
    columns: string[];
    rowCount: number;
    missingColumns: string[];
    extraColumns: string[];
  }[] = [];

  for (const table of TABLES_TO_CHECK) {
    const columns = await getTableColumns(table);
    const rowCount = columns !== null ? await getRowCount(table) : -1;
    const expected = EXPECTED_SCHEMA[table] || [];
    
    const missingColumns = columns !== null 
      ? expected.filter(col => !columns.includes(col) && !columns.includes(col.replace('_', '')))
      : [];
    
    const extraColumns = columns !== null
      ? columns.filter(col => !expected.includes(col) && !expected.includes(col.replace(/([A-Z])/g, '_$1').toLowerCase()))
      : [];

    results.push({
      table,
      exists: columns !== null,
      columns: columns || [],
      rowCount,
      missingColumns,
      extraColumns
    });
  }

  // Print results
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TABLE STATUS OVERVIEW');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const r of results) {
    const status = r.exists ? '✅' : '❌';
    const countStr = r.rowCount >= 0 ? `(${r.rowCount} rows)` : '';
    console.log(`${status} ${r.table.padEnd(25)} ${countStr}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('DETAILED COLUMN ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const r of results) {
    if (!r.exists) {
      console.log(`\n❌ TABLE: ${r.table}`);
      console.log('   Status: DOES NOT EXIST');
      if (EXPECTED_SCHEMA[r.table]) {
        console.log('   Action: Run migration to create this table');
      }
      continue;
    }

    console.log(`\n✅ TABLE: ${r.table}`);
    console.log(`   Rows: ${r.rowCount}`);
    console.log(`   Columns found: ${r.columns.join(', ') || '(empty table)'}`);
    
    if (r.missingColumns.length > 0) {
      console.log(`   ⚠️  MISSING: ${r.missingColumns.join(', ')}`);
    }
    if (r.extraColumns.length > 0) {
      console.log(`   ℹ️  Extra: ${r.extraColumns.join(', ')}`);
    }
    if (r.missingColumns.length === 0 && EXPECTED_SCHEMA[r.table]) {
      console.log('   ✓ All expected columns present');
    }
  }

  // Generate fix recommendations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const missingTables = results.filter(r => !r.exists && EXPECTED_SCHEMA[r.table]);
  const tablesWithMissingCols = results.filter(r => r.exists && r.missingColumns.length > 0);

  if (missingTables.length === 0 && tablesWithMissingCols.length === 0) {
    console.log('✅ Database structure looks good! No critical issues found.\n');
  } else {
    if (missingTables.length > 0) {
      console.log('📋 Missing Tables - Run this SQL in Supabase SQL Editor:\n');
      for (const t of missingTables) {
        console.log(`-- Create ${t.table} table`);
        console.log(`-- See migrations folder for full SQL`);
      }
    }

    if (tablesWithMissingCols.length > 0) {
      console.log('\n📋 Missing Columns - Run this SQL:\n');
      for (const t of tablesWithMissingCols) {
        for (const col of t.missingColumns) {
          let colType = 'TEXT';
          if (col.includes('_at')) colType = 'TIMESTAMPTZ DEFAULT now()';
          if (col.includes('amount') || col.includes('price') || col.includes('rate')) colType = 'DECIMAL(10,2) DEFAULT 0';
          if (col.includes('is_') || col.includes('active')) colType = 'BOOLEAN DEFAULT true';
          if (col === 'id' && t.table !== 'users') colType = 'TEXT PRIMARY KEY';
          if (col === 'items') colType = 'JSONB';
          
          console.log(`ALTER TABLE ${t.table} ADD COLUMN IF NOT EXISTS ${col} ${colType};`);
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('END OF AUDIT REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

auditDatabase().catch(console.error);
