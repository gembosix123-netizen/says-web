'use client';
import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export type DateRange = {
  start: string; // YYYY-MM-DD  (empty string = no filter)
  end: string;   // YYYY-MM-DD
};

function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(d);
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type Preset = {
  label: string;
  getValue: () => DateRange;
};

const PRESETS: Preset[] = [
  { label: 'Today',        getValue: () => ({ start: today(),        end: today() }) },
  { label: 'Last 7 Days',  getValue: () => ({ start: daysAgo(6),     end: today() }) },
  { label: 'Last 30 Days', getValue: () => ({ start: daysAgo(29),    end: today() }) },
  { label: 'This Month',   getValue: () => ({ start: startOfMonth(), end: today() }) },
  { label: 'All Time',     getValue: () => ({ start: '',             end: ''      }) },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Light-mode friendly labels (used inside AnalyticsDashboard) */
  lightMode?: boolean;
}

export default function DateRangePicker({ value, onChange, lightMode = false }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('This Month');

  function handlePreset(preset: Preset) {
    setActivePreset(preset.label);
    setShowCustom(false);
    onChange(preset.getValue());
  }

  function handleCustomToggle() {
    setShowCustom(prev => !prev);
    setActivePreset('Custom');
  }

  const baseBtn = lightMode
    ? 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700';

  const activeBtn = 'bg-blue-600 text-white border-blue-600 dark:border-blue-600';

  const inputClass = lightMode
    ? 'bg-white text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500'
    : 'bg-slate-800 text-white border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar size={14} className={lightMode ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'} />
      <span className={`text-xs font-medium ${lightMode ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
        Date Range:
      </span>

      {PRESETS.map(preset => (
        <button
          key={preset.label}
          onClick={() => handlePreset(preset)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            activePreset === preset.label ? activeBtn : baseBtn
          }`}
        >
          {preset.label}
        </button>
      ))}

      <button
        onClick={handleCustomToggle}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1 ${
          activePreset === 'Custom' ? activeBtn : baseBtn
        }`}
      >
        Custom <ChevronDown size={12} />
      </button>

      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className={inputClass}
          />
          <span className={`text-xs ${lightMode ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400'}`}>to</span>
          <input
            type="date"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className={inputClass}
          />
        </div>
      )}

      {/* Active range display */}
      {(value.start || value.end) && activePreset !== 'All Time' && (
        <span className={`text-xs ${lightMode ? 'text-slate-500 dark:text-slate-400' : 'text-slate-500'}`}>
          {value.start && value.end && value.start !== value.end
            ? `${value.start} → ${value.end}`
            : value.start === value.end
            ? value.start
            : value.start || value.end}
        </span>
      )}
    </div>
  );
}
