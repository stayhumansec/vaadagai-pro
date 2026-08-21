import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HouseCard, type CardStatus } from '../components/HouseCard';
import { MetricCard } from '../components/MetricCard';
import { HouseCardSkeleton, MetricCardSkeleton } from '../components/Skeleton';
import { Reveal } from '../components/Reveal';
import { Modal } from '../components/Modal';
import { ReceiptCard } from '../components/ReceiptCard';
import { getDashboardSummary, getEBReadings, getHouses, getMonthlyReport, getRecords } from '../api';
import type { DashboardSummary, EBReading, House, MonthlyReportRow, RentRecord } from '../types';
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
  const [ebByMonth, setEbByMonth] = useState<Record<string, number>>({});
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));
  const year = month.slice(0, 4);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getHouses(),
      getRecords({ month_from: month, month_to: month }),
      getDashboardSummary(month),
      getEBReadings({ year }),
      getMonthlyReport(year),
    ])
      .then(([houseList, recordList, dashboardSummary, ebList, monthlyData]) => {
        if (cancelled) return;
        setHouses(houseList);
        const byHouse: Record<number, RentRecord> = {};
        recordList.forEach((r) => { byHouse[r.house_id] = r; });
        setRecords(byHouse);
        const ebByHouse: Record<number, EBReading> = {};
        ebList.filter((e) => e.month === month).forEach((e) => { ebByHouse[e.house_id] = e; });
        setEbReadings(ebByHouse);
        const ebByMonthMap: Record<string, number> = {};
        ebList.forEach((e) => { ebByMonthMap[e.month] = (ebByMonthMap[e.month] ?? 0) + e.amount; });
        setEbByMonth(ebByMonthMap);
        setMonthlyReport(monthlyData);
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
  }, [month, year]);

  const efficiency = summary && summary.billed > 0 ? Math.round((summary.collected / summary.billed) * 100) : 0;

  const chartData = monthlyReport.map((m) => ({
    month: mlabel(m.month, language),
    collected: m.collected,
    balance: m.balance,
    eb: ebByMonth[m.month] ?? 0,
  }));

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal delayMs={140} className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
          <p className="mb-2 text-sm font-medium text-navy">{t('dashboard.collectionChart')}</p>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray">{t('report.noDataHint')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
                <Bar dataKey="collected" name={t('common.collected')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="balance" name={t('common.balance')} fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Reveal>

        <Reveal delayMs={180} className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
          <p className="mb-2 text-sm font-medium text-navy">{t('dashboard.ebChart')}</p>
          {chartData.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray">{t('report.noDataHint')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Line type="monotone" dataKey="eb" name={t('common.eb')} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Reveal>
      </div>

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
