"use client";

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'ms' ? 'en' : 'ms')}
      className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-900 dark:text-white"
      title={`Switch Language: ${lang === 'ms' ? 'English' : 'Bahasa Malaysia'}`}
      aria-label="Toggle language"
    >
      <Globe size={18} className="text-blue-600 dark:text-blue-400" />
      <span className="text-sm font-bold">{lang === 'ms' ? 'BM' : 'EN'}</span>
    </button>
  );
}
