import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getEBReadings, getHouses, saveEBReading } from '../api';
import type { EBReading, House } from '../types';
import { fmt, mlabel, todayYM } from '../utils';
import { useToast } from '../components/Toast';

const MONTH_SHORT = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];

export function EBTracker() {
  const { showToast } = useToast();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseId, setHouseId] = useState<number | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [readings, setReadings] = useState<EBReading[]>([]);
  const [month, setMonth] = useState(todayYM());
  const [startReading, setStartReading] = useState(0);
  const [endReading, setEndReading] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHouses().then((list) => {
      setHouses(list);
      if (list.length > 0) setHouseId(list[0].id);
    });
  }, []);

  const load = async () => {
    if (!houseId) return;
    const data = await getEBReadings({ house_id: houseId, year });
    setReadings(data);
  };

  useEffect(() => { load(); }, [houseId, year]);

  const selectedHouse = houses.find((h) => h.id === houseId);
  const rate = selectedHouse?.eb_rate ?? 6.0;

  const readingByMonth = useMemo(() => {
    const map: Record<string, EBReading> = {};
    readings.forEach((r) => { map[r.month] = r; });
    return map;
  }, [readings]);

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { month: MONTH_SHORT[i], amount: readingByMonth[ym]?.amount ?? 0 };
  });

  const units = Math.max(0, endReading - startReading);
  const amount = Math.round(units * rate);

  const handleSave = async () => {
    if (!houseId) return;
    setSaving(true);
    try {
      await saveEBReading({ house_id: houseId, month, start_reading: startReading, end_reading: endReading });
      showToast('EB பதிவு சேமிக்கப்பட்டது', 'ok');
      load();
    } catch {
      showToast('சேமிக்க முடியவில்லை', 'err');
    } finally {
      setSaving(false);
    }
  };

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
          ஆண்டு
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 block w-24 rounded-lg border border-gray-3 px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
        {chartData.map((m, i) => {
          const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
          const reading = readingByMonth[ym];
          return (
            <div key={ym} className={`rounded-lg border p-2 text-center text-xs ${reading ? 'border-brand-blue/40 bg-brand-blue/5' : 'border-gray-3'}`}>
              <p className="text-gray">{m.month}</p>
              <p className="mt-1 font-medium text-navy">{reading ? `${reading.units} யூ` : '—'}</p>
              <p className="text-gray">{reading ? fmt(reading.amount) : ''}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-navy">புதிய பதிவு</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            மாதம்
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
          </label>
          <label className="text-sm">
            தொடக்க மீட்டர்
            <input
              type="number"
              value={startReading}
              onChange={(e) => setStartReading(+e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-gray-3 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            முடிவு மீட்டர்
            <input
              type="number"
              value={endReading}
              onChange={(e) => setEndReading(+e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-gray-3 px-3 py-2"
            />
          </label>
          <div className="text-sm text-gray">
            யூனிட்: <span className="font-medium text-navy">{units}</span> · விலை: <span className="font-medium text-navy">{fmt(amount)}</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !houseId}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? 'சேமிக்கிறது...' : 'சேமி'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">மாதம்</th>
              <th className="px-3 py-2">தொடக்கம்</th>
              <th className="px-3 py-2">முடிவு</th>
              <th className="px-3 py-2">யூனிட்</th>
              <th className="px-3 py-2">விலை</th>
              <th className="px-3 py-2">தொகை</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-b border-gray-3 last:border-0">
                <td className="px-3 py-2">{mlabel(r.month)}</td>
                <td className="px-3 py-2">{r.start_reading}</td>
                <td className="px-3 py-2">{r.end_reading}</td>
                <td className="px-3 py-2">{r.units}</td>
                <td className="px-3 py-2">₹{r.rate}/யூ</td>
                <td className="px-3 py-2 font-medium">{fmt(r.amount)}</td>
              </tr>
            ))}
            {readings.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray">பதிவுகள் இல்லை.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
