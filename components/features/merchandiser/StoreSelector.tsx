'use client';

import React from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, Store } from 'lucide-react';

export function StoreSelector() {
  const { allowedCustomers, setSelectedCustomer, setStep } = useMerchandiser();
  const [search, setSearch] = React.useState('');

  const filteredCustomers = allowedCustomers.filter((customer) =>
    customer.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setStep(2); // Move to check-in step
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Select Store to Visit</h2>
        <p className="text-slate-400">Choose a store from your assigned list</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={20} />
        <Input
          type="text"
          placeholder="Search store name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Store List */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-white/40">
            No stores found. Contact your admin to assign stores.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleSelect(customer)}
              className="cursor-pointer"
            >
              <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Store className="text-blue-400" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white text-lg">{customer.name}</h3>
                  {customer.address && (
                    <p className="text-sm text-slate-300 mt-1">{customer.address}</p>

                  )}
                  {customer.branch && (
                   <p className="text-xs text-slate-400 mt-2">Branch: {customer.branch}</p>
                  )}
                </div>
                <Button variant="secondary" size="sm">
                  Visit
                </Button>
              </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
