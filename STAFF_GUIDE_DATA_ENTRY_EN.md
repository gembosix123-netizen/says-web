# Staff Guide — How to Enter Data into the System

This guide is written for staff responsible for entering sales data into the SAYS system.

---

## Section 1 — Creating a New Sale (Daily)

This is for sales that happen **today or during your current shift**.

### Steps:

**Step 1 — Select Customer**
- Go to **Sales → New Sale**
- Search for the customer's name in the list
- Click the customer's name to select

**Step 2 — Add Products**
- Search for the product in the list
- Click **+** to add it to the cart
- Adjust quantity if needed
- Check the total amount at the bottom

**Step 3 — Select Payment Method**

Choose **one** correct payment method:

| Method | When to Use | What to Fill In |
|--------|-------------|-----------------|
| **Cash** | Customer pays in cash | Cash Bill Receipt No. |
| **Credit (Bill-to-Bill)** | Customer pays later / on credit | Invoice No. / Credit Reference No. |
| **Bank Transfer** | Customer transfers directly to bank | Transfer Reference No. |
| **QR Code** | Customer scans QR to pay | QR Transaction No. |

> ⚠️ **IMPORTANT:** The reference number is **mandatory**. If left empty, the sale cannot be saved.

**Step 4 — Complete**
- Click the **Complete Sale** button
- The system will save the record and return to the Sales page

---

## Section 2 — Importing Past Data (Before the System Was in Use)

This is for sales data from **months before this system was implemented**.

### What you need to prepare:

1. **Request the CSV template** from your Admin or download it from the Import page
2. **Fill in the data** using Excel or Google Sheets
3. **Save as CSV** (File → Save As → CSV UTF-8)
4. **Upload** to the system for validation and saving

---

### CSV Template Format

The template has the following columns:

| Column | Example | Description |
|--------|---------|-------------|
| `month` | `2025-11` | Month (format YEAR-MONTH) |
| `branch` | `Kota Kinabalu` | Branch name |
| `payment_method` | `cash` | Payment method (see list below) |
| `amount` | `1500.00` | Amount in Ringgit |
| `receipt_no` | `CB-KK-202511-001` | Receipt no. (for cash only) |
| `billing_ref_no` | `B2B-KB-202511-001` | Invoice no. (for credit only) |
| `transfer_ref_no` | `TRF-KK-202511-001` | Transfer ref. (for bank transfer only) |
| `qr_txn_ref_no` | `QR-KK-202511-001` | Transaction no. (for QR only) |
| `customer_name` | `ABC Store` | Shop / customer name (optional) |
| `payment_note` | `October Payment` | Additional remarks (optional) |

---

### Valid Payment Methods

Make sure to fill in **exactly** as listed below:

| What to Enter | Meaning |
|---------------|---------|
| `cash` | Cash |
| `bill_to_bill` | Credit / Deferred Payment |
| `bank_transfer` | Bank Transfer |
| `qr_code` | QR Code |
| `card` | Card |
| `ewallet` | eWallet |

---

### Reference Number Rules

Based on the payment method chosen, **fill in only one** corresponding reference number:

- Choose `cash` → fill `receipt_no`, leave others empty
- Choose `bill_to_bill` → fill `billing_ref_no`, leave others empty
- Choose `bank_transfer` → fill `transfer_ref_no`, leave others empty
- Choose `qr_code` → fill `qr_txn_ref_no`, leave others empty

---

### How to Format Reference Numbers

Use this format so numbers stay consistent and do not get mixed up:

| Type | Format | Example |
|------|--------|---------|
| Cash Bill | `CB-[BRANCH]-[YYYYMM]-[NO]` | `CB-KK-202511-001` |
| Bill-to-Bill | `B2B-[BRANCH]-[YYYYMM]-[NO]` | `B2B-KB-202511-001` |
| Bank Transfer | `TRF-[BRANCH]-[YYYYMM]-[NO]` | `TRF-KK-202511-001` |
| QR Code | `QR-[BRANCH]-[YYYYMM]-[NO]` | `QR-KK-202511-001` |

> Branch abbreviations: `KK` = Kota Kinabalu, `KB` = Kinabatangan

---

### Import Steps:

**Step 1 — Download Template**
- Go to the **Backdated Import** menu (in Admin Panel)
- Click the **Download Template** button

**Step 2 — Fill In Data**
- Open the template file in Excel
- Enter one row per transaction
- Do not change the column names (first row)
- Save as **CSV UTF-8**

**Step 3 — Upload File**
- Return to the **Backdated Import** page
- Click **Choose File** and select your CSV file

**Step 4 — Dry Run (Validation)**
- Click the **Validate (Dry Run)** button
- The system will check all rows
- If there are errors, the system will show **which rows are invalid**
- Fix them in Excel and re-upload

**Step 5 — Confirm Import**
- Once all rows are valid (no errors)
- Click the **Confirm Import** button
- The system will save all records to the database
- A "Import Successful" message will appear

---

## Section 3 — Common Mistakes & How to Fix Them

| Problem | Cause | How to Fix |
|---------|-------|------------|
| "Receipt number required" | Chose `cash` but `receipt_no` is empty | Fill in the receipt number |
| "Format must be YYYY-MM" | Month entered as `11/2025` or `Nov 2025` | Change to `2025-11` |
| "Invalid payment method" | Wrong spelling, e.g. `Cash` (capital letter) | Use lowercase: `cash` |
| "Amount must be a positive number" | `RM` symbol in the amount column | Enter numbers only: `1500.00` |
| Sale cannot be submitted | Mandatory fields are not filled | Check all fields marked with a red ★ |

---

## Section 4 — Frequently Asked Questions

**Q: Can I enter data from more than one month in a single CSV file?**
Yes. Each row can have a different month.

**Q: How many rows can I import at once?**
Maximum 500 rows per import.

**Q: What happens if I import the same data twice?**
The system will add a new record each time. Always review before importing to avoid duplicates.

**Q: Who can perform backdated data import?**
Only **Admin** and **Main Admin** have access to the Backdated Import page.

**Q: How do I know if the import was successful?**
After clicking Confirm Import, the system will show a green "Import Successful" message along with the number of records saved.

---

*For further assistance, contact your system Admin or branch supervisor.*
