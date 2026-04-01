# SAYS 2.0 Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SAYS 2.0 Premium Dashboard                       │
│                    (EnhancedAdminDashboard)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  Overview    │  │ Staff Mgmt   │  │ Inventory    │             │
│  │              │  │              │  │              │             │
│  │ • Sales KPI  │  │ • CRUD Ops   │  │ • Stock      │             │
│  │ • Metrics    │  │ • Super Admin │  │ • Alerts     │             │
│  │ • Trends     │  │ • Validation │  │ • Reports    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
        
    ┌─────────────────┐  ┌──────────────┐  ┌───────────────┐
    │  MetricCard     │  │ Toast        │  │ Button/Form   │
    │  Components     │  │ Notifications│  │ Components    │
    │                 │  │              │  │               │
    │ • Glassmorphism │  │ • Success    │  │ • Primary     │
    │ • Trends        │  │ • Error      │  │ • Secondary   │
    │ • Responsive    │  │ • Warning    │  │ • Danger      │
    │ • WCAG 2.1      │  │ • Info       │  │ • Super Admin │
    │ • Micro-interact│  │              │  │   Guard       │
    └─────────────────┘  └──────────────┘  └───────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
                
    ┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐
    │ Design Tokens    │  │ Context API    │  │ State Management │
    │                  │  │                │  │                  │
    │ • Colors         │  │ • DashboardCtx │  │ • useState       │
    │ • Typography     │  │ • ToastProvider│  │ • useEffect      │
    │ • Shadows        │  │ • LanguageCtx  │  │ • useCallback    │
    │ • Animations     │  │ • ThemeCtx     │  │ • useMemo        │
    └──────────────────┘  └────────────────┘  └──────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Firestore Backend  │
                    │                     │
                    │ • Users Collection  │
                    │ • Products          │
                    │ • Inventory         │
                    │ • Transactions      │
                    │ • Commissions       │
                    │ • Settlements       │
                    └─────────────────────┘
```

---

## Component Hierarchy Tree

```
App (RootLayout)
├── ToastProvider
│   └── LanguageProvider
│       └── ThemeProvider
│           └── Page/Layout
│               └── AdminLayout
│                   ├── Sidebar (Dynamic Navigation)
│                   ├── Header
│                   └── Main Content
│                       └── EnhancedAdminDashboard
│                           ├── Overview Tab
│                           │   ├── OverviewDashboard
│                           │   ├── MetricCard (x6)
│                           │   ├── QuickStats Card
│                           │   └── BranchPerformance Card
│                           │
│                           ├── Staff Tab
│                           │   ├── StaffManagement
│                           │   ├── AddStaff Form (Super Admin Guard)
│                           │   ├── Search Bar
│                           │   └── Staff Table
│                           │       └── TableRow (x10)
│                           │
│                           └── Inventory Tab
│                               ├── InventoryManagement
│                               ├── Metrics (Total/LowStock/OutOfStock)
│                               ├── Search Bar
│                               ├── Inventory Table
│                               │   └── TableRow (xN)
│                               ├── StockHealth Cards
│                               └── BranchInventory Card
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User Interaction                              │
│                    (Click, Type, Navigate)                           │
└────────────────────────────────────────────┬────────────────────────┘
                                             │
                                             ▼
                        ┌────────────────────────────────┐
                        │  Event Handler (useCallback)   │
                        │                                │
                        │  • onClick handlers            │
                        │  • Form submissions            │
                        │  • Search/Filter operations    │
                        └────────┬───────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
                    
        ┌──────────────────┐  ┌─────────────────┐  ┌────────────────┐
        │ State Update     │  │ API Call        │  │ Validation     │
        │ (useState)       │  │ (fetch/axios)   │  │ Error Check    │
        │                  │  │                 │  │                │
        │ setStaff()       │  │ /api/staff      │  │ Error handling │
        │ setMetrics()     │  │ /api/inventory  │  │ Catch blocks   │
        │ setLoading()     │  │ /api/products   │  │                │
        └────────┬─────────┘  └────────┬────────┘  └────────┬───────┘
                 │                     │                    │
                 └─────────────────────┼────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │  Derived State (useMemo)     │
                        │                              │
                        │  • Filtered staff list       │
                        │  • Calculated metrics        │
                        │  • Aggregated inventory      │
                        │  • Stock status calculation  │
                        └──────────┬───────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────────┐
                        │  Context Update              │
                        │  (DashboardContext)          │
                        │                              │
                        │  • activeTab                 │
                        │  • isLoading                 │
                        │  • Additional state          │
                        └──────────┬───────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────────┐
                        │  Component Re-render         │
                        │  (with new props)            │
                        │                              │
                        │  • MetricCard updated        │
                        │  • Table refreshed           │
                        │  • Status badges visible     │
                        └──────────┬───────────────────┘
                                   │
                                   ▼
                        ┌──────────────────────────────┐
                        │  UI Update + Notification    │
                        │                              │
                        │  • Toast displayed           │
                        │  • Loading spinner removed   │
                        │  • Data visualized           │
                        │  • Micro-interactions        │
                        └──────────────────────────────┘
