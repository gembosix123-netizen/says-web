import React, { useState, useEffect } from 'react';
import { useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import { Search, List, History, Truck, LayoutDashboard, Lock, LogOut } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CartItem, Product, User } from '@/types';
import OrderHistory from './OrderHistory';
import InventoryLoading from './InventoryLoading';
import VanDashboard from './VanDashboard';
import EndDayModal from './EndDayModal';


export default function SalesDashboard() {
  const { customers, visitedCustomers, setSelectedCustomer, setStep, setActiveOrderId, orders, setCart, setLatestAudit, products } = useSales();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'visits' | 'history' | 'inventory'>('visits');
  const [currentDate, setCurrentDate] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showEndDay, setShowEndDay] = useState(false);

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' }));
    
    // Fetch current user
    fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => setCurrentUser(data))
        .catch(console.error);
  }, []);

  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const progress = customers.length > 0 ? Math.round((visitedCustomers.length / customers.length) * 100) : 0;

  const handleSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setLatestAudit(null);
    const customerOrder = orders.find(o => o.customerId === customer.id);
    if (customerOrder) {
      setActiveOrderId(customerOrder.id);
      // Map OrderItem to CartItem
      setCart(customerOrder.items.map(i => ({
         id: i.productId,
         name: i.productName,
         unit: i.unit,
         price: i.price,
         quantity: 0, 
      } as CartItem))); 
    } else {
      setActiveOrderId(null);
      setCart([]);
    }
    setStep(2);
  };

  const handleInventorySuccess = () => {
      setRefreshKey(prev => prev + 1); // Trigger VanDashboard refresh
      setView('inventory'); // Stay on inventory view or maybe switch to visits?
      alert(t('inventory_loaded'));
  };

  return (
    <div className="space-y-4">
      {/* Progress Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-lg">
         <div className="flex justify-between items-end mb-2">
           <div>
             <h2 className="text-xl font-bold">{t('dashboard_title')}</h2>
             <p className="text-slate-300 text-sm">{currentDate}</p>
           </div>
           <div className="flex flex-col items-end gap-2">
               <button 
                onClick={() => setShowEndDay(true)}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-lg shadow-red-900/20 border border-red-500 transition-all"
               >
                   <Lock size={12} /> {t('end_day')}
               </button>
               <div className="text-3xl font-bold">{visitedCustomers.length}/{customers.length}</div>
           </div>
         </div>
         <div className="w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
           <div className="bg-white h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
         </div>
         <p className="text-sm text-right mt-1 text-slate-300">{progress}% Completed</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl overflow-x-auto">
        <button 
            onClick={() => setView('visits')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-all whitespace-nowrap ${view === 'visits' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
            <List size={18} /> {t('visits') || 'Visits'}
        </button>
        <button 
            onClick={() => setView('history')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-all whitespace-nowrap ${view === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
            <History size={18} /> {t('history') || 'History'}
        </button>
        <button 
            onClick={() => setView('inventory')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-all whitespace-nowrap ${view === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
            <Truck size={18} /> {t('inventory') || 'Stock'}
        </button>
      </div>

      {view === 'visits' && (
        <>
            {/* Search */}
            <div className="sticky top-0 bg-slate-50 pt-2 pb-2 z-10">
                <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                <input
                    type="text"
                    placeholder={t('search_store')}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 shadow-sm focus:ring-2 focus:ring-slate-900 outline-none text-lg text-slate-900 placeholder-slate-400"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                </div>
            </div>

            {/* List */}
            <div className="space-y-3 pb-20">
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <p>No customers assigned.</p>
                    </div>
                ) : (
                    filteredCustomers.map((customer) => {
                        const isVisited = visitedCustomers.includes(customer.id);
                        return (
                            <button
                                key={customer.id}
                                onClick={() => handleSelect(customer)}
                                className={`w-full text-left p-4 rounded-xl shadow-sm border transition-all relative overflow-hidden ${
                                    isVisited 
                                    ? 'bg-slate-100 border-slate-300 opacity-80' 
                                    : 'bg-white border-slate-200 active:bg-slate-50'
                                }`}
                            >
                                {isVisited && (
                                    <div className="absolute top-0 right-0 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
                                        {t('visited')}
                                    </div>
                                )}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className={`font-bold text-lg ${isVisited ? 'text-slate-600' : 'text-slate-900'}`}>{customer.name}</h3>
                                        <p className="text-slate-500 text-sm">{customer.address}</p>
                                    </div>
                                    <div className="text-right mt-1">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${customer.outstandingBalance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                            {customer.outstandingBalance > 0 ? t('debt') : t('balance')} {formatCurrency(customer.outstandingBalance)}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </>
      )}

      {view === 'history' && <OrderHistory />}

      {view === 'inventory' && currentUser && (
          <div className="space-y-6 pb-20">
              <VanDashboard userId={currentUser.id} products={products} refreshTrigger={refreshKey} />
              <InventoryLoading products={products} userId={currentUser.id} onSuccess={handleInventorySuccess} />
          </div>
      )}

      {currentUser && (
        <EndDayModal 
            isOpen={showEndDay} 
            onClose={() => setShowEndDay(false)} 
            userId={currentUser.id}
            userName={currentUser.name}
        />
      )}
    </div>
  );
}
