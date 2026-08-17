import { forwardRef } from 'react';
import type { EBReading, House, RentRecord } from '../types';
import { fmt, mlabel } from '../utils';

interface ReceiptCardProps {
  house: House;
  record: RentRecord;
  ebReading?: EBReading | null;
}

export const ReceiptCard = forwardRef<HTMLDivElement, ReceiptCardProps>(function ReceiptCard(
  { house, record, ebReading },
  ref
) {
  return (
    <div ref={ref} className="w-[320px] bg-white p-5 font-mono text-sm text-navy">
      <p className="text-center text-base">🏠 வாடகை ரசீது</p>
      <p className="mt-2 text-center font-semibold">{house.name}</p>
      <p className="text-center text-gray">
        வீடு {house.id} · {mlabel(record.month)}
      </p>

      <div className="my-2 border-t border-dashed border-gray-3" />

      <div className="flex justify-between">
        <span>வாடகை</span>
        <span>{fmt(record.rent)}</span>
      </div>
      <div className="flex justify-between">
        <span>தண்ணீர்</span>
        <span>{fmt(record.water)}</span>
      </div>
      <div className="flex justify-between">
        <span>மின்சாரம் (EB)</span>
        <span>{fmt(record.eb)}</span>
      </div>
      {ebReading && (
        <div className="ml-2 flex justify-between text-xs text-gray">
          <span>வாசிப்பு {ebReading.start_reading} → {ebReading.end_reading}</span>
          <span>{ebReading.units} யூனிட்</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>பராமரிப்பு</span>
        <span>{fmt(record.maintenance)}</span>
      </div>
      {record.mun_bakki > 0 && (
        <div className="flex justify-between text-brand-orange">
          <span>📌 முன் பாக்கி</span>
          <span>{fmt(record.mun_bakki)}</span>
        </div>
      )}

      <div className="my-2 border-t border-dashed border-gray-3" />

      <div className="flex justify-between font-semibold">
        <span>மொத்தம்</span>
        <span>{fmt(record.total)}</span>
      </div>
      <div className="flex justify-between">
        <span>வசூல்</span>
        <span>{fmt(record.received)}</span>
      </div>

      <div className="my-2 border-t border-dashed border-gray-3" />

      <div className="flex justify-between font-semibold text-brand-red">
        <span>இருப்பு</span>
        <span>{fmt(record.balance)}</span>
      </div>

      <div className="my-2 border-t border-dashed border-gray-3" />

      <p className="text-center text-xs text-gray">
        நன்றி! | {new Date().toLocaleDateString('en-IN')}
      </p>
    </div>
  );
});
