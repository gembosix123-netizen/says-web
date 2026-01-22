'use client';
import React, { useState, useEffect } from 'react';
import { Package, Plus, Save, Trash2, Search, Edit } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  price: number;
  code: string;
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('');
  const [isEditing, setIsEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', price: '', code: '' });

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = '/api/products';
    const method = isEditing ? 'PUT' : 'POST';
    const body = isEditing 
        ? { ...form, id: isEditing.id, price: parseFloat(form.price) }
        : { ...form, id: `p${Date.now()}`, price: parseFloat(form.price) };

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            alert(isEditing ? 'Product updated' : 'Product created');
            setIsEditing(null);
            setForm({ name: '', price: '', code: '' });
            fetchProducts();
        } else {
            alert('Failed to save product');
        }
    } catch (error) {
        console.error(error);
        alert('Error saving product');
    }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Delete this product?')) return;
      try {
          await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
          fetchProducts();
      } catch (error) {
          console.error(error);
      }
  };

  const handleEdit = (product: Product) => {
      setIsEditing(product);
      setForm({ name: product.name, price: product.price.toString(), code: product.code });
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Form Section */}
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <span className="bg-blue-500/20 text-blue-500 p-2 rounded-lg">
            {isEditing ? <Edit size={20} /> : <Plus size={20} />}
          </span>
          {isEditing ? 'Edit Product' : 'Add New Product'}
        </h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            placeholder="Product Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg"
            required
          />
          <input
            placeholder="Code (e.g. P001)"
            value={form.code}
            onChange={e => setForm({ ...form, code: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg"
            required
          />
          <input
            type="number"
            step="0.01"
            placeholder="Price (RM)"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
            className="bg-slate-950 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg"
            required
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                <Save size={18} /> {isEditing ? 'Update' : 'Save'}
            </button>
            {isEditing && (
                <button 
                    type="button" 
                    onClick={() => { setIsEditing(null); setForm({ name: '', price: '', code: '' }); }}
                    className="px-4 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                    Cancel
                </button>
            )}
          </div>
        </form>
      </div>

      {/* List Section */}
      <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="text-blue-500" /> Product List
            </h2>
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Search products..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white text-sm"
                />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map(product => (
                <div key={product.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex justify-between items-center group hover:bg-slate-800/60 transition-all">
                    <div>
                        <h3 className="font-bold text-white">{product.name}</h3>
                        <p className="text-xs text-slate-400">Code: {product.code}</p>
                        <p className="text-blue-400 font-bold mt-1">RM {product.price.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(product)} className="p-2 text-blue-400 hover:bg-blue-900/20 rounded-lg">
                            <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