```

---

## Security & Access Control Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    User Authentication                               │
│                  (Session/Token verification)                        │
└────────────────┬─────────────────────────────────────────────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │  Fetch User Data    │
        │  (fetch /api/auth)  │
        └────────┬────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │  Determine User Role           │
    │                                │
    │  • Main Admin (Full Access)    │
    │  • Admin (Branch Access)       │
    │  • Sales (Limited Access)      │
    └────────┬───────────────────────┘
             │
    ┌────────┼────────┐
    ▼        ▼        ▼
    
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Main Admin   │  │ Admin        │  │ Sales        │
│              │  │              │  │              │
│ ✓ View All   │  │ ✓ View Own   │  │ ✓ View Own   │
│ ✓ Edit All   │  │   Branch     │  │   Branch     │
│ ✓ Delete All │  │ ✓ Edit Branch│  │ ✓ Transact   │
│ ✓ Add Users  │  │ ✓ Delete Own │  │              │
│ ✓ View Audit │  │   Role       │  │ ✗ No Access  │
│ ✓ Settle     │  │ ✓ View Audit │  │   to Others  │
└──────────────┘  └──────────────┘  └──────────────┘
    │               │                   │
    └───────────────┼───────────────────┘
                    │
                    ▼
        ┌──────────────────────────┐
        │  Super Admin Guard       │
        │  Check (Frontend)        │
        │                          │
        │ if (role !== 'Main Admin')
        │   Hide/Disable button    │
        │   Show warning toast     │
        └──────────┬───────────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ Backend Validation       │
        │ (Firestore Rules)        │
        │                          │
        │ if (!auth.isMainAdmin)   │
        │   Deny operation         │
        │   Log to audits          │
        └──────────────────────────┘
```

---

## State Management Flow

```
Global State (Context)
├── DashboardContext
│   ├── activeTab: 'overview' | 'staff' | 'inventory'
│   ├── isLoading: boolean
│   └── setActiveTab(), setIsLoading()
│
├── ToastContext  
│   ├── toasts: Toast[]
│   ├── addToast(message, type, duration)
│   └── removeToast(id)
│
├── ThemeContext
│   ├── theme: 'dark' | 'light'
│   └── toggleTheme()
│
└── LanguageContext
    ├── language: string
    └── setLanguage()

Component Local State
├── OverviewDashboard
│   ├── metrics: Metrics | null
│   ├── isLoading: boolean
│   └── error: string | null
│
├── StaffManagement
│   ├── staff: StaffMember[]
│   ├── filteredStaff: StaffMember[]
│   ├── searchTerm: string
│   ├── showAddForm: boolean
│   ├── editingId: string | null
│   └── formData: FormData
│
└── InventoryManagement
    ├── inventory: InventoryItem[]
    ├── filteredInventory: InventoryItem[]
    ├── searchTerm: string
    ├── totals: { total, lowStock, outOfStock }
    └── isLoading: boolean
```

---

## Database Architecture

### Primary: Supabase / PostgreSQL

All transactional data lives in Supabase:

