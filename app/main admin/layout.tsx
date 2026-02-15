import React from 'react';

/**
 * Admin Layout (app/admin/layout.tsx)
 * Fail ini membungkus semua halaman di bawah route /admin.
 * Ia memastikan tema dan struktur asas konsisten untuk Founder/Admin.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-root-container min-h-screen bg-[#020617] selection:bg-red-500/30">
      {/* Kita tidak letak Sidebar di sini jika 'page.tsx' kau sudah mempunyai 
        logik navigasi sendiri. Tetapi jika kau mahu Sidebar itu 'kekal' 
        walaupun bertukar route (cth: /admin/users), kau boleh pindahkan 
        kod Sidebar ke sini.
      */}
      
      <section className="relative">
        {children}
      </section>

      {/* Global Styles khusus untuk Admin 
        (Contoh: Custom Scrollbar untuk tema gelap)
      */}
      <style jsx global>{`
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #020617;
        }
        ::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #ef4444;
        }
      `}</style>
    </div>
  );
}