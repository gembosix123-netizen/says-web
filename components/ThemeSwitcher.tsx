"use client";

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon size={20} className="text-slate-600" />
      ) : (
        <Sun size={20} className="text-yellow-400" />
      )}
    </button>
  );
}
