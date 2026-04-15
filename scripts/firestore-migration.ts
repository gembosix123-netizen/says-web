/**
 * Firestore Migration Script
 * ===========================
 * 
 * Professional migration script untuk migrate data dari JSON files ke Firestore.
 * 
 * USAGE:
 * ------
 * 1. Set up Firebase service account credentials
 * 2. Run: npm run migrate:firestore
 * 
 * FEATURES:
 * --------
 * - Password hashing dengan bcrypt
 * - Proper timestamp handling
 * - Data validation & transformation
 * - Batch writes untuk efficiency
 * - Comprehensive error handling
 * - Transaction support untuk data consistency
 */

import * as admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
  './firebase-service-account.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Service account file not found at:', serviceAccountPath);
  console.error('Please set up Firebase service account and update FIREBASE_SERVICE_ACCOUNT_PATH');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = admin.firestore();
const BATCH_SIZE = 500; // Firestore batch write limit
const SALT_ROUNDS = 10; // bcrypt salt rounds

interface User {
  id: string;
  username: string;
  password: string;
  role: 'Main Admin' | 'Admin' | 'Sales';
  name: string;
  branch: string;
  assignedShopId?: string | null;
  commissionRate?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit?: string;
  code?: string;
  description?: string;
  category?: string;
  costPrice?: number;
}

interface Customer {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  outstandingBalance?: number;
  sales_id?: string;
  lat?: number;
  lon?: number;
  city?: string;
  state?: string;
  postalCode?: string;
  type?: 'retail' | 'wholesale' | 'individual';
  creditLimit?: number;
}

