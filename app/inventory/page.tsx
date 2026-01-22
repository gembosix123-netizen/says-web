'use client';

import SalesLayout from '@/components/layouts/SalesLayout';
import { Package } from 'lucide-react';
import Image from 'next/image';

export default function InventoryPage() {
  return (
    <SalesLayout>
      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
          {/* Glow Effect */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500" />
          
          <div className="flex items-center gap-6 mb-8 relative z-10">
             <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-blue-400 shadow-lg border border-white/5">
                <Package size={32} />
             </div>
             <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Inventory</h1>
                <p className="text-slate-400 mt-1">View stock levels and manage requests.</p>
             </div>
          </div>
          
          <div className="flex flex-col items-center justify-center py-16 bg-black/20 rounded-xl border border-white/5 border-dashed relative z-10">
             <div className="w-24 h-24 relative opacity-50 mb-4 grayscale hover:grayscale-0 transition-all duration-500">
                <Image 
                    src="/logo.svg" 
                    alt="Yanong's Logo" 
                    fill
                    className="object-contain"
                />
             </div>
             <h3 className="text-xl font-semibold text-white mb-2">Under Construction</h3>
             <p className="text-slate-500">This module is currently being developed.</p>
          </div>
        </div>
      </div>
    </SalesLayout>
  );
}
