'use client';

import React, { createContext, useContext, useState } from 'react';

export type DashboardTab = 'overview' | 'staff' | 'inventory';

interface DashboardContextType {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isLoading, setIsLoading] = useState(false);

  return (
    <DashboardContext.Provider value={{ activeTab, setActiveTab, isLoading, setIsLoading }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
}
