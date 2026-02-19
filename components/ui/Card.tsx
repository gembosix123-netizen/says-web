import { cn } from '@/lib/utils';
import React from 'react';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('bg-slate-800/50 p-6 rounded-xl shadow-sm border border-slate-700', className)}>
      {children}
    </div>
  );
}
