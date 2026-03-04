# Invoice Batch Import Tutorial

## Overview

This guide explains how to import historical invoice data (back-dated) into the SAYS System using the CSV batch import feature.

**Use Case:** You have existing invoices from 2025 or earlier in Excel/CSV format that need to be imported into the system.

---

## Prerequisites

- **Admin or Main Admin role** (required to access import feature)
- **CSV file** with historical invoice data
- **Customer data** already created in system (customer IDs must exist)
- **No duplicate invoice numbers** in system

---

## Step-by-Step Process

### Step 1: Prepare Your Data

#### 1.1 Gather Historical Invoices

Collect all historical invoices that need to be imported:
```
Example: All invoices from January - December 2025
- INV-2025-001 to INV-2025-150
- Old Excel files or ledgers
- Payment records
- Customer information
```

#### 1.2 Organize Data in Excel

Create an Excel file with the following columns:

| Column Name | Format | Example | Required |
|---|---|---|---|
| `invoice_no` | Text | INV-2025-001 | ✓ Yes |
| `invoice_date` | YYYY-MM-DD | 2025-01-15 | ✓ Yes |
| `due_date` | YYYY-MM-DD | 2025-02-15 | ✓ Yes |
| `customer_id` | Text | CUST-001 | ✓ Yes |
| `subtotal` | Number (decimal) | 500.00 | ✓ Yes |
| `tax` | Number (decimal) | 50.00 | ✓ Yes |
| `total` | Number (decimal) | 550.00 | ✓ Yes |
| `payment_status` | UNPAID / PARTIAL / PAID | PAID | ✓ Yes |
| `amount_paid` | Number (decimal) | 550.00 | ✓ Yes |

#### 1.3 Sample Data

```
invoice_no,invoice_date,due_date,customer_id,subtotal,tax,total,payment_status,amount_paid
INV-2025-001,2025-01-15,2025-02-15,CUST-001,500.00,50.00,550.00,PAID,550.00
INV-2025-002,2025-01-20,2025-02-20,CUST-002,1000.00,100.00,1100.00,PARTIAL,600.00
INV-2025-003,2025-02-01,2025-03-01,CUST-003,750.00,75.00,825.00,UNPAID,0.00
INV-2025-004,2025-02-10,2025-03-10,CUST-001,300.00,30.00,330.00,PAID,330.00
INV-2025-005,2025-02-15,2025-03-15,CUST-004,2000.00,200.00,2200.00,PARTIAL,1000.00
```

#### 1.4 Validation Rules

Before importing, ensure:

- ✅ **Invoice numbers are unique** - no duplicates in file or system
- ✅ **Date format is correct** - YYYY-MM-DD only
- ✅ **Customer IDs exist** - must be created in /customers first
- ✅ **Numbers use decimals** - use period (.) not comma (,)
- ✅ **Payment status is valid** - only UNPAID, PARTIAL, or PAID
- ✅ **Balance calculation** - balance_due = total - amount_paid

**Example of INCORRECT data:**
```
❌ invoice_no: blank
❌ invoice_date: 15/01/2025 (wrong format, should be 2025-01-15)
❌ customer_id: NONEXISTENT (customer not in system)
❌ total: 550,00 (wrong decimal, should be 550.00)
❌ payment_status: Paid (wrong case, should be PAID)
```

---

### Step 2: Download CSV Template

1. Open: **https://yoursite.com/invoices/import**
2. Click: **⬇ Download CSV Template**
3. File will be saved as: `invoice-import-template.csv`

This template contains:
- Column headers in correct order
- Sample data rows (replace these with your data)
- Correct formatting examples

---

### Step 3: Prepare CSV File

#### Option A: Use Downloaded Template

1. Open `invoice-import-template.csv` in Excel
2. Delete sample rows
3. Paste your historical data
4. **Save as CSV format** (.csv not .xlsx)
   - File → Save As → Format: CSV (Comma delimited)

#### Option B: Create New CSV File

If creating from scratch:

1. Open Excel
2. Create columns in this order:
   ```
   invoice_no | invoice_date | due_date | customer_id | subtotal | tax | total | payment_status | amount_paid
   ```
3. Enter your data
4. **Save as CSV** (not Excel format)

#### CSV File Naming
```
✓ Good names:
  - invoices_2025.csv
  - historical_invoices.csv
  - legacy_invoices.csv

✗ Avoid:
  - invoices.xlsx (wrong format)
  - My Invoices 2025.xlsx (wrong format)
```

---

### Step 4: Upload to System

1. Navigate to: **https://yoursite.com/invoices/import**
2. Click: **"Select CSV File"** button
3. Browse and select your CSV file
4. File will show as selected: "Selected: invoices_2025.csv"

---

### Step 5: Validate & Preview

