import type { PayStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';

const OPTIONS: { value: PayStatus; labelKey: string; activeClass: string }[] = [
  { value: 'full', labelKey: 'status.full', activeClass: 'bg-brand-green text-white border-brand-green' },
  { value: 'partial', labelKey: 'status.partial', activeClass: 'bg-brand-amber text-white border-brand-amber' },
  { value: 'none', labelKey: 'status.none', activeClass: 'bg-brand-red text-white border-brand-red' },
];

interface PayChipsProps {
  value: PayStatus;
  onChange: (value: PayStatus) => void;
}

export function PayChips({ value, onChange }: PayChipsProps) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            value === opt.value ? opt.activeClass : 'border-gray-3 text-gray hover:bg-gray-4'
          }`}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}
