# Panduan Staff — Cara Masukkan Data Dalam Sistem

Panduan ini ditulis khas untuk staff yang bertanggungjawab memasukkan data jualan ke dalam sistem SAYS.

---

## Bahagian 1 — Cara Buat Jualan Baru (Harian)

Ini untuk jualan yang berlaku **hari ini atau semasa kerja**.

### Langkah-langkah:

**Langkah 1 — Pilih Pelanggan**
- Pergi ke menu **Sales → Jualan Baru**
- Cari nama pelanggan dalam senarai
- Klik nama pelanggan untuk pilih

**Langkah 2 — Tambah Produk**
- Cari produk dalam senarai
- Klik **+** untuk tambah ke troli
- Ubah kuantiti jika perlu
- Semak jumlah di bahagian bawah

**Langkah 3 — Pilih Kaedah Bayaran**

Pilih **satu** kaedah bayaran yang betul:

| Kaedah | Bila Guna | Apa Perlu Diisi |
|--------|-----------|-----------------|
| **Tunai** | Customer bayar cash | No. Resit Cash Bill |
| **Kredit (Bill-to-Bill)** | Customer bayar kemudian / hutang | No. Invois / No. Rujukan Kredit |
| **Bank Transfer** | Customer transfer terus ke bank | No. Rujukan Pemindahan |
| **QR Code** | Customer scan QR | No. Transaksi QR |

> ⚠️ **PENTING:** Nombor rujukan **wajib diisi**. Kalau kosong, jualan tidak boleh disimpan.

**Langkah 4 — Selesai**
- Klik butang **Selesai Jualan**
- Sistem akan simpan dan kembali ke halaman Sales

---

## Bahagian 2 — Cara Import Data Lama (Sebelum Sistem Digunakan)

Ini untuk data jualan **bulan-bulan sebelum sistem ini dikuatkuasakan**.

### Apa yang perlu disediakan:

1. **Minta template CSV** daripada Admin atau muat turun di halaman Import
2. **Isi data** dalam template menggunakan Excel atau Google Sheets
3. **Simpan sebagai CSV** (File → Save As → CSV UTF-8)
4. **Upload** ke sistem untuk semakan dan simpan

---

### Format Template CSV

Template mempunyai kolum-kolum berikut:

| Kolum | Contoh | Keterangan |
|-------|--------|------------|
| `month` | `2025-11` | Bulan (format TAHUN-BULAN) |
| `branch` | `Kota Kinabalu` | Nama cawangan |
| `payment_method` | `cash` | Kaedah bayaran (lihat senarai bawah) |
| `amount` | `1500.00` | Jumlah dalam Ringgit |
| `receipt_no` | `CB-KK-202511-001` | No. resit (untuk tunai sahaja) |
| `billing_ref_no` | `B2B-KB-202511-001` | No. invois (untuk kredit sahaja) |
| `transfer_ref_no` | `TRF-KK-202511-001` | No. rujukan (untuk bank transfer sahaja) |
| `qr_txn_ref_no` | `QR-KK-202511-001` | No. transaksi (untuk QR sahaja) |
| `customer_name` | `Kedai ABC` | Nama kedai/pelanggan (optional) |
| `payment_note` | `Bayaran Oktober` | Catatan tambahan (optional) |

---

### Kaedah Bayaran Yang Sah

Pastikan isi **tepat** seperti dalam senarai ini:

| Yang Perlu Diisi | Maksudnya |
|-----------------|-----------|
| `cash` | Tunai |
| `bill_to_bill` | Kredit / Hutang |
| `bank_transfer` | Pemindahan Bank |
| `qr_code` | QR Code |
| `card` | Kad |
| `ewallet` | eWallet |

---

### Peraturan Nombor Rujukan

Ikut kaedah bayaran yang dipilih, **hanya isi satu nombor rujukan** yang berkaitan:

