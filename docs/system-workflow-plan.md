# Pelan workflow sistem SAYS 2.0

Dokumen ini dibuat selepas semakan repo. Pelan workflow sedia ada yang ditemui ialah
[`docs/void-invoice-workflow-plan.md`](void-invoice-workflow-plan.md), tetapi dokumen itu khusus
untuk aliran void invois/gantian. Dokumen ini pula menerangkan workflow sistem secara menyeluruh
berdasarkan modul dan kod semasa.

---

## 1. Skop sistem

SAYS 2.0 mengurus operasi jualan lapangan, stok, pelanggan, merchandiser, expenses, laporan dan
audit untuk beberapa cawangan. Sumber data utama ialah Supabase/PostgreSQL; Firestore digunakan
sebagai lapisan tambahan untuk fungsi real-time/legacy.

| Peranan | Tanggungjawab utama |
|---|---|
| `Main Admin` | Akses semua cawangan, kelulusan akhir, polisi komisen, audit, laporan HQ |
| `Admin` | Operasi cawangan: semak jualan, pelanggan, stok, expenses cawangan, hantar laporan ke HQ |
| `Sales` | Buat jualan, invois/resit, laporan harian jualan sendiri |
| `Merchandiser` | Lawatan kedai, audit produk, laporan lawatan |

---

## 2. Workflow sistem tahap tinggi

```mermaid
flowchart TD
  A[Login pengguna] --> B{Role + branch disahkan}
  B -->|Sales| C[Jualan lapangan]
  B -->|Merchandiser| D[Lawatan kedai dan audit produk]
  B -->|Admin| E[Operasi cawangan]
  B -->|Main Admin| F[HQ review dan kawalan penuh]

  C --> G[Transaksi jualan + invoice/receipt]
  C --> H[Laporan harian sales]
  D --> I[Store visit + product audit]
  D --> H

  E --> J[Semak live sales, customer, inventory]
  E --> K[Tambah expenses cawangan ke laporan]
  E --> L[Hantar laporan ke Main Admin]

  F --> M[Lulus atau tolak laporan]
  F --> N[Komisen, laporan mingguan/bulanan, audit]

  G --> O[(Supabase sales_transactions + sales_items)]
  H --> P[(daily_reports)]
  I --> Q[(store_visits + store_audit_items)]
  K --> R[(expenses / expense lines)]
  M --> N
```

---

## 3. Aliran login, akses dan data

```mermaid
sequenceDiagram
  participant U as Pengguna
  participant UI as Next.js UI
  participant API as API Route
  participant DB as Supabase / DB

  U->>UI: Masuk username + password
  UI->>API: POST /api/auth/login
  API->>DB: Semak user + password hash
  DB-->>API: Profil user, role, branch
  API-->>UI: Set session cookie
  UI->>API: Panggil modul protected
  API->>API: normalizeRole + permission check
  API->>DB: Query ikut role/branch
  DB-->>UI: Data yang dibenarkan sahaja
```

Prinsip penting:

- `Main Admin` boleh lihat dan urus semua cawangan.
- `Admin` dikunci kepada cawangan sendiri untuk data operasi.
- `Sales` hanya lihat transaksi/laporan sendiri.
- Mutation penting perlu melalui API route dan direkod dalam audit jika modul menyokongnya.

---

## 4. Workflow jualan dan invois

```mermaid
flowchart LR
  S[Sales pilih customer + produk] --> V{Semak stok van}
  V -->|Stok cukup| T[POST /api/sales]
  V -->|Stok tidak cukup| X[Tolak jualan]
  T --> I[Jana invoice / receipt no]
  T --> D[Kurangkan stok van]
  T --> R[Simpan sales_transactions]
  T --> L[Simpan sales_items]
  R --> P[Live Sales / Invoice / Reports]
```

Peraturan kerja:

