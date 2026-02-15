# SAYS 2.0 - Code Refactoring & Performance Optimization Guide

## Quick Reference

This document provides actionable patterns for refactoring and optimizing React/TypeScript code in SAYS 2.0.

---

## Memory Leak Prevention

### Pattern 1: useEffect with Cleanup

**Problem: Memory Leak**
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    console.log('Running every second');
  }, 1000);
  // BUG: No cleanup - interval runs forever even after component unmounts!
}, []);
```

**Solution:**
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    console.log('Running every second');
  }, 1000);

  // Cleanup function runs on unmount
  return () => clearInterval(interval);
}, []);
```

### Pattern 2: Abort Controller for Fetch

**Problem: Race Condition**
```tsx
useEffect(() => {
  const fetchData = async () => {
    const response = await fetch('/api/data');
    const data = await response.json();
    setData(data); // May run after unmount!
  };
  
  fetchData();
}, [dependency]); // BUG: Component unmounts but state update happens
```

**Solution:**
```tsx
useEffect(() => {
  const abortController = new AbortController();

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data', {
        signal: abortController.signal,
      });
      const data = await response.json();
      setData(data); // Safe: aborted if unmounted
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error(error);
      }
    }
  };

  fetchData();

  return () => abortController.abort();
}, [dependency]);
```

### Pattern 3: Event Listener Cleanup

**Problem:**
```tsx
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // BUG: Listener never removed!
}, []);

function handleResize() {
  console.log('Window resized');
}
```

**Solution:**
```tsx
useEffect(() => {
  const handleResize = () => {
    console.log('Window resized');
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

---

## Unnecessary Re-renders Prevention

### Anti-Pattern 1: Functions in JSX

**Problem:**
```tsx
<button onClick={() => handleClick()} className="...">
  Click me
</button>

// BUG: New function created every render!
// Child components always re-render due to new reference
```

**Solution:**
```tsx
const handleClick = useCallback(() => {
  console.log('Clicked');
}, []);

<button onClick={handleClick} className="...">
  Click me
</button>

// Function reference is stable across renders
```

### Anti-Pattern 2: Derived Objects in JSX

**Problem:**
```tsx
function UserProfile({ user }) {
  return (
    <ProfileCard
      userInfo={{
        name: user.name,
        email: user.email,
      }}
    />
  );
}

// BUG: New object created every render!
// ProfileCard always thinks props changed
```

**Solution:**
```tsx
function UserProfile({ user }) {
  const userInfo = useMemo(
    () => ({
      name: user.name,
      email: user.email,
    }),
    [user.name, user.email]
  );

  return <ProfileCard userInfo={userInfo} />;
}

// Object reference only changes when data actually changes
```

### Anti-Pattern 3: useCallback without Dependencies

**Problem:**
```tsx
const handleSubmit = useCallback(() => {
  console.log(formData); // BUG: Always has stale formData!
}, []);

// Dependencies missing - formData never updates
```

**Solution:**
```tsx
const handleSubmit = useCallback(() => {
  console.log(formData); // Correct - always has fresh data
}, [formData]);

// Dependencies declared - callback recreated when needed
```

---

## Component Optimization Patterns

### Pattern 1: Lazy Loading with Suspense

```tsx
import { lazy, Suspense } from 'react';

// Heavy component loaded only when needed
const StaffManagement = lazy(() =>
  import('./components/features/admin/StaffManagement')
);

function Dashboard() {
  const [showStaff, setShowStaff] = useState(false);

  return (
    <div>
      <button onClick={() => setShowStaff(true)}>Show Staff</button>
      {showStaff && (
        <Suspense fallback={<LoadingSpinner />}>
          <StaffManagement />
        </Suspense>
      )}
    </div>
  );
}
```

### Pattern 2: React.memo for Pure Components

```tsx
// If props haven't changed, don't re-render
const MetricCardMemo = React.memo(MetricCard);

