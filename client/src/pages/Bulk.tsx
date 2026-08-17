import { useEffect, useState } from 'react';
import { getEBReadings, getHouses, getRecords, getRentHistory, saveRecordsBulk } from '../api';
import type { EBReading, House, PayStatus, RentRecord } from '../types';
import { fmt, getEffectiveRent, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';

interface BulkRow {
  house: House;
  rent: number;
  water: number;
  other: number;
  eb: number;
  mun_bakki: number;
  pay_status: PayStatus;
  received: number;
}

export function Bulk() {
  const { showToast } = useToast();
  const [month, setMonth] = useState(todayYM());
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [houseList, history, monthRecords, prevMonthRecords, ebList] = await Promise.all([
        getHouses(),
        getRentHistory(),
        getRecords({ month_from: month, month_to: month }),
        getRecords({ month_from: prevYM(month), month_to: prevYM(month) }),
        getEBReadings({ year: month.slice(0, 4) }),
      ]);

      const recMap: Record<number, RentRecord> = {};
      monthRecords.forEach((r) => { recMap[r.house_id] = r; });
      const prevMap: Record<number, RentRecord> = {};
      prevMonthRecords.forEach((r) => { prevMap[r.house_id] = r; });
      const ebMap: Record<number, EBReading> = {};
      ebList.filter((e) => e.month === month).forEach((e) => { ebMap[e.house_id] = e; });

      const nextRows: BulkRow[] = houseList
        .filter((h) => h.status === 'Active')
        .map((house) => {
          const existing = recMap[house.id];
          const eff = getEffectiveRent(house, history, month);
          return {
            house,
            rent: existing?.rent ?? eff.rent,
            water: existing?.water ?? eff.water,
            other: existing?.other ?? eff.maintenance,
            eb: existing?.eb ?? ebMap[house.id]?.amount ?? 0,
            mun_bakki: existing?.mun_bakki ?? prevMap[house.id]?.balance ?? 0,
            pay_status: existing?.pay_status ?? 'none',
            received: existing?.received ?? 0,
          };
        });
      setRows(nextRows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const updateRow = (houseId: number, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.house.id === houseId ? { ...r, ...patch } : r)));
  };

  const rowTotal = (r: BulkRow) => r.rent + r.water + r.eb + r.other + r.mun_bakki;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await saveRecordsBulk(
        rows.map((r) => ({
          house_id: r.house.id,
          month,
          rent: r.rent,
          water: r.water,
          eb: r.eb,
          other: r.other,
          pay_status: r.pay_status,
          received: r.pay_status === 'full' ? rowTotal(r) : r.pay_status === 'none' ? 0 : r.received,
        }))
      );
      showToast('அனைத்து பதிவுகளும் சேமிக்கப்பட்டன', 'ok');
      load();
    } catch {
      showToast('சேமிக்க முடியவில்லை', 'err');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-3 px-3 py-2 text-sm"
        />
        <button type="button" onClick={load} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
          ஏற்று
        </button>
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving || rows.length === 0}
          className="ml-auto rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {saving ? 'சேமிக்கிறது...' : '💾 அனைத்தும் சேமி'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">வீடு</th>
              <th className="px-3 py-2">பெயர்</th>
              <th className="px-3 py-2">வாடகை</th>
              <th className="px-3 py-2">தண்ணீர்</th>
              <th className="px-3 py-2">EB</th>
              <th className="px-3 py-2">முன் பாக்கி</th>
              <th className="px-3 py-2">மொத்தம்</th>
              <th className="px-3 py-2">நிலை</th>
              <th className="px-3 py-2">வசூல்</th>
              <th className="px-3 py-2">இருப்பு</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const total = rowTotal(r);
              const received = r.pay_status === 'full' ? total : r.pay_status === 'none' ? 0 : r.received;
              const balance = total - received;
              return (
                <tr key={r.house.id} className={`border-b border-gray-3 last:border-0 ${r.mun_bakki > 0 ? 'bg-brand-orange/10' : ''}`}>
                  <td className="px-3 py-2">{r.house.id}</td>
                  <td className="px-3 py-2">{r.house.name}</td>
                  <td className="px-3 py-2 text-gray">{fmt(r.rent)}</td>
                  <td className="px-3 py-2 text-gray">{fmt(r.water)}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={r.eb}
                      onChange={(e) => updateRow(r.house.id, { eb: +e.target.value })}
                      className="w-20 rounded border border-gray-3 px-1.5 py-1"
                    />
                  </td>
                  <td className="px-3 py-2 text-brand-orange">{fmt(r.mun_bakki)}</td>
                  <td className="px-3 py-2 font-medium">{fmt(total)}</td>
                  <td className="px-3 py-2">
                    <select
                      value={r.pay_status}
                      onChange={(e) => updateRow(r.house.id, { pay_status: e.target.value as PayStatus })}
                      className="rounded border border-gray-3 px-1.5 py-1"
                    >
                      <option value="full">முழுமையாக</option>
                      <option value="partial">பகுதியாக</option>
                      <option value="none">இல்லை</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    {r.pay_status === 'partial' ? (
                      <input
                        type="number"
                        value={r.received}
                        onChange={(e) => updateRow(r.house.id, { received: +e.target.value })}
                        className="w-20 rounded border border-gray-3 px-1.5 py-1"
                      />
                    ) : (
                      fmt(received)
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-brand-red">{fmt(balance)}</td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray">செயலில் உள்ள வீடுகள் இல்லை.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
