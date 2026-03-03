# Audit Module UAT Checklist (Stabilization)

Dokumen ini untuk semakan akhir sebelum release modul audit.

## 1) Pre-Check (Wajib)

- [ ] Pastikan migration sudah run: `migrations/20260226_add_audit_tables.sql`
- [ ] Pastikan table wujud di DB:
  - [ ] `audit_events`
  - [ ] `audit_event_changes`
  - [ ] `audit_import_batches`
- [ ] Pastikan role test account tersedia:
  - [ ] Main Admin
  - [ ] Admin (branch)
  - [ ] Sales (untuk negative test)
- [ ] Pastikan aplikasi boleh login/logout normal

## 2) Access Control UAT

### 2.1 Audit Center access
- [ ] Login Main Admin → boleh buka `/admin/audit-center`
- [ ] Login Admin → boleh buka `/admin/audit-center` (data branch sendiri)
- [ ] Login Sales → tidak boleh akses (`403` atau redirect)

Expected:
- Main Admin: semua branch
- Admin: branch sendiri sahaja
- Sales: deny

## 3) Critical Action UAT (Reason/Reference)

## 3.1 Delete Sales
- [ ] Cuba delete sales tanpa reason → mesti gagal (`400`)
- [ ] Delete sales dengan reason + optional reference → berjaya
- [ ] Semak rekod audit tercipta dengan module `sales`, action `delete_sale`

Expected fields:
- status: `success`
- reason: tidak kosong
- reference_no: ikut input (jika ada)

## 3.2 Delete User
- [ ] Cuba delete user tanpa reason → mesti gagal (`400`)
- [ ] Delete user dengan reason/reference → berjaya
- [ ] Semak audit module `user_management`, action `delete_user`

## 3.3 Delete Order
- [ ] Tanpa reason → mesti gagal (`400`)
- [ ] Dengan reason/reference → berjaya
- [ ] Semak audit module `orders`, action `delete_order`

## 3.4 Delete Inventory Item
- [ ] Tanpa reason → mesti gagal (`400`)
- [ ] Dengan reason/reference → berjaya
- [ ] Semak audit module `inventory`, action `delete_inventory_item`

## 3.5 Day End Close
- [ ] Close day end tanpa reconciliation notes → mesti gagal (`400`)
- [ ] Close day end dengan notes + optional reference → berjaya
- [ ] Semak audit module `day_end`, action `close_day_end`

## 4) Audit Center Functional UAT

### 4.1 List & Pagination
- [ ] List load tanpa error
- [ ] `Previous/Next` berfungsi
- [ ] Page size (25/50/100/200) berfungsi
- [ ] Total records & total pages betul

### 4.2 Filters
- [ ] Filter by module
- [ ] Filter by status
- [ ] Filter by reference no
- [ ] Filter date range
- [ ] Kombinasi filter (module + status + reference + date)

Expected:
- Data yang dipaparkan konsisten dengan filter

### 4.3 Column display
- [ ] Column `Reference` dipaparkan
- [ ] Column `Reason` dipaparkan
- [ ] Status badge (`success`/`failed`/`denied`) betul

## 5) CSV Export UAT

- [ ] Export CSV tanpa filter berjaya
- [ ] Export CSV dengan filter (module/status/reference/date) berjaya
- [ ] File boleh dibuka di Excel/Sheets
- [ ] Header CSV lengkap termasuk `reference_no` dan `reason`

## 6) Branch Segregation UAT

- [ ] Main Admin nampak event semua branch
- [ ] Admin tidak nampak event branch lain
- [ ] Export CSV oleh Admin hanya branch sendiri

## 7) Negative & Resilience UAT

- [ ] API `/api/audit/events` tanpa login → `401`
- [ ] API `/api/audit/export` tanpa login → `401`
- [ ] Role tidak sah cuba akses audit → `403`
- [ ] Uji input reference yang kosong/normal/panjang munasabah

## 8) Smoke Performance UAT

- [ ] Audit list page load < 3s untuk page size 50
- [ ] Export 1k rows selesai tanpa timeout

## 9) Release Gate (Sign-Off)

- [ ] Backend sign-off
- [ ] Frontend sign-off
- [ ] QA sign-off
- [ ] Product owner sign-off

Release Decision:
- [ ] GO
- [ ] NO-GO

## 10) Quick SQL Verify (Optional)

Contoh semak event terbaru:

```sql
SELECT created_at, module, action, status, reason, reference_no, branch
FROM audit_events
ORDER BY created_at DESC
LIMIT 50;
```

Contoh semak perubahan field-level:

```sql
SELECT e.created_at, e.module, e.action, c.field_name, c.old_value, c.new_value
FROM audit_events e
JOIN audit_event_changes c ON c.event_id = e.id
ORDER BY e.created_at DESC
LIMIT 100;
```
