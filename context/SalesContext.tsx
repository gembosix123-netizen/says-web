import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Customer, Product, CartItem, Order, OrderItem, Transaction, StockAudit } from '@/types';

type PaymentDetails = {
  method: 'cash' | 'transfer' | 'credit';
  returnAmount: number;
  exchangeAmount: number;
  focAmount: number;
};

interface SalesContextType {
  step: number;
  setStep: (step: number) => void;
  customers: Customer[];
  products: Product[];
  visitedCustomers: string[];
  setVisitedCustomers: React.Dispatch<React.SetStateAction<string[]>>;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  cart: CartItem[];
  updateCart: (product: Product, change: number) => void;
  payment: PaymentDetails;
  setPayment: React.Dispatch<React.SetStateAction<PaymentDetails>>;
  checkInTime: Date | null;
  setCheckInTime: (date: Date | null) => void;
  gpsLocation: { lat: number; lon: number } | null;
  setGpsLocation: (loc: { lat: number; lon: number } | null) => void;
  signatureUrl: string | null;
  setSignatureUrl: (url: string | null) => void;
  photoUrl: string | null;
  setPhotoUrl: (url: string | null) => void;
  resetSalesProcess: () => void;
  calculateSubtotal: () => number;
  calculateGrandTotal: () => number;
  orders: Order[];
  activeOrderId: string | null;
  setActiveOrderId: (id: string | null) => void;
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  transactions: Transaction[];
  refreshTransactions: () => void;
  saveStockAudit: (items: { productId: string; productName: string; physicalStock: number }[]) => Promise<void>;
  latestAudit: StockAudit | null;
  setLatestAudit: (audit: StockAudit | null) => void;
  loading: boolean;
  userRole: string | null;
  exchangeItems: { productId: string; quantity: number; reason: string }[];
  setExchangeItems: React.Dispatch<React.SetStateAction<{ productId: string; quantity: number; reason: string }[]>>;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);

export function SalesProvider({ children, initialRole }: { children: ReactNode, initialRole?: string }) {
  const [step, setStep] = useState<number>(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [visitedCustomers, setVisitedCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [latestAudit, setLatestAudit] = useState<StockAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole] = useState<string | null>(initialRole || null);

  const [payment, setPayment] = useState<PaymentDetails>({
    method: 'cash',
    returnAmount: 0,
    exchangeAmount: 0,
    focAmount: 0,
  });

  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [exchangeItems, setExchangeItems] = useState<{ productId: string; quantity: number; reason: string }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [custRes, prodRes, ordRes, transRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/products'),
        fetch('/api/orders'),
        fetch('/api/sales')
      ]);
      
      if (custRes.ok) setCustomers(await custRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (ordRes.ok) setOrders(await ordRes.json());
      if (transRes.ok) setTransactions(await transRes.json());
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll for status updates every 10 seconds
    const interval = setInterval(() => {
        fetch('/api/sales').then(res => res.json()).then(setTransactions).catch(console.error);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshTransactions = () => {
      fetch('/api/sales').then(res => res.json()).then(setTransactions).catch(console.error);
  };

  const saveStockAudit = async (items: { productId: string; productName: string; physicalStock: number }[]) => {
    if (!selectedCustomer) return;

    const auditData = {
      customerId: selectedCustomer.id,
      items,
    };

    try {
      const res = await fetch('/api/stock-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData),
      });
      
      if (res.ok) {
        const audit = await res.json();
        setLatestAudit(audit);
      }
    } catch (error) {
      console.error("Failed to save stock audit", error);
    }
  };


  const updateCart = (product: Product, change: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        // Check max qty from order if in order mode
        const orderItem = activeOrderId 
            ? orders.find(o => o.id === activeOrderId)?.items.find(i => i.productId === product.id)
            : null;
        
        const maxQty = orderItem ? orderItem.quantity : Infinity;
        const newQty = Math.max(0, Math.min(existing.quantity + change, maxQty));

        if (newQty <= 0) {
          return prev.filter((item) => item.id !== product.id);
        }
        return prev.map((item) => (item.id === product.id ? { ...item, quantity: newQty } : item));
      } else {
        if (change > 0 && activeOrderId === null) {
            // Only allow adding if not strict order mode (or logic handled elsewhere)
            // But here we just add it
          return [...prev, { ...product, quantity: 1 }];
        }
        return prev;
      }
    });
  };

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const calculateGrandTotal = () => {
    return calculateSubtotal();
  };

  const resetSalesProcess = () => {
    setSelectedCustomer(null);
    setCheckInTime(null);
    setGpsLocation(null);
    setCart([]);
    setPayment({ method: 'cash', returnAmount: 0, exchangeAmount: 0, focAmount: 0 });
    setExchangeItems([]);
    setSignatureUrl(null);
    setPhotoUrl(null);
    setStep(1);
    setActiveOrderId(null);
    setLatestAudit(null);
    refreshTransactions();
  };

  return (
    <SalesContext.Provider
      value={{
        step,
        setStep,
        customers,
        products,
        visitedCustomers,
        setVisitedCustomers,
        selectedCustomer,
        setSelectedCustomer,
        cart,
        updateCart,
        payment,
        setPayment,
        checkInTime,
        setCheckInTime,
        gpsLocation,
        setGpsLocation,
        signatureUrl,
        setSignatureUrl,
        photoUrl,
        setPhotoUrl,
        resetSalesProcess,
        calculateSubtotal,
        calculateGrandTotal,
        orders,
        activeOrderId,
        setActiveOrderId,
        setCart,
        transactions,
        refreshTransactions,
        saveStockAudit,
        latestAudit,
        setLatestAudit,
        loading,
        userRole,
        exchangeItems,
        setExchangeItems
      }}
    >
      {children}
    </SalesContext.Provider>
  );
}


export function useSales() {
  const context = useContext(SalesContext);
  if (context === undefined) {
    throw new Error('useSales must be used within a SalesProvider');
  }
  return context;
}
