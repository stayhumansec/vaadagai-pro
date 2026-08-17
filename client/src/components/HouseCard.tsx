import type { House, PayStatus } from '../types';
import { fmt } from '../utils';
import { useLanguage } from '../context/LanguageContext';

export type CardStatus = PayStatus | 'pending' | 'inactive';

const STATUS_STYLES: Record<CardStatus, { border: string; bg: string; chip: string; labelKey: string }> = {
  full: { border: 'border-brand-green', bg: 'bg-brand-green/10', chip: 'bg-brand-green text-white', labelKey: 'common.full' },
  partial: { border: 'border-brand-amber', bg: 'bg-brand-amber/10', chip: 'bg-brand-amber text-white', labelKey: 'common.partial' },
  none: { border: 'border-brand-red', bg: 'bg-brand-red/10', chip: 'bg-brand-red text-white', labelKey: 'common.none' },
  pending: { border: 'border-gray-3', bg: 'bg-white', chip: 'bg-gray-3 text-gray', labelKey: 'status.pending' },
  inactive: { border: 'border-gray-3', bg: 'bg-gray-4', chip: 'bg-gray-3 text-gray', labelKey: 'common.inactive' },
};

interface HouseCardProps {
  house: House;
  status: CardStatus;
  amount?: number;
  munBakki?: number;
  onClick?: () => void;
}

export function HouseCard({ house, status, amount, munBakki, onClick }: HouseCardProps) {
  const { t } = useLanguage();
  const style = STATUS_STYLES[status];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`relative min-w-[110px] rounded-xl border p-3 text-left transition-all duration-150 ${style.border} ${style.bg} ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'
      }`}
    >
      {!!munBakki && munBakki > 0 && (
        <span
          title={t('houseCard.munBakkiTitle')}
          className="absolute right-2 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-brand-orange"
        />
      )}
      <p className="text-xs text-gray">{t('common.house')} {house.id}</p>
      <p className="truncate text-sm font-medium text-navy">{house.name}</p>
      {amount !== undefined && <p className="mt-1 text-sm font-semibold text-navy">{fmt(amount)}</p>}
      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] ${style.chip}`}>{t(style.labelKey)}</span>
    </button>
  );
}
