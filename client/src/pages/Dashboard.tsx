import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HouseCard, type CardStatus } from '../components/HouseCard';
import { MetricCard } from '../components/MetricCard';
import { HouseCardSkeleton, MetricCardSkeleton } from '../components/Skeleton';
import { Reveal } from '../components/Reveal';
import { getDashboardSummary, getEBReadings, getHouses, getMonthlyReport, getRecords } from '../api';
import type { DashboardSummary, EBReading, House, PayStatus, RentRecord, MonthlyReportRow } from '../types';
import { fmt, mlabel, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

function gaugeColor(pct: number): string {
  if (pct >= 90) return '#22c55e';
  if (pct >= 50) return '#f59e0b';
  return '#ef4444';
}

export function Dashboard() {
  const { t, language } = useLanguage();
  const { showToast } = useToast();
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
  const chartsRef = useRef<HTMLDivElement>(null);

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

  const gaugeFill = gaugeColor(efficiency);
  const gaugeData = [{ value: Math.min(100, efficiency), fill: gaugeFill }];

  const statusCounts: Record<PayStatus | 'pending', number> = { full: 0, partial: 0, none: 0, pending: 0 };
  houses.forEach((house) => {
    if (house.status === 'Inactive') return;
    const record = records[house.id];
    if (!record) { statusCounts.pending++; return; }
    statusCounts[record.pay_status]++;
  });
  const statusData = [
    { key: 'full', name: t('common.full'), value: statusCounts.full, fill: '#22c55e' },
    { key: 'partial', name: t('common.partial'), value: statusCounts.partial, fill: '#f59e0b' },
    { key: 'none', name: t('common.none'), value: statusCounts.none, fill: '#ef4444' },
    { key: 'pending', name: t('status.pending'), value: statusCounts.pending, fill: '#94a3b8' },
  ].filter((d) => d.value > 0);

  const topDues = houses
    .map((house) => ({ house, record: records[house.id] }))
    .filter((x): x is { house: House; record: RentRecord } => !!x.record && x.record.balance > 0)
    .sort((a, b) => b.record.balance - a.record.balance)
    .slice(0, 5);
  const maxDue = topDues[0]?.record.balance ?? 0;

  const downloadChart = async () => {
    if (!chartsRef.current) return;
    try {
      const canvas = await html2canvas(chartsRef.current, { scale: 2, backgroundColor: '#fff' });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      const scope = chartHouse ? `house${chartHouse.id}` : 'all';
      a.download = `charts_${year}_${scope}.png`;
      a.click();
    } catch {
      showToast(t('dashboard.chartDownloadFailed'), 'err');
    }
  };

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

      <Reveal delayMs={60} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
          <p className="mb-1 text-sm font-medium text-navy">{t('dashboard.efficiency')}</p>
          <ResponsiveContainer width="100%" height={130}>
            <RadialBarChart cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" barSize={16} data={gaugeData} startAngle={180} endAngle={0}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="-mt-8 text-center text-2xl font-semibold" style={{ color: gaugeFill }}>{efficiency}%</p>
        </div>

        <div className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
          <p className="mb-1 text-sm font-medium text-navy">{t('dashboard.paymentStatus')}</p>
          {statusData.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray">{t('report.noDataHint')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={35} outerRadius={55} paddingAngle={2}>
                  {statusData.map((d) => <Cell key={d.key} fill={d.fill} />)}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-gray-3/70 bg-white p-4 shadow-soft">
          <p className="mb-2 text-sm font-medium text-navy">{t('dashboard.topDues')}</p>
          {topDues.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray">{t('dashboard.noDues')}</p>
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
        <button
          type="button"
          onClick={downloadChart}
          className="ml-auto rounded-lg border border-gray-3 px-3 py-1.5 text-xs hover:bg-gray-4"
        >
          📷 {t('dashboard.downloadChart')}
        </button>
      </div>

      <div ref={chartsRef} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
