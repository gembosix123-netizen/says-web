'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSales } from '@/context/SalesContext';
import { Search, Plus, Store, CheckCircle, Loader2, ClipboardList, BadgeCheck } from 'lucide-react';
import { User } from '@/types';
import CommissionWidget from './CommissionWidget';
import { useToast } from '@/components/ui/Toast';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

type TaskStatus = 'Success' | 'Failed' | 'Pending';

type TaskItem = {
  id: string;
  title?: string;
  name?: string;
  paymentStatus?: TaskStatus;
  deliveryStatus?: TaskStatus;
  updatedAt?: string;
};

type StoreItem = {
  id: string;
  name?: string;
};

export default function SalesDashboard() {
  const { customers, visitedCustomers, setSelectedCustomer, setStep, setLatestAudit, orders, setCart, userBranch } = useSales();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<{ id?: string } | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newShop, setNewShop] = useState({ name: '', address: '', phone: '' });
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [storesLoading, setStoresLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [updating, setUpdating] = useState<{ id: string; field: 'paymentStatus' | 'deliveryStatus' } | null>(null);

  useEffect(() => {
    // Ambil pengguna semasa
    fetch('/api/auth/me')
        .then(async (res) => {
          const text = await res.text();
          return text ? JSON.parse(text) : null;
        })
        .then(data => {
          if (!data) return;
          setCurrentUser(data);
          setUser(data);
        })
        .catch(console.error);
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return;
    try {
      setUser(JSON.parse(storedUser));
    } catch (error) {
      console.error('Gagal membaca sesi pengguna:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // TEMPORARY: Disable Firestore realtime sync until database is populated
    // Uncomment this section after running migration: npm run migrate:firestore
    
    setTasksLoading(false);
    setStoresLoading(false);
    setTasks([]);
    setStores([]);
    
    return () => {};

    /* 
    let unsubscribeTasks = () => {};
    let unsubscribeStores = () => {};
    let isActive = true;

    const setupRealtimeSync = async () => {
      setSyncError('');
      setTasksLoading(true);
      setStoresLoading(true);

      try {
        await signInAnonymously(auth);

        // Guna koleksi Firestore yang betul mengikut architecture
        const tasksRef = collection(db, 'transactions');
        const storesRef = collection(db, 'customers');

        unsubscribeTasks = onSnapshot(
          tasksRef,
          (snapshot) => {
            if (!isActive) return;
            // Filter untuk transaksi yang pending sahaja
            const items = snapshot.docs
              .map((docItem) => {
                const data = docItem.data();
                return {
                  id: docItem.id,
                  title: data.reference || docItem.id,
                  name: data.customerId || 'Unknown',
                  paymentStatus: data.paymentStatus || (data.status === 'completed' ? 'Success' : 'Pending'),
                  deliveryStatus: data.deliveryStatus || 'Pending',
                  updatedAt: data.updatedAt,
                };
              })
              .filter((item) => item.paymentStatus !== 'Success' || item.deliveryStatus !== 'Success');
            setTasks(items);
            setTasksLoading(false);
          },
          (error) => {
            console.error('Ralat onSnapshot tugasan:', error);
            if (!isActive) return;
            setSyncError('Gagal menyegerakkan tugasan.');
            setTasksLoading(false);
          }
        );

        unsubscribeStores = onSnapshot(
          storesRef,
          (snapshot) => {
            if (!isActive) return;
            const items = snapshot.docs.map((docItem) => ({
              id: docItem.id,
              name: docItem.data().name,
            }));
            setStores(items);
            setStoresLoading(false);
          },
          (error) => {
            console.error('Ralat onSnapshot stor:', error);
            if (!isActive) return;
            setSyncError('Gagal menyegerakkan stor.');
            setStoresLoading(false);
          }
        );
      } catch (error) {
        console.error('Ralat sambungan Firestore:', error);
        if (!isActive) return;
        setSyncError('Ralat sambungan Firestore.');
        setTasksLoading(false);
        setStoresLoading(false);
      }
    };

    setupRealtimeSync();

    return () => {
      isActive = false;
      unsubscribeTasks();
      unsubscribeStores();
    };
    */
  }, [user]);

  const normalizeStatus = (value?: TaskStatus): TaskStatus => {
    if (value === 'Success' || value === 'Failed') return value;
    return 'Pending';
  };

  const statusClasses: Record<TaskStatus, string> = {
    Success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Failed: 'bg-red-500/15 text-red-300 border-red-500/30',
    Pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const labelA = (a.title ?? a.name ?? a.id).toLowerCase();
      const labelB = (b.title ?? b.name ?? b.id).toLowerCase();
      return labelA.localeCompare(labelB);
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return sortedTasks.filter((task) => {
      const hasPayment = typeof task.paymentStatus === 'string';
      const hasDelivery = typeof task.deliveryStatus === 'string';
      return hasPayment || hasDelivery;
    });
  }, [sortedTasks]);

  const handleUpdateStatus = async (taskId: string, field: 'paymentStatus' | 'deliveryStatus') => {
    setUpdating({ id: taskId, field });
    setSyncError('');

    try {
      await signInAnonymously(auth);

      const taskRef = doc(db, 'transactions', taskId);
      await updateDoc(taskRef, { [field]: 'Success' });
    } catch (error) {
      console.error('Ralat kemaskini status:', error);
      setSyncError('Gagal mengemaskini status.');
    } finally {
      setUpdating(null);
    }
  };

  const filteredCustomers = customers.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleShopSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setLatestAudit(null);
    const customerOrder = orders.find(o => o.customerId === customer.id);
    if (customerOrder) {
      // ... (pulihkan logik sedia ada untuk pilih semula pelanggan)
    }
    setStep(2); // Pergi ke CheckIn
  };

  const handleRegisterShop = async () => {
    if (!newShop.name.trim()) return;
    
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newShop.name.trim(),
          address: newShop.address.trim() || undefined,
          phone: newShop.phone.trim() || undefined,
          branch: userBranch || 'Kota Kinabalu',
          type: 'retail',
          status: 'active',
          isActive: true,
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        addToast('Kedai berjaya didaftarkan', 'success');
        setShowRegisterModal(false);
        setNewShop({ name: '', address: '', phone: '' });
        // Segar semula senarai pelanggan
        window.location.reload();
      } else {
        const message = data?.error || data?.details?.[0] || 'Gagal mendaftarkan kedai';
        addToast(message, 'error');
      }
    } catch (error) {
      console.error('Failed to register shop:', error);
      addToast('Ralat sambungan. Cuba semula.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Widget Komisen (digabung seperti kad dashboard) */}
      {currentUser && <CommissionWidget user={currentUser} />}

      {/* Pemilihan Kedai (padanan UI langkah 1) */}
      <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Cari kedai..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-xl pl-10 h-12 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent outline-none transition-all"
            />
          </div>
          
          <button 
            className="w-full py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/40 flex items-center justify-center gap-2 transition-all"
            onClick={() => setShowRegisterModal(true)}
          >
            <Plus size={18} /> Daftar Kedai Baharu
          </button>

          <div className="space-y-3">
            {filteredCustomers.map(customer => {
                const isVisited = visitedCustomers.includes(customer.id);
                return (
                  <button
                    key={customer.id}
                    onClick={() => handleShopSelect(customer)}
                    className={`w-full text-left bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl hover:bg-white/10 hover:border-blue-500/30 transition-all active:scale-[0.98] group relative overflow-hidden ${isVisited ? 'opacity-75' : ''}`}
                  >
                    {isVisited && (
                        <div className="absolute top-0 right-0 bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-bl-lg border-l border-b border-green-500/20 flex items-center gap-1">
                          <CheckCircle size={12} /> Dikunjungi
                        </div>
                    )}
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 flex items-center justify-center group-hover:from-blue-600 group-hover:to-indigo-600 group-hover:text-white transition-all shadow-lg">
                            <Store size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">{customer.name}</h3>
                            <p className="text-sm text-slate-400 truncate">{customer.address || 'Tiada alamat'}</p>
                        </div>
                    </div>
                  </button>
                );
            })}
            {filteredCustomers.length === 0 && (
                  <div className="text-center text-slate-500 py-8">
                          <p>Tiada kedai ditemui.</p>
                  </div>
              )}
          </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-400">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Tugasan Masa Nyata</h3>
              <p className="text-xs text-slate-400">
                Jumlah stor: {storesLoading ? 'Memuat...' : stores.length}
              </p>
            </div>
          </div>
          {syncError && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 px-3 py-2 rounded-lg">
              {syncError}
            </div>
          )}
        </div>

        {tasksLoading ? (
          <div className="bg-[#020617] border border-slate-800 rounded-2xl p-6 flex items-center gap-3 text-slate-400">
            <Loader2 className="animate-spin" size={18} />
            <span>Memuatkan tugasan...</span>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-[#020617] border border-slate-800 rounded-2xl p-6 text-slate-400">
            Tiada tugasan ditemui.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredTasks.map((task) => {
              const paymentStatus = normalizeStatus(task.paymentStatus);
              const deliveryStatus = normalizeStatus(task.deliveryStatus);
              const isComplete = paymentStatus === 'Success' && deliveryStatus === 'Success';
              const paymentUpdating = updating?.id === task.id && updating.field === 'paymentStatus';
              const deliveryUpdating = updating?.id === task.id && updating.field === 'deliveryStatus';
              const taskTitle = task.title ?? task.name ?? 'Tugasan Tanpa Nama';

              return (
                <div
                  key={task.id}
                  className="bg-[#020617] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg shadow-slate-950/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">ID Tugasan</p>
                      <h4 className="text-lg font-semibold text-white break-all">{taskTitle}</h4>
                    </div>
                    {isComplete && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <BadgeCheck size={14} /> Selesai
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Status Bayaran</p>
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${statusClasses[paymentStatus]}`}
                      >
                        {paymentStatus}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">Status Penghantaran</p>
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${statusClasses[deliveryStatus]}`}
                      >
                        {deliveryStatus}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleUpdateStatus(task.id, 'paymentStatus')}
                      disabled={paymentStatus === 'Success' || paymentUpdating}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {paymentUpdating ? (
                        <>
                          <Loader2 className="animate-spin" size={16} /> Mengemaskini...
                        </>
                      ) : (
                        'Tandakan Bayaran Berjaya'
                      )}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(task.id, 'deliveryStatus')}
                      disabled={deliveryStatus === 'Success' || deliveryUpdating}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {deliveryUpdating ? (
                        <>
                          <Loader2 className="animate-spin" size={16} /> Mengemaskini...
                        </>
                      ) : (
                        'Tandakan Penghantaran Berjaya'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Daftar Kedai */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Daftar Kedai Baharu</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nama Kedai *"
                value={newShop.name}
                onChange={(e) => setNewShop({...newShop, name: e.target.value})}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-400"
              />
              <input
                type="text"
                placeholder="Alamat"
                value={newShop.address}
                onChange={(e) => setNewShop({...newShop, address: e.target.value})}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-400"
              />
              <input
                type="text"
                placeholder="Nombor Telefon"
                value={newShop.phone}
                onChange={(e) => setNewShop({...newShop, phone: e.target.value})}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-400"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="flex-1 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleRegisterShop}
                disabled={!newShop.name.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Daftar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
