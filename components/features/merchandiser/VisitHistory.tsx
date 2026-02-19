'use client';

import React, { useState } from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, CheckCircle, Clock, XCircle, Calendar, Store } from 'lucide-react';

export function VisitHistory() {
  const { visits, loading } = useMerchandiser();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'in-progress' | 'cancelled'>('all');

  const filteredVisits = visits.filter((visit) => {
    const matchesSearch = visit.customer?.name.toLowerCase().includes(search.toLowerCase()) || false;
    const matchesStatus = filterStatus === 'all' || visit.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle size={12} />
            Completed
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Clock size={12} />
            In Progress
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/20">
            <XCircle size={12} />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border bg-gray-500/10 text-gray-400 border-gray-500/20">
            {status}
          </span>
        );
    }
  };

  const calculateDuration = (checkIn: string, checkOut?: string | null) => {
    if (!checkOut) return 'Ongoing';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Visit History</h2>
        <p className="text-white/60">View all your previous store visits</p>
      </div>

      {/* Filters */}
      <div className="space-y-4">
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

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={filterStatus === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'completed' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterStatus('completed')}
          >
            Completed
          </Button>
          <Button
            variant={filterStatus === 'in-progress' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterStatus('in-progress')}
          >
            In Progress
          </Button>
          <Button
            variant={filterStatus === 'cancelled' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilterStatus('cancelled')}
          >
            Cancelled
          </Button>
        </div>
      </div>

      {/* Visit List */}
      {filteredVisits.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-white/40">
            <Store size={48} className="mx-auto mb-4 opacity-20" />
            <p>No visits found</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredVisits.map((visit) => (
            <Card key={visit.id} className="hover:bg-white/10 transition-colors">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-lg">
                      {visit.customer?.name || 'Unknown Store'}
                    </h3>
                    {visit.customer?.address && (
                      <p className="text-sm text-white/60 mt-1">{visit.customer.address}</p>
                    )}
                  </div>
                  {getStatusBadge(visit.status)}
                </div>

                {/* Visit Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-white/60 text-xs mb-1 flex items-center gap-1">
                      <Calendar size={12} />
                      Date
                    </div>
                    <div className="text-white">
                      {new Date(visit.check_in_time).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs mb-1 flex items-center gap-1">
                      <Clock size={12} />
                      Check-in
                    </div>
                    <div className="text-white">
                      {new Date(visit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs mb-1">Duration</div>
                    <div className="text-white">
                      {calculateDuration(visit.check_in_time, visit.check_out_time)}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs mb-1">Photos</div>
                    <div className="text-white">
                      {visit.photo_urls?.length || 0}
                    </div>
                  </div>
                </div>

                {/* Staff Info */}
                {visit.staff_name && (
                  <div className="pt-3 border-t border-white/10">
                    <div className="text-xs text-white/60">
                      Staff: <span className="text-white">{visit.staff_name}</span>
                      {visit.staff_contact && <span className="ml-3">({visit.staff_contact})</span>}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {visit.notes && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-white/60 mb-1">Notes:</div>
                    <div className="text-sm text-white">{visit.notes}</div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
