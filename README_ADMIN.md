# Panduan Admin SAYS (Sales Activity System)

Dokumen ini menyediakan panduan ringkas untuk pentadbir (Admin) menggunakan sistem SAYS.

## Akses Admin
1. Pergi ke halaman Log Masuk.
2. Masukkan ID Pengguna: `admin`
3. Masukkan Kata Laluan: `password`
4. Klik butang **Login**.

## Papan Pemuka (Dashboard)
Setelah log masuk, anda akan melihat Papan Pemuka Admin yang mempunyai 4 tab utama:

### 1. Analytics (Analisis)
- Melihat prestasi jualan semasa.
- **Top Products**: 5 produk paling laris.
- **Top Agents**: Jurujual dengan jualan tertinggi.
- **Sales Trend**: Graf jualan 7 hari terkini.
- **Low Stock Alerts**: Amaran jika stok fizikal (dari audit) kurang daripada 10 unit.

### 2. Orders (Pesanan)
- Senarai semua pesanan yang masuk dari jurujual.
- Anda boleh menukar status pesanan (contoh: *Pending* -> *Processing* -> *Completed*).
- Klik pada status untuk mengemaskininya.

### 3. Customers (Pelanggan)
- Menguruskan senarai pelanggan/kedai.
- **Tambah Pelanggan**: Klik butang "Add Customer", isi maklumat, dan simpan.
- **Edit/Buang**: Gunakan butang Edit atau Delete pada senarai pelanggan.
- Anda boleh menetapkan lokasi GPS untuk kedai di sini.

### 4. Products (Produk)
- Menguruskan katalog produk.
- **Tambah Produk**: Klik butang "Add Product".
- Isi nama, kod, harga, dan kategori.
- Produk yang ditambah akan serta-merta muncul dalam aplikasi jurujual.

## Nota Teknikal
- **Stok**: Sistem ini menggunakan fail JSON untuk penyimpanan data. Pastikan fail `data/*.json` disandarkan (backup) secara berkala jika perlu.
- **Audit Stok**: Jurujual melakukan audit stok di kedai. Data ini akan muncul dalam laporan "Low Stock Alerts" jika stok rendah.
- **Offline Mode**: Jurujual memerlukan sambungan internet untuk Log Masuk dan Menghantar Pesanan ("Submit").

---
*SAYS v1.0 - Dibangunkan untuk pengurusan jualan yang efisien.*