```
Supabase (PostgreSQL)
│
├── users                    # auth & profiles (all roles)
├── stores                   # outlet/store register
├── products                 # product catalog
├── sales_transactions       # all sales (canonical, branch column)
├── sales_items              # line items per sale
├── sales_kinabatangan       # VIEW (WHERE branch = 'Kinabatangan')
├── sales_kota_kinabalu      # VIEW (WHERE branch = 'Kota Kinabalu')
├── customers_kb             # Kota Kinabalu customers
├── customers_kk             # Kinabatangan customers
├── customers_archive        # backup of old unified customers table
├── orders                   # order management
├── store_visits             # merchandiser visit records
├── store_audit_items        # product audit per visit
├── audit_events             # full system audit trail
├── audit_event_changes      # field-level diff per audit event
├── audit_import_batches     # batch import audit records
├── exchange_returns         # product returns
├── expenses                 # field expense claims
├── inventory_movements      # stock movement log
├── weekly_report_history    # archived weekly summaries
└── customer_ownership_log   # assign/handover/release audit
```

### Supplement: Firebase / Firestore

Used for real-time features and supplemental collections:

```
Firestore Database
│
├── users/           # profile sync / real-time presence
├── products/        # product catalog mirror
├── inventory/       # branch stock levels (real-time)
├── transactions/    # sales (Firestore mirror, may be legacy)
├── customers/       # CRM (legacy, superseded by Supabase branch tables)
├── commissions/     # commission data
├── settlements/     # settlement reports
└── audits/          # compliance logs (superseded by Supabase audit_events)
```

> **Note:** Supabase is the source of truth for all current data. Firestore is supplemental / real-time layer. When in doubt, check Supabase.

---

## Design System Implementation Map

```
Tailwind Config
├── Color Tokens
│   ├── says-base:      #020617 (backgrounds)
│   ├── says-card:      #0f172a (containers)
│   ├── says-accent:    #ef4444 (actions)
│   ├── says-subtle:    #1e293b (secondary)
│   └── says-muted:     #64748b (disabled)
│
├── Effects
│   ├── Glass Effect:  backdrop-filter blur + 10% opacity gradient
│   ├── Shadows:       Multiple elevation levels (1-4)
│   └── Animations:    fade-in, slide-up, pulse-soft
│
└── Responsive Units
    ├── Mobile:  320px - 640px
    ├── Tablet:  641px - 1024px
    └── Desktop: 1025px+

Component Implementation
├── MetricCard
│   ├── Color Status:  success|warning|danger|neutral
│   ├── Hover Effect:  translate-y + shadow elevation
│   ├── Trend:         Up (green) | Down (red) | Neutral (gray)
│   └── Loading:       Skeleton pulse animation
│
├── Buttons
│   ├── Primary:       bg-says-accent + hover:bg-red-500
│   ├── Secondary:     bg-slate-700 + hover:bg-slate-600
│   ├── Danger:        bg-red-900/40 + Super Admin Guard
│   └── States:        Normal | Hover | Active | Disabled
│
├── Tables
│   ├── Header Row:    bg-slate-900/50 + border-b
│   ├── Data Row:      hover:bg-slate-800/20 transition
│   ├── Badge Cells:   Status-based color coding
│   └── Action Cells:  Icon buttons with tooltips
│
└── Forms
    ├── Inputs:        bg-says-card + border-slate-700
    ├── Focus:         border-says-accent outline-none
    ├── Placeholder:    text-slate-500
    └── Error:         border-red-500 text-red-400
```

---

## Performance Optimization Strategy

```
Memory Management
├── useEffect Cleanup
│   ├── Abort fetch requests (AbortController)
│   ├── Remove event listeners
│   ├── Clear intervals/timeouts
│   └── Unsubscribe from subscribes
│
└── Component Unmounting
    ├── Clear loading states
    ├── Abort in-flight requests
    └── Cleanup subscriptions

Render Optimization
├── useCallback
│   ├── Event handlers
│   ├── Callbacks to children
│   └── Filter/sort functions
│
├── useMemo
│   ├── Filtered data arrays
│   ├── Calculated metrics
│   ├── Formatted strings
│   └── Complex objects
│
└── React.memo
    ├── Pure components
    ├── Table rows
    └── Card components

Data Fetching
├── Single Query Pattern
│   ├── Fetch complete dataset once
│   ├── Filter/sort client-side
│   ├── Cache in component state
│   └── Update on action only
│
└── Error Handling
    ├── Try-catch blocks
    ├── Toast notifications
    ├── Graceful fallbacks
    └── Retry logic
```

