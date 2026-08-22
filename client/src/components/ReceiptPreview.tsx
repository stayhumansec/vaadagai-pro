import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { ReceiptCard } from './ReceiptCard';
import type { EBReading, House, RentRecord } from '../types';
import { mlabel } from '../utils';
import { shareImageViaWhatsApp } from '../lib/whatsappShare';
import { useToast } from './Toast';
import { useLanguage } from '../context/LanguageContext';

interface ReceiptPreviewProps {
  house: House;
  record: RentRecord;
  ebReading?: EBReading | null;
  showPrint?: boolean;
  showDownload?: boolean;
  showShare?: boolean;
}

export function ReceiptPreview({ house, record, ebReading, showPrint, showDownload, showShare = true }: ReceiptPreviewProps) {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const receiptRef = useRef<HTMLDivElement>(null);

  const rasterize = () => {
    if (!receiptRef.current) return null;
    return html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#fff' });
  };

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    const canvas = await rasterize();
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `receipt_${record.month}_house${house.id}.png`;
    a.click();
  };

  const handleShare = async () => {
    try {
      const canvas = await rasterize();
      if (!canvas) return;
      const caption = `${t('receipt.title')} — ${t('common.house')} ${house.id} — ${mlabel(record.month, language)}`;
      const result = await shareImageViaWhatsApp(canvas, `receipt_${record.month}_house${house.id}.png`, caption, house.phone);
      if (result === 'fallback') showToast(t('receipt.shareFallbackHint'), 'warn');
    } catch {
      showToast(t('receipt.shareFailed'), 'err');
    }
  };

  return (
    <>
      <div className="flex justify-center">
        <ReceiptCard ref={receiptRef} house={house} record={record} ebReading={ebReading} />
      </div>
      {(showPrint || showDownload || showShare) && (
        <div className="mt-4 flex justify-center gap-2">
          {showPrint && (
            <button type="button" onClick={handlePrint} className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm hover:bg-gray-4">
              🖨️ {t('common.print')}
            </button>
          )}
          {showDownload && (
            <button type="button" onClick={handleDownload} className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white hover:opacity-90">
              {t('receipt.downloadImage')}
            </button>
          )}
          {showShare && (
            <button type="button" onClick={handleShare} className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-4 py-2 text-sm text-white hover:opacity-90">
              💬 {t('receipt.shareWhatsApp')}
            </button>
          )}
        </div>
      )}
    </>
  );
}
