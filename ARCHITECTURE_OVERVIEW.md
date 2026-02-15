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

## Firestore Collections Structure

```
Firestore Database
│
├── users/
│   ├── u_founder
│   │   ├── username: "founder"
│   │   ├── role: "Main Admin"
│   │   ├── branch: "HQ"
│   │   └── ...
│   ├── u_admin_kk
│   ├── u_sales_kk
│   └── ...
│
├── products/
│   ├── p_001
│   │   ├── sku: "SKU001"
│   │   ├── name: "Product A"
│   │   ├── price: 1250
│   │   └── ...
│   └── ...
│
├── inventory/
│   ├── inv_001
│   │   ├── productId: "p_001"
│   │   ├── branch: "Kota Kinabalu"
│   │   ├── quantity: 150
│   │   └── ...
│   └── ...
│
├── transactions/
│   ├── txn_001
│   │   ├── type: "sale"
│   │   ├── userId: "u_sales_kk"
│   │   ├── amount: 2500
│   │   └── ...
│   └── ...
│
├── customers/
│   ├── cust_001
│   │   ├── name: "Customer Name"
│   │   ├── branch: "Kota Kinabalu"
│   │   └── ...
│   └── ...
│
├── commissions/
│   ├── comm_001
│   │   ├── userId: "u_sales_kk"
│   │   ├── amount: 100
│   │   └── ...
│   └── ...
│
├── settlements/
│   ├── settle_2024-02
│   │   ├── period: "2024-02"
│   │   ├── netProfit: 50000
│   │   └── ...
│   └── ...
│
└── audits/
    ├── audit_001
    │   ├── action: "delete"
    │   ├── entityType: "staff"
    │   ├── userId: "u_founder"
    │   └── ...
    └── ...
```

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
