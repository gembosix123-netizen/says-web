#!/usr/bin/env node
/**
 * run-migration.js
 * Jalankan mana-mana fail .sql migration ke Supabase menggunakan service role key
 * 
 * Usage:
 *   node scripts/run-migration.js                              <- jalankan migrations/20260401_full_system_upgrade.sql
 *   node scripts/run-migration.js migrations/myfile.sql       <- tentukan fail
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tiada dalam .env.local');
  process.exit(1);
}

const sqlFile = process.argv[2] || path.join(__dirname, '..', 'migrations', '20260401_full_system_upgrade.sql');
const sqlFilePath = path.resolve(sqlFile);

if (!fs.existsSync(sqlFilePath)) {
  console.error(`❌  Fail tidak dijumpai: ${sqlFilePath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlFilePath, 'utf8');
console.log(`\n📄  Fail: ${sqlFilePath}`);
console.log(`📏  Saiz SQL: ${sql.length} aksara\n`);

// Supabase REST API — execute SQL via /rest/v1/rpc/exec_sql is not available for arbitrary SQL.
// We use the Postgres REST endpoint directly: POST /rest/v1/  -- NOT supported for raw SQL.
// Best approach: use supabase-js with rpc, or call the Management API.
// 
// Easiest: use the pg-based approach via SUPABASE_DB_URL if available.
const DB_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (DB_URL) {
  runViaPg(DB_URL, sql);
} else {
  console.log('ℹ️  DATABASE_URL tidak ada. Cuba jalankan via Supabase REST (rpc exec_sql)...\n');
  runViaRpc(sql);
}

// ── Option A: direct PostgreSQL connection ──────────────────────────────────
function runViaPg(dbUrl, sql) {
  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('❌  Module "pg" tidak dipasang. Jalankan: npm install pg --save-dev');
    printManualInstructions();
    process.exit(1);
  }

  const { Pool } = pg;
  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  console.log('🔌  Menyambung ke PostgreSQL...');
  pool.query(sql, (err) => {
    pool.end();
    if (err) {
      console.error('\n❌  Migration GAGAL:\n', err.message);
      printManualInstructions();
      process.exit(1);
    }
    console.log('✅  Migration berjaya! Semua jadual dan kolum telah kemaskini.\n');
  });
}

// ── Option B: Supabase RPC (needs exec_sql function installed) ─────────────
function runViaRpc(sql) {
  // Split on semicolons to run statement by statement
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

  const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
  const lib = url.protocol === 'https:' ? https : http;

  console.log(`🔄  Cuba jalankan ${statements.length} statement via RPC...\n`);

  let i = 0;
  function next() {
    if (i >= statements.length) {
      console.log('\n✅  Semua statement dihantar!\n');
      return;
    }
    const stmt = statements[i++];
    const body = JSON.stringify({ query: stmt + ';' });
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          process.stdout.write(`  ✓ [${i}/${statements.length}]\r`);
        } else {
          console.warn(`  ⚠️  [${i}] HTTP ${res.statusCode}: ${data.slice(0, 120)}`);
        }
        next();
      });
    });
    req.on('error', (e) => { console.error('  ❌  Request error:', e.message); next(); });
    req.write(body);
    req.end();
  }
  next();
}

function printManualInstructions() {
  console.log('\n─────────────────────────────────────────────────────────');
  console.log('📋  CARA MANUAL — Jalankan dalam Supabase SQL Editor:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`1. Buka: ${SUPABASE_URL?.replace('//', '//dashboard.') || 'https://supabase.com/dashboard'}`);
  console.log('2. Pergi ke: Database → SQL Editor → New Query');
  console.log(`3. Salin kandungan fail: migrations/20260401_full_system_upgrade.sql`);
  console.log('4. Klik "Run" (Ctrl+Enter)');
  console.log('─────────────────────────────────────────────────────────\n');
}
