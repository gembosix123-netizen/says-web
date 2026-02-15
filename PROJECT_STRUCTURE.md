# Project Structure — says-web

This document explains the repository layout and purpose of important files.

Top-level
- `app/` — Next.js app router pages and layouts. Contains admin pages under `app/admin` and other routes.
- `components/` — Reusable React components (UI primitives, feature components).
- `lib/` — Database clients and helpers: `supabase.ts` (Supabase client) and `db.ts` (simple JSON/Redis DB abstraction).
- `api/` (under `app/api`) — Server API routes (users, sales, products, stores, etc.).
- `data/` — Local JSON seed files used in development via `lib/db.ts`.
- `migrations/` — SQL migration files for Supabase/postgres. Apply these in Supabase SQL editor.
- `types/` — TypeScript interfaces used across the project.
- `public/`, `styles/` and configuration files (`tailwind.config.ts`, `next.config.ts`, etc.).

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