1. Click: **"Validate & Preview"** button
2. System will:
   - Check all required fields
   - Validate date formats
   - Check payment status values
   - Verify numbers are decimals
   - Count total rows

#### Success (All Valid)
```
✓ Validation passed
✓ Total Rows: 150
✓ Preview (first 10 rows shown)

[Table showing first 10 invoices]

Ready to import? Click "Confirm & Import"
```

#### Errors Found
```
❌ Validation failed
❌ Row 5: Missing invoice_no
❌ Row 12: Invalid payment_status (Paid → should be PAID)
❌ Row 23: Invalid date format (01/02/2025 → should be 2025-02-01)

[Table showing errors]

Please fix errors and try again.
```

**If errors found:**
1. Note the row numbers and errors
2. Open your CSV file in Excel
3. Fix the errors
4. Save CSV
5. Upload again

---

### Step 6: Review Preview

Before confirming, review the preview table:

| Column | What to Check |
|---|---|
| Invoice No | Make sure format is correct (INV-XXXX) |
| Invoice Date | Verify dates are in past (2025 format) |
| Customer ID | Check customer code exists |
| Total | Verify amounts look reasonable |
| Paid | Should be ≤ Total |
| Status | Should be UNPAID, PARTIAL, or PAID |

**Example good preview:**
```
Invoice No     | Date       | Customer | Total    | Paid     | Status
INV-2025-001   | 2025-01-15 | CUST-001 | RM550.00 | RM550.00 | PAID
INV-2025-002   | 2025-01-20 | CUST-002 | RM1100.00| RM600.00 | PARTIAL
INV-2025-003   | 2025-02-01 | CUST-003 | RM825.00 | RM0.00   | UNPAID
```

---

### Step 7: Confirm & Import

1. After reviewing preview, click: **"✓ Confirm & Import"** button
2. System will:
   - Create invoice records
   - Calculate balance_due (total - amount_paid)
   - Set created_at = invoice_date (historical)
   - Create audit log entry
   - Show import result

#### Import Success
```
✓ Import Successful!

Import completed: 150 invoices imported, 0 failed

• Total Rows: 150
• Successfully Imported: 150
• Failed: 0
```

**System automatically:**
- ✅ Creates invoices with historical dates
- ✅ Records payment status (UNPAID/PARTIAL/PAID)
- ✅ Calculates balance due
- ✅ Logs audit trail
- ✅ Sets created_at to invoice_date (maintains history)

---

### Step 8: Verify Imported Data

1. Navigate to: **https://yoursite.com/invoices**
2. Check imported invoices appear in list
3. **Verify key records:**

   For each important invoice:
   - Click invoice to view details
   - Check:
     - ✓ Invoice number correct
     - ✓ Customer matched correctly
     - ✓ Amounts correct
     - ✓ Payment status correct
     - ✓ Balance due calculated (total - amount_paid)

#### Example Verification
```
Opened Invoice: INV-2025-001

Details shown:
✓ Invoice No: INV-2025-001
✓ Date: 2025-01-15
✓ Customer: Ahmad Hardware (CUST-001)
✓ Total: RM550.00
✓ Amount Paid: RM550.00
✓ Balance Due: RM0.00
✓ Status: PAID

All correct! ✓
```

4. **Check audit log:**
   - Go to: **Admin → Audit Center**
   - Filter by: Module = "invoices", Action = "batch_import"
   - Verify import activity is logged

---

## Common Issues & Solutions

### Issue 1: "Missing column headers"

**Error:** System shows validation error for multiple rows

**Cause:** CSV file missing required columns

**Solution:**
1. Open CSV in Excel
2. Check first row has all column names:
   ```
   invoice_no, invoice_date, due_date, customer_id, subtotal, tax, total, payment_status, amount_paid
   ```
3. If any column missing, add it
4. Save and upload again

### Issue 2: "Invalid date format"

**Error:** Row X: Invalid invoice_date format

**Cause:** Date not in YYYY-MM-DD format

**Solution:**
```
❌ Wrong formats:
   - 15/01/2025
   - 01-15-2025
   - Jan 15, 2025
   - 15-1-25

✓ Correct format:
   - 2025-01-15
   - 2025-02-03
   - 2025-12-31

In Excel:
1. Select date column
2. Format as Text
3. Use formula: =TEXT(date_cell,"YYYY-MM-DD")
4. Copy results as values
5. Save CSV
```

### Issue 3: "Customer ID not found"

**Error:** Validation passes but import fails for some rows

**Cause:** Customer with that ID doesn't exist in system

**Solution:**
1. Go to: **https://yoursite.com/customers**
2. Check if customer exists
3. If not, create customer first:
   - Customer Code: CUST-005
   - Name: New Customer
   - Save
4. Update CSV with correct customer ID
5. Re-upload

