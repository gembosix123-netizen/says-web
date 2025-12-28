"use client";

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Customer, Product, User, Transaction, OrderStatus, StockAudit } from '@/types';
import CustomerManagement from '@/components/features/admin/CustomerManagement';
import ProductManagement from '@/components/features/admin/ProductManagement';
import OrderManagement from '@/components/features/admin/OrderManagement';
import AnalyticsDashboard from '@/components/features/admin/AnalyticsDashboard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'analytics' | 'customers' | 'products' | 'orders'>('analytics');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesUsers, setSalesUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stockAudits, setStockAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{t('admin_dashboard')}</h1>
            <p className="text-slate-600">{t('manage_customers_products')}</p>
          </div>
          <div className="flex gap-2 items-center">
            <LanguageSwitcher />
            <Button 
                onClick={handleLogout}
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
                <LogOut size={16} className="mr-2" />
                Logout
            </Button>
            <Button 
                onClick={() => setActiveTab('analytics')}
                variant={activeTab === 'analytics' ? 'secondary' : 'outline'}
            >
                {t('analytics')}
            </Button>
            <Button 
                onClick={() => setActiveTab('orders')}
                variant={activeTab === 'orders' ? 'secondary' : 'outline'}
            >
                Orders
            </Button>
            <Button 
                onClick={() => setActiveTab('customers')}
                variant={activeTab === 'customers' ? 'secondary' : 'outline'}
            >
                {t('customers')}
            </Button>
            <Button 
                onClick={() => setActiveTab('products')}
                variant={activeTab === 'products' ? 'secondary' : 'outline'}
            >
                {t('products')}
            </Button>
          </div>
        </header>
        {loading ? (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </div>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
            </div>
        ) : (
            <>
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
            </>
        )}
      </div>
    </div>
  );
}

