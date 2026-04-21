# Project Structure — says-web

This document explains the repository layout and purpose of important files.

---

## Top-level Folders

| Folder / File | Purpose |
|---|---|
| `app/` | Next.js App Router pages and layouts |
| `components/` | Reusable React components (UI primitives, feature components) |
| `lib/` | Database clients, auth helpers, permission utilities |
| `context/` | React context providers (Dashboard, Language, Merchandiser, Sales, Theme) |
| `types/` | TypeScript interfaces used across the project |
| `data/` | Local JSON seed files (dev only, used by `lib/db.ts`) |
| `migrations/` | SQL migration files for Supabase/PostgreSQL |
| `scripts/` | CLI utilities (Firestore migration, password migration, seeding) |
| `public/` | Static assets and CSV templates |

---

## `app/` — Page Routes

### Admin Routes (`app/admin/`)
| Route | Description |
|---|---|
| `/admin` | Dashboard landing page |
| `/admin/audit-center` | Audit log viewer with filters, pagination, CSV export |
| `/admin/audits` | Audit management |
| `/admin/backdated-import` | CSV batch import for historical data |
| `/admin/commissions` | Commission tracking per salesman |
| `/admin/customers` | Branch-isolated customer CRM |
| `/admin/database` | Database management utilities |
| `/admin/day-end` | Daily closing summary & settlement |
| `/admin/expenses` | Field expense claims (approve/reject/pay) |
| `/admin/founder` | Founder-level controls |
| `/admin/global-monitor` | Cross-branch overview (Main Admin) |
| `/admin/kinabatangan` | Kinabatangan branch dashboard |
| `/admin/kota-kinabalu` | Kota Kinabalu branch dashboard |
| `/admin/live-sales` | Real-time active sales monitor |
| `/admin/loading` | Stock loading for vans |
| `/admin/orders` | Order management |
| `/admin/outstanding` | Outstanding balances |
| `/admin/products` | Product catalog CRUD |
| `/admin/reports` | Sales & financial reports (PDF/Excel export) |
| `/admin/sales` | Admin sales overview |
| `/admin/stores` | Store/outlet management |
| `/admin/users` | User management (CRUD, role & branch assignment) |
| `/admin/weekly-reports` | Weekly summary archive |

### Other Routes
| Route | Description |
|---|---|
| `/login` | Login page |
| `/dashboard` | General dashboard (redirect based on role) |
| `/sales` | Sales entry (field staff) |
| `/sales-dashboard` | Sales staff home — choose Sales or Merchandiser mode |
| `/daily-sales` | Daily sales list |
| `/invoices` | Invoice management |
| `/inventory` | Van & warehouse stock |
| `/merchandiser` | Store visits & product audits |
| `/digital-audit` | Standalone digital audit form |
| `/prospecting` | New customer prospecting |
| `/unauthorized` | Access denied page |

---

## `app/api/` — Server API Routes

| API Path | Description |
|---|---|
| `/api/auth/login` | Login (rate-limited, bcrypt, lazy password migration) |
| `/api/auth/logout` | Logout (clears session cookie) |
| `/api/users` | User CRUD (Admin+ only) |
| `/api/sales` | Sales transactions (branch-guarded) |
| `/api/sales/collect-payment` | Record payment collection |
| `/api/products` | Product CRUD (Admin+ for mutations) |
| `/api/customers` | Customer CRUD (branch-isolated tables) |
| `/api/orders` | Order read/write |
| `/api/commissions` | Commission data |
| `/api/inventory` | Inventory read/write |
| `/api/store-visits` | Merchandiser store visit records |
| `/api/merchandiser/photos` | Photo upload for store visits |
| `/api/merchandiser/audits` | Product audit records |
| `/api/stores` | Store/outlet CRUD (Admin+ for mutations) |
| `/api/audit/events` | Audit event log (Admin+ read) |
| `/api/audit/export` | CSV export of audit log |
| `/api/reports/export-pdf` | PDF report export |
| `/api/reports/export-excel` | Excel report export |
| `/api/day-end/calculate` | Day-end calculations |
| `/api/day-end/close` | Close day end (requires reason) |
| `/api/day-end/export` | Export day-end report |
| `/api/expenses` | Expense claim CRUD |
| `/api/settlements` | Settlement records |
| `/api/payouts` | Commission payout records |
| `/api/invoices` | Invoice CRUD |
| `/api/exchange-returns` | Exchange/return records |

---

## `lib/` — Core Utilities

| File | Purpose |
|---|---|
| `supabase.ts` | Supabase client (`supabase`) and admin client (`supabaseAdmin`). Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `firebase.ts` | Firebase client SDK initialisation |
| `firestore-service.ts` | Firestore CRUD helpers |
| `db.ts` | Lightweight JSON/Redis DB abstraction (dev fallback; uses `data/*.json` when `NODE_ENV !== 'production'`) |
| `session.ts` | Session cookie helpers — read/write/delete |
| `auth-check.ts` | `getSessionUserFromRequest()` — parse & validate session from Next.js request |
| `roles.ts` | `normalizeRole()` — canonical role names Map; `NormalizedRole` type |
| `permissions.ts` | `canAccessAdminPath()`, `canAccessSalesRoutes()`, `canAccessMerchandiserRoutes()`, etc. |
| `branchPermissions.ts` | `canAccessBranch()`, `canPerformSales()`, `canPerformAudit()`, `getSalesTableByBranch()` (deprecated — always returns `sales_transactions`), `getCustomersTableByBranch()` |
| `rateLimit.ts` | Upstash Redis rate limiters (login: 5/15 min, API: 100/min, password reset: 3/hr). Graceful fallback in dev |
| `audit.ts` | Audit event logging helpers (`logAuditEvent()`) |
| `permissions.ts` | Fine-grained permission checks (`canManageUsers`, `canManageProducts`, `canViewAudit`, `canExportReports`, `canCloseDayEnd`, etc.) |
| `adminAnalyticsData.ts` | Analytics data helpers for admin dashboard |
| `utils.ts` | General utilities |
| `validations/` | Zod schemas for input validation |

