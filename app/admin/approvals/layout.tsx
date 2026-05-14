import React from 'react';

/**
 * Layout khusus pusat kelulusan HQ — berasingan daripada halaman laporan penuh.
 * Tiada tab Daily/Weekly/Monthly di sini; hanya aliran kelulusan yang diperlukan Main Admin.
 */
export default function HqApprovalsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative -mx-4 lg:-mx-8 px-4 lg:px-8 py-6 min-h-[50vh]">
      <div
        className="absolute left-4 right-4 lg:left-8 lg:right-8 top-0 h-1 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-500/90 opacity-90 pointer-events-none"
        aria-hidden
      />
      <div className="max-w-5xl mx-auto pt-3 space-y-8">{children}</div>
    </div>
  );
}
