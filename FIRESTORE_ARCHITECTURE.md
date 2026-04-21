/**
 * SAYS 2.0 - SENIBINA PANGKALAN DATA FIRESTORE
 * ============================================
 *
 * Dokumen ini menerangkan senibina Firestore yang boleh diskala serta
 * selamat dengan kawalan RBAC (Role-Based Access Control) dan struktur kos optimum.
 *
 * Prinsip Teras:
 * 1. Mandat Satu Fail: Ambil keseluruhan dataset dalam satu kueri, tapis di sisi klien
 * 2. Hirarki rata bagi mengelakkan keperluan indeks kompleks
 * 3. Penguatkuasaan RBAC melalui Security Rules
 * 4. Pengoptimuman kos melalui kueri yang cekap
 */

// ============================================================================
// STRUKTUR KOLEKSI
// ============================================================================

// 1. USERS Collection
// ----
// Path: /users/{userId}
// Tujuan: Simpan profil pengguna dan metadata pengesahan
// Saiz: Kecil (biasanya < 10KB setiap dokumen)
// Corak bacaan: Autentikasi, bacaan profil pengguna

{
  "userId": "string",
  "username": "string",
  "email": "string",
  "passwordHash": "string",  // JANGAN sesekali simpan kata laluan biasa
  "role": "Main Admin | Admin | Sales",
  "branch": "Kota Kinabalu | Kinabatangan | HQ",
  "name": "string",
  "status": "active | inactive | suspended",
  "commissionRate": "number (0.0-1.0)",
  "salary": "number (untuk Admin/Main Admin)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLogin": "timestamp",
  "permissions": ["string"]  // Custom permissions array
}

// 2. PRODUCTS Collection
// ----
// Path: /products/{productId}
// Tujuan: Katalog produk induk (single source of truth)
// Saiz: Sederhana (1-5KB setiap produk)
// Corak bacaan: Bacaan kerap, penulisan sekali-sekala

{
  "productId": "string",
  "sku": "string",
  "name": "string",
  "description": "string",
  "category": "string",
  "price": "number",
  "costPrice": "number",
  "images": ["url1", "url2"],
  "specifications": { /* flexible JSON */ },
  "minStockLevel": "number",
  "maxStockLevel": "number",
  "supplier": "string",
  "isActive": "boolean",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "metadata": { /* data tambahan */ }
}

// 3. INVENTORY Collection
// ----
// Path: /inventory/{inventoryId}
// Tujuan: Tahap stok khusus cawangan
// Reka bentuk: Data produk dinormalisasi + kuantiti untuk bacaan pantas
// Corak bacaan: Bacaan frekuensi tinggi, penulisan sederhana

{
  "inventoryId": "string",
  "productId": "string",
  "branch": "string",
  "quantity": "number",
  "reservedQuantity": "number",
  "availableQuantity": "number",  // Dikira: quantity - reservedQuantity
  "lastRestockDate": "timestamp",
  "lastCountDate": "timestamp",
  "status": "in-stock | low-stock | out-of-stock",
  "batchNumbers": ["string"],  // Untuk menjejak nombor lot
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}

// 4. TRANSACTIONS Collection
// ----
// Path: /transactions/{transactionId}
// Tujuan: Semua pergerakan kewangan dan inventori
// Saiz: Besar (banyak dokumen setiap hari)
// Corak bacaan: Pelaporan, audit, penyelesaian

{
  "transactionId": "string",
  "type": "sale | return | restock | adjustment | commission",
  "status": "pending | completed | cancelled",
  "userId": "string",  // Pengguna yang memulakan transaksi
  "branch": "string",
  "amount": "number",
  "items": [
    {
      "productId": "string",
      "quantity": "number",
      "unitPrice": "number",
      "totalPrice": "number"
    }
  ],
  "customerId": "string",  // Jika berkenaan
  "paymentMethod": "cash | card | bank-transfer",
  "reference": "string",  // Nombor invois/resit
  "notes": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "completedAt": "timestamp",
  "metadata": { /* fleksibel */ }
}

// 5. CUSTOMERS Collection
// ----
// Path: /customers/{customerId}
// Tujuan: Pengurusan hubungan pelanggan (CRM)
// Saiz: Kecil ke sederhana (bergantung bilangan pelanggan)
// Corak bacaan: Carian, pelaporan, segmentasi