1. Sales buat jualan melalui `/sales`.
2. Sistem jana nombor invoice/receipt dan rekod transaksi di `sales_transactions`.
3. Item jualan disimpan di `sales_items`.
4. Stok van dikemaskini selepas jualan berjaya.
5. Admin/Main Admin boleh semak melalui Live Sales, invoices dan reports.
6. Pembatalan/void invoice ikut dokumen khusus:
   [`docs/void-invoice-workflow-plan.md`](void-invoice-workflow-plan.md).

---

## 5. Workflow laporan harian

Status utama dalam kod:

```mermaid
stateDiagram-v2
  [*] --> draft: Sales/Merch submit snapshot
  draft --> submitted_daily: Admin cawangan simpan expenses dan hantar HQ
  submitted_daily --> approved_daily: Main Admin lulus
  submitted_daily --> returned_daily: Main Admin tolak / pulangkan
  returned_daily --> draft: Staff/Admin cawangan kemas kini semula
  approved_daily --> [*]
```

Aliran operasi:

| Langkah | Siapa | Sistem / route | Hasil |
|---|---|---|---|
| 1 | Sales/Merchandiser | `/api/daily-reports` `POST` | Laporan harian disimpan sebagai `draft` |
| 2 | Admin cawangan | `/admin/reports` | Semak laporan ikut branch |
| 3 | Admin cawangan | `save_branch_report` | Isi expenses, bukti bank/cash, resit |
| 4 | Admin cawangan | `submit_stage` | Status menjadi `submitted_daily` |
| 5 | Main Admin | `approve_stage` atau `return_stage` | Status menjadi `approved_daily` atau `returned_daily` |
| 6 | Sistem | Reports hub | Summary harian/mingguan hanya kira laporan yang diluluskan |

Nota:

- Butang "Hantar ke Main Admin" hanya aktif selepas expenses/bukti disimpan ke laporan.
- Jika Main Admin tolak, `returnedReason` disimpan dan `branchExpensesSyncedAt` dikosongkan supaya
  cawangan perlu semak semula sebelum hantar balik.
- Kad summary di Reports Hub menggunakan `approved_daily`, bukan semua live sales mentah.

---

## 6. Workflow expenses

```mermaid
flowchart TD
  A[Admin cawangan cipta expense untuk salesman] --> B{Validasi}
  B -->|Ada salesman, kategori, amount, resit| C[Status pending]
  B -->|Tidak lengkap| X[Reject request]
  C --> D[Main Admin review]
  D -->|Approve| E[status approved]
  D -->|Reject + reason| F[status rejected]
  E -->|Bayaran selesai| G[status paid]
  C --> H[Audit event]
  E --> H
  F --> H
  G --> H
```

Peraturan kerja:

- Sales tidak boleh cipta expense sendiri melalui API.
- Admin cawangan hanya boleh cipta expense untuk salesman dalam cawangan sendiri.
- Main Admin sahaja boleh `approve`, `reject` atau `mark paid`.
- Resit adalah wajib untuk rekod expense.

---

## 7. Workflow day-end closing

```mermaid
flowchart LR
  A[Admin/Main Admin pilih tarikh + branch] --> B[Calculate day-end]
  B --> C[Semak jualan, refund, expenses]
  C --> D{Data betul?}
  D -->|Ya| E[Close day-end]
  D -->|Tidak| F[Betulkan transaksi / expense / report]
  E --> G[Jana Excel day-end]
  E --> H[Simpan rekod closing]
  E --> I[Audit event]
```

Day-end mengambil data jualan, item jualan, refund dan expenses yang berkaitan untuk tarikh/cawangan.
Selepas close, sistem menyimpan rekod closing dan cuba menjana fail Excel di storage.

---

## 8. Workflow inventory dan stok

```mermaid
flowchart TD
  A[Admin/Main Admin urus produk dan stok] --> B[Inventory pusat / branch]
  B --> C[Load stok ke van]
  C --> D[Sales buat jualan]
  D --> E[Stok van berkurang]
  E --> F[Inventory movements / audit stok]
  F --> G[Report stok dan low-stock alert]
```

