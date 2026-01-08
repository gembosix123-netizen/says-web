"use client";

import React from 'react';
import { SalesProvider, useSales } from '@/context/SalesContext';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import { Home, LogOut } from 'lucide-react';

// Feature Components
import SalesDashboard from './features/sales/SalesDashboard';
import CheckIn from './features/sales/CheckIn';
import ProductCatalog from './features/sales/ProductCatalog';
import PaymentForm from './features/sales/PaymentForm';
import OrderSummary from './features/sales/OrderSummary';
import SuccessScreen from './features/sales/SuccessScreen';
import ProductExchange from './features/sales/ProductExchange';
import StockAudit from './features/sales/StockAudit';

function SalesWizardContent() {
  const { step, selectedCustomer } = useSales();
  const { t } = useLanguage();

  const handleLogout = async () => {
    if (!confirm('Adakah anda pasti mahu log keluar?')) return;
    
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1: return <SalesDashboard />;
      case 2: return <CheckIn />;
      case 3: return <StockAudit />;
      case 4: return <ProductExchange />;
      case 5: return <ProductCatalog />;
      case 6: return <PaymentForm />;
      case 7: return <OrderSummary />;
      case 8: return <SuccessScreen />;
      default: return <SalesDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <header className="bg-white border-b border-slate-200 p-5 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-sm font-bold text-slate-500 tracking-widest uppercase">{t('brand_client')}</h1>
            <p className="text-base font-semibold text-slate-900">{step === 1 ? t('system_title') : selectedCustomer?.name}</p>
          </div>
          <div className="flex items-center gap-3">
             <ThemeSwitcher />
             <LanguageSwitcher />
             <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Log Keluar"
             >
                <LogOut size={20} />
             </button>
             {step === 1 ? (
                 <Home size={20} className="text-blue-600" />
             ) : (
                 <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">{t('step')} {step}/8</div>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-5">
        {renderStep()}
      </main>

      {step === 1 && (
        <footer className="bg-slate-900 text-slate-400 p-5 text-center text-sm pb-safe space-y-4">
            <button 
                onClick={handleLogout}
                className="w-full py-3 bg-slate-800 text-red-400 rounded-lg flex items-center justify-center gap-2 font-bold border border-slate-700"
            >
                <LogOut size={16} />
                LOG KELUAR (LOGOUT)
            </button>
            <div>
                <p>{t('developed_by')}</p>
                <p className="text-xs mt-1 opacity-80">Enterprise Solutions v1.0</p>
            </div>
        </footer>
      )}
    </div>
  );
}

export default function SalesWizard({ role }: { role?: string }) {
  return (
    <SalesProvider initialRole={role}>
      <SalesWizardContent />
    </SalesProvider>
  );
}