### Issue 4: "Duplicate invoice numbers"

**Error:** System rejects import (invoice already exists)

**Cause:** Invoice number already in system

**Solution:**
```
Option A: Filter out already-imported invoices
- Check if invoice exists in /invoices list
- Remove from CSV if already there
- Re-upload cleaned file

Option B: Change invoice numbers (not recommended)
- If numbers conflict, add suffix (INV-2025-001-NEW)
- But this changes historical numbering
- Better to clean duplicates instead
```

### Issue 5: "Payment amount greater than total"

**Error:** Row X: amount_paid > total

**Cause:** amount_paid is more than invoice total

**Solution:**
```
❌ Example error row:
invoice_no,total,amount_paid
INV-2025-001,550.00,600.00  ← 600 > 550 (invalid!)

✓ Fix to:
INV-2025-001,550.00,550.00  ← Amount paid ≤ total
```

---

## Best Practices

### Before Import

1. **Backup data** - Keep original CSV file
2. **Create test file** - Import 10 records first to test
3. **Check all dates** - Ensure all dates are in YYYY-MM-DD format
4. **Verify customers** - Make sure all customer IDs exist
5. **Remove duplicates** - Check for duplicate invoice numbers

### File Organization

```
/Documents/Invoices/
├── Original_Data/
│   ├── 2025_invoices.xlsx (original Excel)
│   └── 2025_invoices_backup.csv (backup copy)
├── Cleaned_Data/
│   └── invoices_2025_cleaned.csv (ready to import)
└── Import_Logs/
    └── import_20260304.txt (import result log)
```

### Batch Strategy

If importing large amount of data:

```
Total: 1000 invoices to import

Batch 1: 2025-01-01 to 2025-04-30 (100 invoices)
  → Import → Verify → Check audit log

Batch 2: 2025-05-01 to 2025-08-31 (300 invoices)
  → Import → Verify → Check audit log

Batch 3: 2025-09-01 to 2025-12-31 (600 invoices)
  → Import → Verify → Check audit log

Why: Easier to spot errors in smaller batches
```

---

## Audit Trail & Records

### Audit Log Entry

Every import creates an audit log entry showing:

```
Module: invoices
Action: batch_import
User: Admin Name
Date: 2026-03-04 10:30:45
Metadata:
  - Total Rows: 150
  - Success Count: 150
  - Error Count: 0
  - First 10 IDs imported: [...]
```

**To view:**
1. Go to: **Admin → Audit Center**
2. Filter by:
   - Module: invoices
   - Action: batch_import
3. See who imported what and when

### Data Integrity

After import, system ensures:

✅ **Created at = invoice_date** (maintains historical dates)  
✅ **Balance due = total - amount_paid** (auto-calculated)  
✅ **Payment status** = UNPAID / PARTIAL / PAID  
✅ **All records logged** in audit trail  
✅ **No data loss** - all imports are tracked  

---

## FAQ

**Q: Can I import with invoice items (line items)?**

A: Current version imports invoice header only. To add items, either:
- Manually add via UI (Create Invoice → Add items)
- Or request API enhancement for item import

**Q: What if I import wrong data?**

A: Admin can:
- Delete invoice (with reason in audit)
- Re-import with correct data
- All actions are logged in audit trail

**Q: How far back can I import (2020 data)?**

A: Yes, system supports any past date. Examples:
- 2020 data: 2020-01-15 (fine)
- 2019 data: 2019-06-30 (fine)
- 2015 data: 2015-12-25 (fine)

**Q: Can I update existing invoices via import?**

A: No, current import creates NEW records only. To update:
- Manually edit invoice (click edit)
- Or delete and re-import

**Q: Maximum file size?**

A: CSV file should be < 10MB. Examples:
- 100 invoices: ~30KB (fine)
- 1000 invoices: ~300KB (fine)
- 10000 invoices: ~3MB (fine)
- 100000+ invoices: split into batches

---

## Summary

| Step | Action | Time |
|---|---|---|
| 1 | Prepare CSV data | 30 mins - 2 hours |
| 2 | Download template | 1 min |
| 3 | Create/upload CSV | 5 mins |
| 4 | Validate & preview | 1 min |
| 5 | Review preview | 5 mins |
| 6 | Confirm import | 1 min |
| 7 | Verify data | 15 mins |
| **Total** | | **1-3 hours** |

---

## Support & Troubleshooting

If you encounter issues:

1. **Check error message** - System shows specific row and error
2. **Review this guide** - Common issues section above
3. **Validate CSV** - Use CSV validator online
4. **Test with small batch** - Import 5 records first
5. **Contact admin support** - If persistent issues

---

**Last Updated:** March 4, 2026  
**Version:** 1.0  
**Author:** System Admin
