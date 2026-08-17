import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { ReceiptCard } from '../components/ReceiptCard';
import { getEBReadings, getHouses, getRecord, getRecords } from '../api';
import type { EBReading, House, RentRecord } from '../types';
import { todayYM } from '../utils';
import { useToast } from '../components/Toast';

interface BulkQueueItem {
  house: House;
  record: RentRecord;
  ebReading: EBReading | null;
}

export function Receipt() {
  const { showToast } = useToast();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseId, setHouseId] = useState<number | null>(null);
  const [month, setMonth] = useState(todayYM());
  const [record, setRecord] = useState<RentRecord | null | undefined>(undefined);
  const [ebReading, setEbReading] = useState<EBReading | null>(null);
  const [bulkQueue, setBulkQueue] = useState<BulkQueueItem[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const bulkRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    getHouses().then((list) => {
      setHouses(list);
      if (list.length > 0) setHouseId(list[0].id);
    });
  }, []);

  const showSingle = async () => {
    if (!houseId) return;
    try {
      const r = await getRecord(houseId, month);
      setRecord(r);
      const readings = await getEBReadings({ house_id: houseId, year: month.slice(0, 4) });
      setEbReading(readings.find((e) => e.month === month) ?? null);
    } catch {
      setRecord(null);
      setEbReading(null);
    }
  };

  const downloadSingleImage = async () => {
    if (!receiptRef.current) return;
    const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `receipt_${month}_house${houseId}.png`;
    a.click();
  };

  const printSingle = () => window.print();

  const bulkDownload = async () => {
    const [records, ebList] = await Promise.all([
      getRecords({ month_from: month, month_to: month }),
      getEBReadings({ year: month.slice(0, 4) }),
    ]);
    if (records.length === 0) {
      showToast('இந்த மாதத்திற்கு பதிவுகள் இல்லை', 'warn');
      return;
    }
    const ebMap: Record<number, EBReading> = {};
    ebList.filter((e) => e.month === month).forEach((e) => { ebMap[e.house_id] = e; });
    const queue: BulkQueueItem[] = [];
    for (const r of records) {
      const house = houses.find((h) => h.id === r.house_id);
      if (!house) continue;
      queue.push({ house, record: r, ebReading: ebMap[r.house_id] ?? null });
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
        showToast('அனைத்து ரசீதுகளும் பதிவிறக்கப்பட்டன', 'ok');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkRunning]);

  const selectedHouse = houses.find((h) => h.id === houseId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          வீடு
          <select
            value={houseId ?? ''}
            onChange={(e) => setHouseId(+e.target.value)}
            className="mt-1 block rounded-lg border border-gray-3 px-3 py-2"
          >
            {houses.map((h) => (
              <option key={h.id} value={h.id}>{h.id} — {h.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          மாதம்
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
        </label>
        <button type="button" onClick={showSingle} className="rounded-lg bg-brand-blue px-3 py-2 text-sm text-white hover:opacity-90">
          📄 தனி ரசீது
        </button>
        <button
          type="button"
          onClick={bulkDownload}
          disabled={bulkRunning}
          className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
        >
          {bulkRunning ? `பதிவிறக்குகிறது... (${bulkQueue.length})` : '🖼️ அனைத்தும் படமாக'}
        </button>
      </div>

      {record === null && <p className="text-sm text-brand-red">இந்த வீடு/மாதத்திற்கு பதிவு இல்லை.</p>}

      {record && selectedHouse && (
        <div className="rounded-xl border border-gray-3 bg-gray-4 p-6">
          <div className="flex justify-center">
            <ReceiptCard ref={receiptRef} house={selectedHouse} record={record} ebReading={ebReading} />
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={printSingle} className="rounded-lg border border-gray-3 bg-white px-4 py-2 text-sm hover:bg-gray-4">
              🖨️ அச்சிடு
            </button>
            <button type="button" onClick={downloadSingleImage} className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white hover:opacity-90">
              🖼️ படமாக பதிவிறக்கு
            </button>
          </div>
        </div>
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
