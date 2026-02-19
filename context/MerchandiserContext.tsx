import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Customer, Product, StoreVisit, StoreAuditItem, User } from '@/types';

interface AuditItemInput {
  product_id: string;
  product_name: string;
  balance_stock: number;
  expired_stock: number;
  damaged_stock: number;
  condition_notes?: string;
  photo_url?: string;
}

interface MerchandiserContextType {
  step: number;
  setStep: (step: number) => void;
  
  // Data
  allowedCustomers: Customer[];
  products: Product[];
  visits: StoreVisit[];
  loading: boolean;
  
  // Current visit workflow
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  currentVisit: StoreVisit | null;
  setCurrentVisit: (visit: StoreVisit | null) => void;
  
  // Check-in data
  checkInTime: Date | null;
  setCheckInTime: (date: Date | null) => void;
  gpsLocation: { lat: number; lon: number } | null;
  setGpsLocation: (loc: { lat: number; lon: number } | null) => void;
  staffName: string;
  setStaffName: (name: string) => void;
  staffContact: string;
  setStaffContact: (contact: string) => void;
  
  // Audit items
  auditItems: AuditItemInput[];
  setAuditItems: React.Dispatch<React.SetStateAction<AuditItemInput[]>>;
  addAuditItem: (item: AuditItemInput) => void;
  updateAuditItem: (productId: string, updates: Partial<AuditItemInput>) => void;
  
  // Photos
  photos: string[]; // Data URLs
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  addPhoto: (dataUrl: string) => void;
  removePhoto: (index: number) => void;
  
  // Actions
  startVisit: (customerId: string) => Promise<StoreVisit | null>;
  completeVisit: () => Promise<boolean>;
  resetVisitProcess: () => void;
  refreshVisits: () => Promise<void>;
  
  // User info
  userRole: string | null;
  userBranch: string | null;
  userId: string | null;
}

const MerchandiserContext = createContext<MerchandiserContextType | undefined>(undefined);

