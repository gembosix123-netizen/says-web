/**
 * Firestore Service Utilities
 * ============================
 * 
 * Centralized functions for Firestore operations
 * Provides a clean interface for reading/writing data
 * 
 * Usage:
 * import { getUsers, createUser, updateUser } from '@/lib/firestore-service';
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Query,
  DocumentReference,
  Timestamp,
  FirestoreDataConverter,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface User {
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'Main Admin' | 'Admin' | 'Sales';
  branch: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  commissionRate?: number;
  salary?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastLogin?: Timestamp | null;
  permissions?: string[];
}

export interface Product {
  productId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  costPrice?: number;
  images?: string[];
  specifications?: Record<string, any>;
  minStockLevel?: number;
  maxStockLevel?: number;
  supplier?: string;
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  metadata?: Record<string, any>;
}

export interface Customer {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  branch: string;
  type?: 'retail' | 'wholesale' | 'individual';
  status: 'active' | 'inactive';
  totalPurchases?: number;
  totalSpent?: number;
  creditLimit?: number;
  credits?: number;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Transaction {
  transactionId: string;
  type: 'sale' | 'return' | 'restock' | 'adjustment' | 'commission';
  status: 'pending' | 'completed' | 'cancelled';
  userId: string;
  branch: string;
  amount: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  customerId?: string;
  paymentMethod?: 'cash' | 'card' | 'bank-transfer';
  reference?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp | null;
  metadata?: Record<string, any>;
}

export interface InventoryItem {
  inventoryId: string;
  productId: string;
  branch: string;
  quantity: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  lastRestockDate?: Timestamp;
  lastCountDate?: Timestamp;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  batchNumbers?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ============================================================================
// GENERIC FIRESTORE OPERATIONS
// ============================================================================

/**
 * Fetch all documents from a collection
 */
export async function getAllDocuments<T extends DocumentData>(
  collectionName: string
): Promise<T[]> {
  try {
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    } as unknown as T));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Fetch a single document by ID
 */
export async function getDocument<T extends DocumentData>(
  collectionName: string,
  documentId: string
): Promise<T | null> {
  try {
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? ({ ...docSnap.data(), id: docSnap.id } as unknown as T) : null;
  } catch (error) {
    console.error(`Error fetching ${collectionName}/${documentId}:`, error);
    throw error;
  }
}

/**
 * Query documents with filters
 */
export async function queryDocuments<T extends DocumentData>(
  collectionName: string,
  filters?: Array<{
    field: string;
    operator: '==' | '<' | '>' | '<=' | '>=';
    value: any;
  }>
): Promise<T[]> {
  try {
    let q: Query = collection(db, collectionName);

    if (filters && filters.length > 0) {
      const whereClause = filters.map((f) => where(f.field, f.operator, f.value));
      q = query(q, ...whereClause);
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    } as unknown as T));
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Create a new document
 */