---

## Database Architecture

### Primary: Supabase / PostgreSQL

All transactional data lives in Supabase. Canonical tables + migrations mapping:

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | Authentication & profiles | `id`, `username`, `role`, `branch`, `assigned_districts[]` |
| `stores` | Store/outlet register | `id`, `name`, `branch`, `district`, `geo_group` |
| `products` | Product catalog | `id`, `sku`, `name`, `price`, `cost_price` |
| `sales_transactions` | All sales (canonical) | `id`, `branch`, `user_id`, `customer_id`, `grand_total`, `status` |
| `sales_items` | Line items per sale | `id`, `transaction_id`, `product_id`, `quantity`, `unit_price` |
| `customers_kb` | Kota Kinabalu customers | `id`, `name`, `branch` = 'Kota Kinabalu', `assigned_to`, `district` |
| `customers_kk` | Kinabatangan customers | `id`, `name`, `branch` = 'Kinabatangan', `assigned_to`, `district` |
| `orders` | Order management | `id`, `customer_id`, `order_date`, `status` |
| `store_visits` | Merchandiser visits | `id`, `merchandiser_id`, `store_id`, `check_in`, `check_out` |
| `audit_events` | System audit trail | `id`, `actor_id`, `module`, `action`, `reason`, `reference_no`, `status` |
| `expenses` | Field expense claims | `id`, `salesman_id`, `category`, `amount`, `status` |
| `inventory_movements` | Stock movements | `id`, `actor_id`, `movement_type`, `quantity` |
| `exchange_returns` | Product returns | `id`, `sale_id`, `reason`, `status` |

**Branch-scoped VIEWs** (read helpers, NOT base tables):
- `sales_kinabatangan` → `SELECT * FROM sales_transactions WHERE branch = 'Kinabatangan'`
- `sales_kota_kinabalu` → `SELECT * FROM sales_transactions WHERE branch = 'Kota Kinabalu'`

### Supplement: Firebase / Firestore

Used for real-time features and supplemental data:
- User profile sync / real-time presence
- Real-time inventory updates
- Notification delivery
- Legacy data mirrors (may be deprecated)

### Security Model

- **API Layer:** All requests go through Next.js server-side API routes using `supabaseAdmin` (service role)
- **RLS (Row-Level Security):** All tables deny anon key access; only service role can read/write
- **Defence-in-depth:** Client-side anon key cannot directly query tables
- **Audit Trail:** `audit_events` captures all critical actions (delete, close day-end, etc.)

---

## Deployment Checklist

```
Pre-Deployment
├── ✅ Build succeeds (npm run build)
├── ✅ TypeScript no errors
├── ✅ Components tested manually
├── ✅ Toast notifications working
├── ✅ Super Admin guard verified
├── ✅ Responsive design checked
├── ✅ Accessibility tested (contrast, keyboard nav)
├── ✅ Environment variables set
└── ✅ Database rules deployed

Post-Deployment Monitoring
├── Error logging (Sentry/LogRocket)
├── Performance monitoring
├── User analytics
├── Firestore read/write costs
├── API response times
├── Component render times
└── User feedback channels
```

---

This architecture ensures:
- 🔒 **Security**: Role-based access control at frontend & backend
- ⚡ **Performance**: Optimized data fetching & rendering
- ♿ **Accessibility**: WCAG 2.1 AA+ compliance
- 🎨 **Design**: Premium dark mode with consistent tokens
- 📱 **Responsive**: Mobile-first, works on all devices
- 🚀 **Scalability**: Modular components, reusable patterns
- 🧪 **Testability**: Pure functions, isolated components
- 📊 **Maintainability**: Clear folder structure, documented code
