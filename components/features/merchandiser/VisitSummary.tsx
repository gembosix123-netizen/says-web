'use client';

import React, { useState } from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { CheckCircle, MapPin, User, Package, Camera, Loader, AlertTriangle } from 'lucide-react';

export function VisitSummary() {
  const {
    selectedCustomer,
    currentVisit,
    checkInTime,
    staffName,
    staffContact,
    auditItems,
    photos,
    completeVisit,
    resetVisitProcess,
  } = useMerchandiser();

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const totalProducts = auditItems.length;
  const totalExpired = auditItems.reduce((sum, item) => sum + item.expired_stock, 0);
  const totalDamaged = auditItems.reduce((sum, item) => sum + item.damaged_stock, 0);
  const totalIssues = totalExpired + totalDamaged;

  const handleComplete = async () => {
    if (!currentVisit) {
      alert('No active visit');
      return;
    }

    setLoading(true);

    const success = await completeVisit();

    if (success) {
      try {
        const rawUser = localStorage.getItem('user');
        const user = rawUser ? JSON.parse(rawUser) : {};
        const reportPayload = {
          date: new Date().toISOString().slice(0, 10),
          userId: user?.id || '',
          userName: user?.name || user?.username || 'Merchandiser',
          branch: user?.branch || 'HQ',
          totalSales: 0,
          totalCash: 0,
          totalCredit: 0,
          source: 'merch',
          status: 'submitted',
        };

        const checkParams = new URLSearchParams({
          date: reportPayload.date,
          userId: reportPayload.userId,
        });
        const checkRes = await fetch(`/api/daily-reports?${checkParams.toString()}`);
        const checkData = await checkRes.json().catch(() => ({}));
        const existingReports = Array.isArray(checkData?.reports) ? checkData.reports : [];

        if (existingReports.length === 0) {
          await fetch('/api/daily-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportPayload),
          });
          setSubmitMessage('Laporan merch berjaya dihantar kepada admin untuk semakan.');
        } else {
          setSubmitMessage('Laporan merch untuk hari ini sudah pernah dihantar.');
        }
      } catch (error) {
        console.error('Failed to submit merch report:', error);
        setSubmitMessage('Visit selesai, tetapi submit laporan kepada admin gagal.');
      }
    }

    setLoading(false);

    if (success) {
      setCompleted(true);
    }
  };

  const handleDone = () => {
    resetVisitProcess();
    router.push('/merchandiser');
  };

  if (completed) {
    return (
      <div className="space-y-6">
        <Card className="text-center py-12">
          <div className="inline-flex p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <CheckCircle size={48} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Visit Completed!</h2>
          <p className="text-white/60 mb-6">
            Your store visit and audit have been successfully recorded.
          </p>
          {submitMessage && (
            <p className="text-sm text-emerald-300 mb-4">{submitMessage}</p>
          )}
          <Button onClick={handleDone} variant="primary" size="lg">
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Visit Summary</h2>
        <p className="text-white/60">Review your visit details before submitting</p>
      </div>

      {/* Store & Visit Info */}
      <Card>
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <MapPin size={20} />
          Store & Visit Information
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Store:</span>
            <span className="text-white font-medium">{selectedCustomer?.name}</span>
          </div>
          {selectedCustomer?.address && (
            <div className="flex justify-between">
              <span className="text-white/60">Address:</span>
              <span className="text-white text-right">{selectedCustomer.address}</span>
            </div>
          )}
          {checkInTime && (
            <div className="flex justify-between">
              <span className="text-white/60">Check-in Time:</span>
              <span className="text-white">{checkInTime.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Staff Info */}
      <Card>
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <User size={20} />
          Staff Information
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Staff Name:</span>
            <span className="text-white font-medium">{staffName || 'N/A'}</span>
          </div>
          {staffContact && (
            <div className="flex justify-between">
              <span className="text-white/60">Contact:</span>
              <span className="text-white">{staffContact}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Audit Summary */}
      <Card>
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Package size={20} />
          Audit Summary
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="text-2xl font-bold text-white">{totalProducts}</div>
            <div className="text-xs text-white/60 mt-1">Products Audited</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
            <div className={`text-2xl font-bold ${totalIssues > 0 ? 'text-amber-400' : 'text-white'}`}>
              {totalIssues}
            </div>
            <div className="text-xs text-white/60 mt-1">Issues Found</div>
          </div>
        </div>

        {totalIssues > 0 && (
          <div className="space-y-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <AlertTriangle size={16} />
              Issues Breakdown
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Expired:</span>
                <span className="text-white font-medium">{totalExpired}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Damaged:</span>
                <span className="text-white font-medium">{totalDamaged}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Photos */}
      <Card>
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Camera size={20} />
          Photos
        </h3>
        {photos.length > 0 ? (
          <div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {photos.slice(0, 4).map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-20 object-cover rounded-lg"
                />
              ))}
            </div>
            <p className="text-sm text-white/60">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} attached
            </p>
          </div>
        ) : (
          <p className="text-sm text-white/40">No photos attached</p>
        )}
      </Card>

      {/* Complete Button */}
      <Button
        onClick={handleComplete}
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader className="animate-spin mr-2" size={20} />
            Completing Visit...
          </>
        ) : (
          <>
            <CheckCircle className="mr-2" size={20} />
            Complete Visit
          </>
        )}
      </Button>
    </div>
  );
}