export function MerchandiserProvider({ 
  children, 
  initialRole, 
  initialBranch,
  initialUserId 
}: { 
  children: ReactNode;
  initialRole?: string;
  initialBranch?: string;
  initialUserId?: string;
}) {
  const [step, setStep] = useState<number>(1);
  const [allowedCustomers, setAllowedCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [visits, setVisits] = useState<StoreVisit[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentVisit, setCurrentVisit] = useState<StoreVisit | null>(null);
  
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [staffName, setStaffName] = useState<string>('');
  const [staffContact, setStaffContact] = useState<string>('');
  
  const [auditItems, setAuditItems] = useState<AuditItemInput[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  
  const [userRole] = useState<string | null>(initialRole || null);
  const [userBranch] = useState<string | null>(initialBranch || null);
  const [userId] = useState<string | null>(initialUserId || null);

  const readJson = async (res: Response) => {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  };

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [custRes, prodRes, visitsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/products'),
        fetch('/api/store-visits')
      ]);

      if (custRes.ok) {
        const data = await readJson(custRes);
        // If user has allowed_stores, filter customers
        // For now, show all customers - filtering will happen server-side
        setAllowedCustomers(Array.isArray(data) ? data : []);
      }
      
      if (prodRes.ok) {
        const data = await readJson(prodRes);
        setProducts(Array.isArray(data) ? data : []);
      }
      
      if (visitsRes.ok) {
        const data = await readJson(visitsRes);
        setVisits(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("[MerchandiserContext] Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh visits
  const refreshVisits = async () => {
    try {
      const res = await fetch('/api/store-visits');
      if (res.ok) {
        const data = await readJson(res);
        setVisits(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("[MerchandiserContext] Failed to refresh visits", error);
    }
  };

  // Add audit item
  const addAuditItem = (item: AuditItemInput) => {
    setAuditItems((prev) => {
      // Check if item already exists
      const exists = prev.find((i) => i.product_id === item.product_id);
      if (exists) {
        // Update existing
        return prev.map((i) => (i.product_id === item.product_id ? item : i));
      }
      // Add new
      return [...prev, item];
    });
  };

  // Update audit item
  const updateAuditItem = (productId: string, updates: Partial<AuditItemInput>) => {
    setAuditItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, ...updates } : item
      )
    );
  };

  // Add photo
  const addPhoto = (dataUrl: string) => {
    setPhotos((prev) => [...prev, dataUrl]);
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Start visit (check-in)
  const startVisit = async (customerId: string): Promise<StoreVisit | null> => {
    try {
      const res = await fetch('/api/store-visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          gps_lat: gpsLocation?.lat,
          gps_long: gpsLocation?.lon,
          staff_name: staffName,
          staff_contact: staffContact,
          visit_type: 'audit',
        }),
      });

      if (res.ok) {
        const visit = await res.json();
        setCurrentVisit(visit);
        await refreshVisits();
        return visit;
      } else {
        const error = await res.json();
        console.error("[MerchandiserContext] Failed to start visit:", error);
        alert(error.error || 'Failed to start visit');
        return null;
      }
    } catch (error) {
      console.error("[MerchandiserContext] Error starting visit:", error);
      alert('Error starting visit');
      return null;
    }
  };

  // Complete visit
  const completeVisit = async (): Promise<boolean> => {
    if (!currentVisit) {
      alert('No active visit');
      return false;
    }

    try {
      // 1. Submit audit items
      if (auditItems.length > 0) {
        const auditRes = await fetch('/api/merchandiser/audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visit_id: currentVisit.id,
            items: auditItems,
          }),
        });

        if (!auditRes.ok) {
          const error = await auditRes.json();
          console.error("[MerchandiserContext] Failed to submit audits:", error);
          alert(error.error || 'Failed to submit audit items');
          return false;
        }
      }

      // 2. Upload photos if any
      if (photos.length > 0) {
        const photoRes = await fetch('/api/merchandiser/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visit_id: currentVisit.id,
            photo_data_urls: photos,
          }),
        });

        if (!photoRes.ok) {
          console.error("[MerchandiserContext] Failed to upload photos");
          // Don't fail the whole process if photos fail
        }
      }

      // 3. Mark visit as completed
      const completeRes = await fetch('/api/store-visits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visit_id: currentVisit.id,
          status: 'completed',
          check_out_time: new Date().toISOString(),
        }),
      });

      if (completeRes.ok) {
        await refreshVisits();
        return true;
      } else {
        const error = await completeRes.json();
        console.error("[MerchandiserContext] Failed to complete visit:", error);
        alert(error.error || 'Failed to complete visit');
        return false;
      }
    } catch (error) {
      console.error("[MerchandiserContext] Error completing visit:", error);
      alert('Error completing visit');
      return false;
    }
  };

  // Reset visit process
  const resetVisitProcess = () => {
    setSelectedCustomer(null);
    setCurrentVisit(null);
    setCheckInTime(null);
    setGpsLocation(null);
    setStaffName('');
    setStaffContact('');
    setAuditItems([]);
    setPhotos([]);
    setStep(1);
    refreshVisits();
  };

  return (
    <MerchandiserContext.Provider
      value={{
        step,
        setStep,
        allowedCustomers,
        products,
        visits,
        loading,
        selectedCustomer,
        setSelectedCustomer,
        currentVisit,
        setCurrentVisit,
        checkInTime,
        setCheckInTime,
        gpsLocation,
        setGpsLocation,
        staffName,
        setStaffName,
        staffContact,
        setStaffContact,
        auditItems,
        setAuditItems,
        addAuditItem,
        updateAuditItem,
        photos,
        setPhotos,
        addPhoto,
        removePhoto,
        startVisit,
        completeVisit,
        resetVisitProcess,
        refreshVisits,
        userRole,
        userBranch,
        userId,
      }}
    >
      {children}
    </MerchandiserContext.Provider>
  );
}

export function useMerchandiser() {
  const context = useContext(MerchandiserContext);
  if (context === undefined) {
    throw new Error('useMerchandiser must be used within a MerchandiserProvider');
  }
  return context;
}
