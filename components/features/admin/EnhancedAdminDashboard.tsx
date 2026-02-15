'use client';

import React, { useState, useEffect } from 'react';
import { LayoutGrid, Users, Package, BarChart3 } from 'lucide-react';
import clsx from 'clsx';
import OverviewDashboard from './OverviewDashboard';
import StaffManagement from './StaffManagement';
import InventoryManagement from './InventoryManagement';

type DashboardSection = 'overview' | 'staff' | 'inventory';

interface EnhancedAdminDashboardProps {
  userRole?: string;
}

export default function EnhancedAdminDashboard({ userRole = 'Main Admin' }: EnhancedAdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');

  const sections = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutGrid,
      description: 'Sales metrics and performance KPIs',
    },
    {
      id: 'staff',
      label: 'Staff Management',
      icon: Users,
      description: 'Manage team members and roles',
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Package,
      description: 'Track stock levels and alerts',
    },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewDashboard />;
      case 'staff':
        return <StaffManagement userRole={userRole} />;
      case 'inventory':
        return <InventoryManagement />;
      default:
        return <OverviewDashboard />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Navigation Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as DashboardSection)}
              className={clsx(
                'p-6 rounded-2xl border transition-all duration-300 text-left group',
                isActive
                  ? 'border-says-accent bg-gradient-to-br from-red-900/20 to-red-900/10 shadow-glass-accent'
                  : 'border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 hover:border-slate-600'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon
                  size={24}
                  className={clsx(
                    'transition-colors duration-200',
                    isActive ? 'text-says-accent' : 'text-slate-400 group-hover:text-slate-300'
                  )}
                />
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-says-accent" />
                )}
              </div>
              <h3 className={clsx('font-semibold mb-1', isActive ? 'text-white' : 'text-slate-300')}>
                {section.label}
              </h3>
              <p className="text-sm text-slate-500">{section.description}</p>
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="animate-fade-in">{renderSection()}</div>
    </div>
  );
}
