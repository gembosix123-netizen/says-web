# Daily Audit Ops Checklist (5–10 min)

Checklist ini untuk rutin harian Main Admin/Admin supaya audit trail sentiasa bersih dan boleh dikesan.

## A) Start of Day (Pagi)

- [ ] Login sebagai Main Admin atau Admin.
- [ ] Buka Audit Center: `/admin/audit-center`.
- [ ] Set `Date Range` kepada hari semalam hingga hari ini.
- [ ] Set `Status` kepada `failed` dan semak jika ada event gagal.
- [ ] Set `Status` kepada `denied` dan semak jika ada cubaan akses tidak sah.
- [ ] Catat sebarang isu kritikal dalam log operasi harian.

## B) Mid-Day Quick Check (Tengah Hari)

- [ ] Filter `module=sales`, semak action `delete_sale`.
- [ ] Pastikan setiap delete ada `reason` dan (jika ada) `reference`.
- [ ] Filter `module=user_management`, semak `delete_user` / `reassign_branch`.
- [ ] Pastikan tiada tindakan luar polisi role/branch.

## C) End of Day (Petang/Malam)

- [ ] Filter `module=day_end`, semak `close_day_end` berjaya.
- [ ] Pastikan `reason` dan `reference` direkod untuk close day end.
- [ ] Export CSV Audit untuk arkib harian.
- [ ] Simpan fail export ikut format nama standard.

Contoh nama fail arkib:
- `AUDIT_YYYY-MM-DD_BRANCH.csv`
- `AUDIT_2026-02-26_HQ.csv`

## D) Incident Handling (Jika ada event failed/denied)

- [ ] Klik/filter event bermasalah mengikut `module` dan `reference`.
- [ ] Kenalpasti pengguna (`actor_name`, `actor_role`, `branch`).
- [ ] Semak `reason`, `action`, `entity`.
- [ ] Jika perlu, buka tiket insiden dan letak `reference no`.
- [ ] Tandakan status insiden: Open / Investigating / Resolved.

## E) Daily Sign-Off

- [ ] Semua event failed/denied telah disemak.
- [ ] CSV audit harian telah diexport dan disimpan.
- [ ] Ringkasan harian dihantar kepada owner (jika perlu).
- [ ] Sign-off oleh pegawai bertugas.

---

# SOP Step-by-Step: Cara Buat Kerja Harian Audit

## 1) Buka modul audit
1. Login ke sistem.
2. Pergi ke `/admin/audit-center`.
3. Pastikan role anda betul (Main Admin/Admin).

## 2) Semak event berisiko (failed/denied)
1. Pilih `Status = failed`.
2. Pilih julat tarikh (hari semasa).
3. Klik `Apply Filter`.
4. Ulang untuk `Status = denied`.
5. Jika jumpa event pelik, catat `module`, `action`, `actor`, `reference`.

## 3) Semak tindakan kritikal
1. Set `Module = sales`.
2. Semak action `delete_sale`.
3. Pastikan kolum `Reason` tidak kosong.
4. Jika ada `Reference`, pastikan format rujukan betul.
5. Ulang langkah sama untuk:
   - `user_management`
   - `inventory`
   - `orders`
   - `day_end`

## 4) Export audit harian
1. Kekalkan filter yang dikehendaki (contoh: satu hari penuh).
2. Klik `Export CSV`.
3. Simpan fail ikut format standard.
4. Upload/simpan ke folder arkib pasukan.

## 5) Tindakan jika jumpa anomali
1. Ambil screenshot event.
2. Salin `reference no` dan butiran event.
3. Buat tiket (Jira/ClickUp/Notion) dengan severity:
   - P1: data sensitif / akses tidak sah
   - P2: proses gagal tapi ada workaround
   - P3: isu kosmetik / non-blocking
4. Assign owner dan tarikh sasaran pembetulan.

## 6) Tutup operasi harian
1. Pastikan tiada event kritikal tertinggal.
2. Isi ringkasan ringkas harian:
   - Jumlah failed
   - Jumlah denied
   - Jumlah incident dibuka
3. Sign-off.

---

## Template Ringkasan Harian (Copy-Paste)

Tarikh: ____________

- Failed events: ____
- Denied events: ____
- Critical incidents (P1/P2): ____
- CSV exported: [ ] Ya [ ] Tidak
- Disemak oleh: ____________
- Catatan: ____________________________________
