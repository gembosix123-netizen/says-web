# SAYS 2.0 — Sales & Audit Your System

A production Next.js 16 web application for managing field sales, inventory, customer accounts, merchandiser store visits, and financial audits across multiple branches.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Primary DB:** Supabase (PostgreSQL) — all transactional data
- **Real-time / Auth supplement:** Firebase / Firestore
- **Styling:** Tailwind CSS v4, Lucide React icons
- **Auth:** Cookie-based session (`session` cookie), bcrypt password hashing, Upstash Redis rate limiting
- **Hosting:** Vercel (recommended)

## Roles

| Role | Description |
|------|-------------|
| `Main Admin` | Full access — all branches, all data, all admin functions |
| `Admin` | Branch-scoped admin — own branch only |
| `Sales` | Field sales — own transactions, own customers |
| `Merchandiser` | Store visits & product audits only; cannot perform sales |

## Quick Start

```bash
# Install
npm install

# Development
npm run dev
# → http://localhost:3000

# Build
npm run build
npm run start
```

In GitHub Codespaces, port `3000` is configured to auto-forward. If the preview stops responding, restart with `npm run dev` and reopen port `3000` from the Ports panel.

## Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Optional — Upstash Redis for distributed rate limiting
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

## Key Modules

| Module | Route | Description |
|--------|-------|-------------|
| Admin Dashboard | `/admin` | KPI overview, branch monitoring |
| Sales Entry | `/sales` | Daily sales transactions |
| Invoices | `/invoices` | Invoice management |
| Inventory | `/inventory` | Van & warehouse stock |
| Merchandiser | `/merchandiser` | Store visits, product audits |
| Audit Center | `/admin/audit-center` | Full audit trail with RBAC |
| Day End | `/admin/day-end` | Daily closing & settlement |
| Expenses | `/admin/expenses` | Field expense claims |
| Reports | `/admin/reports` | Sales & financial reports |
| Weekly Reports | `/admin/weekly-reports` | Weekly summary archive |
| Customers | `/admin/customers` | Branch-isolated customer CRM |
| Backdated Import | `/admin/backdated-import` | CSV historical data import |
| Digital Audit | `/digital-audit` | Standalone audit form |
| Prospecting | `/prospecting` | New customer prospecting |

## Database Migrations

Run migrations in order via Supabase SQL Editor (`migrations/` folder). The canonical tables are:

- `sales_transactions` + `sales_items` — all sales (branch-filtered)
- `customers_kb` (Kota Kinabalu) / `customers_kk` (Kinabatangan)
- `expenses`, `inventory_movements`, `weekly_report_history`
- `store_visits`, `store_audit_items`
- `audit_events`, `audit_event_changes`
- `exchange_returns`, `customer_ownership_log`

See `migrations/TABLE_ONE_TO_ONE_MAP.md` for full mapping.

## Useful Scripts

```bash
npm run migrate:firestore          # Migrate JSON seed data to Firestore
npm run migrate:passwords:dry      # Check which users need bcrypt upgrade
npm run migrate:passwords:reset    # Force password reset on next login
npm run seed:supabase              # Seed Supabase with dev data
```

## Documentation

| File | Topic |
|------|-------|
| `ARCHITECTURE_OVERVIEW.md` | Component hierarchy & data flow |
| `PROJECT_STRUCTURE.md` | Folder & file layout |
| `SECURITY_IMPLEMENTATION.md` | Rate limiting, bcrypt, RBAC |
| `AUDIT_RBAC_POLICY_MATRIX.md` | Role access matrix (source of truth) |
| `BRANCH_PERMISSIONS_GUIDE.md` | Branch-based access control |
| `CUSTOMER_BRANCH_SEPARATION_GUIDE.md` | Branch-isolated customer tables |
| `MERCHANDISER_IMPLEMENTATION.md` | Merchandiser module details |
| `DAILY_AUDIT_OPS_CHECKLIST.md` | Daily audit operations SOP |
| `migrations/TABLE_ONE_TO_ONE_MAP.md` | DB table ↔ migration file map |

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
