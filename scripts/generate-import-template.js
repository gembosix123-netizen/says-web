/**
 * generate-import-template.js
 * Run: node scripts/generate-import-template.js
 * Output: public/templates/backdated_import_template.xlsx
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// ─── Ensure output directory exists ──────────────────────────────────────────
const outputDir = path.join(__dirname, '..', 'public', 'templates');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ─── Column definitions ───────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'month',           label: 'month',           width: 14,  note: 'Format: YYYY-MM  (e.g. 2025-11)' },
  { key: 'branch',          label: 'branch',           width: 20,  note: 'Kota Kinabalu | Kinabatangan' },
  { key: 'payment_method',  label: 'payment_method',   width: 18,  note: 'cash | bill_to_bill | bank_transfer | qr_code | card | ewallet' },
  { key: 'amount',          label: 'amount',           width: 14,  note: 'Numbers only, no RM symbol. e.g. 1500.00' },
  { key: 'receipt_no',      label: 'receipt_no',       width: 24,  note: 'Required for cash only. e.g. CB-KK-202511-001' },
  { key: 'billing_ref_no',  label: 'billing_ref_no',   width: 24,  note: 'Required for bill_to_bill only. e.g. B2B-KB-202511-001' },
  { key: 'transfer_ref_no', label: 'transfer_ref_no',  width: 24,  note: 'Required for bank_transfer only. e.g. TRF-KK-202511-001' },
  { key: 'qr_txn_ref_no',   label: 'qr_txn_ref_no',   width: 24,  note: 'Required for qr_code only. e.g. QR-KK-202511-001' },
  { key: 'customer_name',   label: 'customer_name',    width: 22,  note: 'Optional. Shop or customer name.' },
  { key: 'payment_note',    label: 'payment_note',     width: 28,  note: 'Optional. Any remarks.' },
];

// ─── Example data rows ────────────────────────────────────────────────────────
const EXAMPLES = [
  {
    month: '2025-10', branch: 'Kota Kinabalu', payment_method: 'cash',
    amount: 1500.00, receipt_no: 'CB-KK-202510-001',
    billing_ref_no: '', transfer_ref_no: '', qr_txn_ref_no: '',
    customer_name: 'Kedai ABC', payment_note: '',
  },
  {
    month: '2025-10', branch: 'Kinabatangan', payment_method: 'bill_to_bill',
    amount: 2300.00, receipt_no: '',
    billing_ref_no: 'B2B-KB-202510-001', transfer_ref_no: '', qr_txn_ref_no: '',
    customer_name: 'Kedai XYZ', payment_note: 'Kredit Oktober',
  },
  {
    month: '2025-11', branch: 'Kota Kinabalu', payment_method: 'bank_transfer',
    amount: 800.00, receipt_no: '', billing_ref_no: '',
    transfer_ref_no: 'TRF-KK-202511-001', qr_txn_ref_no: '',
    customer_name: 'Kedai DEF', payment_note: '',
  },
  {
    month: '2025-11', branch: 'Kota Kinabalu', payment_method: 'qr_code',
    amount: 450.00, receipt_no: '', billing_ref_no: '', transfer_ref_no: '',
    qr_txn_ref_no: 'QR-KK-202511-001',
    customer_name: 'Kedai GHI', payment_note: '',
  },
  {
    month: '2025-12', branch: 'Kinabatangan', payment_method: 'cash',
    amount: 975.50, receipt_no: 'CB-KB-202512-001',
    billing_ref_no: '', transfer_ref_no: '', qr_txn_ref_no: '',
    customer_name: 'Kedai JKL', payment_note: '',
  },
];

// ─── Build workbook ───────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();

// ── Sheet 1: DATA INPUT ──────────────────────────────────────────────────────
const dataRows = [
  COLUMNS.map(c => c.label),      // row 1 = headers
  ...EXAMPLES.map(row => COLUMNS.map(c => row[c.key] ?? '')),
];

const wsData = XLSX.utils.aoa_to_sheet(dataRows);

// Set column widths
wsData['!cols'] = COLUMNS.map(c => ({ wch: c.width }));

// Freeze first row (header)
wsData['!freeze'] = { xSplit: 0, ySplit: 1 };

XLSX.utils.book_append_sheet(wb, wsData, 'DATA INPUT');

// ── Sheet 2: INSTRUCTIONS ────────────────────────────────────────────────────
const instructions = [
  ['SAYS SYSTEM — BACKDATED IMPORT TEMPLATE'],
  [''],
  ['HOW TO USE THIS TEMPLATE'],
  [''],
  ['1.  Fill in data starting from Row 2 in the "DATA INPUT" sheet.'],
  ['2.  Do NOT change or delete the header row (Row 1).'],
  ['3.  One row = one transaction.'],
  ['4.  When done, save as CSV UTF-8: File → Save As → CSV UTF-8 (*.csv)'],
  ['5.  Upload the CSV file at: Admin Panel → Backdated Import'],
  [''],
  ['COLUMN RULES'],
  [''],
  ['Column',            'Rule',                                         'Example'],
  ['month',             'Format YYYY-MM only',                          '2025-11'],
  ['branch',            'Exact branch name',                            'Kota Kinabalu'],
  ['payment_method',    'Lowercase only (see valid values below)',       'cash'],
  ['amount',            'Numbers only, no RM symbol',                   '1500.00'],
  ['receipt_no',        'Fill ONLY if payment_method = cash',           'CB-KK-202511-001'],
  ['billing_ref_no',    'Fill ONLY if payment_method = bill_to_bill',   'B2B-KB-202511-001'],
  ['transfer_ref_no',   'Fill ONLY if payment_method = bank_transfer',  'TRF-KK-202511-001'],
  ['qr_txn_ref_no',     'Fill ONLY if payment_method = qr_code',        'QR-KK-202511-001'],
  ['customer_name',     'Optional',                                      'Kedai ABC'],
  ['payment_note',      'Optional remarks',                              'October payment'],
  [''],
  ['VALID PAYMENT METHODS'],
  [''],
  ['Value',             'Meaning'],
  ['cash',              'Cash payment'],
  ['bill_to_bill',      'Credit / deferred payment'],
  ['bank_transfer',     'Bank transfer'],
  ['qr_code',           'QR Code payment'],
  ['card',              'Card payment'],
  ['ewallet',           'eWallet payment'],
  [''],
  ['REFERENCE NUMBER FORMAT'],
  [''],
  ['Type',              'Format',                         'Example'],
  ['Cash Bill',         'CB-[BRANCH]-[YYYYMM]-[NO]',     'CB-KK-202511-001'],
  ['Bill-to-Bill',      'B2B-[BRANCH]-[YYYYMM]-[NO]',    'B2B-KB-202511-001'],
  ['Bank Transfer',     'TRF-[BRANCH]-[YYYYMM]-[NO]',    'TRF-KK-202511-001'],
  ['QR Code',           'QR-[BRANCH]-[YYYYMM]-[NO]',     'QR-KK-202511-001'],
  [''],
  ['Branch codes: KK = Kota Kinabalu  |  KB = Kinabatangan'],
  [''],
  ['MAXIMUM 500 ROWS PER IMPORT'],
  [''],
  ['For assistance, contact your Admin or branch supervisor.'],
];

const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
wsInstructions['!cols'] = [{ wch: 28 }, { wch: 50 }, { wch: 30 }];
XLSX.utils.book_append_sheet(wb, wsInstructions, 'INSTRUCTIONS');

// ── Sheet 3: REFERENCE ───────────────────────────────────────────────────────
const reference = [
  ['PAYMENT METHOD', 'REFERENCE COLUMN TO FILL', 'LEAVE EMPTY'],
  ['cash',          'receipt_no',                'billing_ref_no, transfer_ref_no, qr_txn_ref_no'],
  ['bill_to_bill',  'billing_ref_no',            'receipt_no, transfer_ref_no, qr_txn_ref_no'],
  ['bank_transfer', 'transfer_ref_no',           'receipt_no, billing_ref_no, qr_txn_ref_no'],
  ['qr_code',       'qr_txn_ref_no',             'receipt_no, billing_ref_no, transfer_ref_no'],
  ['card',          '(none required)',            'All reference columns can be empty'],
  ['ewallet',       '(none required)',            'All reference columns can be empty'],
];

const wsRef = XLSX.utils.aoa_to_sheet(reference);
wsRef['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 50 }];
XLSX.utils.book_append_sheet(wb, wsRef, 'QUICK REFERENCE');

// ─── Write file ───────────────────────────────────────────────────────────────
const outputPath = path.join(outputDir, 'backdated_import_template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`✅  Template generated: ${outputPath}`);
console.log(`    Sheets: DATA INPUT | INSTRUCTIONS | QUICK REFERENCE`);
console.log(`    ${EXAMPLES.length} example rows included.`);
