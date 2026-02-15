# SAYS 2.0 - Quick Reference Guide

## 🎯 What You Got

### Premium Components Ready to Use

```tsx
// 1. Metric Card (KPI Display)
<MetricCard
  title="Total Sales"
  value={156750}
  unit="RM"
  icon={DollarSign}
  trend={{ direction: 'up', percentage: 12.5 }}
  status="success"
/>

// 2. Toast Notifications
const { addToast } = useToast();
addToast('Action completed!', 'success');  // success, error, warning, info

// 3. Dashboard with 3 Sections
<EnhancedAdminDashboard userRole="Main Admin" />
// Sections: Overview | Staff Management | Inventory

// 4. Staff Management with Super Admin Guard
// Delete/Salary buttons only render for userRole === 'Main Admin'

// 5. Inventory with Stock Alerts
// Low stock → yellow badge
// Out of stock → red badge with "Restock" button
```

---

## 🎨 Design System

### Color Tokens (Update your CSS)
```css
/* Dark Mode Premium Palette */
says-base:     #020617  /* Page backgrounds */
says-card:     #0f172a  /* Card backgrounds */
says-accent:   #ef4444  /* Buttons, alerts, focus */
says-subtle:   #1e293b  /* Secondary elements */
says-muted:    #64748b  /* Disabled text */
```

### Card Styling Template
```tsx
className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass hover:border-slate-600 transition-all duration-300"
```

### Button Styling Template
```tsx
// Primary (Accent)
className="px-4 py-2 bg-says-accent hover:bg-red-500 text-white rounded-lg transition-colors"

// Secondary
className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
```

---

## 📁 File Locations

| Component | Path |
|-----------|------|
| MetricCard | `components/ui/MetricCard.tsx` |
| Toast System | `components/ui/Toast.tsx` |
| Overview Tab | `components/features/admin/OverviewDashboard.tsx` |
| Staff Tab | `components/features/admin/StaffManagement.tsx` |
| Inventory Tab | `components/features/admin/InventoryManagement.tsx` |
| Dashboard Container | `components/features/admin/EnhancedAdminDashboard.tsx` |
| Dashboard Context | `context/DashboardContext.tsx` |

---

## 🔐 Super Admin Guard Pattern

```tsx
// Only accessible to Main Admin
const isSuperAdmin = userRole === 'Main Admin';

// Conditional rendering
{isSuperAdmin && (
  <button onClick={handleDelete} className="bg-red-900/40 ...">
    Delete Staff
  </button>
)}

// Toast feedback for unauthorized access
if (!isSuperAdmin) {
  addToast('Only Super Admin can delete staff', 'warning');
  return;
}
```

---

## 🚀 Implementation Checklist

### To use in your admin page:

```tsx
'use client';

import { ToastProvider } from '@/components/ui/Toast';
import EnhancedAdminDashboard from '@/components/features/admin/EnhancedAdminDashboard';
import { DashboardProvider } from '@/context/DashboardContext';

// 1. ✅ Wrap with providers
export default function AdminPage() {
  const userRole = getUserRoleFromSession(); // Your auth logic

  return (
    <ToastProvider>
      <DashboardProvider>
        <div className="min-h-screen bg-says-base text-white">
          <EnhancedAdminDashboard userRole={userRole} />
        </div>
      </DashboardProvider>
    </ToastProvider>
  );
}

// 2. ✅ Use toast notifications
const { addToast } = useToast();
addToast('Staff member deleted', 'success');  // 3s auto-dismiss

// 3. ✅ Guard sensitive operations
if (userRole !== 'Main Admin') {
  addToast('Unauthorized action', 'warning');
  return;
}

// 4. ✅ Display metrics with proper formatting
const metrics = {
  totalSales: 156750,
  trend: { direction: 'up', percentage: 12.5 },
  status: 'success'
};
```

---

## 📊 Data Structure Examples

### Staff Member Object
```tsx
{
  id: "u_admin_kk",
  username: "admin_kk",
  name: "Admin Kota Kinabalu",
  role: "Admin",
  branch: "Kota Kinabalu",
  email: "admin@says.com",
  salary: 5000,
  status: "active"
}
```

### Inventory Item Object
```tsx
{
  id: "inv_001",
  name: "Product A",
  sku: "SKU001",
  quantity: 150,
  minStock: 20,
  maxStock: 500,
  branch: "Kota Kinabalu",
  status: "in-stock",
  trend: { direction: 'up', percentage: 5.2 }
}
```

### Transaction Object
```tsx
{
  id: "txn_001",
  type: "sale",
  amount: 2500,
  userId: "u_sales_kk",
  branch: "Kota Kinabalu",
  customerId: "cust_001",
  items: [
    { productId: "prod_001", quantity: 2, unitPrice: 1250 }
  ],
  status: "completed",
  createdAt: timestamp
}
```

---

## 🎬 Common Use Cases

### Display Sales Metrics
```tsx
<MetricCard
  title="Total Sales"
  value={spotifyBalance}
  unit="RM"
  icon={DollarSign}
  trend={{ direction: 'up', percentage: 12.5 }}
  status={profitMargin > 20 ? 'success' : 'warning'}
/>
```

