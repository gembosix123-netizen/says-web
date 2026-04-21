# Audit Module UAT Results Template

Gunakan template ini semasa pelaksanaan UAT berdasarkan checklist di `AUDIT_UAT_CHECKLIST.md`.

Rujukan polisi akses semasa: `AUDIT_RBAC_POLICY_MATRIX.md`.

## UAT Meta

- Project: __________________________
- Environment: [ ] Dev  [ ] Staging  [ ] Production-like
- Build/Release Version: __________________________
- Test Window: __________________________
- QA Lead: __________________________
- Backend Owner: __________________________
- Frontend Owner: __________________________
- Product Owner: __________________________

## Execution Summary

- Total Test Cases: ______
- Passed: ______
- Failed: ______
- Blocked: ______
- Pass Rate: ______%

## Result Matrix

| ID | Test Area | Test Case | Expected Result | Actual Result | Status (PASS/FAIL/BLOCKED) | Evidence (URL/Screenshot/Log) | Owner | Date |
|---|---|---|---|---|---|---|---|---|
| A-01 | Access Control | Main Admin buka Audit Center | Boleh akses penuh |  |  |  |  |  |
| A-02 | Access Control | Admin buka Audit Center | Hanya branch sendiri |  |  |  |  |  |
| A-03 | Access Control | Sales buka Audit Center | Ditolak (403/redirect) |  |  |  |  |  |
| C-01 | Critical Action | Delete sales tanpa reason | Gagal (400) |  |  |  |  |  |
| C-02 | Critical Action | Delete sales dgn reason/reference | Berjaya + audit log |  |  |  |  |  |
| C-03 | Critical Action | Delete user tanpa reason | Gagal (400) |  |  |  |  |  |
| C-04 | Critical Action | Delete user dgn reason/reference | Berjaya + audit log |  |  |  |  |  |
| C-05 | Critical Action | Delete order tanpa reason | Gagal (400) |  |  |  |  |  |
| C-06 | Critical Action | Delete order dgn reason/reference | Berjaya + audit log |  |  |  |  |  |
| C-07 | Critical Action | Delete inventory tanpa reason | Gagal (400) |  |  |  |  |  |
| C-08 | Critical Action | Delete inventory dgn reason/reference | Berjaya + audit log |  |  |  |  |  |
| C-09 | Critical Action | Close day-end tanpa notes | Gagal (400) |  |  |  |  |  |
| C-10 | Critical Action | Close day-end dengan notes/reference | Berjaya + audit log |  |  |  |  |  |
| F-01 | Audit Center | Pagination berfungsi | Data tukar ikut page |  |  |  |  |  |
| F-02 | Audit Center | Filter module/status/reference/date | Data tepat ikut filter |  |  |  |  |  |
| F-03 | Audit Center | Kolum reason/reference dipapar | Nilai dipapar betul |  |  |  |  |  |
| E-01 | Export | Export CSV tanpa filter | Fail dijana & boleh buka |  |  |  |  |  |
| E-02 | Export | Export CSV ikut filter | Hanya data filter diexport |  |  |  |  |  |
| B-01 | Branch Segregation | Main Admin lihat semua branch | Semua branch terlihat |  |  |  |  |  |
| B-02 | Branch Segregation | Admin lihat branch lain | Tidak terlihat |  |  |  |  |  |
| N-01 | Negative | `/api/audit/events` tanpa login | 401 |  |  |  |  |  |
| N-02 | Negative | `/api/audit/export` tanpa login | 401 |  |  |  |  |  |
| N-03 | Negative | Role tak sah akses audit | 403 |  |  |  |  |  |
| P-01 | Performance | Load page size 50 | < 3s |  |  |  |  |  |
| P-02 | Performance | Export 1k rows | Berjaya tanpa timeout |  |  |  |  |  |

## Defect Log

| Bug ID | Severity (P1/P2/P3) | Area | Steps to Reproduce | Expected | Actual | Status | Owner | Target Fix |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |

## Release Gate Decision

- Backend Sign-off: [ ] Yes [ ] No — Name: __________________ Date: __________
- Frontend Sign-off: [ ] Yes [ ] No — Name: __________________ Date: __________
- QA Sign-off: [ ] Yes [ ] No — Name: __________________ Date: __________
- Product Sign-off: [ ] Yes [ ] No — Name: __________________ Date: __________

Final Decision:
- [ ] GO
- [ ] NO-GO

Reason (if NO-GO):
______________________________________________________________
______________________________________________________________

## Notes / Follow-up Actions

1. ______________________________________________
2. ______________________________________________
3. ______________________________________________
