'use client';

import React from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { Search, Store, Plus, MapPinned } from 'lucide-react';

export function StoreSelector() {
  const { allowedCustomers, setSelectedCustomer, setStep, refreshCustomers, userBranch } = useMerchandiser();
  const { addToast } = useToast();
  const [search, setSearch] = React.useState('');
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newStore, setNewStore] = React.useState({
    name: '',
    phone: '',
    address: '',
    area: '',
    mapLink: '',
    branch: userBranch || 'Kota Kinabalu',
  });

  const filteredCustomers = allowedCustomers.filter((customer) =>
    customer.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (customer: any) => {
    setSelectedCustomer(customer);
    setStep(2); // Move to check-in step
  };

  const normalizeMapLink = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const handleCreateStore = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newStore.name.trim()) {
      addToast('Store name is required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const mapLink = normalizeMapLink(newStore.mapLink);
      const formattedAddress = mapLink
        ? `${newStore.address.trim()} | Map: ${mapLink}`.trim()
        : newStore.address.trim();

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStore.name.trim(),
          phone: newStore.phone.trim(),
          address: formattedAddress,
          area: newStore.area.trim(),
          branch: newStore.branch,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const details = Array.isArray(data?.details) ? data.details.join(', ') : data?.details;
        addToast(details || data?.error || 'Failed to add new store', 'error');
        return;
      }

      addToast('New store added successfully', 'success');
      setNewStore({
        name: '',
        phone: '',
        address: '',
        area: '',
        mapLink: '',
        branch: userBranch || 'Kota Kinabalu',
      });
      setShowAddForm(false);
      await refreshCustomers();
    } catch (error) {
      console.error('Failed to create store', error);
      addToast('Error creating store', 'error');
    } finally {
      setSaving(false);
    }
  };

  const getMapLink = (address?: string) => {
    if (!address) return null;
    const match = address.match(/(https?:\/\/[^\s|]+)/i);
    return match ? match[1] : null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Select Store to Visit</h2>
        <p className="text-slate-400">Choose a store from your assigned list</p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          <Plus size={16} />
          {showAddForm ? 'Close Form' : 'Add New Store'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="bg-slate-900/70 border-slate-700">
          <form onSubmit={handleCreateStore} className="space-y-3">
            <h3 className="text-white font-semibold">New Store Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Store Name"
                value={newStore.name}
                onChange={(event) => setNewStore((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <Input
                placeholder="Phone Number"
                value={newStore.phone}
                onChange={(event) => setNewStore((prev) => ({ ...prev, phone: event.target.value }))}
              />
              <Input
                placeholder="Address"
                value={newStore.address}
                onChange={(event) => setNewStore((prev) => ({ ...prev, address: event.target.value }))}
              />
              <Input
                placeholder="Area / Kawasan (cth: Inanam, Penampang)"
                value={newStore.area}
                onChange={(event) => setNewStore((prev) => ({ ...prev, area: event.target.value }))}
                required
              />
              <Input
                placeholder="Branch (e.g. Kota Kinabalu)"
                value={newStore.branch}
                onChange={(event) => setNewStore((prev) => ({ ...prev, branch: event.target.value }))}
                required
              />
            </div>
            <Input
              placeholder="Google Maps link (optional)"
              value={newStore.mapLink}
              onChange={(event) => setNewStore((prev) => ({ ...prev, mapLink: event.target.value }))}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" size="sm" disabled={saving}>
                {saving ? 'Saving...' : 'Save Store'}
              </Button>
            </div>
          </form>
        </Card>
      )}

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
                  {getMapLink(customer.address) && (
                    <a
                      href={getMapLink(customer.address) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 mt-2 hover:text-blue-300"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MapPinned size={12} />
                      Open Map
                    </a>
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