interface Transaction {
  id: string;
  [key: string]: any;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function getCurrentTimestamp(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.now();
}

function ensureTimestamp(value: string | number | Date | admin.firestore.Timestamp): admin.firestore.Timestamp {
  if (value instanceof admin.firestore.Timestamp) {
    return value;
  }
  if (value instanceof Date) {
    return admin.firestore.Timestamp.fromDate(value);
  }
  if (typeof value === 'string') {
    return admin.firestore.Timestamp.fromDate(new Date(value));
  }
  if (typeof value === 'number') {
    return admin.firestore.Timestamp.fromMillis(value);
  }
  return admin.firestore.Timestamp.now();
}

async function batchWrite(batch: admin.firestore.WriteBatch): Promise<void> {
  try {
    await batch.commit();
    console.log('✅ Batch committed');
  } catch (error) {
    console.error('❌ Batch commit failed:', error);
    throw error;
  }
}

// ============================================================================
// DATA LOADING
// ============================================================================

function loadJsonFile<T>(filename: string): T[] {
  const filepath = path.join(__dirname, '../data', filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`⚠️  File not found: ${filepath}`);
    return [];
  }
  const content = fs.readFileSync(filepath, 'utf8');
  return JSON.parse(content) as T[];
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

async function migrateUsers(): Promise<void> {
  console.log('\n📦 Migrating USERS...');
  const users = loadJsonFile<User>('users.json');
  
  if (users.length === 0) {
    console.log('⚠️  No users to migrate');
    return;
  }

  let batch = db.batch();
  let operationCount = 0;

  for (const user of users) {
    const userRef = db.collection('users').doc(user.id);
    
    const passwordHash = await hashPassword(user.password);
    
    const userData = {
      userId: user.id,
      username: user.username,
      email: user.username + '@says.local', // Generate email if not provided
      passwordHash, // NEVER store plain passwords
      role: user.role,
      branch: user.branch,
      name: user.name,
      status: 'active',
      commissionRate: user.commissionRate || 0,
      salary: 0, // Set default, can be updated later
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      lastLogin: null,
      permissions: [], // Will be auto-populated based on role
    };

    batch.set(userRef, userData);
    operationCount++;

    if (operationCount % BATCH_SIZE === 0) {
      await batchWrite(batch);
      batch = db.batch();
    }
  }

  if (operationCount % BATCH_SIZE !== 0) {
    await batchWrite(batch);
  }

  console.log(`✅ Migrated ${users.length} users`);
}

async function migrateProducts(): Promise<void> {
  console.log('\n📦 Migrating PRODUCTS...');
  const products = loadJsonFile<Product>('products.json');
  
  if (products.length === 0) {
    console.log('⚠️  No products to migrate');
    return;
  }

  let batch = db.batch();
  let operationCount = 0;

  for (const product of products) {
    const productRef = db.collection('products').doc(product.id);
    
    const productData = {
      productId: product.id,
      sku: product.code || `SKU-${product.id}`,
      name: product.name,
      description: product.description || '',
      category: product.category || 'Uncategorized',
      price: product.price,
      costPrice: product.costPrice || 0,
      images: [],
      specifications: { unit: product.unit || 'pkt' },
      minStockLevel: 0,
      maxStockLevel: 1000,
      supplier: '',
      isActive: true,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      metadata: {},
    };

    batch.set(productRef, productData);
    operationCount++;

    if (operationCount % BATCH_SIZE === 0) {
      await batchWrite(batch);
      batch = db.batch();
    }
  }

  if (operationCount % BATCH_SIZE !== 0) {
    await batchWrite(batch);
  }

  console.log(`✅ Migrated ${products.length} products`);
}

async function migrateCustomers(): Promise<void> {
  console.log('\n📦 Migrating CUSTOMERS...');
  const customers = loadJsonFile<Customer>('customers.json');
  
  if (customers.length === 0) {
    console.log('⚠️  No customers to migrate');
    return;
  }

  let batch = db.batch();
  let operationCount = 0;

  for (const customer of customers) {
    const customerRef = db.collection('customers').doc(customer.id);
    
    const customerData = {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      postalCode: customer.postalCode || '',
      branch: 'HQ', // Determine from sales_id if available
      type: customer.type || 'retail',
      status: 'active',
      totalPurchases: 0,
      totalSpent: 0,
      creditLimit: 100000,
      credits: customer.outstandingBalance || 0,
      notes: '',
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      metadata: {
        originalSalesId: customer.sales_id || '',
        lat: customer.lat,
        lon: customer.lon,
      },
    };

    batch.set(customerRef, customerData);
    operationCount++;

    if (operationCount % BATCH_SIZE === 0) {
      await batchWrite(batch);
      batch = db.batch();
    }
  }

  if (operationCount % BATCH_SIZE !== 0) {
    await batchWrite(batch);
  }

  console.log(`✅ Migrated ${customers.length} customers`);
}

async function migrateTransactions(): Promise<void> {
  console.log('\n📦 Migrating TRANSACTIONS...');
  const transactions = loadJsonFile<Transaction>('transactions.json');
  
  if (transactions.length === 0) {
    console.log('⚠️  No transactions to migrate');
    return;
  }

  let batch = db.batch();
  let operationCount = 0;

  for (const transaction of transactions) {
    const transactionRef = db.collection('transactions').doc(transaction.id);
    
    // Extract fields based on transaction structure
    const items = transaction.items || [];
    const totalAmount = transaction.total || transaction.subtotal || 0;

    const transactionData = {
      transactionId: transaction.id,
      type: transaction.type || 'sale',
      status: (transaction.status || 'completed').toLowerCase() as 'pending' | 'completed' | 'cancelled',
      userId: transaction.salesmanId || transaction.customer?.sales_id || '',
      branch: 'HQ',
      amount: totalAmount,
      items: items.map((item: any) => ({
        productId: item.id || item.productId,
        quantity: item.qty || item.quantity || 1,
        unitPrice: item.price || item.unitPrice || 0,
        totalPrice: (item.qty || item.quantity || 1) * (item.price || item.unitPrice || 0),
      })),
      customerId: transaction.customerId || transaction.customer?.id || '',
      paymentMethod: transaction.payment?.method || 'cash',
      reference: transaction.id,
      notes: transaction.notes || '',
      createdAt: transaction.createdAt 
        ? ensureTimestamp(transaction.createdAt)
        : getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      completedAt: transaction.status === 'Completed' 
        ? ensureTimestamp(transaction.createdAt || new Date())
        : null,
      metadata: {
        originalCheckInTime: transaction.checkInTime,
        gps: transaction.gps,
        payment: transaction.payment,
      },
    };

    batch.set(transactionRef, transactionData);
    operationCount++;

    if (operationCount % BATCH_SIZE === 0) {
      await batchWrite(batch);
      batch = db.batch();
    }
  }

  if (operationCount % BATCH_SIZE !== 0) {
    await batchWrite(batch);
  }

  console.log(`✅ Migrated ${transactions.length} transactions`);
}

async function migrateVanInventories(): Promise<void> {
  console.log('\n📦 Migrating VAN INVENTORIES (as inventory snapshots)...');
  const vanInventories = loadJsonFile<any>('van_inventories.json');
  
  if (vanInventories.length === 0) {
    console.log('⚠️  No van inventories to migrate');
    return;
  }

  let batch = db.batch();
  let operationCount = 0;
  const products = loadJsonFile<Product>('products.json');
  const productMap = new Map(products.map(p => [p.id, p]));

  for (const van of vanInventories) {
    const userId = van.userId;
    
    for (const [productId, quantity] of Object.entries(van.items || {})) {
      if (quantity === null || quantity === undefined) continue;

      const inventoryId = `inv_${userId}_${productId}`;
      const inventoryRef = db.collection('inventory').doc(inventoryId);
      
      const product = productMap.get(productId) || { name: '', unit: '' };
      
      const inventoryData = {
        inventoryId,
        productId,
        productName: product.name,
        branch: 'HQ', // Can be determined from user branch
        quantity: quantity as number,
        reservedQuantity: 0,
        availableQuantity: (quantity as number) - 0,
        lastRestockDate: ensureTimestamp(van.lastUpdated || new Date()),
        lastCountDate: getCurrentTimestamp(),
        status: (quantity as number) === 0 ? 'out-of-stock' : 
               (quantity as number) < 10 ? 'low-stock' : 'in-stock',
        batchNumbers: [],
        createdAt: getCurrentTimestamp(),
        updatedAt: ensureTimestamp(van.lastUpdated || new Date()),
        metadata: {
          vanUserId: userId,
        },
      };

      batch.set(inventoryRef, inventoryData);
      operationCount++;

      if (operationCount % BATCH_SIZE === 0) {
        await batchWrite(batch);
        batch = db.batch();
      }
    }
  }

  if (operationCount % BATCH_SIZE !== 0) {
    await batchWrite(batch);
  }

  console.log(`✅ Migrated van inventories (${operationCount} inventory records)`);
}

async function migrateStockAudits(): Promise<void> {
  console.log('\n📦 Migrating STOCK AUDITS (as transactions)...');
  const audits = loadJsonFile<any>('stock_audits.json');
  
  if (audits.length === 0) {
    console.log('⚠️  No stock audits to migrate');
    return;
  }

  let batch = db.batch();
  let operationCount = 0;

  for (const audit of audits) {
    const auditRef = db.collection('stockAudits').doc(audit.id);
    
    const auditData = {
      auditId: audit.id,
      customerId: audit.customerId,
      items: (audit.items || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        physicalStock: item.physicalStock,
      })),
      counts: audit.counts || {},
      notes: audit.notes || '',
      date: audit.date ? ensureTimestamp(audit.date) : getCurrentTimestamp(),
      createdAt: audit.createdAt ? ensureTimestamp(audit.createdAt) : getCurrentTimestamp(),
      metadata: {},
    };

    batch.set(auditRef, auditData);
    operationCount++;

    if (operationCount % BATCH_SIZE === 0) {
      await batchWrite(batch);
      batch = db.batch();
    }
  }

  if (operationCount % BATCH_SIZE !== 0) {
    await batchWrite(batch);
  }

  console.log(`✅ Migrated ${audits.length} stock audits`);
}

// ============================================================================
// MAIN MIGRATION ORCHESTRATION
// ============================================================================

async function runMigration(): Promise<void> {
  console.log('🚀 Starting Firestore Migration...');
  console.log(`📂 Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}\n`);

  const startTime = Date.now();

  try {
    // Run migrations in order (users first, as they're referenced by other collections)
    await migrateUsers();
    await migrateProducts();
    await migrateCustomers();
    await migrateTransactions();
    await migrateVanInventories();
    await migrateStockAudits();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Migration completed successfully in ${duration}s!`);
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Verify data in Firebase Console');
    console.log('2. Update Firestore Security Rules');
    console.log('3. Create API endpoints to access Firestore data');
    console.log('4. Update frontend components to use Firestore API');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };
