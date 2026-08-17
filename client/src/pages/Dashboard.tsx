import { useEffect, useState } from 'react';
import { HouseCard, type CardStatus } from '../components/HouseCard';
import { MetricCard } from '../components/MetricCard';
import { HouseCardSkeleton, MetricCardSkeleton, Skeleton } from '../components/Skeleton';
import { getDashboardSummary, getHouses, getRecords } from '../api';
import type { DashboardSummary, House, RentRecord } from '../types';
import { fmt, mlabel, todayYM } from '../utils';

function progressColor(pct: number): string {
  if (pct >= 90) return 'bg-brand-green';
  if (pct >= 50) return 'bg-brand-amber';
  return 'bg-brand-red';
}

export function Dashboard() {
  const [houses, setHouses] = useState<House[]>([]);
  const [records, setRecords] = useState<Record<number, RentRecord>>({});
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const month = todayYM();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([getHouses(), getRecords({ month_from: month, month_to: month }), getDashboardSummary(month)])
      .then(([houseList, recordList, dashboardSummary]) => {
        if (cancelled) return;
        setHouses(houseList);
        const byHouse: Record<number, RentRecord> = {};
        recordList.forEach((r) => { byHouse[r.house_id] = r; });
        setRecords(byHouse);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-3 bg-white px-4 py-3 text-sm">
        <span className="font-medium text-navy">{mlabel(month)}</span>
        <span className="flex items-center gap-1 text-gray">
          <span className={`h-2 w-2 rounded-full transition-colors ${connected ? 'bg-brand-green' : connected === false ? 'bg-brand-red' : 'bg-gray-3'}`} />
          {connected ? 'இணைக்கப்பட்டுள்ளது' : connected === false ? 'இணைப்பு இல்லை' : 'சரிபார்க்கிறது...'}
        </span>
        {summary && (
          <span className="ml-auto text-gray">
            செயலில் {summary.activeCount} · செயலற்றது {summary.inactiveCount}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {loading && !summary ? (
          Array.from({ length: 5 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard label="மொத்த வாடகை" value={fmt(summary?.billed)} />
            <MetricCard label="வசூல்" value={fmt(summary?.collected)} colorClass="text-brand-green" />
            <MetricCard label="நிலுவை" value={fmt(summary?.balance)} colorClass="text-brand-red" />
            <MetricCard label="முன் பாக்கி" value={fmt(summary?.mun_bakki)} colorClass="text-brand-orange" />
            <MetricCard label="வசூல் திறன்" value={`${efficiency}%`} colorClass="text-brand-purple" />
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <p className="mb-2 text-sm text-gray">வசூல் முன்னேற்றம்</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-3">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${progressColor(efficiency)}`}
            style={{ width: `${Math.min(100, efficiency)}%` }}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-navy">வீடுகள்</p>
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
                  />
                );
              })}
        </div>
        {!loading && houses.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-3 bg-white p-8 text-center">
            <p className="text-3xl">🏠</p>
            <p className="mt-2 text-sm text-gray">வீடுகள் இல்லை.</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <p className="mb-2 text-sm font-medium text-navy">நிலுவை உள்ள வீடுகள்</p>
        {loading && houses.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : dueHouses.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-1 text-sm text-gray">நிலுவை இல்லை. அனைவரும் செலுத்திவிட்டனர்.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray">
                  <th className="py-1 pr-3">வீடு</th>
                  <th className="py-1 pr-3">பெயர்</th>
                  <th className="py-1 pr-3">முன் பாக்கி</th>
                  <th className="py-1 pr-3">நிலை</th>
                  <th className="py-1 pr-3">இருப்பு</th>
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
                      <td className="py-2 pr-3">{record ? record.pay_status : 'பதிவு இல்லை'}</td>
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
      </div>
    </div>
  );
}
