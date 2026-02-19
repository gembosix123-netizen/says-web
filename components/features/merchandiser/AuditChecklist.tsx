'use client';

import React, { useState } from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, Package, AlertTriangle } from 'lucide-react';

export function AuditChecklist() {
  const { products, auditItems, addAuditItem, updateAuditItem, setStep } = useMerchandiser();
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleInputChange = (productId: string, productName: string, field: string, value: string) => {
    const numValue = parseInt(value) || 0;
    
    const existing = auditItems.find((item) => item.product_id === productId);
    
    if (existing) {
      updateAuditItem(productId, { [field]: numValue });
    } else {
      addAuditItem({
        product_id: productId,
        product_name: productName,
        balance_stock: field === 'balance_stock' ? numValue : 0,
        expired_stock: field === 'expired_stock' ? numValue : 0,
        damaged_stock: field === 'damaged_stock' ? numValue : 0,
      });
    }
  };

  const handleNotesChange = (productId: string, productName: string, notes: string) => {
    const existing = auditItems.find((item) => item.product_id === productId);
    
    if (existing) {
      updateAuditItem(productId, { condition_notes: notes });
    } else {
      addAuditItem({
        product_id: productId,
        product_name: productName,
        balance_stock: 0,
        expired_stock: 0,
        damaged_stock: 0,
        condition_notes: notes,
      });
    }
  };

  const getItemData = (productId: string) => {
    return auditItems.find((item) => item.product_id === productId) || {
      balance_stock: 0,
      expired_stock: 0,
      damaged_stock: 0,
      condition_notes: '',
    };
  };

  const handleContinue = () => {
    if (auditItems.length === 0) {
      if (confirm('No items audited. Continue anyway?')) {
        setStep(4); // Move to photos
      }
    } else {
      setStep(4); // Move to photos
    }
  };

  const totalIssues = auditItems.reduce(
    (sum, item) => sum + item.expired_stock + item.damaged_stock,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Stock Audit</h2>
        <p className="text-white/60">Check and record stock condition for all products</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-white">{auditItems.length}</div>
          <div className="text-xs text-white/60 mt-1">Products Audited</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-amber-400">{totalIssues}</div>
          <div className="text-xs text-white/60 mt-1">Issues Found</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-white">{products.length}</div>
          <div className="text-xs text-white/60 mt-1">Total Products</div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
        <Input
          type="text"
          placeholder="Search product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Product List */}
      <div className="space-y-4">
        {filteredProducts.map((product) => {
          const itemData = getItemData(product.id);
          const hasIssues = itemData.expired_stock > 0 || itemData.damaged_stock > 0;

          return (
            <Card key={product.id} className={hasIssues ? 'border-amber-500/30' : ''}>
              <div className="space-y-4">
                {/* Product Header */}
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Package className="text-blue-400" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{product.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                      <span>SKU: {product.sku || product.id}</span>
                      <span>•</span>
                      <span>Price: RM {product.price.toFixed(2)}</span>
                    </div>
                  </div>
                  {hasIssues && (
                    <AlertTriangle className="text-amber-400" size={20} />
                  )}
                </div>

                {/* Stock Inputs */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-white/60 mb-2">Balance</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={itemData.balance_stock || ''}
                      onChange={(e) => handleInputChange(product.id, product.name, 'balance_stock', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-amber-400 mb-2">Expired</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={itemData.expired_stock || ''}
                      onChange={(e) => handleInputChange(product.id, product.name, 'expired_stock', e.target.value)}
                      className="border-amber-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-red-400 mb-2">Damaged</label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={itemData.damaged_stock || ''}
                      onChange={(e) => handleInputChange(product.id, product.name, 'damaged_stock', e.target.value)}
                      className="border-red-500/30"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs text-white/60 mb-2">Condition Notes (Optional)</label>
                  <textarea
                    placeholder="Add notes about product condition..."
                    value={itemData.condition_notes || ''}
                    onChange={(e) => handleNotesChange(product.id, product.name, e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                    rows={2}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Continue Button */}
      <Button
        onClick={handleContinue}
        variant="primary"
        size="lg"
        className="w-full"
      >
        Continue to Photos
      </Button>
    </div>
  );
}
