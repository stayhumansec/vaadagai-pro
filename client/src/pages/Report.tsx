import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getHouseReport, getMonthlyReport } from '../api';
import type { HouseReportRow, MonthlyReportRow } from '../types';
import { fmt, mlabel } from '../utils';

export function Report() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [monthly, setMonthly] = useState<MonthlyReportRow[]>([]);
  const [byHouse, setByHouse] = useState<HouseReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [monthlyData, houseData] = await Promise.all([getMonthlyReport(year), getHouseReport(year)]);
      setMonthly(monthlyData);
      setByHouse(houseData);
    } finally {
      setLoading(false);
    }
  };

  const totals = monthly.reduce(
    (acc, m) => ({ billed: acc.billed + m.billed, collected: acc.collected + m.collected, balance: acc.balance + m.balance }),
    { billed: 0, collected: 0, balance: 0 }
  );
  const efficiency = totals.billed > 0 ? Math.round((totals.collected / totals.billed) * 100) : 0;

  const chartData = monthly.map((m) => ({
    month: mlabel(m.month),
    வசூல்: m.collected,
    நிலுவை: m.balance,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          ஆண்டு
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 block w-24 rounded-lg border border-gray-3 px-3 py-2"
          />
        </label>
        <button type="button" onClick={load} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
          ஏற்று
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[130px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">ஆண்டு மொத்தம்</p>
          <p className="mt-1 text-xl font-semibold text-navy">{fmt(totals.billed)}</p>
        </div>
        <div className="min-w-[130px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">வசூல்</p>
          <p className="mt-1 text-xl font-semibold text-brand-green">{fmt(totals.collected)}</p>
        </div>
        <div className="min-w-[130px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">நிலுவை</p>
          <p className="mt-1 text-xl font-semibold text-brand-red">{fmt(totals.balance)}</p>
        </div>
        <div className="min-w-[130px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">திறன்</p>
          <p className="mt-1 text-xl font-semibold text-brand-purple">{efficiency}%</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Legend />
            <Bar dataKey="வசூல்" stackId="a" fill="#22c55e" />
            <Bar dataKey="நிலுவை" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">மாதம்</th>
              <th className="px-3 py-2">மொத்தம்</th>
              <th className="px-3 py-2">வசூல்</th>
              <th className="px-3 py-2">நிலுவை</th>
              <th className="px-3 py-2">திறன் %</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => {
              const eff = m.billed > 0 ? Math.round((m.collected / m.billed) * 100) : 0;
              return (
                <tr key={m.month} className="border-b border-gray-3 last:border-0">
                  <td className="px-3 py-2">{mlabel(m.month)}</td>
                  <td className="px-3 py-2">{fmt(m.billed)}</td>
                  <td className="px-3 py-2 text-brand-green">{fmt(m.collected)}</td>
                  <td className="px-3 py-2 text-brand-red">{fmt(m.balance)}</td>
                  <td className="px-3 py-2">{eff}%</td>
                </tr>
              );
            })}
            {!loading && monthly.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray">தரவு இல்லை. "ஏற்று" அழுத்தவும்.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-navy">வீடு வாரியாக</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {byHouse.map((h) => {
            const eff = h.billed > 0 ? Math.round((h.collected / h.billed) * 100) : 0;
            return (
              <div key={h.house_id} className="rounded-xl border border-gray-3 bg-white p-3">
                <p className="font-medium text-navy">{h.house_id} — {h.name}</p>
                <p className="text-xs text-gray">{h.months} மாதங்கள்</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-3">
                  <div className="h-full rounded-full bg-brand-green" style={{ width: `${Math.min(100, eff)}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-brand-green">{fmt(h.collected)}</span>
                  <span className="text-brand-red">{fmt(h.balance)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
