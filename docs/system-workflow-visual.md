# Visual planning workflow SAYS 2.0

Dokumen ini versi visual untuk menerangkan planning workflow sistem kepada owner/client. Diagram
ditulis dalam Mermaid supaya GitHub boleh render sebagai carta.

Rujukan detail teknikal: [`system-workflow-plan.md`](system-workflow-plan.md).

---

## 1. Big picture workflow

```mermaid
flowchart TB
  Start([Pengguna login]) --> Auth{Role + branch sah?}
  Auth -->|Tidak| Deny[Access denied]
  Auth -->|Ya| Route{Role pengguna}

  Route -->|Sales| SalesHome[Sales dashboard]
  Route -->|Merchandiser| MerchHome[Merchandiser dashboard]
  Route -->|Admin| BranchAdmin[Admin cawangan]
  Route -->|Main Admin| HQ[Main Admin HQ]

  SalesHome --> Sale[Create sale]
  Sale --> Invoice[Invoice / receipt generated]
  Sale --> VanStock[Stok van berkurang]
  Sale --> SalesReport[Submit laporan harian]

  MerchHome --> Visit[Check-in store visit]
  Visit --> Audit[Product / shelf audit]
  Audit --> MerchReport[Submit laporan harian merch]

  SalesReport --> Draft[Status: draft]
  MerchReport --> Draft

  BranchAdmin --> LiveSales[Semak live sales]
  BranchAdmin --> Expenses[Isi expenses + bukti]
  Draft --> Expenses
  Expenses --> SubmitHQ[Hantar ke Main Admin]
  SubmitHQ --> Pending[Status: submitted_daily]

  HQ --> Review[Review laporan + bukti]
  Pending --> Review
  Review -->|Lulus| Approved[Status: approved_daily]
  Review -->|Tolak| Returned[Status: returned_daily]
  Returned --> Draft

  Approved --> Summary[Daily / weekly / monthly summary]
  Approved --> Commission[Komisen dan KPI]
  Approved --> DayEnd[Day-end closing]

  LiveSales --> AuditLog[Audit center]
  Expenses --> AuditLog
  Review --> AuditLog
  DayEnd --> AuditLog
```

---

## 2. Swimlane mengikut role

```mermaid
flowchart LR
  subgraph sales [Sales]
    S1[Login]
    S2[Buat jualan]
    S3[Upload bukti bayaran jika perlu]
    S4[Hantar laporan harian]
  end

  subgraph merch [Merchandiser]
    M1[Login]
    M2[Check-in kedai]
    M3[Audit produk / rak]
    M4[Check-out dan hantar laporan]
  end

  subgraph admin [Admin Cawangan]
    A1[Semak live sales]
    A2[Semak laporan draft]
    A3[Tambah expenses + resit]
    A4[Hantar ke Main Admin]
  end

  subgraph hq [Main Admin]
    H1[Semak pending report]
    H2{Keputusan}
    H3[Lulus]
    H4[Tolak + sebab]
    H5[Reports, KPI, komisen]
  end

  subgraph system [System]
    X1[(sales_transactions)]
    X2[(sales_items)]
    X3[(daily_reports)]
    X4[(expenses)]
    X5[(audit_events)]
  end

  S1 --> S2 --> S3 --> S4 --> X3
  S2 --> X1
  S2 --> X2

  M1 --> M2 --> M3 --> M4 --> X3

  X3 --> A2
  A1 --> X1
  A2 --> A3 --> X4
  A3 --> A4 --> H1

  H1 --> H2
  H2 -->|approve| H3 --> H5
  H2 -->|return| H4 --> A2

  A3 --> X5
  A4 --> X5
  H3 --> X5
  H4 --> X5
```

---

## 3. Status workflow laporan harian

```mermaid
stateDiagram-v2
  [*] --> draft: Sales/Merch hantar laporan
  draft --> draft: Admin cawangan semak / edit expenses
  draft --> submitted_daily: Admin cawangan hantar ke HQ
  submitted_daily --> approved_daily: Main Admin lulus
  submitted_daily --> returned_daily: Main Admin tolak
  returned_daily --> draft: Betulkan semula
  approved_daily --> reports: Masuk summary/reporting
  reports --> [*]

  note right of draft
    Laporan belum final.
    Admin cawangan perlu simpan expenses
    dan bukti sebelum hantar HQ.
  end note

  note right of approved_daily
    Data diluluskan digunakan untuk
    summary harian, mingguan, bulanan,
    KPI dan komisen.
  end note
```

---

## 4. Workflow jualan sampai laporan

```mermaid
flowchart TD
  A[Sales pilih customer] --> B[Pilih produk + quantity]
  B --> C{Stok van cukup?}
  C -->|Tidak| D[Paparkan error stok]
  C -->|Ya| E[Pilih payment method]
  E --> F[Submit sale]
  F --> G[Jana invoice / receipt number]
  G --> H[Simpan header transaksi]
  H --> I[Simpan item transaksi]
  I --> J[Kemaskini stok van]
  J --> K[Transaksi muncul di Live Sales]
  K --> L[Sales hantar daily report]
  L --> M[Admin cawangan semak]
  M --> N[Main Admin approve]
```

---

## 5. Workflow expenses dan kelulusan

```mermaid
flowchart TD
  A[Admin cawangan pilih salesman] --> B[Isi kategori, amount, tarikh]
  B --> C[Upload resit]
  C --> D{Validasi lengkap?}
  D -->|Tidak| E[Request gagal / perlu lengkapkan]
  D -->|Ya| F[Expense status: pending]
  F --> G[Main Admin review]
  G --> H{Keputusan}
  H -->|Approve| I[Expense status: approved]
  H -->|Reject| J[Expense status: rejected + reason]
  I --> K{Sudah dibayar?}
  K -->|Ya| L[Expense status: paid]
  K -->|Belum| I
```

---

## 6. Workflow day-end

```mermaid
flowchart LR
  A[Admin/Main Admin pilih branch + date] --> B[Calculate day-end]
  B --> C[Semak sales]
  B --> D[Semak refund/return]
  B --> E[Semak expenses approved/paid]
  C --> F{Semua betul?}
  D --> F
  E --> F
  F -->|Tidak| G[Betulkan data sumber]
  G --> B
  F -->|Ya| H[Close day-end]
  H --> I[Jana Excel]
  H --> J[Simpan closing record]
  H --> K[Audit event]
```

---

## 7. Ringkasan keputusan workflow

```mermaid
flowchart TB
  A[Data operasi masuk] --> B{Jenis data}
  B -->|Sales| C[Live Sales + Invoice]
  B -->|Daily Report| D[Approval workflow]
  B -->|Expenses| E[Main Admin approval]
  B -->|Inventory| F[Stock movement]
  B -->|Merch Visit| G[Store audit]

  C --> H[Reports]
  D --> H
  E --> H
  F --> H
  G --> H

  H --> I[Daily summary]
  H --> J[Weekly report]
  H --> K[Monthly report]
  H --> L[KPI / commission]
  H --> M[Audit center]
```

---

## Cara tunjuk kepada client

1. Mulakan dengan **Big picture workflow** untuk gambaran semua peranan.
2. Guna **Swimlane mengikut role** untuk jelaskan siapa buat apa.
3. Guna **Status workflow laporan harian** untuk tunjuk approval flow sebenar.
4. Guna diagram jualan, expenses dan day-end jika client tanya modul tertentu.
