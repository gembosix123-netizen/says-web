# Merchandiser Module - Deployment Guide

## Pre-Deployment Checklist

### 1. Database Migration
Run the SQL migration to create required tables:

```bash
# Connect to your Supabase database and run:
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f /workspaces/says-web/migrations/20260219_add_merchandiser_tables.sql
```

Or using Supabase Dashboard:
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `/migrations/20260219_add_merchandiser_tables.sql`
3. Execute the SQL

**Tables Created:**
- `store_visits` - Visit tracking with GPS, timestamps, status
- `store_audit_items` - Product audit records (expired/damaged/balance)
- Updated `users` table to add `allowed_stores` JSONB column

### 2. Supabase Storage Bucket
Create the storage bucket for merchandiser photos:

```sql
-- Run in Supabase SQL Editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('merchandiser-photos', 'merchandiser-photos', false);

-- Set up RLS policy for authenticated users:
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'merchandiser-photos');

CREATE POLICY "Users can view their own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'merchandiser-photos');
```

Or using Supabase Dashboard:
1. Go to Storage section
2. Click "New Bucket"
3. Name: `merchandiser-photos`
4. Public: **No** (keep private)
5. Create bucket
6. Add policies in the bucket settings

### 3. Environment Variables
Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Assign Merchandiser Role to Users
Update existing users or create new merchandiser accounts:

```sql
-- Option A: Update existing user to Merchandiser
UPDATE users 
SET role = 'Merchandiser',
    allowed_stores = '["Store A", "Store B", "Store C"]'::jsonb
WHERE id = 'user-id-here';

-- Option B: Create new merchandiser
INSERT INTO users (username, password_hash, role, branch, allowed_stores, created_at)
VALUES (
  'merchandiser1',
  'hashed-password',
  'Merchandiser',
  'Kota Kinabalu',
  '["Tesco Inanam", "Giant Kolombong", "Milimewa Tuaran"]'::jsonb,
  NOW()
);

-- Option C: Give Sales dual access (can do both Sales and Merchandiser)
-- Sales users automatically have access to merchandiser features, no changes needed
```

## Testing Checklist

### 1. Authentication & Routing
- [ ] Merchandiser role redirects to `/merchandiser` on login
- [ ] Sales role redirects to `/sales-dashboard` with choice screen
- [ ] Main Admin/Admin cannot access merchandiser features (proper 403)

### 2. Store Assignment
- [ ] Merchandiser can only see stores from their `allowed_stores` list
- [ ] Store selector shows correct filtered list
- [ ] Search functionality works in store selector

### 3. Visit Workflow
- [ ] Can start new visit and select store
- [ ] GPS capture works (check browser permissions)
- [ ] Staff name entry saves correctly
- [ ] Audit checklist loads all products
- [ ] Can enter expired/damaged/balance counts
- [ ] Photo capture/upload works (optional feature)
- [ ] Visit summary shows all entered data
- [ ] Submit creates records in database

### 4. Visit History
- [ ] Past visits display with correct data
- [ ] Status badges show correct colors (completed/in_progress)
- [ ] Filtering by status works
- [ ] Date display shows correct timezone

### 5. API Endpoints
Test with tools like Postman or curl:

```bash
# Get visits (requires auth cookie)
curl -X GET http://localhost:3000/api/store-visits \
  -H "Cookie: auth-session=..." 

# Create visit
curl -X POST http://localhost:3000/api/store-visits \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-session=..." \
  -d '{
    "store_name": "Test Store",
    "gps_location": {"latitude": 5.9804, "longitude": 116.0735},
    "staff_contact": "John Doe"
  }'

# Get audit items
curl -X GET "http://localhost:3000/api/merchandiser/audits?visit_id=123" \
  -H "Cookie: auth-session=..."
```

### 6. Admin Features
- [ ] Can assign Merchandiser role in Staff Management
- [ ] Can set `allowed_stores` for merchandisers
- [ ] View merchandiser visit reports (if implemented)

## Rollback Plan

If issues occur, rollback the database changes:

```sql
-- Remove tables
DROP TABLE IF EXISTS store_audit_items CASCADE;
DROP TABLE IF EXISTS store_visits CASCADE;

-- Remove column from users
ALTER TABLE users DROP COLUMN IF EXISTS allowed_stores;

-- Revert any Merchandiser users back to Sales
UPDATE users SET role = 'Sales' WHERE role = 'Merchandiser';
```

## Common Issues & Solutions

### Issue: GPS not capturing
**Solution:** Check browser permissions - Location access must be allowed. Test on mobile browser for better GPS accuracy.

### Issue: Photos not uploading
**Solution:** 
1. Verify storage bucket exists: `merchandiser-photos`
2. Check RLS policies allow uploads
3. Check file size limits (default 50MB)

### Issue: Merchandiser can't see any stores
**Solution:** Ensure `allowed_stores` column is populated with JSONB array:
```sql
UPDATE users 
SET allowed_stores = '["Store 1", "Store 2"]'::jsonb 
WHERE role = 'Merchandiser';
```

### Issue: Sales user doesn't see choice screen
**Solution:** Check middleware redirects - Sales role should redirect to `/sales-dashboard`, not `/sales`.

### Issue: Visit status stuck in "in_progress"
**Solution:** Check API endpoint completion logic - ensure PUT request updates status to "completed".

## Performance Considerations

- **Photos:** Consider implementing image compression before upload (future enhancement)
- **GPS:** Cache location for 5 minutes to avoid repeated captures
- **Audit Lists:** Product list could be large - consider pagination if > 100 products
- **Offline Mode:** Not implemented yet - requires service worker setup (future enhancement)

## Security Notes

- All API routes validate user role and branch permissions
- Merchandisers can only access their assigned stores
- Photos are stored in private bucket (not publicly accessible)
- GPS coordinates are logged for audit trail
- Visit data is filtered by branch - users cannot see other branches' data

## Next Steps (Future Enhancements)

1. **Reports:** Admin dashboard for merchandiser performance metrics
2. **Notifications:** Alert admin when issues found (expired/damaged products)
3. **Offline Mode:** PWA with IndexedDB for offline visit capturing
4. **Photo Analysis:** AI detection of product conditions from photos
5. **Route Optimization:** Suggest optimal store visit order based on location
6. **QR Codes:** Scan product barcodes instead of manual selection

## Support

For issues or questions:
- Check `/MERCHANDISER_IMPLEMENTATION.md` for technical details
- Review middleware logic in `/middleware.ts`
- Check API logs in browser DevTools Network tab
- Verify database tables using Supabase Table Editor