{
  "customerId": "string",
  "name": "string",
  "phone": "string",
  "email": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "postalCode": "string",
  "branch": "string",
  "type": "retail | wholesale | individual",
  "status": "active | inactive",
  "totalPurchases": "number",
  "totalSpent": "number",
  "creditLimit": "number",
  "credits": "number",
  "notes": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}

// 6. COMMISSIONS Collection
// ----
// Path: /commissions/{commissionId}
// Tujuan: Menjejak pengiraan komisen dan pembayaran
// Saiz: Sederhana (satu setiap transaksi jika perlu)
// Corak bacaan: Penyelesaian berkala, pelaporan

{
  "commissionId": "string",
  "transactionId": "string",
  "userId": "string",
  "branch": "string",
  "baseAmount": "number",
  "commissionRate": "number",
  "commissionAmount": "number",
  "status": "pending | paid | cancelled",
  "paymentDate": "timestamp",
  "notes": "string",
  "createdAt": "timestamp",
  "paidAt": "timestamp"
}

// 7. AUDITS Collection
// ----
// Path: /audits/{auditId}
// Tujuan: Log pematuhan dan keselamatan
// Saiz: Besar (satu bagi setiap tindakan penting)
// Corak bacaan: Laporan pematuhan, semakan keselamatan

{
  "auditId": "string",
  "action": "create | read | update | delete | login | logout",
  "entityType": "user | product | inventory | transaction",
  "entityId": "string",
  "userId": "string",
  "branch": "string",
  "changes": {
    "before": { /* previous values */ },
    "after": { /* new values */ }
  },
  "ipAddress": "string",
  "userAgent": "string",
  "status": "success | failure",
  "reason": "string",  // Jika gagal
  "timestamp": "timestamp"
}

// 8. SETTLEMENTS Collection
// ----
// Path: /settlements/{settlementId}
// Tujuan: Penyata kewangan berkala
// Saiz: Kecil ke sederhana
// Corak bacaan: Laporan bulanan/mingguan

{
  "settlementId": "string",
  "period": "string",  // format "2024-02"
  "branch": "string",
  "totalSales": "number",
  "totalCommissions": "number",
  "totalExpenses": "number",
  "netProfit": "number",
  "commissionBreakdown": {
    "userId": "number"  // Peta ID pengguna kepada jumlah komisen
  },
  "status": "draft | finalized | reconciled",
  "createdAt": "timestamp",
  "finalizedAt": "timestamp"
}

