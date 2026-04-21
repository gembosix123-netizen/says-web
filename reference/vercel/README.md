# Vercel Reference Files

Folder ini khas untuk simpan code asal dari Vercel sebagai rujukan, tanpa overwrite code local terus.

## Cara guna

1. Paste code asal Vercel ke fail yang sepadan dalam folder ini.
2. Jangan ubah path production terus dulu (`app/*`, `components/*`, `types/*`).
3. Lepas paste siap, bagitahu saya fail mana yang sudah diisi.
4. Saya akan compare dan merge minimum change ke code local.

## Mapping

- `sales-daily-report-page.tsx` -> `app/sales/daily-report/page.tsx`
- `admin-reports-hub.tsx` -> `components/features/admin/AdminReportsHub.tsx`
- `daily-reports-route.ts` -> `app/api/daily-reports/route.ts`

