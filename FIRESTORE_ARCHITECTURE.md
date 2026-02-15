/**
 * SAYS 2.0 - FIRESTORE DATABASE ARCHITECTURE
 * ==========================================
 * 
 * This document outlines the scalable, secure Firestore architecture
 * with Role-Based Access Control (RBAC) and optimized cost structure.
 * 
 * Core Principles:
 * 1. Single-File Mandate: Fetch complete datasets in one query, filter client-side
 * 2. Flat hierarchies to avoid complex index requirements
 * 3. RBAC enforcement via Security Rules
 * 4. Cost optimization through query efficiency
 */

// ============================================================================
// COLLECTION STRUCTURE
// ============================================================================

// 1. USERS Collection
// ----
// Path: /users/{userId}
// Purpose: Store user profiles and authentication metadata
// Size: Small (typically < 10KB per document)
// Read patterns: Authentication, user profile fetches

{
  "userId": "string",
  "username": "string",
  "email": "string",
  "passwordHash": "string",  // NEVER store plain passwords
  "role": "Main Admin | Admin | Sales",
  "branch": "Kota Kinabalu | Kinabatangan | HQ",
  "name": "string",
  "status": "active | inactive | suspended",
  "commissionRate": "number (0.0-1.0)",
  "salary": "number (for Admin/Main Admin)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLogin": "timestamp",
  "permissions": ["string"]  // Custom permissions array
}

// 2. PRODUCTS Collection
// ----
// Path: /products/{productId}
// Purpose: Master product catalog (single source of truth)
// Size: Medium (typically 1-5KB per product)
// Read patterns: Frequent reads, occasional writes

{
  "productId": "string",
  "sku": "string",
  "name": "string",
  "description": "string",
  "category": "string",
  "price": "number",
  "costPrice": "number",
  "images": ["url1", "url2"],
  "specifications": { /* flexible JSON */ },
  "minStockLevel": "number",
  "maxStockLevel": "number",
  "supplier": "string",
  "isActive": "boolean",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "metadata": { /* any additional data */ }
}

// 3. INVENTORY Collection
// ----
// Path: /inventory/{inventoryId}
// Purpose: Branch-specific stock levels
// Design: Denormalized product data + quantity for quick reads
// Read patterns: High-frequency reads, moderate writes

{
  "inventoryId": "string",
  "productId": "string",
  "branch": "string",
  "quantity": "number",
  "reservedQuantity": "number",
  "availableQuantity": "number",  // Calculated: quantity - reservedQuantity
  "lastRestockDate": "timestamp",
  "lastCountDate": "timestamp",
  "status": "in-stock | low-stock | out-of-stock",
  "batchNumbers": ["string"],  // For tracking lot numbers
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}

// 4. TRANSACTIONS Collection
// ----
// Path: /transactions/{transactionId}
// Purpose: All financial and inventory movements
// Size: Large (many documents per day)
// Read patterns: Reporting, auditing, settlements

{
  "transactionId": "string",
  "type": "sale | return | restock | adjustment | commission",
  "status": "pending | completed | cancelled",
  "userId": "string",  // User who initiated transaction
  "branch": "string",
  "amount": "number",
  "items": [
    {
      "productId": "string",
      "quantity": "number",
      "unitPrice": "number",
      "totalPrice": "number"
    }
  ],
  "customerId": "string",  // If applicable
  "paymentMethod": "cash | card | bank-transfer",
  "reference": "string",  // Invoice/Receipt number
  "notes": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "completedAt": "timestamp",
  "metadata": { /* flexible */ }
}

// 5. CUSTOMERS Collection
// ----
// Path: /customers/{customerId}
// Purpose: Customer relationship management
// Size: Small to medium (varies by customer count)
// Read patterns: Lookups, reporting, segmentation

{
  "customerId": "string",
  "name": "string",
  "phone": "string",
  "email": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "postalCode": "string",
  "branch": "string",
  "type": "retail | wholesale | individual",
  "status": "active | inactive",
  "totalPurchases": "number",
  "totalSpent": "number",
  "creditLimit": "number",
  "credits": "number",
  "notes": "string",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}

// 6. COMMISSIONS Collection
// ----
// Path: /commissions/{commissionId}
// Purpose: Track commission calculations and payments
// Size: Medium (one per transaction if applicable)
// Read patterns: Periodic settlement, reporting

{
  "commissionId": "string",
  "transactionId": "string",
  "userId": "string",
  "branch": "string",
  "baseAmount": "number",
  "commissionRate": "number",
  "commissionAmount": "number",
  "status": "pending | paid | cancelled",
  "paymentDate": "timestamp",
  "notes": "string",
  "createdAt": "timestamp",
  "paidAt": "timestamp"
}

// 7. AUDITS Collection
// ----
// Path: /audits/{auditId}
// Purpose: Compliance and security logging
// Size: Large (one per significant action)
// Read patterns: Compliance reports, security reviews

