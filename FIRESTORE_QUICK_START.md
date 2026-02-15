# 🚀 FIRESTORE MIGRATION - QUICK REFERENCE CARD

## ONE-TIME SETUP

### Step 1: Download Service Account (2 min)
```
Firebase Console → ⚙️ Settings → Service Accounts → Generate New Private Key
Save as: firebase-service-account.json (in project root)
```

### Step 2: Install Dependencies (2 min)
```bash
npm install
```

### Step 3: Run Migration (3-5 min)
```bash
npm run migrate:firestore
```

### Step 4: Deploy Security Rules (2 min)
```
Firebase Console → Firestore → Rules
↓
Copy all content from: FIRESTORE_SECURITY_RULES.txt
↓
Paste & Publish
```

---

## VERIFICATION

### Check Migration Success:
1. Terminal shows: ✅ Migration completed successfully
2. Firebase Console → Firestore shows 8 collections:
   - users (5 docs)
   - products (8+ docs)
   - customers (50+ docs)
   - transactions (X docs)
   - inventory (Y docs)
   - stockAudits (Z docs)

### Check Security Rules:
```
Firebase Console → Firestore → Rules
Status: "Rules are validated and deployed"
```

---

## COMMON COMMANDS

```bash
# Install all dependencies
npm install

# Run migration
npm run migrate:firestore

# Validate script syntax
npm run migrate:firestore:validate

# Start dev server
npm dev

# Backup Firestore data
firebase firestore:export ./firestore-backup

# Restore Firestore data
firebase firestore:import ./firestore-backup
```

---

## FILES TO KNOW ABOUT

| File | Purpose |
|------|---------|
| `scripts/firestore-migration.ts` | Migration script |
| `FIRESTORE_SECURITY_RULES.txt` | Copy to Firebase Console |
| `FIRESTORE_SETUP_GUIDE.md` | Detailed documentation |
| `FIRESTORE_SETUP_COMPLETION.md` | What was done & next steps |
| `firebase-service-account.json` | Download & place in root (NOT in git!) |
| `.env.local` | Firebase credentials (already set) |

---

## WHAT GETS MIGRATED

```
✅ Users (with hashed passwords)
✅ Products
✅ Customers  
✅ Transactions
✅ Van Inventories
✅ Stock Audits
```

---

## SECURITY CHECKLIST

- ✅ Passwords hashed with bcrypt
- ✅ Service account NOT in git
- ✅ RBAC enforced via Security Rules
- ✅ Branch isolation implemented
- ✅ Fail-secure defaults set

---

## NEXT AFTER MIGRATION

1. Create API endpoints (`app/api/*`)
2. Update frontend to use Firestore
3. Implement login authentication
4. Test with real data

---

## NEED HELP?

See: **FIRESTORE_SETUP_GUIDE.md** (Troubleshooting section)

---

**Status:** 🟢 Ready to Start (awaiting service account file)  
**Time to Complete:** ~15 minutes total
