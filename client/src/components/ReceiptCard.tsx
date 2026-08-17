import { forwardRef } from 'react';
import type { EBReading, House, RentRecord } from '../types';
import { fmt, mlabel } from '../utils';
import { useLanguage } from '../context/LanguageContext';

interface ReceiptCardProps {
  house: House;
  record: RentRecord;
  ebReading?: EBReading | null;
}

export const ReceiptCard = forwardRef<HTMLDivElement, ReceiptCardProps>(function ReceiptCard(
  { house, record, ebReading },
  ref
) {
  const { t, language } = useLanguage();
  return (
    <div ref={ref} className="w-[320px] bg-white p-5 font-mono text-sm text-navy">
      <p className="text-center text-base">{t('receipt.title')}</p>
      <p className="mt-2 text-center font-semibold">{house.name}</p>
      <p className="text-center text-gray">
        {t('common.house')} {house.id} · {mlabel(record.month, language)}
      </p>

      <div className="my-2 border-t border-dashed border-gray-3" />

      <div className="flex justify-between">
        <span>{t('common.rent')}</span>
        <span>{fmt(record.rent)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t('common.water')}</span>
        <span>{fmt(record.water)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t('common.eb')}</span>
        <span>{fmt(record.eb)}</span>
      </div>
      {ebReading && (
        <div className="ml-2 flex justify-between text-xs text-gray">
          <span>{t('receipt.readings')} {ebReading.start_reading} → {ebReading.end_reading}</span>
          <span>{ebReading.units} {t('common.units')}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>{t('common.maintenance')}</span>
        <span>{fmt(record.maintenance)}</span>
      </div>
      {record.mun_bakki > 0 && (
        <div className="flex justify-between text-brand-orange">
          <span>📌 {t('common.prevBalance')}</span>
          <span>{fmt(record.mun_bakki)}</span>
        </div>
      )}

      <div className="my-2 border-t border-dashed border-gray-3" />

      <div className="flex justify-between font-semibold">
        <span>{t('common.total')}</span>
        <span>{fmt(record.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t('common.collected')}</span>
        <span>{fmt(record.received)}</span>
      </div>

      <div className="my-2 border-t border-dashed border-gray-3" />

      <div className="flex justify-between font-semibold text-brand-red">
        <span>{t('common.balance')}</span>
        <span>{fmt(record.balance)}</span>
      </div>

      <div className="my-2 border-t border-dashed border-gray-3" />

      <p className="text-center text-xs text-gray">
        {t('receipt.thanks')} | {new Date().toLocaleDateString('en-IN')}
      </p>
    </div>
  );
});