Peraturan kerja:

- Produk dan stok diurus oleh Admin/Main Admin.
- Jualan yang berjaya mengurangkan stok van.
- Rekod movement digunakan untuk audit perubahan stok.
- Untuk proses void, stok perlu dipulihkan mengikut pelan void invoice.

---

## 9. Workflow merchandiser

```mermaid
flowchart LR
  M[Merchandiser login] --> S[Pilih store/customer]
  S --> C[Check-in + GPS]
  C --> A[Audit produk / rak / stok kedai]
  A --> P[Muat naik foto jika perlu]
  P --> O[Check-out]
  O --> R[Store visit report]
  R --> H[Admin/Main Admin review]
```

Data utama:

- `store_visits` untuk rekod lawatan.
- `store_audit_items` untuk audit produk per lawatan.
- Akses store ikut branch/assignment yang dibenarkan.

---

## 10. Workflow audit dan laporan

```mermaid
flowchart TD
  A[Mutation penting] --> B[API route]
  B --> C[Permission + validation]
  C --> D[Write data]
  D --> E[logAuditEvent jika modul menyokong]
  E --> F[Audit Center]
  D --> G[Reports / export PDF / Excel]
```

Modul laporan utama:

| Modul | Fungsi |
|---|---|
| Live Sales | Pantau transaksi jualan semasa |
| Daily Reports | Workflow draft, pending, lulus, tolak |
| Weekly Reports | Ringkasan mingguan dan export |
| Monthly Reports | Ringkasan bulanan / closing bulanan |
| Audit Center | Jejak tindakan penting |
| Day End | Closing harian dan export Excel |

---

## 11. Matriks status penting

| Domain | Status | Maksud |
|---|---|---|
| Daily report | `draft` | Menunggu admin cawangan lengkapkan dan hantar |
| Daily report | `submitted_daily` | Menunggu Main Admin |
| Daily report | `approved_daily` | Diluluskan dan boleh masuk summary |
| Daily report | `returned_daily` | Dipulangkan untuk pembetulan |
| Expense | `pending` | Menunggu Main Admin |
| Expense | `approved` | Diluluskan |
| Expense | `rejected` | Ditolak dengan sebab |
| Expense | `paid` | Sudah dibayar |
| Sales void | `voided_at IS NOT NULL` | Transaksi dibatalkan dari revenue aktif |

---

## 12. Fail rujukan utama

| Fail | Tujuan |
|---|---|
| `README.md` | Ringkasan sistem, roles, modul utama |
| `ARCHITECTURE_OVERVIEW.md` | Architecture dan data flow |
| `PROJECT_STRUCTURE.md` | Struktur folder, routes, API |
| `docs/void-invoice-workflow-plan.md` | Pelan khusus void invoice |
| `app/api/sales/route.ts` | Create/list sales |
| `app/api/daily-reports/route.ts` | Daily report workflow |
| `components/features/admin/AdminReportsHub.tsx` | UI workflow laporan admin |
| `components/features/admin/DailyReportDataTable.tsx` | Status dan tindakan laporan |
| `app/api/expenses/route.ts` | Expense create/approve/reject/paid |
| `app/api/day-end/close/route.ts` | Day-end closing |
| `lib/permissions.ts` | Permission/RBAC helper |

---

## 13. Cadangan penggunaan dokumen

1. Guna dokumen ini untuk tunjuk aliran sistem kepada owner/client.
2. Guna `void-invoice-workflow-plan.md` apabila bincang isu invoice salah/void/gantian.
3. Jika ada perubahan proses bisnes, kemas kini dahulu bahagian status dan swimlane sebelum ubah kod.
4. Untuk UAT, semak satu workflow penuh: Sales submit daily report -> Admin cawangan isi expenses
   -> hantar HQ -> Main Admin approve/return -> summary berubah.
