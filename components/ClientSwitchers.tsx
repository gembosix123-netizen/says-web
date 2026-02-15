'use client';

import { useEffect, useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';

export default function ClientSwitchers() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 w-[102px] h-10" />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher />
      <ThemeSwitcher />
    </div>
  );
}