// Or with custom comparison
export const InventoryTableRow = React.memo(
  InventoryTableRowComponent,
  (prevProps, nextProps) => {
    // Return true if props are equal (no re-render)
    return prevProps.item.id === nextProps.item.id &&
           prevProps.item.quantity === nextProps.item.quantity;
  }
);
```

### Pattern 3: useDeferredValue for Heavy Updates

```tsx
import { useDeferredValue, useState } from 'react';

function SearchStaff({ staff }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Deferred value updates after urgent updates
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filteredStaff = useMemo(
    () => staff.filter(s => 
      s.name.toLowerCase().includes(deferredSearchTerm.toLowerCase())
    ),
    [staff, deferredSearchTerm]
  );

  return (
    <>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      {/* Shows while filtering - keeps UI responsive */}
      {filteringInProgress && <p>Searching...</p>}
      <StaffList staff={filteredStaff} />
    </>
  );
}
```

---

## Data Fetching Best Practices

### Pattern 1: Single Responsibility Hook

```tsx
// ✓ Good: Hook does one thing
function useFetchStaff() {
  const [staff, setStaff] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    
    const fetchData = async () => {
      try {
        const response = await fetch('/api/staff', {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch');
        setStaff(await response.json());
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, []);

  return { staff, isLoading, error };
}

// Usage is clean and simple
function StaffComponent() {
  const { staff, isLoading, error } = useFetchStaff();
  // ...
}
```

### Pattern 2: Retry Logic for Failed Requests

```tsx
export function useFetchWithRetry(url, maxRetries = 3) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let retries = 0;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`${response.status}`);
        setData(await response.json());
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError') return;

        if (retries < maxRetries) {
          retries++;
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = Math.pow(2, retries - 1) * 1000;
          setTimeout(fetchData, delay);
        } else {
          setError(err.message);
        }
      } finally {
        setIsLoading(retries === 0 && !error);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [url, maxRetries]);

  return { data, isLoading, error };
}
```

---

## Error Handling Patterns

### Pattern 1: Error Boundary for Component Trees

```tsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to error tracking service
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-900/20 border border-red-500/30 rounded-lg">
          <h2 className="text-red-400 font-bold mb-2">Something went wrong</h2>
          <p className="text-red-300 text-sm">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <StaffManagement />
