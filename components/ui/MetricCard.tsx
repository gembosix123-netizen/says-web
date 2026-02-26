'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
  };
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
  isLoading?: boolean;
}

export default function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  status = 'neutral',
  onClick,
  isLoading = false,
}: MetricCardProps) {
  const statusColors = {
    success: 'border-emerald-500/35 bg-gradient-to-br from-emerald-500/20 to-emerald-900/20',
    warning: 'border-amber-500/35 bg-gradient-to-br from-amber-500/20 to-amber-900/20',
    danger: 'border-rose-500/35 bg-gradient-to-br from-rose-500/20 to-rose-900/20',
    neutral: 'border-blue-500/25 bg-gradient-to-br from-blue-500/15 to-slate-900/55',
  };

  const iconContainerColors = {
    success: 'bg-emerald-500/25 border border-emerald-400/30',
    warning: 'bg-amber-500/25 border border-amber-400/30',
    danger: 'bg-rose-500/25 border border-rose-400/30',
    neutral: 'bg-blue-500/25 border border-blue-400/30',
  };

  const iconColors = {
    success: 'text-emerald-300',
    warning: 'text-amber-300',
    danger: 'text-rose-300',
    neutral: 'text-blue-300',
  };

  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative p-6 rounded-2xl border backdrop-blur-glass transition-all duration-300 overflow-hidden group',
        statusColors[status],
        onClick && 'cursor-pointer hover:border-slate-600 hover:-translate-y-1 hover:shadow-glass'
      )}
    >
      {/* Glassmorphism effect background */}
      <div className="absolute inset-0 bg-glass-effect pointer-events-none" />

      {/* Gradient accent on hover */}
      <div className="absolute -inset-1 bg-gradient-accent opacity-0 group-hover:opacity-5 blur transition-opacity duration-300 -z-10" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-400 mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              {isLoading ? (
                <div className="h-8 w-24 bg-slate-700/50 rounded animate-pulse" />
              ) : (
                <>
                  <span className="text-3xl font-bold text-white">{value}</span>
                  {unit && <span className="text-sm text-slate-500">{unit}</span>}
                </>
              )}
            </div>
          </div>

          {Icon && (
            <div className={clsx('p-3 rounded-xl transition-colors duration-200', iconContainerColors[status])}>
              <Icon size={24} className={iconColors[status]} />
            </div>
          )}
        </div>

        {/* Trend */}
        {trend && (
          <div className={clsx('flex items-center gap-1 text-sm font-medium', trendColors[trend.direction])}>
            <span>{trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '–'}</span>
            <span>{Math.abs(trend.percentage)}%</span>
          </div>
        )}
      </div>

      {/* Hover border glow effect */}
      <div className="absolute inset-0 rounded-2xl border border-says-accent/0 group-hover:border-says-accent/30 transition-all duration-300 pointer-events-none" />
    </div>
  );
}