- Pilih `cash` → isi `receipt_no`, kosongkan yang lain
- Pilih `bill_to_bill` → isi `billing_ref_no`, kosongkan yang lain
- Pilih `bank_transfer` → isi `transfer_ref_no`, kosongkan yang lain
- Pilih `qr_code` → isi `qr_txn_ref_no`, kosongkan yang lain

---

### Cara Buat Nombor Rujukan

Guna format ini supaya nombor tidak bercampur:

| Jenis | Format | Contoh |
|-------|--------|--------|
| Cash Bill | `CB-[CAWANGAN]-[YYYYMM]-[NO]` | `CB-KK-202511-001` |
| Bill-to-Bill | `B2B-[CAWANGAN]-[YYYYMM]-[NO]` | `B2B-KB-202511-001` |
| Bank Transfer | `TRF-[CAWANGAN]-[YYYYMM]-[NO]` | `TRF-KK-202511-001` |
| QR Code | `QR-[CAWANGAN]-[YYYYMM]-[NO]` | `QR-KK-202511-001` |

> Singkatan cawangan: `KK` = Kota Kinabalu, `KB` = Kinabatangan

---

### Langkah Import Data:

**Langkah 1 — Muat Turun Template**
- Pergi ke menu **Import Data Lama** (dalam Admin Panel)
- Klik butang **Download Template**

**Langkah 2 — Isi Data**
- Buka fail template dalam Excel
- Isi satu baris untuk setiap transaksi
- Jangan ubah nama kolum (baris pertama)
- Simpan sebagai **CSV UTF-8**

**Langkah 3 — Upload Fail**
- Kembali ke halaman **Import Data Lama**
- Klik **Pilih Fail** dan pilih fail CSV kamu

**Langkah 4 — Dry Run (Semakan)**
- Klik butang **Validate (Dry Run)**
- Sistem akan semak semua baris
- Jika ada error, sistem akan tunjukkan **baris mana yang salah**
- Betulkan dalam Excel dan upload semula

**Langkah 5 — Confirm Import**
- Selepas semua baris sah (tiada error)
- Klik butang **Confirm Import**
- Sistem akan simpan semua data ke database
- Muncul mesej "Import Berjaya"

---

## Bahagian 3 — Kesalahan Biasa & Cara Betulkan

| Masalah | Punca | Cara Betulkan |
|---------|-------|---------------|
| "Nombor resit diperlukan" | Pilih `cash` tapi `receipt_no` kosong | Isi nombor resit |
| "Format mesti YYYY-MM" | Bulan diisi sebagai `11/2025` atau `Nov 2025` | Tukar kepada `2025-11` |
| "Kaedah bayaran tidak sah" | Salah eja, contoh `Cash` (huruf besar) | Guna huruf kecil: `cash` |
| "Jumlah mesti nombor positif" | Ada simbol `RM` dalam kolum amount | Isi nombor sahaja: `1500.00` |
| Jualan tidak boleh submit | Semua field wajib belum diisi | Semak field yang ada tanda ★ merah |

---

## Bahagian 4 — Soalan Lazim

**S: Boleh saya isi data lebih dari satu bulan dalam satu fail CSV?**
Ya, boleh. Setiap baris boleh ada bulan berbeza.

**S: Berapa banyak baris yang boleh diimport sekali?**
Maksimum 500 baris.

**S: Bagaimana jika saya import data yang sama dua kali?**
Sistem akan menambah rekod baru. Pastikan semak sebelum import untuk elak pendua.

**S: Siapa yang boleh buat import data lama?**
Hanya **Admin** dan **Main Admin** boleh akses halaman Import Data Lama.

**S: Bagaimana saya nak tahu import berjaya?**
Selepas klik Confirm Import, sistem tunjuk mesej hijau "Import Berjaya" dan bilangan rekod yang disimpan.

---

*Untuk bantuan lanjut, hubungi Admin sistem atau ketua cawangan anda.*
