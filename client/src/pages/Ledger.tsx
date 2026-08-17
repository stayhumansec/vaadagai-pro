import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { getHouses, getRecords } from '../api';
import type { House, RentRecord } from '../types';
import { fmt, mlabel, todayYM } from '../utils';
import { useToast } from '../components/Toast';

export function Ledger() {
  const { showToast } = useToast();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseFilter, setHouseFilter] = useState<number | 'all'>('all');
  const [monthFrom, setMonthFrom] = useState(todayYM());
  const [monthTo, setMonthTo] = useState(todayYM());
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const houseName = (id: number) => houses.find((h) => h.id === id)?.name ?? `வீடு ${id}`;

  const load = async () => {
    setLoading(true);
    try {
      const [houseList, recordList] = await Promise.all([
        getHouses(),
        getRecords({
          house_id: houseFilter === 'all' ? undefined : houseFilter,
          month_from: monthFrom,
          month_to: monthTo,
        }),
      ]);
      setHouses(houseList);
      setRecords(recordList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totals = records.reduce(
    (acc, r) => ({ total: acc.total + r.total, received: acc.received + r.received, balance: acc.balance + r.balance }),
    { total: 0, received: 0, balance: 0 }
  );

  const downloadXlsx = async () => {
    const headers = ['வீடு', 'பெயர்', 'மாதம்', 'வாடகை', 'தண்ணீர்', 'EB', 'முன் பாக்கி', 'மொத்தம்', 'நிலை', 'வசூல்', 'இருப்பு'];
    const rows = records.map((r) => [
      r.house_id, houseName(r.house_id), r.month, r.rent, r.water, r.eb, r.mun_bakki, r.total, r.pay_status, r.received, r.balance,
    ]);
    rows.push(['', '', '', '', '', '', '', totals.total, '', totals.received, totals.balance]);
    try {
      const { downloadExcel } = await import('../lib/excel');
      await downloadExcel([{ name: 'Ledger', headers, rows }], `ledger_${monthFrom}_${monthTo}.xlsx`);
    } catch {
      showToast('Excel பதிவிறக்க முடியவில்லை', 'err');
    }
  };

  const downloadImage = async () => {
    if (!tableRef.current) return;
    try {
      const canvas = await html2canvas(tableRef.current, { scale: 2, backgroundColor: '#fff' });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `ledger_${monthFrom}_${monthTo}.png`;
      a.click();
    } catch {
      showToast('படமாக பதிவிறக்க முடியவில்லை', 'err');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          வீடு
          <select
            value={houseFilter}
            onChange={(e) => setHouseFilter(e.target.value === 'all' ? 'all' : +e.target.value)}
            className="mt-1 block rounded-lg border border-gray-3 px-3 py-2"
          >
            <option value="all">அனைத்தும்</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>{h.id} — {h.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          தொடக்க மாதம்
          <input type="month" value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
        </label>
        <label className="text-sm">
          முடிவு மாதம்
          <input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
        </label>
        <button type="button" onClick={load} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
          ஏற்று
        </button>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={downloadXlsx} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
            ⬇️ Excel
          </button>
          <button type="button" onClick={downloadImage} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
            🖼️ படம்
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">மொத்தம்</p>
          <p className="mt-1 text-xl font-semibold text-navy">{fmt(totals.total)}</p>
        </div>
        <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">வசூல்</p>
          <p className="mt-1 text-xl font-semibold text-brand-green">{fmt(totals.received)}</p>
        </div>
        <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">நிலுவை</p>
          <p className="mt-1 text-xl font-semibold text-brand-red">{fmt(totals.balance)}</p>
        </div>
      </div>

      <div ref={tableRef} className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">வீடு</th>
              <th className="px-3 py-2">மாதம்</th>
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
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-3 last:border-0">
                <td className="px-3 py-2">{r.house_id} — {houseName(r.house_id)}</td>
                <td className="px-3 py-2">{mlabel(r.month)}</td>
                <td className="px-3 py-2">{fmt(r.rent)}</td>
                <td className="px-3 py-2">{fmt(r.water)}</td>
                <td className="px-3 py-2">{fmt(r.eb)}</td>
                <td className="px-3 py-2">{fmt(r.mun_bakki)}</td>
                <td className="px-3 py-2 font-medium">{fmt(r.total)}</td>
                <td className="px-3 py-2">{r.pay_status}</td>
                <td className="px-3 py-2">{fmt(r.received)}</td>
                <td className="px-3 py-2 text-brand-red">{fmt(r.balance)}</td>
              </tr>
            ))}
            {!loading && records.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray">பதிவுகள் இல்லை.</td></tr>
            )}
          </tbody>
          {records.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-3 font-semibold">
                <td className="px-3 py-2" colSpan={6}>மொத்தம்</td>
                <td className="px-3 py-2">{fmt(totals.total)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2">{fmt(totals.received)}</td>
                <td className="px-3 py-2 text-brand-red">{fmt(totals.balance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
