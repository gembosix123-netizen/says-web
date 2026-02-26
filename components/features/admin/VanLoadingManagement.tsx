'use client';
import React, { useState, useEffect } from 'react';
import { Truck, Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  name: string;
  username: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
}

export default function VanLoadingManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loadItems, setLoadItems] = useState<{ productId: string; quantity: number }[]>([]);
  
  // Fetch staff data
  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/users?role=Sales');
      const userData = await res.json();
      const users = Array.isArray(userData) ? userData : (userData?.data || []);
      setUsers(users);
    } catch (err) {
      console.error('Error fetching staff:', err);
      setUsers([]);
    }
  };

  // Fetch products data
  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const productData = await res.json();
      const products = Array.isArray(productData) ? productData : (productData?.data || []);
      setProducts(products);
    } catch (err) {
      console.error('Error fetching products:', err);
      setProducts([]);
    }
  };
  
  // Load initial data & setup Supabase Realtime subscription
  useEffect(() => {
    // Fetch initial data
    fetchStaff();
    fetchProducts();

    // Setup Supabase Realtime subscription for staff (users with role Sales)
    const channel = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'users',
          filter: 'role=eq.Sales'
        },
        (payload) => {
          console.log('Staff data changed:', payload);
          // Refetch staff data when there's any change (INSERT, UPDATE, DELETE)
          fetchStaff();
        }
      )
      .subscribe();

    // Cleanup: unsubscribe when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addItem = () => {
    if (products.length > 0) {
        setLoadItems([...loadItems, { productId: products[0].id, quantity: 0 }]);
    }
  };

  const updateItem = (index: number, field: 'productId' | 'quantity', value: string) => {
    const newItems = [...loadItems];
    if (field === 'quantity') {
        newItems[index].quantity = parseInt(value) || 0;
    } else {
        newItems[index].productId = value;
    }
    setLoadItems(newItems);
  };

  const removeItem = (index: number) => {
    setLoadItems(loadItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || loadItems.length === 0) return alert('Select user and items');

    try {
        const payload = {
            userId: selectedUser,
            items: loadItems
        };
        console.log('Sending payload:', payload);

        const res = await fetch('/api/inventory/load', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        
        if (res.ok) {
            alert('Stock Loaded Successfully!');
            setLoadItems([]);
            setSelectedUser('');
        } else {
            console.error('Server Error:', data);
            alert(`Failed to load stock: ${data.error || 'Unknown error'}`);
        }
    } catch (e) {
        console.error('Network Error:', e);
        alert('Error submitting load. Check console.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
            <Truck className="text-orange-500" /> Van Stock Loading
        </h2>

        {users.length === 0 || products.length === 0 ? (
          <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-center text-slate-300">
            <p>Loading staff and products...</p>
            {users.length === 0 && <p className="text-sm text-slate-400">Available staff: {users.length}</p>}
            {products.length === 0 && <p className="text-sm text-slate-400">Available products: {products.length}</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Selection */}
            <div>
                <label className="block text-sm text-slate-400 mb-2">Select Sales Staff</label>
                <select 
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white"
                    required
                >
                    <option value="">-- Select Staff --</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                    ))}
                </select>
            </div>

            {/* Items List */}
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-sm text-slate-400">Loading Items</label>
                    <button type="button" onClick={addItem} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        <Plus size={16} /> Add Item
                    </button>
                </div>
                
                {loadItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                        <select 
                            value={item.productId}
                            onChange={(e) => updateItem(idx, 'productId', e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white"
                        >
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <input 
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                            className="w-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-white text-center"
                        />
                        <button type="button" onClick={() => removeItem(idx)} className="p-2 text-red-400 hover:bg-slate-800 rounded">
                            <Trash2 size={18} />
                        </button>
                    </div>

                ))}
            </div>

            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                <Save size={20} /> Confirm Load
            </button>
        </form>
        )}
      </div>
    </div>
  );
}
