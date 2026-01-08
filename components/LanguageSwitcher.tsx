"use client";

import React from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Globe } from '@/components/Icons';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'ms' ? 'en' : 'ms')}
      className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm active:scale-95 transition-all hover:bg-slate-50"
      title="Switch Language"
    >
      <Globe size={18} className="text-blue-600" />
      <span className="text-sm font-bold text-slate-800">{lang === 'ms' ? 'BM' : 'EN'}</span>
    </button>
  );
}
