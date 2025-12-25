import { cn } from '@/lib/utils';
import React from 'react';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('bg-white p-6 rounded-xl shadow-sm border border-slate-200', className)}>
      {children}
    </div>
  );
}
