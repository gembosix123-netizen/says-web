'use client';

import React from 'react';

type SidebarHeaderProps = {
  logoSrc?: string;
  logoAlt?: string;
  className?: string;
};

const DEFAULT_LOGO = '/unnamed.png';

export default function SidebarHeader({
  logoSrc = DEFAULT_LOGO,
  logoAlt = "Yanong's Logo",
  className = '',
}: SidebarHeaderProps) {
  return (
    <div className={`pt-8 pb-6 px-4 flex items-center justify-center border-b border-white/10 ${className}`}>
      <div className="w-full flex items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-3">
        <img
          src={logoSrc}
          alt={logoAlt}
          draggable={false}
          className="h-12 w-20 rounded-full object-cover select-none ring-1 ring-white/10 shadow-md shadow-black/40"
        />
      </div>
    </div>
  );
}