</ErrorBoundary>
```

### Pattern 2: Graceful Error Handling in Async Operations

```tsx
async function deleteStaff(staffId) {
  try {
    setIsDeleting(true);
    
    const response = await fetch(`/api/staff/${staffId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      // Check for specific error types
      if (response.status === 403) {
        throw new Error('You do not have permission to delete this staff member');
      } else if (response.status === 404) {
        throw new Error('Staff member not found');
      } else {
        throw new Error(`Failed to delete staff (${response.status})`);
      }
    }

    // Only show success if operation completed
    staffList.forEach(s => {
      if (s.id === staffId) {
        s.status = 'deleted';
      }
    });
    
    addToast('Staff member deleted successfully', 'success');
    
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';
    
    addToast(message, 'error');
    console.error('Delete operation failed:', error);
    
  } finally {
    setIsDeleting(false);
  }
}
```

---

## TypeScript Best Practices

### Pattern 1: Strict Typing for Callbacks

**Problem:**
```tsx
import { ChangeEvent } from 'react';

function SearchBox({ onSearch }) {
  // No type info - autocompletion doesn't work
  const handleChange = (e) => {
    onSearch(e.target.value);
  };

  return <input onChange={handleChange} />;
}
```

**Solution:**
```tsx
import { ChangeEvent, useCallback } from 'react';

interface SearchBoxProps {
  onSearch: (searchTerm: string) => void;
}

function SearchBox({ onSearch }: SearchBoxProps) {
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  }, [onSearch]);

  return <input onChange={handleChange} />;
}
```

### Pattern 2: Generic Hooks

```tsx
// Reusable, type-safe hook for any API endpoint
export function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json: T = await response.json();
        setData(json);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, [url]);

  return { data, error, isLoading };
}

// Usage type-safe
const { data: staff } = useApi<Staff[]>('/api/staff');
const { data: metrics } = useApi<Metrics>('/api/metrics');
```

---

## Common Code Smells & Fixes

### Smell 1: God Component

**Before:**
```tsx
function Dashboard() {
  // 500+ lines, handles everything:
  // - Data fetching
  // - State management
  // - Authentication
  // - Rendering 10+ sections
  // - Error handling
  // - Analytics
}
```

**After:**
```tsx
function Dashboard() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<DashboardSkeleton />}>
        <OverviewSection />
        <StaffManagementSection />
        <InventorySection />
      </Suspense>
    </ErrorBoundary>
  );
}

// Each section is its own component with focused responsibility
```

### Smell 2: Prop Drilling

**Before:**
```tsx
function Dashboard({ user, branch, metrics, theme, ... }) {
  return (
    <Header user={user} theme={theme} />
    <Sidebar branch={branch} theme={theme} />
    <Content metrics={metrics} user={user} theme={theme} />
  );
}
```

**After:**
```tsx
// Use Context API to avoid prop drilling
const AppContext = createContext({
  user: null,
  branch: '',
  theme: 'dark',
});

function Dashboard() {
  const { user, branch, theme } = useContext(AppContext);
  
  return (
    <Header />
    <Sidebar />
    <Content />
  );
}
```

### Smell 3: Over-Complicated Conditionals

**Before:**
```tsx
{isLoading && !error && !data ? (
  <LoadingSpinner />
) : error && !isLoading ? (
  <ErrorMessage error={error} />
) : data && !error ? (
  <DataDisplay data={data} />
) : null}
```

**After:**
```tsx
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (data) return <DataDisplay data={data} />;
return null;
```

### Smell 4: Magic Numbers & Strings

**Before:**
```tsx
const handleDelete = async (id) => {
  await fetch(`/api/staff/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  
  setTimeout(() => refetch(), 3000); // What is 3000?
  
  if (data.length < 10) { // Why 10?
    showWarning('Low items');
  }
};
```

**After:**
```tsx
const REFETCH_DELAY_MS = 3000;
const LOW_INVENTORY_THRESHOLD = 10;

const handleDelete = async (id: string) => {
  await fetch(`/api/staff/${id}`, {
    method: 'DELETE',
    headers: HTTP_HEADERS,
  });
  
  setTimeout(() => refetch(), REFETCH_DELAY_MS);
  
  if (data.length < LOW_INVENTORY_THRESHOLD) {
    showWarning('Low items');
  }
};
```

---

## Performance Monitoring

### Add to useEffect for monitoring re-renders:

```tsx
useEffect(() => {
  console.log(`[${ComponentName}] Rendered`);
}, []);

// With why-did-you-render in development
import whyDidYouRender from '@welldone-software/why-did-you-render';

if (process.env.NODE_ENV === 'development') {
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    trackHooks: {
      useCallback: true,
      useEffect: true,
    },
  });
}
```

### Use React DevTools Profiler

1. Open React DevTools
2. Go to the "Profiler" tab
3. Start recording
4. Interact with component
5. Stop recording
6. Analyze render times and what triggered re-renders

---

## Summary: Optimization Checklist

- [ ] Remove unused dependencies from useEffect
- [ ] Wrap callbacks in useCallback
- [ ] Memoize expensive calculations with useMemo
- [ ] Use AbortController for fetch cleanup
- [ ] Add removeEventListener in cleanup
- [ ] Implement React.memo for pure components
- [ ] Use lazy + Suspense for code splitting
- [ ] Handle loading and error states gracefully
- [ ] Add proper TypeScript types
- [ ] Remove magic numbers (use constants)
- [ ] Break down large components
- [ ] Avoid prop drilling (use Context)
- [ ] Test performance with React DevTools Profiler

---

## Resources

- [React Hooks Best Practices](https://react.dev/reference/react/useEffect)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Web API - AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [React Profiling](https://react.dev/learn/render-and-commit)
