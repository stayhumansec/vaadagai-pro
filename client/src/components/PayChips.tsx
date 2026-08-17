import type { PayStatus } from '../types';

const OPTIONS: { value: PayStatus; label: string; activeClass: string }[] = [
  { value: 'full', label: '✅ முழுமையாக', activeClass: 'bg-brand-green text-white border-brand-green' },
  { value: 'partial', label: '⚡ பகுதியாக', activeClass: 'bg-brand-amber text-white border-brand-amber' },
  { value: 'none', label: '❌ இல்லை', activeClass: 'bg-brand-red text-white border-brand-red' },
];

interface PayChipsProps {
  value: PayStatus;
  onChange: (value: PayStatus) => void;
}

export function PayChips({ value, onChange }: PayChipsProps) {
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
          {opt.label}
        </button>
      ))}
    </div>
  );
}
