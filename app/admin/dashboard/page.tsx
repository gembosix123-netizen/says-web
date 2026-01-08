"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Customer, Product, User, Transaction, OrderStatus, StockAudit } from '@/types';
import CustomerManagement from '@/components/features/admin/CustomerManagement';
import ProductManagement from '@/components/features/admin/ProductManagement';
import OrderManagement from '@/components/features/admin/OrderManagement';
import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import SettlementDashboard from '@/components/features/admin/SettlementDashboard';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { LogOut, LayoutDashboard, ShoppingCart, Users, Package, Menu, X, DollarSign } from 'lucide-react';

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'analytics' | 'customers' | 'products' | 'orders' | 'settlements'>('analytics');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesUsers, setSalesUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stockAudits, setStockAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
        const [custRes, prodRes, usersRes, transRes, auditRes] = await Promise.all([
            fetch('/api/customers'),
            fetch('/api/products'),
            fetch('/api/users?role=Sales'),
            fetch('/api/sales'),
            fetch('/api/stock-audits')
        ]);
        setCustomers(await custRes.json());
        setProducts(await prodRes.json());
        setSalesUsers(await usersRes.json());
        setTransactions(await transRes.json());
        setStockAudits(await auditRes.json());
    } catch (e) {
        console.error("Failed to fetch data", e);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCustomer = async (customer: Partial<Customer>, isEdit: boolean) => {
    const url = '/api/customers';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });

    if (res.ok) {
      alert(`${t('customer_saved')}`);
      fetchData();
    } else {
      alert(t('customer_save_fail'));
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu membuang pelanggan ini?')) return;
    const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else alert('Gagal membuang pelanggan.');
  };

  const handleSaveProduct = async (product: Partial<Product>, isEdit: boolean) => {
    const url = '/api/products';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });

    if (res.ok) {
      alert(`${t('product_saved')}`);
      fetchData();
    } else {
      alert(t('product_save_fail'));
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Adakah anda pasti mahu membuang produk ini?')) return;
    const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
    else alert('Gagal membuang produk.');
  };

  const handleUpdateStatus = async (id: string, status: OrderStatus, assignedShopId?: string) => {
      const res = await fetch('/api/sales', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status, assignedShopId })
      });
      
      if (res.ok) {
          fetchData();
      } else {
          alert('Failed to update order status');
      }
  };

  const menuItems = [
    { id: 'analytics', label: t('analytics'), icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'customers', label: t('customers'), icon: Users },
    { id: 'products', label: t('products'), icon: Package },
    { id: 'settlements', label: 'Settlements', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100 flex overflow-hidden font-sans selection:bg-red-500/30">
      
      {/* Sidebar Backdrop (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo Area */}
          <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-900">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-600 flex items-center justify-center shadow-lg shadow-red-900/20 mr-3">
                <span className="text-white font-bold text-xl">S</span>
             </div>
             <div>
                <h1 className="font-bold text-lg tracking-tight text-white">SAYS 2.0</h1>
                <p className="text-xs text-slate-500">Admin Console</p>
             </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile / Logout */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/50">
             <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">AD</span>
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">Administrator</p>
                    <p className="text-xs text-slate-500 truncate">admin@says.com</p>
                </div>
             </div>
             <Button 
                onClick={handleLogout}
                variant="outline"
                className="w-full justify-center text-red-400 hover:text-red-300 hover:bg-red-900/20 border-slate-700 hover:border-red-900/50"
            >
                <LogOut size={16} className="mr-2" />
                Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-black relative">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
             <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[100px]" />
             <div className="absolute top-[20%] right-[0%] w-[30%] h-[30%] bg-red-900/10 rounded-full blur-[100px]" />
        </div>

        {/* Header */}
        <header className="h-20 border-b border-slate-800 bg-black/50 backdrop-blur-md flex items-center justify-between px-6 z-10">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <h2 className="text-xl font-semibold text-white">
                {menuItems.find(i => i.id === activeTab)?.label}
              </h2>
           </div>
           <div className="flex items-center gap-4">
              <ThemeSwitcher />
              <LanguageSwitcher />
           </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 z-10 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl mx-auto">
                    <Skeleton className="h-64 rounded-2xl bg-slate-800" />
                    <Skeleton className="h-64 rounded-2xl bg-slate-800" />
                    <Skeleton className="h-40 rounded-2xl bg-slate-800 md:col-span-2" />
                </div>
            ) : (
                <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === 'analytics' && (
                        <AnalyticsDashboard 
                            transactions={transactions} 
                            products={products} 
                            salesUsers={salesUsers} 
                            stockAudits={stockAudits}
                            customers={customers}
                        />
                    )}

                    {activeTab === 'orders' && (
                        <OrderManagement 
                            transactions={transactions} 
                            customers={customers} 
                            onUpdateStatus={handleUpdateStatus} 
                        />
                    )}

                    {activeTab === 'customers' && (
                        <CustomerManagement 
                            customers={customers} 
                            salesUsers={salesUsers} 
                            onSave={handleSaveCustomer} 
                            onDelete={handleDeleteCustomer} 
                        />
                    )}

                    {activeTab === 'products' && (
                        <ProductManagement 
                            products={products} 
                            onSave={handleSaveProduct} 
                            onDelete={handleDeleteProduct} 
                        />
                    )}

                    {activeTab === 'settlements' && (
                        <SettlementDashboard />
                    )}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}