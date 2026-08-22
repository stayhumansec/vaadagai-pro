import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HouseCard, type CardStatus } from '../components/HouseCard';
import { MetricCard } from '../components/MetricCard';
import { HouseCardSkeleton, MetricCardSkeleton } from '../components/Skeleton';
import { Modal } from '../components/Modal';
import { ReceiptCard } from '../components/ReceiptCard';
import { Reveal } from '../components/Reveal';
import { getDashboardSummary, getEBReadings, getHouses, getMonthlyReport, getRecords } from '../api';
import type { DashboardSummary, EBReading, House, MonthlyReportRow, PayStatus, RentRecord } from '../types';
import { fmt, mlabel, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

// A single shared good/warning/bad color scale, used everywhere on this page
// so the same colors always mean the same thing.
function rateColorClass(pct: number): string {
  if (pct >= 90) return 'text-brand-green';
  if (pct >= 50) return 'text-brand-amber';
  return 'text-brand-red';
}
function rateBgClass(pct: number): string {
  if (pct >= 90) return 'bg-brand-green';
  if (pct >= 50) return 'bg-brand-amber';
  return 'bg-brand-red';
}

// Percentage change vs. the previous period. null means "nothing to compare"
// (previous period was zero) rather than a misleading +/-Infinity.
function pctDelta(current: number, prev: number): number | null {
  if (prev === 0) return current === 0 ? 0 : null;
  return Math.round(((current - prev) / prev) * 100);
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
  const [prevSummary, setPrevSummary] = useState<DashboardSummary | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));
  const year = month.slice(0, 4);

  // null = the chart shows the totals across all houses. Clicking a house
  // drills the chart down to that one house's year, without affecting the
  // summary metrics/house grid above (which always reflect the selected
  // month).
  const [chartHouseId, setChartHouseId] = useState<number | null>(null);
  const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null);
  const [houseYearRecords, setHouseYearRecords] = useState<RentRecord[]>([]);
  const [houseYearEb, setHouseYearEb] = useState<EBReading[]>([]);
  const collectionChartRef = useRef<HTMLDivElement>(null);
  const ebChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartHouseId == null) return;
    let cancelled = false;
    Promise.all([
      getRecords({ house_id: chartHouseId, month_from: `${year}-01`, month_to: `${year}-12` }),
      getEBReadings({ house_id: chartHouseId, year }),
    ]).then(([recs, eb]) => {
      if (cancelled) return;
      setHouseYearRecords(recs);
      setHouseYearEb(eb);
    });
    return () => { cancelled = true; };
  }, [chartHouseId, year]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getHouses(),
      getRecords({ month_from: month, month_to: month }),
      getDashboardSummary(month),
      getDashboardSummary(prevYM(month)),
      getEBReadings({ year }),
      getMonthlyReport(year),
    ])
      .then(([houseList, recordList, dashboardSummary, prevDashboardSummary, ebList, monthlyData]) => {
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
        setPrevSummary(prevDashboardSummary);
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
  const prevEfficiency = prevSummary && prevSummary.billed > 0 ? Math.round((prevSummary.collected / prevSummary.billed) * 100) : 0;

  const billedDelta = summary && prevSummary ? pctDelta(summary.billed, prevSummary.billed) : null;
  const collectedDelta = summary && prevSummary ? pctDelta(summary.collected, prevSummary.collected) : null;
  const balanceDelta = summary && prevSummary ? pctDelta(summary.balance, prevSummary.balance) : null;
  const munBakkiDelta = summary && prevSummary ? pctDelta(summary.mun_bakki, prevSummary.mun_bakki) : null;
  const efficiencyDelta = summary && prevSummary ? efficiency - prevEfficiency : null;

  const chartHouse = houses.find((h) => h.id === chartHouseId);
  const selectedHouse = houses.find((h) => h.id === selectedHouseId);
  const selectedRecord = selectedHouseId ? records[selectedHouseId] : undefined;

  const statusCounts: Record<PayStatus | 'pending', number> = { full: 0, partial: 0, none: 0, pending: 0 };
  houses.forEach((house) => {
    if (house.status === 'Inactive') return;
    const record = records[house.id];
    if (!record) { statusCounts.pending++; return; }
    statusCounts[record.pay_status]++;
  });
  const statusData = [
    { key: 'full', name: t('common.full'), value: statusCounts.full, colorClass: 'bg-brand-green' },
    { key: 'partial', name: t('common.partial'), value: statusCounts.partial, colorClass: 'bg-brand-amber' },
    { key: 'none', name: t('common.none'), value: statusCounts.none, colorClass: 'bg-brand-red' },
    { key: 'pending', name: t('status.pending'), value: statusCounts.pending, colorClass: 'bg-gray-3' },
  ].filter((d) => d.value > 0);
  const statusTotal = statusData.reduce((sum, d) => sum + d.value, 0);

  const topDues = houses
    .map((house) => ({ house, record: records[house.id] }))
    .filter((x): x is { house: House; record: RentRecord } => !!x.record && x.record.balance > 0)
    .sort((a, b) => b.record.balance - a.record.balance)
    .slice(0, 5);
  const maxDue = topDues[0]?.record.balance ?? 0;

  const downloadChart = async (ref: React.RefObject<HTMLDivElement | null>, kind: string) => {
    if (!ref.current) return;
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#fff' });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      const scope = chartHouse ? `house${chartHouse.id}` : 'all';
      a.download = `${kind}_${year}_${scope}.png`;
      a.click();
    } catch {
      showToast(t('dashboard.chartDownloadFailed'), 'err');
    }
  };

  // Shown inside each chart card (and so captured in its downloaded image)
  // so a downloaded chart is self-explanatory about whose data it is.
  const chartScopeLabel = chartHouse ? `${chartHouse.id} — ${chartHouse.name}` : t('dashboard.chartsAllHouses');

  const chartData = chartHouseId == null
    ? monthlyReport.map((m) => ({
        month: mlabel(m.month, language),
        collected: m.collected,
        balance: m.balance,
        eb: ebByMonth[m.month] ?? 0,
      }))
    : houseYearRecords
        .slice()
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((r) => ({
          month: mlabel(r.month, language),
          collected: r.received,
          balance: r.balance,
          eb: houseYearEb.find((e) => e.month === r.month)?.amount ?? 0,
        }));

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
            <MetricCard icon="💰" label={t('dashboard.totalRent')} value={fmt(summary?.billed)} delta={billedDelta} />
            <MetricCard icon="✅" label={t('common.collected')} value={fmt(summary?.collected)} colorClass="text-brand-green" delta={collectedDelta} />
            <MetricCard icon="⚠️" label={t('common.balance')} value={fmt(summary?.balance)} colorClass="text-brand-red" delta={balanceDelta} deltaGoodWhenPositive={false} />
            <MetricCard icon="📌" label={t('common.prevBalance')} value={fmt(summary?.mun_bakki)} colorClass="text-brand-orange" delta={munBakkiDelta} deltaGoodWhenPositive={false} />
            <MetricCard
              icon="📊"
              label={t('dashboard.efficiency')}
              value={`${efficiency}%`}
              colorClass={rateColorClass(efficiency)}
              progressPct={efficiency}
              progressColorClass={rateBgClass(efficiency)}
              delta={efficiencyDelta}
              deltaSuffix="pts"
            />
          </>
        )}
      </Reveal>

      <Reveal delayMs={60} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
          <p className="text-sm font-medium text-navy">{t('dashboard.paymentStatus')}</p>
          {statusTotal === 0 ? (
            <p className="py-6 text-center text-sm text-gray">{t('report.noDataHint')}</p>
          ) : (
            <>
              <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full bg-gray-3">
                {statusData.map((d) => (
                  <div key={d.key} className={d.colorClass} style={{ width: `${(d.value / statusTotal) * 100}%` }} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {statusData.map((d) => (
                  <span key={d.key} className="flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${d.colorClass}`} />
                    {d.name}: <strong className="text-navy">{d.value}</strong>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
          <p className="mb-2 text-sm font-medium text-navy">{t('dashboard.topDues')}</p>
          {topDues.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray">{t('dashboard.noDues')}</p>
          ) : (
            <div className="space-y-2">
              {topDues.map(({ house, record }) => (
                <div key={house.id}>
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-navy">{house.id} — {house.name}</span>
                    <span className="shrink-0 font-medium text-brand-red">{fmt(record.balance)}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-3">
                    <div className="h-full rounded-full bg-brand-red" style={{ width: `${maxDue > 0 ? (record.balance / maxDue) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    onClick={() => {
                      setChartHouseId(house.id);
                      setSelectedHouseId(house.id);
                    }}
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

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-navy">
          {chartHouse ? `${t('dashboard.chartsFor')} ${chartHouse.id} — ${chartHouse.name}` : t('dashboard.chartsAllHouses')}
        </p>
        {chartHouseId != null && (
          <button
            type="button"
            onClick={() => setChartHouseId(null)}
            className="rounded-full border border-gray-3 px-3 py-1 text-xs text-gray hover:bg-gray-4"
          >
            ✕ {t('dashboard.showAllHouses')}
          </button>
        )}
      </div>

      <Reveal delayMs={140}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div ref={collectionChartRef} className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-navy">{t('dashboard.collectionChart')}</p>
                <p className="text-xs text-gray">{chartScopeLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => downloadChart(collectionChartRef, 'collection')}
                className="shrink-0 rounded-lg border border-gray-3 px-2 py-1 text-xs hover:bg-gray-4"
                title={t('dashboard.downloadChart')}
              >
                📷
              </button>
            </div>
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
          </div>

          <div ref={ebChartRef} className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-navy">{t('dashboard.ebChart')}</p>
                <p className="text-xs text-gray">{chartScopeLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => downloadChart(ebChartRef, 'eb')}
                className="shrink-0 rounded-lg border border-gray-3 px-2 py-1 text-xs hover:bg-gray-4"
                title={t('dashboard.downloadChart')}
              >
                📷
              </button>
            </div>
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
          </div>
        </div>
      </Reveal>

      {selectedHouse && (
        <Modal title={`${t('common.house')} ${selectedHouse.id} — ${selectedHouse.name}`} onClose={() => setSelectedHouseId(null)}>
          {selectedRecord ? (
            <div className="flex justify-center">
              <ReceiptCard house={selectedHouse} record={selectedRecord} ebReading={ebReadings[selectedHouse.id] ?? null} />
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-brand-red">{t('receipt.noRecord')}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
