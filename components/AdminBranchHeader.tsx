'use client';

import { useLanguage } from '@/context/LanguageContext';

interface AdminBranchHeaderProps {
  titleKey: string;
  subtitleKey: string;
  icon?: React.ReactNode;
  titleClassName?: string;
}

export default function AdminBranchHeader({ titleKey, subtitleKey, icon, titleClassName }: AdminBranchHeaderProps) {
  const { t } = useLanguage();
  return (
    <div className="mb-8">
      <h1 className={titleClassName ?? 'text-2xl font-bold text-slate-900 dark:text-white'}>
        {icon && <span className="inline-flex items-center gap-3">{icon}{t(titleKey)}</span>}
        {!icon && t(titleKey)}
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mt-1">{t(subtitleKey)}</p>
    </div>
  );
}
