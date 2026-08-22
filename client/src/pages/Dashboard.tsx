import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HouseCard, type CardStatus } from '../components/HouseCard';
import { MetricCard } from '../components/MetricCard';
import { HouseCardSkeleton, MetricCardSkeleton } from '../components/Skeleton';
import { Reveal } from '../components/Reveal';
import { getDashboardSummary, getEBReadings, getHouses, getMonthlyReport, getRecords } from '../api';
import type { DashboardSummary, EBReading, House, MonthlyReportRow, RentRecord } from '../types';
import { fmt, mlabel, prevYM, todayYM } from '../utils';
import { useLanguage } from '../context/LanguageContext';

function progressColor(pct: number): string {
  if (pct >= 90) return 'from-brand-green to-emerald-400';
  if (pct >= 50) return 'from-brand-amber to-yellow-400';
  return 'from-brand-red to-rose-400';
}

export function Dashboard() {
  const { t, language } = useLanguage();
  const [houses, setHouses] = useState<House[]>([]);
  const [records, setRecords] = useState<Record<number, RentRecord>>({});
  const [ebByMonth, setEbByMonth] = useState<Record<string, number>>({});
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReportRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));
  const year = month.slice(0, 4);

  // null = charts show the totals across all houses. Clicking a house drills
  // the charts down to that one house's year, without affecting the summary
  // metrics/house grid above (which always reflect the selected month).
  const [chartHouseId, setChartHouseId] = useState<number | null>(null);
  const [houseYearRecords, setHouseYearRecords] = useState<RentRecord[]>([]);
  const [houseYearEb, setHouseYearEb] = useState<EBReading[]>([]);

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
      getEBReadings({ year }),
      getMonthlyReport(year),
    ])
      .then(([houseList, recordList, dashboardSummary, ebList, monthlyData]) => {
        if (cancelled) return;
        setHouses(houseList);
        const byHouse: Record<number, RentRecord> = {};
        recordList.forEach((r) => { byHouse[r.house_id] = r; });
        setRecords(byHouse);
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

  const chartHouse = houses.find((h) => h.id === chartHouseId);

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
                    onClick={() => setChartHouseId(house.id)}
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
    </div>
  );
}
