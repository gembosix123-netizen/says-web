# Audit & RBAC Policy Matrix (Source of Truth)

Dokumen ini ringkas untuk QA/UAT semak akses role dengan cepat berdasarkan implementasi semasa di `lib/permissions.ts`.

## 1) Role Normalization

Semua semakan akses guna role yang telah dinormalisasi (`lib/roles.ts`):

- `Main Admin`
- `Admin`
- `Sales`
- `Merchandiser`

Alias seperti `owner`, `super admin`, `salesman` akan dipetakan ke role di atas.

## 2) Web Route Access (Middleware/Admin)

Rujukan fungsi: `canAccessAdminPath`, `canAccessSalesRoutes`, `canAccessMerchandiserRoutes`.

| Area | Main Admin | Admin | Sales | Merchandiser |
|---|---:|---:|---:|---:|
| `/admin/**` (full) | ✅ | ❌ (allowlist sahaja) | ❌ (allowlist terhad) | ❌ |
| Admin allowlist (`/admin/reports`, `/admin/products`, dll.) | ✅ | ✅ | ❌ | ❌ |
| Sales allowlist (`/admin/commissions`, `/admin/orders`, `/admin/customers`, dll.) | ✅ | ✅ | ✅ | ❌ |
| Sales API module | ✅ | ✅ | ✅ | ❌ |
| Merchandiser/Store Visit module | ✅ | ✅ | ✅ | ✅ |

## 3) High-Risk API Access Matrix

Rujukan endpoint yang sudah dipusatkan kepada `getSessionUserFromRequest` + `normalizeRole` + helper permission.

| Endpoint Group | Rule | Main Admin | Admin | Sales | Merchandiser |
|---|---|---:|---:|---:|---:|
| `GET/POST/DELETE /api/sales` | Sales module + branch guard | ✅ | ✅ | ✅* | ❌ |
| `GET/POST /api/sales/collect-payment` | Sales module + branch guard | ✅ | ✅ | ✅* | ❌ |
| `/api/users` (create/update/delete) | `canManageUsers` | ✅ | ✅** | ❌ | ❌ |
| `/api/products` (mutating) | `canManageProducts` | ✅ | ✅ | ❌ | ❌ |
| `/api/audit/events`, `/api/audit/export` | `canViewAudit` | ✅ | ✅ | ❌ | ❌ |
| `/api/reports/export-pdf`, `/api/reports/export-excel` | `canExportReports` | ✅ | ✅ | ❌ | ❌ |
| `/api/day-end/calculate`, `/api/day-end/export` | `canViewDayEnd` | ✅ | ✅ | ❌ | ❌ |
| `/api/day-end/close` | `canCloseDayEnd` | ✅ | ✅ | ❌ | ❌ |
| `/api/store-visits`, `/api/merchandiser/photos`, `/api/merchandiser/audits` | `canAccessStoreVisits` | ✅ | ✅ | ✅ | ✅ |
| `/api/stores` (POST/PUT/DELETE) | `canManageUsers` | ✅ | ✅ | ❌ | ❌ |

\* Sales tertakluk kepada branch sendiri dan/atau data sendiri mengikut endpoint.  
\** Admin tertakluk kepada branch sendiri, tidak boleh cross-branch untuk operasi terhad.

## 4) Expected UAT Status Codes

- `401` jika tiada session/invalid session.
- `403` jika role tidak dibenarkan.
- `400` untuk input tidak sah (contoh reason wajib untuk tindakan kritikal).

## 5) Quick UAT Flow (5 min)

1. Login sebagai setiap role (`Main Admin`, `Admin`, `Sales`, `Merchandiser`).
2. Uji 1 endpoint dari setiap group high-risk di atas.
3. Rekod keputusan dalam `AUDIT_UAT_RESULTS_TEMPLATE.md`.
4. Jika mismatch dengan matrix ini, anggap sebagai regression access control.