### Show Loading State
```tsx
<MetricCard
  title="Processing"
  value={0}
  isLoading={true}
/>
```

### Handle Clickable Cards
```tsx
<MetricCard
  title="Customer Stats"
  value={127}
  onClick={() => navigateToCustomers()}
/>
```

### Notify User of Action
```tsx
const handleSave = async () => {
  try {
    await saveData();
    addToast('Changes saved successfully', 'success');
  } catch (error) {
    addToast('Failed to save changes', 'error');
  }
};
```

---

## ⚡ Performance Tips

### Use useMemo for Filtered Lists
```tsx
const filteredStaff = useMemo(
  () => staff.filter(s => s.status === 'active'),
  [staff]
);
```

### Use useCallback for Event Handlers
```tsx
const handleDelete = useCallback((id: string) => {
  // Only recreates when dependencies change
  deleteStaff(id);
}, []);
```

### Lazy Load Heavy Components
```tsx
const StaffManagement = lazy(() => 
  import('./StaffManagement')
);

<Suspense fallback={<LoadingSpinner />}>
  <StaffManagement />
</Suspense>
```

---

## 🧪 Testing Component Display

### Mock Data for Development
```tsx
const mockMetrics = {
  totalSales: 156750,
  totalOrders: 342,
  totalCustomers: 127,
  activeStaff: 8,
  inventoryItems: 1240,
};

<MetricCard
  title="Total Sales"
  value={mockMetrics.totalSales}
  unit="RM"
/>
```

---

## 📚 Documentation Files

All detailed documentation is available:

| Document | Purpose |
|----------|---------|
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Complete feature overview |
| [DESIGN_SYSTEM_GUIDE.md](DESIGN_SYSTEM_GUIDE.md) | Design tokens, components, accessibility |
| [CODE_REFACTORING_GUIDE.md](CODE_REFACTORING_GUIDE.md) | Performance optimization patterns |
| [FIRESTORE_ARCHITECTURE.md](FIRESTORE_ARCHITECTURE.md) | Database schema & security rules |

---

## 🎨 Tailwind Classes Quick Reference

```tsx
// Colors
bg-says-base       /* #020617 - Page background */
bg-says-card       /* #0f172a - Card background */
bg-says-accent     /* #ef4444 - Red accent */
bg-says-subtle     /* #1e293b - Secondary */
text-says-accent   /* Red text */

// Effects
backdrop-blur-glass     /* Glassmorphism blur */
shadow-glass            /* Glass shadow */
shadow-glass-accent     /* Red glow shadow */

// Animations
animate-fade-in         /* Fade in */
animate-slide-up        /* Slide up */
animate-pulse-soft      /* Soft pulse */
transition-all duration-300  /* Smooth transition */

// Status Colors
bg-green-500/20         /* Success */
bg-yellow-500/20        /* Warning */
bg-red-500/20           /* Danger */
```

---

## 🔍 Debugging Tips

### Check if Toast is Working
```tsx
const { addToast } = useToast();

useEffect(() => {
  addToast('Component loaded', 'info');
}, []);
```

### Verify Dashboard Tab Switching
```tsx
const { activeTab, setActiveTab } = useDashboard();

console.log('Current tab:', activeTab);
setActiveTab('staff');  // Switch to staff section
```

### Verify Super Admin Guard
```tsx
console.log('User role:', userRole);
console.log('Is Super Admin:', userRole === 'Main Admin');

// Temporary: Show button for all roles to test
{/* {isSuperAdmin && ( */}
  <button onClick={handleDelete}>Delete</button>
{/* )} */}
```

---

## ✅ Verification Steps

1. **Check Build**
   ```bash
   npm run build
   # Should show: ✓ Compiled successfully
   ```

2. **Test Components in Page**
   ```tsx
   import EnhancedAdminDashboard from '@/components/features/admin/EnhancedAdminDashboard';
   
   <EnhancedAdminDashboard userRole="Main Admin" />
   ```

3. **Test Toast Notifications**
   ```tsx
   const { addToast } = useToast();
   addToast('Test message', 'success');
   ```

4. **Test Super Admin Guard**
   - Try with `userRole="Admin"` - delete button should be disabled
   - Try with `userRole="Main Admin"` - delete button should be enabled

5. **Check Mobile Responsiveness**
   - Test on mobile (375px width)
   - Cards should stack vertically
   - Table should horizontal scroll

---

## 🎓 Next Learning Steps

1. Review [DESIGN_SYSTEM_GUIDE.md](DESIGN_SYSTEM_GUIDE.md) for full design specs
2. Study [CODE_REFACTORING_GUIDE.md](CODE_REFACTORING_GUIDE.md) for best practices
3. Integrate [FIRESTORE_ARCHITECTURE.md](FIRESTORE_ARCHITECTURE.md) for backend
4. Customize colors in [tailwind.config.ts](tailwind.config.ts)
5. Add real data from your API endpoints

---

**SAYS 2.0 Premium Dark Mode** — Ready for Production Use
*Documentation: February 9, 2026*
