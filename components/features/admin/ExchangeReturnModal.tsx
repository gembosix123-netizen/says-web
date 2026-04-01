'use client';

import { useState } from 'react';
import { X, Package, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ExchangeReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  saleData?: {
    id: string;
    invoice?: string;
    items: Array<{
      id: string;
      name?: string;
      product_name?: string;
      quantity: number;
    }>;
  };
}

export default function ExchangeReturnModal({ isOpen, onClose, onSuccess, saleData }: ExchangeReturnModalProps) {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [type, setType] = useState<'exchange' | 'return' | 'disposal'>('return');
  const [reason, setReason] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [notes, setNotes] = useState('');
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofPreviews, setProofPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleProofFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setProofFiles((prev) => [...prev, ...files]);
    const previews = files.map((file) => URL.createObjectURL(file));
    setProofPreviews((prev) => [...prev, ...previews]);

    event.currentTarget.value = '';
  };

  const removeProofAt = (index: number) => {
    setProofFiles((prev) => prev.filter((_, i) => i !== index));
    setProofPreviews((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadProofImages = async (files: File[]) => {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filename = `exchange-returns/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('sales-receipts')
        .upload(filename, file, { contentType: file.type || 'image/jpeg', upsert: false });

      if (uploadError) {
        throw new Error(`Gagal upload gambar bukti: ${uploadError.message}`);
      }

      const { data } = supabase.storage.from('sales-receipts').getPublicUrl(filename);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const selectedItem = saleData?.items.find(item => item.id === selectedProduct);
    if (!selectedItem) {
      setError('Please select a product');
      setLoading(false);
      return;
    }

    try {
      if (proofFiles.length === 0) {
        throw new Error('Gambar bukti wajib. Sila snap atau pilih sekurang-kurangnya satu gambar.');
      }

      const proofPhotoUrls = await uploadProofImages(proofFiles);

      const response = await fetch('/api/exchange-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sale_id: saleData?.id,
          invoice: saleData?.invoice,
          product_id: selectedProduct,
          product_name: selectedItem.name || selectedItem.product_name || 'Unknown Product',
          quantity: Number(quantity),
          type,
          reason,
          reason_details: reasonDetails || undefined,
          notes: notes || undefined,
          proof_photo_urls: proofPhotoUrls,
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create request');
      }

      onSuccess();
      onClose();
      
      // Reset form
      setSelectedProduct('');
      setQuantity(1);
      setReason('');
      setReasonDetails('');
      setNotes('');
      proofPreviews.forEach((url) => URL.revokeObjectURL(url));
      setProofFiles([]);
      setProofPreviews([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reasonOptions = {
    exchange: ['wrong_item', 'customer_request', 'defective'],
    return: ['damaged', 'expired', 'wrong_item', 'customer_request', 'quality_issue', 'overstock'],
    disposal: ['damaged', 'expired', 'contaminated', 'recalled']
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Package className="text-orange-500" size={24} />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {type === 'exchange' ? 'Exchange' : type === 'return' ? 'Return' : 'Disposal'} Request
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as any);
                setReason(''); // Reset reason when type changes
              }}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
            >
              <option value="return">Return (Refund)</option>
              <option value="exchange">Exchange (Swap Product)</option>
              <option value="disposal">Disposal (Damaged/Expired)</option>
            </select>
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              required
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">Select product...</option>
              {saleData?.items.map((item, idx) => (
                <option key={idx} value={item.id}>
                  {item.name || item.product_name || item.id} (Max: {item.quantity})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              max={saleData?.items.find(item => item.id === selectedProduct)?.quantity || 1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">Select reason...</option>
              {reasonOptions[type].map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {/* Reason Details */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Details (Optional)
            </label>
            <textarea
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              rows={2}
              placeholder="Additional details about the reason..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
            />
          </div>

          {/* Proof Photos */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Gambar Bukti (Wajib)
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleProofFiles}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
            />
            {proofPreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {proofPreviews.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative">
                    <img src={url} alt={`proof-${idx}`} className="w-full h-20 object-cover rounded border border-slate-300 dark:border-slate-700" />
                    <button
                      type="button"
                      onClick={() => removeProofAt(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none"
                      aria-label="Padam gambar"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Snap gambar terus dari kamera atau pilih dari galeri. Sekurang-kurangnya 1 gambar diperlukan.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
