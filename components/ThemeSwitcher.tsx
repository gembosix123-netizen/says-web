"use client";

import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? (
        <Moon size={20} className="text-slate-700 dark:text-slate-200" />
      ) : (
        <Sun size={20} className="text-yellow-400" />
      )}
    </button>
  );
}
