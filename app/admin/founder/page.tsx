"use client";

import React from 'react';
import EnhancedAdminDashboard from '@/components/features/admin/EnhancedAdminDashboard';
import { DashboardProvider } from '@/context/DashboardContext';

export default function FounderAdminPage() {
  // This page is dedicated for the Main Admin / Founder role.
  // We pass a fixed `userRole` prop so Super Admin guarded actions are visible.
  return (
    <DashboardProvider>
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <EnhancedAdminDashboard userRole={"Main Admin"} />
      </div>
    </DashboardProvider>
  );
}
