require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { createClient } = require('@supabase/supabase-js');

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function toBoolean(value, fallback = true) {
  if (value == null || value === '') return fallback;
  const text = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(text);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBranch(value, fallbackBranch) {
  const raw = String(value || fallbackBranch || '').trim().toLowerCase();
  if (!raw) return 'Kota Kinabalu';
  if (raw === 'kk' || raw === 'kota kinabalu' || raw === 'kota-kinabalu') return 'Kota Kinabalu';
  if (raw === 'kb' || raw === 'kinabatangan') return 'Kinabatangan';
  if (raw === 'hq') return 'HQ';
  return fallbackBranch || 'Kota Kinabalu';
}

async function main() {
  const fileArg = getArg('file', 'data/products_from_image_1775807055562.csv');
  const branchArg = getArg('branch', 'Kota Kinabalu');
  const dryRun = hasFlag('dry-run');
  const absPath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);

  if (!fs.existsSync(absPath)) {
    console.error(`CSV file not found: ${absPath}`);
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(absPath, 'utf8');
  const parsed = Papa.parse(rawCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => String(header || '').trim(),
  });

  if (parsed.errors.length > 0) {
    console.error('CSV parsing errors found:');
    parsed.errors.slice(0, 10).forEach((err) => console.error(`- ${err.message}`));
    process.exit(1);
  }

  const rows = parsed.data || [];
  const products = rows
    .map((row, idx) => {
      const id = String(row.id || '').trim();
      const name = String(row.name || '').trim();
      const code = String(row.code || '').trim();

      if (!id || !name) {
        console.warn(`Skipping row ${idx + 2}: missing id or name`);
        return null;
      }

      return {
        id,
        name,
        code: code || null,
        price: toNumber(row.price, 0),
        unit: String(row.unit || 'pkt').trim() || 'pkt',
        is_active: toBoolean(row.is_active, true),
        created_at: row.created_at ? String(row.created_at).trim() : null,
        current_stock: Math.trunc(toNumber(row.current_stock, 0)),
        branch: normalizeBranch(row.branch, branchArg),
      };
    })
    .filter(Boolean);

  if (products.length === 0) {
    console.error('No valid product rows found in CSV.');
    process.exit(1);
  }

  console.log(`Parsed ${products.length} products from ${absPath}`);

  if (dryRun) {
    console.log('Dry-run mode enabled. Sample payload:');
    console.log(products.slice(0, 3));
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase env vars in .env.local');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let success = 0;
  let failed = 0;

  for (const product of products) {
    const payload = { ...product };
    if (!payload.created_at) delete payload.created_at;

    const { error } = await supabase
      .from('products')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      failed += 1;
      console.error(`Failed: ${product.id} - ${error.message}`);
    } else {
      success += 1;
    }
  }

  console.log(`Done. Success: ${success}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