// ============================================================================
// FIRESTORE SECURITY RULES (Role-Based Access Control)
// ============================================================================

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Fungsi utiliti
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isMainAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Main Admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['Main Admin', 'Admin'];
    }
    
    function isSalesUser() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Sales';
    }
    
    function getUserBranch() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.branch;
    }
    
    function userOwnsDocument(documentBranch) {
      return getUserBranch() == documentBranch || isMainAdmin();
    }

    // ========================================
    // PERATURAN KOLEKSI USERS
    // ========================================
    match /users/{userId} {
      // Baca: Main Admin boleh baca semua, pengguna biasa hanya diri sendiri
      allow read: if isMainAdmin() || request.auth.uid == userId;
      
      // Cipta: Main Admin sahaja
      allow create: if isMainAdmin();
      
      // Kemas kini: Main Admin semua medan, pengguna terhad
      allow update: if isMainAdmin() || 
                       (request.auth.uid == userId && 
                        !request.resource.data.diff(resource.data).affectedKeys()
                          .hasAny(['role', 'permissions', 'salary']));

      // Padam: Main Admin sahaja
      allow delete: if isMainAdmin();
    }

    // ========================================
    // PERATURAN KOLEKSI PRODUCTS
    // ========================================
    match /products/{productId} {
      // Baca: Semua pengguna sah
      allow read: if isAuthenticated();
      
      // Cipta/Kemas kini: Admin dan ke atas
      allow create, update: if isAdmin();
      
      // Padam: Main Admin sahaja
      allow delete: if isMainAdmin();
    }

    // ========================================
    // PERATURAN KOLEKSI INVENTORY
    // ========================================
    match /inventory/{inventoryId} {
      // Baca: Pengguna baca inventori cawangan sendiri, Main Admin semua
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || resource.data.branch == getUserBranch());
      
      // Cipta/Kemas kini: Admin+ untuk cawangan masing-masing
      allow create, update: if isAdmin() && 
                              userOwnsDocument(request.resource.data.branch);
      
      // Padam: Main Admin sahaja
      allow delete: if isMainAdmin();
    }

    // ========================================
    // PERATURAN KOLEKSI TRANSACTIONS
    // ========================================
    match /transactions/{transactionId} {
      // Baca: Pengguna lihat transaksi cawangan sendiri, Main Admin semua
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || resource.data.branch == getUserBranch());
      
      // Cipta: Sales/Admin dalam cawangan masing-masing
      allow create: if (isSalesUser() || isAdmin()) && 
                      userOwnsDocument(request.resource.data.branch);
      
      // Kemas kini: Terhad (batal, lengkap), Main Admin akses penuh
      allow update: if isMainAdmin() ||
                      (request.auth.uid == resource.data.userId && 
                       resource.data.status == 'pending' &&
                       request.resource.data.status in ['completed', 'cancelled']);
      
      // Padam: Main Admin sahaja
      allow delete: if isMainAdmin();
    }

    // ========================================
    // PERATURAN KOLEKSI CUSTOMERS
    // ========================================
    match /customers/{customerId} {
      // Baca: Pengguna lihat pelanggan cawangan sendiri, Main Admin semua
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || resource.data.branch == getUserBranch());
      
      // Cipta: Sales dan Admin
      allow create, update: if (isSalesUser() || isAdmin()) && 
                              userOwnsDocument(request.resource.data.branch);
      
      // Padam: Admin dan ke atas
      allow delete: if isAdmin();
    }

    // ========================================
    // PERATURAN KOLEKSI COMMISSIONS
    // ========================================
    match /commissions/{commissionId} {
      // Baca: Sales lihat sendiri, Admin lihat cawangan, Main Admin semua
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || 
                      isAdmin() && resource.data.branch == getUserBranch() ||
                      isSalesUser() && resource.data.userId == request.auth.uid);
      
      // Cipta: Admin memicu pengiraan komisen
      allow create: if isAdmin();
      
      // Kemas kini: Admin hanya boleh ubah status
      allow update: if isAdmin() && 
                      request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(['status', 'paymentDate', 'paidAt']);
      
      // Padam: Main Admin sahaja
      allow delete: if isMainAdmin();
    }

    // ========================================
    // PERATURAN KOLEKSI AUDITS
    // ========================================
    match /audits/{auditId} {
      // Baca: Admin+ untuk cawangan sendiri, Main Admin semua
      allow read: if isMainAdmin() || 
                     (isAdmin() && resource.data.branch == getUserBranch());
      
      // Cipta: Sistem sahaja (trigger backend) - klien tidak dibenarkan
      allow create: if false;
      
      // Kemas kini/Padam: Tidak dibenarkan
      allow update, delete: if false;
    }

    // ========================================
    // PERATURAN KOLEKSI SETTLEMENTS
    // ========================================
    match /settlements/{settlementId} {
      // Baca: Admin lihat cawangan sendiri, Main Admin semua
      allow read: if isMainAdmin() || 
                     (isAdmin() && resource.data.branch == getUserBranch());
      
      // Cipta/Kemas kini: Main Admin sahaja
      allow create, update: if isMainAdmin();
      
      // Padam: Main Admin sahaja
      allow delete: if isMainAdmin();
    }
  }
}

// ============================================================================
// STRUKTUR ENDPOINT API (Next.js)
// ============================================================================

// GET /api/users
// - Dapatkan semua pengguna (Main Admin) atau diri sendiri (pengguna sah)
// - Param kueri: ?branch=*, ?role=*
// - Pulangan: Senarai pengguna (satu kueri, tapis di klien)

// POST /api/users
// - Cipta pengguna baharu (Main Admin sahaja)
// - Body: { username, email, role, branch, salary, commissionRate }

// PUT /api/users/{userId}
// - Kemas kini data pengguna (Main Admin) atau pemilik akaun
// - Body: { name, email, ... (medan dibenarkan) }