{
  "auditId": "string",
  "action": "create | read | update | delete | login | logout",
  "entityType": "user | product | inventory | transaction",
  "entityId": "string",
  "userId": "string",
  "branch": "string",
  "changes": {
    "before": { /* previous values */ },
    "after": { /* new values */ }
  },
  "ipAddress": "string",
  "userAgent": "string",
  "status": "success | failure",
  "reason": "string",  // If failure
  "timestamp": "timestamp"
}

// 8. SETTLEMENTS Collection
// ----
// Path: /settlements/{settlementId}
// Purpose: Periodic financial settlements
// Size: Small to medium
// Read patterns: Monthly/weekly reporting

{
  "settlementId": "string",
  "period": "string",  // "2024-02" format
  "branch": "string",
  "totalSales": "number",
  "totalCommissions": "number",
  "totalExpenses": "number",
  "netProfit": "number",
  "commissionBreakdown": {
    "userId": "number"  // Map of user IDs to commission amounts
  },
  "status": "draft | finalized | reconciled",
  "createdAt": "timestamp",
  "finalizedAt": "timestamp"
}

// ============================================================================
// FIRESTORE SECURITY RULES (Role-Based Access Control)
// ============================================================================

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isMainAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Main Admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['Main Admin', 'Admin'];
    }
    
    function isSalesUser() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'Sales';
    }
    
    function getUserBranch() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.branch;
    }
    
    function userOwnsDocument(documentBranch) {
      return getUserBranch() == documentBranch || isMainAdmin();
    }

    // ========================================
    // USERS COLLECTION RULES
    // ========================================
    match /users/{userId} {
      // Read: Main Admin can read all, Users can read themselves
      allow read: if isMainAdmin() || request.auth.uid == userId;
      
      // Create: Main Admin only
      allow create: if isMainAdmin();
      
      // Update: Main Admin can update all, Users can update limited fields
      allow update: if isMainAdmin() || 
                       (request.auth.uid == userId && 
                        !request.resource.data.diff(resource.data).affectedKeys()
                          .hasAny(['role', 'permissions', 'salary']));
      
      // Delete: Main Admin only
      allow delete: if isMainAdmin();
    }

    // ========================================
    // PRODUCTS COLLECTION RULES
    // ========================================
    match /products/{productId} {
      // Read: All authenticated users
      allow read: if isAuthenticated();
      
      // Create/Update: Admin and above
      allow create, update: if isAdmin();
      
      // Delete: Main Admin only
      allow delete: if isMainAdmin();
    }

    // ========================================
    // INVENTORY COLLECTION RULES
    // ========================================
    match /inventory/{inventoryId} {
      // Read: Users can read their branch inventory, Main Admin sees all
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || resource.data.branch == getUserBranch());
      
      // Create/Update: Admin and above on own branch
      allow create, update: if isAdmin() && 
                              userOwnsDocument(request.resource.data.branch);
      
      // Delete: Main Admin only
      allow delete: if isMainAdmin();
    }

    // ========================================
    // TRANSACTIONS COLLECTION RULES
    // ========================================
    match /transactions/{transactionId} {
      // Read: Users see transactions from their branch, Main Admin sees all
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || resource.data.branch == getUserBranch());
      
      // Create: Sales and Admin on own branch
      allow create: if (isSalesUser() || isAdmin()) && 
                      userOwnsDocument(request.resource.data.branch);
      
      // Update: Limited updates only (cancel, complete), Main Admin has full access
      allow update: if isMainAdmin() ||
                      (request.auth.uid == resource.data.userId && 
                       resource.data.status == 'pending' &&
                       request.resource.data.status in ['completed', 'cancelled']);
      
      // Delete: Main Admin only
      allow delete: if isMainAdmin();
    }

    // ========================================
    // CUSTOMERS COLLECTION RULES
    // ========================================
    match /customers/{customerId} {
      // Read: Users see customers from their branch, Main Admin sees all
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || resource.data.branch == getUserBranch());
      
      // Create: Sales and Admin
      allow create, update: if (isSalesUser() || isAdmin()) && 
                              userOwnsDocument(request.resource.data.branch);
      
      // Delete: Admin and above
      allow delete: if isAdmin();
    }

    // ========================================
    // COMMISSIONS COLLECTION RULES
    // ========================================
    match /commissions/{commissionId} {
      // Read: Sales user sees own, Admin sees branch, Main Admin sees all
      allow read: if isAuthenticated() && 
                     (isMainAdmin() || 
                      isAdmin() && resource.data.branch == getUserBranch() ||
                      isSalesUser() && resource.data.userId == request.auth.uid);
      
      // Create: Admin triggers commission calculation
      allow create: if isAdmin();
      
      // Update: Only status updates by Admin
      allow update: if isAdmin() && 
                      request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(['status', 'paymentDate', 'paidAt']);
      
      // Delete: Main Admin only
      allow delete: if isMainAdmin();
    }

    // ========================================
    // AUDITS COLLECTION RULES
    // ========================================
    match /audits/{auditId} {
      // Read: Admin and above for their branch, Main Admin sees all
      allow read: if isMainAdmin() || 
                     (isAdmin() && resource.data.branch == getUserBranch());
      
      // Create: System only (via backend trigger) - should not allow client writes
      allow create: if false;
      
      // Update/Delete: Never allowed
      allow update, delete: if false;
    }

    // ========================================
    // SETTLEMENTS COLLECTION RULES
    // ========================================
    match /settlements/{settlementId} {
      // Read: Admin sees own branch, Main Admin sees all
      allow read: if isMainAdmin() || 
                     (isAdmin() && resource.data.branch == getUserBranch());
      
      // Create/Update: Main Admin only
      allow create, update: if isMainAdmin();
      
      // Delete: Main Admin only
      allow delete: if isMainAdmin();
    }
  }
}