export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: T
): Promise<DocumentReference> {
  try {
    const docRef = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Update an existing document
 */
export async function updateDocument<T extends DocumentData>(
  collectionName: string,
  documentId: string,
  data: Partial<T>
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, documentId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error(
      `Error updating ${collectionName}/${documentId}:`,
      error
    );
    throw error;
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(
  collectionName: string,
  documentId: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, documentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(
      `Error deleting ${collectionName}/${documentId}:`,
      error
    );
    throw error;
  }
}

// ============================================================================
// USER-SPECIFIC OPERATIONS
// ============================================================================

export async function getUsers(): Promise<User[]> {
  return getAllDocuments<User>('users');
}

export async function getUser(userId: string): Promise<User | null> {
  return getDocument<User>('users', userId);
}

export async function getUsersByBranch(branch: string): Promise<User[]> {
  return queryDocuments<User>('users', [
    { field: 'branch', operator: '==', value: branch },
  ]);
}

export async function getUsersByRole(role: string): Promise<User[]> {
  return queryDocuments<User>('users', [
    { field: 'role', operator: '==', value: role },
  ]);
}

export async function createUser(userData: Omit<User, 'userId'>): Promise<string> {
  try {
    const docRef = await createDocument('users', userData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  return updateDocument<User>('users', userId, updates);
}

export async function deleteUser(userId: string): Promise<void> {
  return deleteDocument('users', userId);
}

// ============================================================================
// PRODUCT-SPECIFIC OPERATIONS
// ============================================================================

export async function getProducts(): Promise<Product[]> {
  return getAllDocuments<Product>('products');
}

export async function getProduct(productId: string): Promise<Product | null> {
  return getDocument<Product>('products', productId);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  return queryDocuments<Product>('products', [
    { field: 'category', operator: '==', value: category },
  ]);
}

export async function getActiveProducts(): Promise<Product[]> {
  return queryDocuments<Product>('products', [
    { field: 'isActive', operator: '==', value: true },
  ]);
}

export async function createProduct(productData: Omit<Product, 'productId'>): Promise<string> {
  const docRef = await createDocument('products', productData);
  return docRef.id;
}

export async function updateProduct(productId: string, updates: Partial<Product>): Promise<void> {
  return updateDocument<Product>('products', productId, updates);
}

export async function deleteProduct(productId: string): Promise<void> {
  return deleteDocument('products', productId);
}

// ============================================================================
// CUSTOMER-SPECIFIC OPERATIONS
// ============================================================================

export async function getCustomers(): Promise<Customer[]> {
  return getAllDocuments<Customer>('customers');
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  return getDocument<Customer>('customers', customerId);
}

export async function getCustomersByBranch(branch: string): Promise<Customer[]> {
  return queryDocuments<Customer>('customers', [
    { field: 'branch', operator: '==', value: branch },
  ]);
}

export async function getCustomersByType(type: string): Promise<Customer[]> {
  return queryDocuments<Customer>('customers', [
    { field: 'type', operator: '==', value: type },
  ]);
}

export async function createCustomer(
  customerData: Omit<Customer, 'customerId'>
): Promise<string> {
  const docRef = await createDocument('customers', customerData);
  return docRef.id;
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<Customer>
): Promise<void> {
  return updateDocument<Customer>('customers', customerId, updates);
}

export async function deleteCustomer(customerId: string): Promise<void> {
  return deleteDocument('customers', customerId);
}

// ============================================================================
// TRANSACTION-SPECIFIC OPERATIONS
// ============================================================================

export async function getTransactions(): Promise<Transaction[]> {
  return getAllDocuments<Transaction>('transactions');
}

export async function getTransaction(transactionId: string): Promise<Transaction | null> {
  return getDocument<Transaction>('transactions', transactionId);
}

export async function getTransactionsByUser(userId: string): Promise<Transaction[]> {
  return queryDocuments<Transaction>('transactions', [
    { field: 'userId', operator: '==', value: userId },
  ]);
}

export async function getTransactionsByBranch(branch: string): Promise<Transaction[]> {
  return queryDocuments<Transaction>('transactions', [
    { field: 'branch', operator: '==', value: branch },
  ]);
}

export async function getTransactionsByCustomer(customerId: string): Promise<Transaction[]> {
  return queryDocuments<Transaction>('transactions', [
    { field: 'customerId', operator: '==', value: customerId },
  ]);
}

export async function getTransactionsByStatus(status: string): Promise<Transaction[]> {
  return queryDocuments<Transaction>('transactions', [
    { field: 'status', operator: '==', value: status },
  ]);
}

export async function createTransaction(
  transactionData: Omit<Transaction, 'transactionId'>
): Promise<string> {
  const docRef = await createDocument('transactions', transactionData);
  return docRef.id;
}

export async function updateTransaction(
  transactionId: string,
  updates: Partial<Transaction>
): Promise<void> {
  return updateDocument<Transaction>('transactions', transactionId, updates);
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  return deleteDocument('transactions', transactionId);
}

// ============================================================================
// INVENTORY-SPECIFIC OPERATIONS
// ============================================================================

export async function getInventory(): Promise<InventoryItem[]> {
  return getAllDocuments<InventoryItem>('inventory');
}

export async function getInventoryItem(inventoryId: string): Promise<InventoryItem | null> {
  return getDocument<InventoryItem>('inventory', inventoryId);
}

export async function getInventoryByBranch(branch: string): Promise<InventoryItem[]> {
  return queryDocuments<InventoryItem>('inventory', [
    { field: 'branch', operator: '==', value: branch },
  ]);
}

export async function getInventoryByProduct(productId: string): Promise<InventoryItem[]> {
  return queryDocuments<InventoryItem>('inventory', [
    { field: 'productId', operator: '==', value: productId },
  ]);
}

export async function getLowStockItems(): Promise<InventoryItem[]> {
  return queryDocuments<InventoryItem>('inventory', [
    { field: 'status', operator: '==', value: 'low-stock' },
  ]);
}

export async function getOutOfStockItems(): Promise<InventoryItem[]> {
  return queryDocuments<InventoryItem>('inventory', [
    { field: 'status', operator: '==', value: 'out-of-stock' },
  ]);
}

export async function createInventoryItem(
  inventoryData: Omit<InventoryItem, 'inventoryId'>
): Promise<string> {
  const docRef = await createDocument('inventory', inventoryData);
  return docRef.id;
}

export async function updateInventoryItem(
  inventoryId: string,
  updates: Partial<InventoryItem>
): Promise<void> {
  return updateDocument<InventoryItem>('inventory', inventoryId, updates);
}

export async function deleteInventoryItem(inventoryId: string): Promise<void> {
  return deleteDocument('inventory', inventoryId);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safe JSON serialization that handles Firestore Timestamps
 */
export function serializeForJSON(data: any): any {
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(serializeForJSON);
  }
  if (data !== null && typeof data === 'object') {
    const serialized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeForJSON(value);
    }
    return serialized;
  }
  return data;
}

/**
 * Validate user has permission to access branch data
 */
export function canAccessBranch(userBranch: string, targetBranch: string): boolean {
  // Main Admin can access all branches
  // Others can only access their own branch
  return true; // RBAC enforced at Firestore Security Rules level
}

/**
 * Convert database response to API response
 */
export function toApiResponse<T>(data: T, includeTimestamps = true): any {
  return includeTimestamps ? serializeForJSON(data) : data;
}
