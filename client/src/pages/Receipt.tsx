import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { HouseCard, type CardStatus } from '../components/HouseCard';
import { HouseCardSkeleton } from '../components/Skeleton';
import { Modal } from '../components/Modal';
import { ReceiptCard } from '../components/ReceiptCard';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { getEBReadings, getHouses, getRecords } from '../api';
import type { EBReading, House, RentRecord } from '../types';
import { prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

interface BulkQueueItem {
  house: House;
  record: RentRecord;
  ebReading: EBReading | null;
}

export function Receipt() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [houses, setHouses] = useState<House[]>([]);
  const [records, setRecords] = useState<Record<number, RentRecord>>({});
  const [ebReadings, setEbReadings] = useState<Record<number, EBReading>>({});
  const [loading, setLoading] = useState(true);
  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { getHouses().then(setHouses); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getRecords({ month_from: month, month_to: month }),
      getEBReadings({ year: month.slice(0, 4) }),
    ])
      .then(([recordList, ebList]) => {
        if (cancelled) return;
        const byHouse: Record<number, RentRecord> = {};
        recordList.forEach((r) => { byHouse[r.house_id] = r; });
        setRecords(byHouse);
        const ebByHouse: Record<number, EBReading> = {};
        ebList.filter((e) => e.month === month).forEach((e) => { ebByHouse[e.house_id] = e; });
        setEbReadings(ebByHouse);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [month]);

  const bulkDownload = async () => {
    const queue: BulkQueueItem[] = houses
      .filter((house) => records[house.id])
      .map((house) => ({ house, record: records[house.id], ebReading: ebReadings[house.id] ?? null }));
    if (queue.length === 0) {
      showToast(t('receipt.noRecordsForMonth'), 'warn');
      return;
    }
    bulkRefs.current = [];
    setBulkQueue(queue);
    setBulkRunning(true);
  };

  useEffect(() => {
    if (!bulkRunning || bulkQueue.length === 0) return;

    let cancelled = false;
    (async () => {
      for (let i = 0; i < bulkQueue.length; i++) {
        if (cancelled) return;
        const el = bulkRefs.current[i];
        const { house, record: r } = bulkQueue[i];
        if (!el) continue;
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff' });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `receipt_${r.month}_house${house.id}_${house.name}.png`;
        a.click();
        await new Promise((res) => setTimeout(res, 350));
      }
      if (!cancelled) {
        setBulkRunning(false);
        setBulkQueue([]);
        showToast(t('receipt.allDownloaded'), 'ok');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkRunning]);

  const selectedHouse = houses.find((h) => h.id === selectedHouseId);
  const selectedRecord = selectedHouseId ? records[selectedHouseId] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          {t('common.month')}
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
        </label>
        <button
          type="button"
          onClick={bulkDownload}
          disabled={bulkRunning}
          className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
        >
          {bulkRunning ? `${t('receipt.downloading')} (${bulkQueue.length})` : t('receipt.bulkImage')}
        </button>
      </div>

      <p className="text-sm text-gray">{t('receipt.pickHouseHint')}</p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
        {loading && houses.length === 0
          ? Array.from({ length: 15 }).map((_, i) => <HouseCardSkeleton key={i} />)
          : houses.map((house) => {
              const record = records[house.id];
              const status: CardStatus = house.status === 'Inactive' ? 'inactive' : record ? record.pay_status : 'pending';
              return (
                <HouseCard
                  key={house.id}
                  house={house}
                  status={status}
                  amount={record?.total}
                  munBakki={record?.mun_bakki}
                  onClick={() => setSelectedHouseId(house.id)}
                />
              );
            })}
      </div>
      {!loading && houses.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-3 bg-white p-8 text-center">
          <p className="text-3xl">🏠</p>
          <p className="mt-2 text-sm text-gray">{t('dashboard.noHouses')}</p>
        </div>
      )}

      {selectedHouse && (
        <Modal title={`${t('common.house')} ${selectedHouse.id} — ${selectedHouse.name}`} onClose={() => setSelectedHouseId(null)}>
          {selectedRecord ? (
            <ReceiptPreview house={selectedHouse} record={selectedRecord} ebReading={ebReadings[selectedHouse.id] ?? null} showPrint showDownload showShare />
          ) : (
            <p className="py-6 text-center text-sm text-brand-red">{t('receipt.noRecord')}</p>
          )}
        </Modal>
      )}

      <div className="fixed left-[-9999px] top-0">
        {bulkQueue.map((item, i) => (
          <ReceiptCard
            key={`${item.house.id}-${item.record.month}`}
            ref={(el) => { bulkRefs.current[i] = el; }}
            house={item.house}
            record={item.record}
            ebReading={item.ebReading}
          />
        ))}
      </div>
    </div>
  );
}
