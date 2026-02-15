# FIRESTORE SETUP & MIGRATION GUIDE
## Professional Production-Ready Setup

---

## TABLE OF CONTENTS
1. [Prerequisites](#prerequisites)
2. [Setup Steps](#setup-steps)
3. [Running Migration](#running-migration)
4. [Verification](#verification)
5. [Deploying Security Rules](#deploying-security-rules)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Firebase Project Created ✅
- Project ID: `says-web`
- Credentials already in `.env.local`

### 2. Service Account Setup
Firebase Admin SDK memerlukan service account credentials:

**How to get:**
1. Go to Firebase Console → Project Settings ⚙️
2. Click "Service Accounts" tab
3. Click "Generate New Private Key"
4. Save file as `firebase-service-account.json` in root directory

**⚠️ SECURITY:**
- Do NOT commit this file to git
- Add to `.gitignore`:
  ```
  firebase-service-account.json
  ```

### 3. Install Dependencies

Already in `package.json`:
- `firebase` - Client SDK
- `firebase-admin` - Server SDK
- `bcrypt` - For password hashing

Run:
```bash
npm install
```

---

## Setup Steps

### Step 1: Place Service Account File
```bash
# Copy your downloaded file to project root
cp ~/Downloads/firebase-service-account.json ./firebase-service-account.json
```

Verify file exists:
```bash
ls -la firebase-service-account.json
```

### Step 2: Set Environment Variable (Optional)
Edit `.env.local` to add (if using custom path):
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

### Step 3: Add Package.json Scripts

Add these scripts ke `package.json`:

```json
{
  "scripts": {
    "migrate:firestore": "ts-node scripts/firestore-migration.ts",
    "migrate:firestore:validate": "ts-node -e \"console.log('Script is valid')\""
  }
}
```

---

## Running Migration

### Full Migration (Recommended)

```bash
npm run migrate:firestore
```

This will:
1. ✅ Hash all user passwords with bcrypt
2. ✅ Migrate 5 collections (users, products, customers, transactions, Van inventories)
3. ✅ Handle timestamps properly
4. ✅ Use batch writes for efficiency
5. ✅ Validate all data before writing

**Expected Output:**
```
🚀 Starting Firestore Migration...
📂 Project ID: says-web

📦 Migrating USERS...
✅ Batch committed
✅ Migrated 5 users

📦 Migrating PRODUCTS...
✅ Batch committed
✅ Migrated 8 products

📦 Migrating CUSTOMERS...
✅ Batch committed
✅ Migrated 50+ customers

📦 Migrating TRANSACTIONS...
✅ Batch committed
✅ Migrated X transactions

📦 Migrating VAN INVENTORIES...
✅ Batch committed
✅ Migrated van inventory records

📦 Migrating STOCK AUDITS...
✅ Batch committed
✅ Migrated X stock audits

✅ Migration completed successfully in 12.34s!

📋 NEXT STEPS:
1. Verify data in Firebase Console
2. Update Firestore Security Rules
3. Create API endpoints to access Firestore data
4. Update frontend components to use Firestore API
```

---

## Verification

### In Firebase Console:
1. Go to Firebase Console → Firestore Database
2. Check each collection:
   - **users** - Should have 5 users (founder, admin_kk, admin_kinabatangan, sales_kk, sales_kinabatangan)
   - **products** - Should have 8+ products
   - **customers** - Should have 50+ customers
   - **transactions** - Should have migrated transactions
   - **inventory** - Should have van inventory records

### Data Check:
```javascript
// Test in Firebase Console → Firestore → Run Query
// Check user data structure:
db.collection("users").doc("u_founder").get()

// Result should show:
{
  userId: "u_founder",
  username: "founder",
  passwordHash: "$2b$10$...", // Hashed, not plain password!
  role: "Main Admin",
  branch: "HQ",
  createdAt: Timestamp,
  ...
}
```

### Via Firebase CLI:
```bash
# Install Firebase CLI if not already
npm install -g firebase-tools

# Login
firebase login

# Check collections
firebase firestore:describe collections

# Backup data
firebase firestore:export ./firestore-backup
```

---

## Deploying Security Rules

### Option 1: Firebase Console (GUI - Recommended)

1. Go to **Firebase Console → Firestore → Rules** tab
2. Replace entire content with: `FIRESTORE_SECURITY_RULES.txt`
3. Click **"Publish"**
4. Wait for deployment (usually < 1 minute)

### Option 2: Firebase CLI

```bash
# Install Firebase tools
npm install -g firebase-tools

# Login
firebase login

# Deploy rules
firebase deploy --only firestore:rules
```

### Verify Rules Deployed:
```bash
# Check current rules
firebase firestore:describe rules
```

---

## Post-Migration Tasks

### 1. Create API Endpoints
Create API routes to read/write Firestore data:

```typescript
// app/api/users/route.ts
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export async function GET(request: Request) {
  const users = await getDocs(collection(db, 'users'));
  return Response.json(users.docs.map(doc => doc.data()));
}
```

### 2. Update Frontend Components
```typescript
// Example: Fetch products from Firestore
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';

async function fetchProducts() {
  const q = query(collection(db, 'products'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}
```

### 3. Setup Authentication
- Update login page to use Firebase Auth
- Verify passwords against hashed versions in Firestore

### 4. Create Admin Functions
- Seed commission calculations
- Generate monthly settlements
- Create audit trails

---

## Troubleshooting

### Issue: "Service account file not found"
**Solution:**
1. Verify file location: `ls -la firebase-service-account.json`
2. Check path in `.env.local`: `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`
3. Re-download from Firebase Console if corrupted

### Issue: "Permission denied" during migration
**Solution:**
1. Verify service account has Firestore Editor role
2. Go to Firebase Console → IAM & Admin
3. Check service account has minimum roles:
   - `Cloud Datastore User`
   - `Cloud Datastore Service Agent`

### Issue: "Batch commit failed"
**Solution:**
1. Check internet connection
2. Verify Firestore database is enabled in Firebase Console
3. Try running with smaller batch size (modify `BATCH_SIZE = 100`)

### Issue: "Password hash takes too long"
**Solution:**
- Reduce `SALT_ROUNDS` from 10 to 8 (less secure but faster)
- Run migration during off-peak hours

### Issue: Duplicate documents created
**Solution:**
1. Delete problematic collection via Firebase Console
2. Re-run migration script
3. Migration script is idempotent - safe to re-run

---

## Security Best Practices ✅

- ✅ Passwords hashed with bcrypt (SALT_ROUNDS=10)
- ✅ Service account credentials not in git (add to .gitignore)
- ✅ Firestore Security Rules enforce RBAC
- ✅ Sensitive fields (passwordHash) encrypted
- ✅ Audit logging for compliance
- ✅ Data validation on migration

---

## Rollback (If Needed)

### Manual Rollback:
1. Go to Firebase Console → Firestore Database
2. Delete affected collection
3. Restore from Firestore backup: `firebase firestore:import ./firestore-backup`

### Automated Rollback:
```bash
# Restore from backup
firebase firestore:import ./firestore-backup
```

---

## Monitoring & Maintenance

### Monitor Firestore Usage:
- Firebase Console → Firestore → Usage tab
- Check read/write operations
- Monitor costs

### Regular Backups:
```bash
# Weekly backup schedule
firebase firestore:export ./backups/firestore-$(date +%Y-%m-%d)
```

### Clear Test Data:
```bash
# Delete a collection (useful for testing)
# Go to Firebase Console → Firestore → Select collection → Delete collection
```

---

## Support & Documentation

- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [Firebase Admin SDK](https://firebase.google.com/docs/database/admin/start)
- [bcrypt Documentation](https://www.npmjs.com/package/bcrypt)

---

**Last Updated:** February 14, 2026
**Status:** Production Ready ✅