---

## `components/` — UI Components

```
components/
├── ui/                   # Primitives: MetricCard, Toast, Button, Input, etc.
├── features/
│   ├── admin/            # EnhancedAdminDashboard, OverviewDashboard,
│   │                     # StaffManagement, InventoryManagement
│   ├── sales/            # SalesWizard, sales forms
│   └── merchandiser/     # Store visit UI components
├── AdminBranchHeader.tsx
├── ClientSwitchers.tsx
├── Icons.tsx
├── LanguageSwitcher.tsx
├── NavigationHeader.tsx
├── SalesWizard.tsx
├── SidebarHeader.tsx
├── ThemeInitializer.tsx
├── ThemeSwitcher.tsx
└── UserHeader.tsx
```

---

## `migrations/` — SQL Migration Order

Run in Supabase SQL Editor in chronological order:

1. `20260209_users_branch_permissions.sql`
2. `20260209_create_stores_and_policies.sql`
3. `20260209_split_sales.sql` *(legacy — superseded)*
4. `20260214_create_all_tables.sql`
5. `20260219_add_merchandiser_tables.sql`
6. `20260224_create_proper_sales_tables.sql`
7. `20260224_quick_fix_sales_table.sql` *(no-op if sales doesn't exist)*
8. `20260226_add_audit_tables.sql`
9. `20260303_create_exchange_returns.sql`
10. `20260326_add_payment_reference_columns.sql`
11. `20260326_add_sales_proof_photo_urls.sql`
12. `20260326_create_monthly_report_history.sql`
13. `20260326_separate_customers_by_branch.sql`
14. `20260401_add_area_to_customers.sql`
15. `20260401_backdated_import_columns.sql`
16. `20260401_customer_ownership.sql`
17. `20260401_full_system_upgrade.sql`
18. `20260401_product_prices.sql`
19. `20260401_rls_branch_isolation.sql`
20. `20260401_split_sales_as_views.sql`

See `migrations/TABLE_ONE_TO_ONE_MAP.md` for table ↔ migration mapping.

---

## Notes on Auth & RBAC

- Session cookie named `session` contains JSON `{ id, role, branch, name, ... }`
- Use `getSessionUserFromRequest()` from `lib/auth-check.ts` in all protected API routes
- Role normalization via `normalizeRole()` in `lib/roles.ts` — use this before any permission check
- All API routes use service role key (`supabaseAdmin`) — RLS prevents anon key direct access
- Rate limiting is scoped to `IP + normalized username` (not IP alone) to avoid false blocks on shared networks

---

## Notes on Database

- **Primary DB:** Supabase / PostgreSQL — all sales, customers, users, audit, inventory, expenses
- **Firebase / Firestore:** Used for real-time features and supplemental data
- **Sales model:** Canonical table is `sales_transactions` (with `branch` column). Branch-scoped VIEWs `sales_kinabatangan` and `sales_kota_kinabalu` exist as read helpers but are NOT base tables
- **Customers model:** Branch-isolated tables — `customers_kb` (Kota Kinabalu) and `customers_kk` (Kinabatangan)
- Use `getCustomersTableByBranch(branch)` from `lib/branchPermissions.ts` to resolve the correct table name

Key files / folders
- `lib/supabase.ts` — initializes `supabase` (client) and `supabaseAdmin` (server service client). Environment variables required:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (recommended).
- `lib/db.ts` — lightweight DB abstraction that uses Upstash/Redis in production and JSON files in development.
  - Stores use `data/*.json` when `NODE_ENV !== 'production'`.
- `app/api/sales/route.ts` — API for creating and reading sales. After migration, writes to `sales_kota_kinabalu` or `sales_kinabatangan` depending on `branch`.
- `migrations/` — contains SQL files to create region-specific sales tables, `sales_history` view, and `stores` table. Run these in Supabase console.
- `app/api/products/route.ts` — Product CRUD. Mutations are restricted to Admin via session cookie role.
- `app/api/stores/route.ts` — Stores CRUD API (admin-protected for mutations).

Frontend organization suggestions
- `app/admin/` — Admin UI pages (manage sales, users, products, stores). Uses `components/features/admin`.
- `components/ui/` — UI primitives (MetricCard, Toast, Button, Input).
- `components/features/sales/` — Sales pages and forms for sales staff.

How to run migrations (Supabase)
1. Open your Supabase project → SQL Editor.
2. Copy the SQL from files in `migrations/` and run them in order.
3. Verify tables `sales_kota_kinabalu`, `sales_kinabatangan`, `stores`, and view `sales_history` exist.

Notes on authentication & RBAC
- This project expects a session cookie named `session` with JSON payload containing at least `{ id, role }` for simple role checks in server routes.
- For production with Supabase Auth, use JWT claims and Row Level Security (RLS) policies instead. Example RLS snippets are included in `migrations/20260209_create_stores_and_policies.sql`.

Next steps for maintainers
- Run migrations on Supabase; migrate old `sales` rows into new tables.
- Implement proper JWT-based auth in API routes (use Supabase helpers) and enable RLS for stricter access control.
- Replace local `lib/db.ts` usage with Supabase or Postgres queries for production.
