import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { HouseCard, type CardStatus } from '../components/HouseCard';
import { MetricCard } from '../components/MetricCard';
import { HouseCardSkeleton, MetricCardSkeleton, Skeleton } from '../components/Skeleton';
import { Reveal } from '../components/Reveal';
import { Modal } from '../components/Modal';
import { ReceiptCard } from '../components/ReceiptCard';
import { getDashboardSummary, getEBReadings, getHouses, getRecords } from '../api';
import type { DashboardSummary, EBReading, House, RentRecord } from '../types';
import { fmt, mlabel, prevYM, todayYM } from '../utils';
import { shareImageViaWhatsApp } from '../lib/whatsappShare';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

function progressColor(pct: number): string {
  if (pct >= 90) return 'from-brand-green to-emerald-400';
  if (pct >= 50) return 'from-brand-amber to-yellow-400';
  return 'from-brand-red to-rose-400';
}

export function Dashboard() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const [houses, setHouses] = useState<House[]>([]);
  const [records, setRecords] = useState<Record<number, RentRecord>>({});
  const [ebReadings, setEbReadings] = useState<Record<number, EBReading>>({});
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getHouses(),
      getRecords({ month_from: month, month_to: month }),
      getDashboardSummary(month),
      getEBReadings({ year: month.slice(0, 4) }),
    ])
      .then(([houseList, recordList, dashboardSummary, ebList]) => {
        if (cancelled) return;
        setHouses(houseList);
        const byHouse: Record<number, RentRecord> = {};
        recordList.forEach((r) => { byHouse[r.house_id] = r; });
        setRecords(byHouse);
        const ebByHouse: Record<number, EBReading> = {};
        ebList.filter((e) => e.month === month).forEach((e) => { ebByHouse[e.house_id] = e; });
        setEbReadings(ebByHouse);
        setSummary(dashboardSummary);
        setConnected(true);
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [month]);

  const efficiency = summary && summary.billed > 0 ? Math.round((summary.collected / summary.billed) * 100) : 0;

  const dueHouses = houses.filter((h) => {
    if (h.status !== 'Active') return false;
    const record = records[h.id];
    return !record || record.pay_status !== 'full';
  });

  const selectedHouse = houses.find((h) => h.id === selectedHouseId);
  const selectedRecord = selectedHouseId ? records[selectedHouseId] : undefined;

  const shareReceipt = async () => {
    if (!receiptRef.current || !selectedHouse) return;
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#fff' });
      const caption = `${t('receipt.title')} — ${t('common.house')} ${selectedHouse.id} — ${mlabel(month, language)}`;
      const result = await shareImageViaWhatsApp(canvas, `receipt_${month}_house${selectedHouse.id}.png`, caption, selectedHouse.phone);
      if (result === 'fallback') showToast(t('receipt.shareFallbackHint'), 'warn');
    } catch {
      showToast(t('receipt.shareFailed'), 'err');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-3/70 bg-white px-4 py-3 text-sm shadow-soft">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-3 px-3 py-1.5 text-sm"
        />
        <span className="flex items-center gap-1 text-gray">
          <span className={`h-2 w-2 rounded-full transition-colors ${connected ? 'bg-brand-green' : connected === false ? 'bg-brand-red' : 'bg-gray-3'}`} />
          {connected ? t('dashboard.connected') : connected === false ? t('dashboard.disconnected') : t('dashboard.checking')}
        </span>
        {summary && (
          <span className="ml-auto text-gray">
            {t('common.active')} {summary.activeCount} · {t('common.inactive')} {summary.inactiveCount}
          </span>
        )}
      </div>

      <Reveal className="flex flex-wrap gap-3">
        {loading && !summary ? (
          Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard label={t('dashboard.totalRent')} value={fmt(summary?.billed)} />
            <MetricCard label={t('common.collected')} value={fmt(summary?.collected)} colorClass="text-brand-green" />
            <MetricCard label={t('common.balance')} value={fmt(summary?.balance)} colorClass="text-brand-red" />
            <MetricCard label={t('common.prevBalance')} value={fmt(summary?.mun_bakki)} colorClass="text-brand-orange" />
            <MetricCard label={t('dashboard.efficiency')} value={`${efficiency}%`} colorClass="text-brand-purple" />
          </>
        )}
      </Reveal>

      <Reveal delayMs={60} className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
        <p className="mb-2 text-sm text-gray">{t('dashboard.progress')}</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-3">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-premium ${progressColor(efficiency)}`}
            style={{ width: `${Math.min(100, efficiency)}%` }}
          />
        </div>
      </Reveal>

      <Reveal delayMs={100}>
        <p className="mb-2 text-sm font-medium text-navy">{t('dashboard.houses')}</p>
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
      </Reveal>

      <Reveal delayMs={140} className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
        <p className="mb-2 text-sm font-medium text-navy">{t('dashboard.dueHouses')}</p>
        {loading && houses.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : dueHouses.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-1 text-sm text-gray">{t('dashboard.allPaid')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray">
                  <th className="py-1 pr-3">{t('common.house')}</th>
                  <th className="py-1 pr-3">{t('common.name')}</th>
                  <th className="py-1 pr-3">{t('common.prevBalance')}</th>
                  <th className="py-1 pr-3">{t('common.status')}</th>
                  <th className="py-1 pr-3">{t('common.balance')}</th>
                  <th className="py-1 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {dueHouses.map((h) => {
                  const record = records[h.id];
                  return (
                    <tr key={h.id} className="border-t border-gray-3 transition-colors hover:bg-gray-4">
                      <td className="py-2 pr-3">{h.id}</td>
                      <td className="py-2 pr-3">{h.name}</td>
                      <td className="py-2 pr-3">{fmt(record?.mun_bakki)}</td>
                      <td className="py-2 pr-3">{record ? record.pay_status : t('common.noRecord')}</td>
                      <td className="py-2 pr-3 font-medium text-brand-red">{fmt(record?.balance ?? h.default_rent)}</td>
                      <td className="py-2 pr-3">
                        {h.phone && (
                          <a
                            href={`https://wa.me/91${h.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-green hover:underline"
                          >
                            💬 WhatsApp
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Reveal>

      {selectedHouse && (
        <Modal title={`${t('common.house')} ${selectedHouse.id} — ${selectedHouse.name}`} onClose={() => setSelectedHouseId(null)}>
          {selectedRecord ? (
            <>
              <div className="flex justify-center">
                <ReceiptCard ref={receiptRef} house={selectedHouse} record={selectedRecord} ebReading={ebReadings[selectedHouse.id] ?? null} />
              </div>
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={shareReceipt}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-4 py-2 text-sm text-white hover:opacity-90"
                >
                  💬 {t('receipt.shareWhatsApp')}
                </button>
              </div>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-brand-red">{t('receipt.noRecord')}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
