'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  Search,
  ShoppingCart,
  Check,
  User,
  Package
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function NewSalePage() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Select Customer, 2: Add Products, 3: Payment
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [customersRes, productsRes] = await Promise.all([
        fetch('/api/customers').then(res => res.json()),
        fetch('/api/products').then(res => res.json())
      ]);

      if (Array.isArray(customersRes)) setCustomers(customersRes);
      if (Array.isArray(productsRes)) setProducts(productsRes);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
    c.phone?.includes(searchCustomer)
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchProduct.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleSubmit = async () => {
    if (!selectedCustomer || cart.length === 0) return;

    setSubmitting(true);
    try {
      const salePayload = {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        return_amount: 0,
        exchange_amount: 0,
        foc_amount: 0,
        items: cart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
          subtotal: item.product.price * item.quantity,
          unit: 'unit',
          discount: 0,
          type: 'sale' as const
        }))
      };

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(salePayload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = Array.isArray(result?.details)
          ? result.details.join(', ')
          : result?.details;
        throw new Error(details || result?.error || 'Ralat semasa menyimpan jualan');
      }

      // Show success and redirect
      alert('Jualan berjaya disimpan! Anda akan kembali ke halaman Sales.');

      // Reset local wizard state immediately (fallback if redirect is delayed)
      setStep(1);
      setSelectedCustomer(null);
      setCart([]);
      setSearchCustomer('');
      setSearchProduct('');
      setPaymentMethod('cash');

      // Redirect to sales landing page
      router.replace('/sales');
    } catch (err: unknown) {
      console.error('Error creating sale:', err);
      const message = err instanceof Error ? err.message : 'Ralat semasa menyimpan jualan';
      alert(`Ralat semasa menyimpan jualan: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Memuatkan...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/sales')}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Jualan Baru</h1>
            <p className="text-white/60">Langkah {step} daripada 3</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                  step >= s 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-slate-700 text-white/40'
                }`}
              >
                {step > s ? <Check size={20} /> : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-1 rounded ${step > s ? 'bg-blue-500' : 'bg-slate-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Step 1: Select Customer */}
            {step === 1 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <User className="text-blue-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Pilih Pelanggan</h2>
                </div>
                
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="text"
                    placeholder="Cari pelanggan..."
                    value={searchCustomer}
                    onChange={(e) => setSearchCustomer(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedCustomer?.id === customer.id
                          ? 'bg-blue-500/20 border-2 border-blue-500'
                          : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
                      }`}
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <p className="font-semibold text-white">{customer.name}</p>
                      <p className="text-white/60 text-sm">{customer.phone}</p>
                      {customer.address && (
                        <p className="text-white/40 text-sm mt-1">{customer.address}</p>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full mt-4"
                  disabled={!selectedCustomer}
                  onClick={() => setStep(2)}
                >
                  Seterusnya
                </Button>
              </Card>
            )}

            {/* Step 2: Add Products */}
            {step === 2 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="text-purple-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Tambah Produk</h2>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-purple-500/50 transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-white">{product.name}</p>
                          <p className="text-purple-400 font-bold">RM {product.price?.toFixed(2)}</p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => addToCart(product)}
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                      <p className="text-white/40 text-xs">Stok: {product.stock || 0}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    disabled={cart.length === 0}
                    onClick={() => setStep(3)}
                  >
                    Seterusnya
                  </Button>
                </div>
              </Card>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <ShoppingCart className="text-emerald-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Pembayaran</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-white/60 text-sm mb-2">Kaedah Pembayaran</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['cash', 'card', 'transfer'].map((method) => (
                        <button
                          key={method}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            paymentMethod === method
                              ? 'border-emerald-500 bg-emerald-500/20 text-white'
                              : 'border-slate-700 bg-slate-800 text-white/60 hover:border-slate-600'
                          }`}
                          onClick={() => setPaymentMethod(method)}
                        >
                          {method === 'cash' && 'Tunai'}
                          {method === 'card' && 'Kad'}
                          {method === 'transfer' && 'Transfer'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-3">Ringkasan Pesanan</h3>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-white/60">
                        <span>Pelanggan:</span>
                        <span className="text-white">{selectedCustomer?.name}</span>
                      </div>
                      <div className="flex justify-between text-white/60">
                        <span>Item:</span>
                        <span className="text-white">{cart.length} produk</span>
                      </div>
                      <div className="flex justify-between text-white/60">
                        <span>Kuantiti:</span>
                        <span className="text-white">{cart.reduce((sum, i) => sum + i.quantity, 0)} unit</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-700 pt-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-white">Jumlah:</span>
                        <span className="text-emerald-400">RM {totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => setStep(2)}
                  >
                    Kembali
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? 'Menyimpan...' : 'Selesai Jualan'}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <ShoppingCart size={20} className="text-blue-400" />
                Troli ({cart.length})
              </h3>

              {cart.length === 0 ? (
                <p className="text-white/40 text-center py-8">Troli kosong</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                    {cart.map((item) => (
                      <div key={item.product.id} className="bg-slate-800 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-white text-sm">{item.product.name}</p>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-white w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-white hover:bg-slate-600"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <p className="text-blue-400 font-semibold text-sm">
                            RM {(item.product.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-700 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-white">Jumlah:</span>
                      <span className="text-emerald-400">RM {totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
