# Panduan Live Run Sistem SAYS

Ikuti langkah-langkah ini untuk menguji sistem sepenuhnya dari A-Z.

## Fasa 1: Persediaan Admin (Setup)
1. **Login sebagai Admin:**
   - Username: `admin`
   - Password: `password`
2. **Tambah Produk:**
   - Pergi ke tab **Products**.
   - Klik **Add Product**.
   - Masukkan: `Roti Gardenia`, Unit: `Buku`, Harga: `4.50`, Stok Awal: `100`.
   - Simpan.
3. **Tambah Kedai & Assign:**
   - Pergi ke tab **Customers**.
   - Klik **Add Customer**.
   - Masukkan: `Kedai Runcit Ali`, Alamat: `Jalan 1`, Pilih Sales: `Sales Ali`.
   - Simpan.

## Fasa 2: Persediaan Staf (Loading)
1. **Logout Admin** dan **Login sebagai Sales:**
   - Username: `sales1`
   - Password: `password`
2. **Loading Barang:**
   - Pergi ke tab **Stock** (Ikon Lori).
   - Di bahagian "Daily Loading", pilih `Roti Gardenia`.
   - Masukkan Qty: `50`.
   - Klik **Submit Loading**.
   - Lihat stok bertambah di "Van Inventory".

## Fasa 3: Operasi Jualan (Field)
1. **Lawatan Kedai:**
   - Pergi ke tab **Visits**.
   - Klik `Kedai Runcit Ali`.
2. **Proses Lawatan:**
   - **Check-In:** Klik "Confirm Check-In".
   - **Audit Freezer:** Masukkan baki semasa (contoh: `5`), klik "Submit".
   - **Exchange:** (Optional) Jika ada barang rosak, rekod di sini.
   - **Product Catalog:** Tambah item jualan (contoh: `10` unit Roti).
   - **Payment:** Pilih "Cash". Masukkan bayaran.
   - **Summary:** Ambil gambar bukti (dummy), klik "Confirm Submit".
   - **Resit:** Klik "Print Receipt" untuk lihat PDF.

## Fasa 4: Penutupan (Settlement)
1. **End Day (Staf):**
   - Di Dashboard Sales, klik butang **End Day** (Kunci Merah, atas kanan).
   - Semak jumlah Cash.
   - Klik **Confirm End Day**.
   - Logout.
2. **Verifikasi (Admin):**
   - Login semula sebagai `admin`.
   - Pergi ke tab **Settlement** (Ikon Dollar).
   - Klik pada laporan `sales1`.
   - Klik **Verify Cash Collection**.
   - Status bertukar ke "Verified".

## Semakan Akhir
- Pergi ke **Analytics**.
- Lihat "Master Sales Report" dan "Sales Trend" telah dikemaskini.
