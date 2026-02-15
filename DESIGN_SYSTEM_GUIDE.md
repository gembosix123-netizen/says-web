# SAYS 2.0 - Premium Design System & Development Guide

## Table of Contents
1. [Design System & Color Tokens](#design-system--color-tokens)
2. [Component Architecture](#component-architecture)
3. [Accessibility Standards](#accessibility-standards)
4. [Performance Optimization](#performance-optimization)
5. [Image Generation Guidelines](#image-generation-guidelines)
6. [Code Refactoring Checklist](#code-refactoring-checklist)

---

## Design System & Color Tokens

### SAYS 2.0 Premium Dark Mode Palette

```
Color Token          | Hex Value | Usage
-----------------------------------------
says-base            | #020617   | Page backgrounds
says-card            | #0f172a   | Card/container backgrounds
says-accent          | #ef4444   | Critical actions, alerts, focus states
says-subtle          | #1e293b   | Secondary elements
says-muted           | #64748b   | Disabled/secondary text
```

### Extended Color Palette

```
Semantic Colors:
- Success:  #10b981 (Emerald)
- Warning:  #f59e0b (Amber)
- Danger:   #ef4444 (Red) - Use says-accent
- Info:     #3b82f6 (Blue)

Neutral Grays:
- White:    #ffffff
- Slate 100: #f1f5f9
- Slate 200: #e2e8f0
- Slate 300: #cbd5e1
- Slate 400: #94a3b8
- Slate 500: #64748b (says-muted)
- Slate 600: #475569
- Slate 700: #334155
- Slate 800: #1e293b (says-subtle)
- Slate 900: #0f172a (says-card)
- Black:    #020617 (says-base)
```

### Glassmorphism Effects

```css
/* Base glass container */
backdrop-filter: blur(10px);
background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
border: 1px solid rgba(255,255,255,0.1);
box-shadow: 0 8px 32px 0 rgba(15, 23, 42, 0.37);

/* On hover - accent glow */
border: 1px solid rgba(239, 68, 68, 0.3);
box-shadow: 0 8px 32px 0 rgba(239, 68, 68, 0.15);
```

### Shadow Elevation System

```
Level 0 (Flat):        rgba(0,0,0,0)
Level 1 (Subtle):      0 2px 8px rgba(0,0,0,0.3)
Level 2 (Medium):      0 4px 16px rgba(0,0,0,0.4)
Level 3 (Glass):       0 8px 32px rgba(15,23,42,0.37)
Level 4 (Accent):      0 8px 32px rgba(239,68,68,0.15)
```

---

## Component Architecture

### Base Components (Reusable)

#### 1. MetricCard
**Purpose:** Display KPI metrics with glassmorphism effect
**Props:**
- `title`: string
- `value`: string | number
- `unit`: string (optional)
- `icon`: LucideIcon (optional)
- `trend`: { direction: 'up' | 'down' | 'neutral', percentage: number } (optional)
- `status`: 'success' | 'warning' | 'danger' | 'neutral'
- `onClick`: () => void (optional)
- `isLoading`: boolean

**Micro-interactions:**
- Hover: `-translate-y-1` + `shadow-glass`
- Active: Border highlight with says-accent
- Loading: Pulse animation on value

#### 2. Toast Notification System
**Purpose:** User feedback for actions
**Types:**
- `success` - Green (#10b981)
- `error` - Red (says-accent #ef4444)
- `warning` - Amber (#f59e0b)
- `info` - Blue (#3b82f6)

**Behaviors:**
- Auto-dismiss after 3 seconds
- Stack multiple toasts
- Slide-up animation
- Dismissible with X button

#### 3. Button Component
**Standard Button Classes:**
```tsx
// Primary (Accent)
className="px-4 py-2 bg-says-accent hover:bg-red-500 text-white rounded-lg transition-colors"

// Secondary
className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"

// Danger (Super Admin Guard)
className="px-4 py-2 bg-red-900/40 border border-red-500/30 text-red-400 hover:bg-red-900/60 rounded-lg"
```

#### 4. Card Component
**Standard Card Classes:**
```tsx
className="p-6 rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-glass hover:border-slate-600 transition-all duration-300"
```

### Dashboard Components

#### OverviewDashboard
- Sales metrics (total, trend)
- Order counts
- Customer statistics
- Staff activity
- Branch performance breakdown

#### StaffManagement
- **Super Admin Guard Logic:**
  - Delete button: Only visible if `userRole === 'Main Admin'`
  - Edit Salary: Only available to Main Admin
  - Add Staff: Main Admin only
- CRUD operations
- Search/filter functionality
- Status indicators

#### InventoryManagement
- Stock level cards (total, low, out-of-stock)
- Product table with search
- Inventory health visualization
- Branch-wise stock breakdown
- Low stock alerts with "Restock" actions

---

## Accessibility Standards (WCAG 2.1)

### Contrast Ratios

| Element                 | Ratio | Example |
|------------------------|-------|---------|
| Text on says-base      | 20:1  | White text on #020617 |
| Text on says-card      | 18:1  | White text on #0f172a |
| Text on says-accent    | 10:1  | White text on #ef4444 |
| Secondary text         | 7:1   | Slate-400 on background |
| Disabled text          | 4.5:1 | Slate-500 on background |

### Implementation Guidelines

1. **Color Contrast:**
   ```tsx
   // Good: White text on dark background
   <p className="text-white bg-says-card">High contrast</p>
   
   // Avoid: Light gray on medium gray
   <p className="text-slate-400 bg-slate-800">Low contrast - DON'T</p>
   ```

2. **Focus States:**
   ```tsx
   className="focus:outline-none focus:ring-2 focus:ring-says-accent focus:ring-offset-2 focus:ring-offset-says-base"
   ```

3. **Semantic HTML:**
   ```tsx
   // Use proper heading hierarchy
   <h1>Page Title</h1>
   <h2>Section</h2>
   <h3>Subsection</h3>
   
   // Use labels for form inputs
   <label htmlFor="email">Email:</label>
   <input id="email" type="email" />
   ```

4. **ARIA Attributes:**
   ```tsx
   // Toast notifications
   <div role="alert" aria-live="polite">Notification</div>
   
   // Loading states
   <div aria-busy="true" aria-label="Loading data">
   
   // Disabled buttons
   <button disabled aria-disabled="true">Button</button>
   ```

---

## Performance Optimization

### React Best Practices

#### 1. Reduce Unnecessary Re-renders

**Before:**
```tsx
function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  
  // Callback recreated every render!
  const handleRefresh = () => {
    fetchMetrics();
  };
  
  return <MetricCard onRefresh={handleRefresh} />;
}
```

**After:**
```tsx
function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  
  // Memoized callback - only recreated on dependency change
  const handleRefresh = useCallback(() => {
    fetchMetrics();
  }, []);
  
  return <MetricCard onRefresh={handleRefresh} />;
}
```

#### 2. Memoize Expensive Calculations

**Before:**
```tsx
function StaffManagement({ staff }) {
  // Recalculated every render!
  const filteredStaff = staff.filter(s => s.status === 'active');
  
  return <StaffTable data={filteredStaff} />;
}
```

**After:**
```tsx
function StaffManagement({ staff }) {
  // Only recalculated when 'staff' changes
  const filteredStaff = useMemo(
    () => staff.filter(s => s.status === 'active'),
    [staff]
  );
  
  return <StaffTable data={filteredStaff} />;
}
```

#### 3. Optimize useEffect Dependencies

**Before (Memory Leak):**
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    fetchData(); // Called infinitely!
  }, 1000);
  // Missing cleanup!
}, []);
```

**After (Proper Cleanup):**
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);
  
  // Cleanup function to prevent memory leaks
  return () => clearInterval(interval);
}, []);
```

#### 4. Code Splitting

```tsx
// Lazy load heavy components
const StaffManagement = lazy(() => 
  import('./components/features/admin/StaffManagement')
);

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StaffManagement />
    </Suspense>
  );
}
```

### State Management Best Practices

```tsx
// ✓ Good: Single responsibility
const [notifications, setNotifications] = useState([]);
const [isLoading, setIsLoading] = useState(false);

// ✗ Avoid: Coupled state
const [appState, setAppState] = useState({
  notifications: [],
  isLoading: false,
  user: null,
  theme: 'dark',
  sidebarOpen: true,
  // ...50 more properties
});
```

### Error Handling

**Standard Pattern:**
```tsx
function DataFetcher() {
  const [data, setData] = useState(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setIsLoading(true);
      
      try {
        const response = await fetch('/api/data');
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        addToast(message, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [addToast]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  return <DataDisplay data={data} />;
}
```

---

## Image Generation Guidelines

### Cinematic Lighting Setup

For photorealistic images with professional appeal:

```
Prompt Template:
"Generated with cinematic lighting setup:
- Key light: 45° angle, soft diffusion
- Fill light: Opposite side, 50% intensity
- Back light: 10% highlight separation
- Environment light: HDRI with ray-tracing
- Camera: 35mm lens equivalent, f/2.8 depth of field
- Resolution: 8K (7680x4320)
- Color grading: Consistent with #020617/#ef4444 palette"
```

### Composition Rules

1. **Rule of Thirds:**
   - Subject not centered
   - Key element at intersection points
   - Negative space to one side

2. **Depth of Field:**
   - Sharp focus on subject
   - Blurred background (bokeh effect)
   - Leading lines to subject

3. **Color Consistency:**
   - Match brand palette: Deep navy, red accent
   - Color temperature: Cool (2700-4000K)
   - Avoid: Oversaturated, neon colors

4. **Lighting Quality:**
   - Soft shadows
   - No harsh edges
   - Natural-looking illumination
   - Ray-tracing for realism

### Professional Landing Page Images

**Tech/SaaS product:**
```
Ultra-detailed photorealistic image of [modern workspace setup]:
- Surfaces: Premium materials with subtle textures
- Lighting: Soft cinematic key light from upper left, 
  professional fill light creating depth
- Color palette: Deep navy (#0f172a) and charcoal backgrounds,
  metallic accents, subtle red (#ef4444) highlights
- Composition: Shot at 45° angle following rule of thirds,
  main subject sharp with blurred premium environment
- Technical specs: 8K resolution, professional color grading,
  ray-traced shadows, depth of field f/1.8
- Style: Corporate, minimalist, high-end technology aesthetic
- Exclude: Text, watermarks, logos
```

---

## Code Refactoring Checklist

### SOLID Principles

#### S - Single Responsibility
```tsx
// ✗ Bad: Component does too much
function Dashboard({ userData }) {
  // Fetches data, manages state, formats dates, performs auth, renders UI
  // ...400 lines of code
}

// ✓ Good: Each component has one reason to change
function Dashboard({ userData }) {
  return (
    <div>
      <UserProfile user={userData} />
      <MetricsGrid metrics={userData.metrics} />
      <RecentActivity logs={userData.logs} />
    </div>
  );
}
```

#### O - Open/Closed
```tsx
// Create reusable, extensible components
interface CardProps {
  title: string;
  status: 'success' | 'warning' | 'error' | 'neutral';
  children: React.ReactNode;
}

// Component is open for extension (new statuses)
// but closed for modification
function Card({ title, status, children }: CardProps) {
  const statusClasses = {
    success: 'border-green-500/20',
    warning: 'border-yellow-500/20',
    error: 'border-red-500/20',
    neutral: 'border-slate-700/50',
  };
  
  return <div className={statusClasses[status]}>{children}</div>;
}
```

#### L - Liskov Substitution
```tsx
// Type safety: Ensure derived types can substitute base types
interface IButton {
  onClick: () => void;
  disabled: boolean;
}

// SecondaryButton can be used anywhere Button is expected
class PrimaryButton implements IButton {
  onClick() { /* ... */ }
  get disabled() { /* ... */ }
}

class SecondaryButton implements IButton {
  onClick() { /* ... */ }
  get disabled() { /* ... */ }
}
```

#### I - Interface Segregation
```tsx
// ✗ Bad: Component forced to accept unused props
interface AdminPageProps {
  userData: User;
  metrics: Metrics;
  permissions: Permission[];
  theme: 'dark' | 'light';
  language: string;
  notificationSettings: NotificationSettings;
  // ...20 more props
}

// ✓ Good: Segregated, focused interfaces
interface OverviewSectionProps {
  metrics: Metrics;
}

interface StaffSectionProps {
  permissions: Permission[];
}

interface InventorySectionProps {
  userData: User;
}
```

#### D - Dependency Inversion
```tsx
// ✗ Bad: Direct dependency on API implementation
class StaffDataComponent {
  async loadStaff() {
    const data = await fetch('/api/staff'); // Tightly coupled
  }
}

// ✓ Good: Depend on abstraction
interface IStaffService {
  loadStaff(): Promise<Staff[]>;
}

class StaffDataComponent {
  constructor(private service: IStaffService) {}
  
  async loadStaff() {
    const data = await this.service.loadStaff();
  }
}
```

### DRY (Don't Repeat Yourself)

```tsx
// ✗ Bad: Repeated status badge code
<div className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300">
  Active
</div>

<div className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-300">
  Pending
</div>

// ✓ Good: Reusable component
<StatusBadge status="active" label="Active" />
<StatusBadge status="pending" label="Pending" />

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'inactive';
  label: string;
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors = {
    active: 'bg-green-500/20 text-green-300',
    pending: 'bg-yellow-500/20 text-yellow-300',
    inactive: 'bg-slate-500/20 text-slate-300',
  };
  
  return (
    <div className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
      {label}
    </div>
  );
}
```

### Code Quality Metrics

**Target Metrics for SAYS 2.0:**
- Cyclomatic Complexity: < 10 per function
- Function Length: < 50 lines for utilities, < 100 for components
- Component Props: < 7 required props
- Test Coverage: > 80% for Business Logic, > 50% for UI

### ESLint Configuration

```json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-unused-vars": "warn",
    "prefer-const": "error",
    "no-var": "error",
    "eqeqeq": "error",
    "curly": ["error", "all"]
  }
}
```

---

## Implementation Checklist for SAYS 2.0

- [ ] **Design System**
  - [ ] Tailwind config updated with color tokens
  - [ ] Glassmorphism effects tested
  - [ ] Shadow elevation system implemented

- [ ] **Components**
  - [ ] MetricCard with glassmorphism
  - [ ] Toast notification system
  - [ ] Enhanced sidebar navigation
  - [ ] Dashboard tabs for Overview/Staff/Inventory

- [ ] **Accessibility**
  - [ ] Contrast ratio testing (WCAG 2.1 AA)
  - [ ] Keyboard navigation (Tab, Enter, Escape)
  - [ ] ARIA labels and roles
  - [ ] Focus states visible

- [ ] **Performance**
  - [ ] useCallback for event handlers
  - [ ] useMemo for expensive calculations
  - [ ] Proper useEffect cleanup
  - [ ] Code splitting for large components

- [ ] **Security (Firestore)**
  - [ ] Security rules with RBAC
  - [ ] Super Admin guard on sensitive actions
  - [ ] Audit logging
  - [ ] Input validation

- [ ] **Testing**
  - [ ] Unit tests for utility functions
  - [ ] Component tests with React Testing Library
  - [ ] E2E tests for critical flows
  - [ ] Accessibility testing

---

## Resources

- [Tailwind Documentation](https://tailwindcss.com)
- [React Best Practices](https://react.dev/learn)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Lucide React Icons](https://lucide.dev)