// ============================================================================
// API ENDPOINT STRUCTURE (Next.js)
// ============================================================================

// GET /api/users
// - Fetch all users (Main Admin) or self (authenticated user)
// - Query params: ?branch=*, ?role=*
// - Returns: Array of users (single query, filter client-side)

// POST /api/users
// - Create new user (Main Admin only)
// - Body: { username, email, role, branch, salary, commissionRate }

// PUT /api/users/{userId}
// - Update user data (Main Admin) or self
// - Body: { name, email, ... (allowed fields) }

// DELETE /api/users/{userId}
// - Delete user (Main Admin only)

// GET /api/products
// - Fetch all products (single collection fetch, filter client-side)
// - Returns: Array of products

// POST /api/products
// - Create product (Admin+)
// - Body: { sku, name, price, costPrice, ... }

// GET /api/inventory
// - Fetch inventory (users see own branch, Main Admin sees all)
// - Query params: ?branch=*
// - Returns: Complete inventory data (single fetch, filter client-side)

// POST /api/inventory
// - Create/update inventory entry (Admin+)
// - Body: { productId, branch, quantity, ... }

// GET /api/transactions
// - Fetch transactions (users see own branch, Main Admin sees all)
// - Query params: ?branch=*, ?startDate=*, ?endDate=*, ?type=*
// - Returns: Array of transactions (single fetch, client-side filtering)

// POST /api/transactions
// - Create transaction (Sales or Admin)
// - Body: { type, items, amount, customerId, ... }

// GET /api/commissions
// - Fetch commissions (Sales sees own, Admin sees branch)
// - Query params: ?userId=*, ?branch=*, ?status=*
// - Returns: Commissions data

// GET /api/settlements
// - Fetch settlements (paginated, Admin+ only)
// - Query params: ?branch=*, ?period=*
// - Returns: Settlement records

// GET /api/audits
// - Fetch audit logs (Admin+ only)
// - Query params: ?branch=*, ?entityType=*, ?startDate=*, ?endDate=*
// - Returns: Audit records

// ============================================================================
// CLIENT-SIDE DATA FETCHING PATTERN (DRY)
// ============================================================================

// Example hook for fetching and filtering data:
/*
export function useFirestoreData<T>(
  collection: string,
  filters?: { field: string; operator: '==' | '<' | '>'; value: any }[]
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch entire collection (single query)
        const response = await fetch(`/api/${collection}`);
        const allData = await response.json();
        
        // Filter client-side
        const filtered = allData.filter((item: T) => {
          if (!filters) return true;
          return filters.every((filter) => {
            const itemValue = (item as any)[filter.field];
            switch (filter.operator) {
              case '==':
                return itemValue === filter.value;
              case '<':
                return itemValue < filter.value;
              case '>':
                return itemValue > filter.value;
              default:
                return true;
            }
          });
        });
        
        setData(filtered);
      } catch (err) {
        setError('Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [collection, filters]);

  return { data, isLoading, error };
}
*/

// ============================================================================
// COST OPTIMIZATION NOTES
// ============================================================================

// 1. Single-File Mandate:
//    - Fetch complete dataset once, filter client-side
//    - Reduces Firestore read operations
//    - Avoids need for complex composite indexes

// 2. Denormalization Strategy:
//    - Duplicate product data in inventory for faster reads
//    - Update both documents in transaction (maintain consistency)
//    - Trade-off: Storage cost vs. read cost (favorable for read-heavy apps)

// 3. Index Optimization:
//    - Firestore automatically indexes simple fields
//    - Only compound indexes needed for multi-field queries
//    - Client-side filtering eliminates need for expensive indexes

// 4. Batch Operations:
//    - Use batch writes for multi-document updates
//    - Reduces transaction overhead
//    - Example: Update inventory + create transaction in one batch

// 5. Pagination:
//    - For large result sets, use cursor-based pagination
//    - Fetch 100 docs at a time, cursor to next batch
//    - Reduces bandwidth and processing time

// ============================================================================