// DELETE /api/users/{userId}
// - Padam pengguna (Main Admin sahaja)

// GET /api/products
// - Ambil semua produk (sekali baca koleksi, tapis di klien)
// - Pulangan: Senarai produk

// POST /api/products
// - Cipta produk (Admin ke atas)
// - Body: { sku, name, price, costPrice, ... }

// GET /api/inventory
// - Ambil inventori (pengguna lihat cawangan sendiri, Main Admin lihat semua)
// - Param kueri: ?branch=*
// - Pulangan: Data inventori penuh (sekali baca, tapis di klien)

// POST /api/inventory
// - Cipta/kemas kini entri inventori (Admin+)
// - Body: { productId, branch, quantity, ... }

// GET /api/transactions
// - Ambil transaksi (pengguna lihat cawangan sendiri, Main Admin lihat semua)
// - Param kueri: ?branch=*, ?startDate=*, ?endDate=*, ?type=*
// - Pulangan: Senarai transaksi (sekali baca, tapis di klien)

// POST /api/transactions
// - Cipta transaksi (Sales atau Admin)
// - Body: { type, items, amount, customerId, ... }

// GET /api/commissions
// - Ambil komisen (Sales lihat sendiri, Admin lihat cawangan)
// - Param kueri: ?userId=*, ?branch=*, ?status=*
// - Pulangan: Data komisen

// GET /api/settlements
// - Ambil penyelesaian (berhalaman, Admin+ sahaja)
// - Param kueri: ?branch=*, ?period=*
// - Pulangan: Rekod penyelesaian

// GET /api/audits
// - Ambil log audit (Admin+ sahaja)
// - Param kueri: ?branch=*, ?entityType=*, ?startDate=*, ?endDate=*
// - Pulangan: Rekod audit

// ============================================================================
// CORAK PENGAMBILAN DATA DI SISI KLIEN (DRY)
// ============================================================================

// Contoh hook untuk mengambil dan menapis data:
/*
export function useFirestoreData<T>(
  collection: string,
  filters?: { field: string; operator: '==' | '<' | '>'; value: any }[]
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Ambil keseluruhan koleksi (satu kueri)
        const response = await fetch(`/api/${collection}`);
        const allData = await response.json();
        
        // Tapis di sisi klien
        const filtered = allData.filter((item: T) => {
          if (!filters) return true;
          return filters.every((filter) => {
            const itemValue = (item as any)[filter.field];
            switch (filter.operator) {
              case '==':
                return itemValue === filter.value;
              case '<':
                return itemValue < filter.value;
              case '>':
                return itemValue > filter.value;
              default:
                return true;
            }
          });
        });
        
        setData(filtered);
      } catch (err) {
        setError('Gagal mengambil data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [collection, filters]);

  return { data, isLoading, error };
}
*/

// ============================================================================
// NOTA PENGOPTIMUMAN KOS
// ============================================================================

// 1. Mandat Satu Fail:
//    - Ambil keseluruhan dataset sekali, tapis di klien
//    - Mengurangkan operasi bacaan Firestore
//    - Mengelak keperluan indeks komposit kompleks

// 2. Strategi Denormalisasi:
//    - Gandakan data produk dalam inventori untuk bacaan pantas
//    - Kemas kini kedua-dua dokumen dalam transaksi (kekalkan konsistensi)
//    - Timbang tara: kos storan vs. kos bacaan (sesuai untuk aplikasi berat bacaan)

// 3. Pengoptimuman Indeks:
//    - Firestore mengindeks medan ringkas secara automatik
//    - Hanya perlu indeks kompaun untuk kueri berbilang medan
//    - Penapisan di klien menghapus keperluan indeks mahal

// 4. Operasi Berkumpulan:
//    - Guna batch write untuk kemas kini pelbagai dokumen
//    - Mengurangkan overhead transaksi
//    - Contoh: Kemas kini inventori + cipta transaksi dalam satu batch

// 5. Pagination:
//    - Untuk set keputusan besar, gunakan pagination berasaskan kursor
//    - Ambil 100 dokumen setiap kali, kursor ke batch seterusnya
//    - Mengurangkan jalur lebar dan masa pemprosesan

// ============================================================================
