'use client';

import React, { useState } from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MapPin, User, Phone, Loader } from 'lucide-react';

export function VisitCheckIn() {
  const {
    selectedCustomer,
    setGpsLocation,
    setCheckInTime,
    staffName,
    setStaffName,
    staffContact,
    setStaffContact,
    startVisit,
    setStep,
  } = useMerchandiser();

  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const captureGPS = () => {
    setGpsStatus('loading');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setGpsStatus('success');
        },
        (error) => {
          console.error('GPS Error:', error);
          setGpsStatus('error');
          alert('Failed to get GPS location. Please enable location services.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGpsStatus('error');
      alert('GPS not supported by your device');
    }
  };

  const handleCheckIn = async () => {
    if (!selectedCustomer) {
      alert('No store selected');
      return;
    }

    if (gpsStatus !== 'success') {
      alert('Please capture GPS location first');
      return;
    }

    if (!staffName.trim()) {
      alert('Please enter staff name');
      return;
    }

    setLoading(true);
    setCheckInTime(new Date());

    const visit = await startVisit(selectedCustomer.id);

    setLoading(false);

    if (visit) {
      setStep(3); // Move to audit step
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Check In</h2>
        <p className="text-white/60">Verify location and store details</p>
      </div>

      {/* Store Info */}
      <Card>
        <h3 className="font-semibold text-white mb-3">Store Information</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-white/60">Name: </span>
            <span className="text-white">{selectedCustomer?.name}</span>
          </div>
          {selectedCustomer?.address && (
            <div>
              <span className="text-white/60">Address: </span>
              <span className="text-white">{selectedCustomer.address}</span>
            </div>
          )}
        </div>
      </Card>

      {/* GPS Capture */}
      <Card>
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <MapPin size={20} />
          GPS Location
        </h3>
        {gpsStatus === 'idle' && (
          <Button onClick={captureGPS} variant="primary" className="w-full">
            Capture GPS Location
          </Button>
        )}
        {gpsStatus === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-4 text-white/60">
            <Loader className="animate-spin" size={20} />
            Getting location...
          </div>
        )}
        {gpsStatus === 'success' && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <MapPin size={16} />
              Location captured successfully
            </div>
          </div>
        )}
        {gpsStatus === 'error' && (
          <div className="space-y-3">
            <div className="text-center py-4 text-red-400">
              Failed to get location. Please try again.
            </div>
            <Button onClick={captureGPS} variant="secondary" className="w-full">
              Retry
            </Button>
          </div>
        )}
      </Card>

      {/* Staff Info */}
      <Card>
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <User size={20} />
          Store Staff Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">Staff Name *</label>
            <Input
              type="text"
              placeholder="Enter staff name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-2">Staff Contact (Optional)</label>
            <Input
              type="tel"
              placeholder="Enter phone number"
              value={staffContact}
              onChange={(e) => setStaffContact(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Check In Button */}
      <Button
        onClick={handleCheckIn}
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading || gpsStatus !== 'success' || !staffName.trim()}
      >
        {loading ? (
          <>
            <Loader className="animate-spin mr-2" size={20} />
            Checking In...
          </>
        ) : (
          'Start Audit'
        )}
      </Button>
    </div>
  );
}
