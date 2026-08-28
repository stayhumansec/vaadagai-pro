import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { deleteRecord, deleteRecordsBulk, getHouses, getRecords, getSettings } from '../api';
import type { House, RentRecord } from '../types';
import { fmt, mlabel, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export function Ledger() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseFilter, setHouseFilter] = useState<number | 'all'>('all');
  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [monthFrom, setMonthFrom] = useState(prevYM(todayYM()));
  const [monthTo, setMonthTo] = useState(prevYM(todayYM()));
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.email) return;
    getSettings()
      .then((s) => setIsOwner(!!s.owner_email && s.owner_email === user.email.toLowerCase()))
      .catch(() => {});
  }, [user?.email]);

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
      setSelectedIds(new Set());
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
    const headers = ['வீடு', 'பெயர்', 'மாதம்', 'வாடகை', 'தண்ணீர்', 'EB', 'பராமரிப்பு', 'முன் பாக்கி', 'மொத்தம்', 'நிலை', 'வசூல்', 'இருப்பு'];
    const rows = records.map((r) => [
      r.house_id, houseName(r.house_id), r.month, r.rent, r.water, r.eb, r.maintenance, r.mun_bakki, r.total, r.pay_status, r.received, r.balance,
    ]);
    rows.push(['', '', '', '', '', '', '', '', totals.total, '', totals.received, totals.balance]);
    try {
      const { downloadExcel } = await import('../lib/excel');
      await downloadExcel([{ name: 'Ledger', headers, rows }], `ledger_${monthFrom}_${monthTo}.xlsx`);
    } catch {
      showToast(t('ledger.excelDownloadFailed'), 'err');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('ledger.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      await deleteRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      showToast(t('ledger.deleted'), 'ok');
    } catch {
      showToast(t('ledger.deleteFailed'), 'err');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === records.length ? new Set() : new Set(records.map((r) => r.id))));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t('ledger.bulkDeleteConfirm').replace('{count}', String(selectedIds.size)))) return;
    setBulkDeleting(true);
    try {
      await deleteRecordsBulk([...selectedIds]);
      setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      showToast(t('ledger.deleted'), 'ok');
    } catch {
      showToast(t('ledger.deleteFailed'), 'err');
    } finally {
      setBulkDeleting(false);
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
      showToast(t('ledger.imageDownloadFailed'), 'err');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          {t('common.house')}
          <select
            value={houseFilter}
            onChange={(e) => setHouseFilter(e.target.value === 'all' ? 'all' : +e.target.value)}
            className="mt-1 block rounded-lg border border-gray-3 px-3 py-2"
          >
            <option value="all">{t('common.all')}</option>
            {houses.map((h) => (
              <option key={h.id} value={h.id}>{h.id} — {h.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('ledger.from')}
          <input type="month" value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
        </label>
        <label className="text-sm">
          {t('ledger.to')}
          <input type="month" value={monthTo} onChange={(e) => setMonthTo(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
        </label>
        <button type="button" onClick={load} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
          {t('common.load')}
        </button>
        <div className="ml-auto flex gap-2">
          {isOwner && selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="rounded-lg border border-brand-red/40 px-3 py-2 text-sm text-brand-red hover:bg-brand-red/10 disabled:opacity-60"
            >
              🗑️ {t('ledger.deleteSelected')} ({selectedIds.size})
            </button>
          )}
          <button type="button" onClick={downloadXlsx} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
            ⬇️ {t('common.excel')}
          </button>
          <button type="button" onClick={downloadImage} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
            🖼️ {t('common.image')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">{t('common.total')}</p>
          <p className="mt-1 text-xl font-semibold text-navy">{fmt(totals.total)}</p>
        </div>
        <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">{t('common.collected')}</p>
          <p className="mt-1 text-xl font-semibold text-brand-green">{fmt(totals.received)}</p>
        </div>
        <div className="min-w-[120px] rounded-xl border border-gray-3 bg-white p-4">
          <p className="text-xs text-gray">{t('common.balance')}</p>
          <p className="mt-1 text-xl font-semibold text-brand-red">{fmt(totals.balance)}</p>
        </div>
      </div>

      <div ref={tableRef} className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              {isOwner && (
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedIds.size === records.length}
                    onChange={toggleSelectAll}
                    aria-label={t('ledger.selectAll')}
                  />
                </th>
              )}
              <th className="px-3 py-2">{t('common.house')}</th>
              <th className="px-3 py-2">{t('common.month')}</th>
              <th className="px-3 py-2">{t('common.rent')}</th>
              <th className="px-3 py-2">{t('common.water')}</th>
              <th className="px-3 py-2">{t('common.eb')}</th>
              <th className="px-3 py-2">{t('common.maintenance')}</th>
              <th className="px-3 py-2">{t('common.prevBalance')}</th>
              <th className="px-3 py-2">{t('common.total')}</th>
              <th className="px-3 py-2">{t('common.status')}</th>
              <th className="px-3 py-2">{t('common.collected')}</th>
              <th className="px-3 py-2">{t('common.balance')}</th>
              {isOwner && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="border-b border-gray-3 last:border-0">
                {isOwner && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                      aria-label={`${t('common.house')} ${r.house_id} — ${mlabel(r.month, language)}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2">{r.house_id} — {houseName(r.house_id)}</td>
                <td className="px-3 py-2">{mlabel(r.month, language)}</td>
                <td className="px-3 py-2">{fmt(r.rent)}</td>
                <td className="px-3 py-2">{fmt(r.water)}</td>
                <td className="px-3 py-2">{fmt(r.eb)}</td>
                <td className="px-3 py-2">{fmt(r.maintenance)}</td>
                <td className="px-3 py-2">{fmt(r.mun_bakki)}</td>
                <td className="px-3 py-2 font-medium">{fmt(r.total)}</td>
                <td className="px-3 py-2">{r.pay_status}</td>
                <td className="px-3 py-2">{fmt(r.received)}</td>
                <td className="px-3 py-2 text-brand-red">{fmt(r.balance)}</td>
                {isOwner && (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      className="rounded border border-brand-red/40 px-2 py-1 text-xs text-brand-red hover:bg-brand-red/10 disabled:opacity-60"
                    >
                      🗑️ {t('ledger.delete')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && records.length === 0 && (
              <tr><td colSpan={isOwner ? 13 : 11} className="px-3 py-6 text-center text-gray">{t('common.noRecords')}</td></tr>
            )}
          </tbody>
          {records.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-3 font-semibold">
                {isOwner && <td className="px-3 py-2"></td>}
                <td className="px-3 py-2" colSpan={7}>{t('common.total')}</td>
                <td className="px-3 py-2">{fmt(totals.total)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2">{fmt(totals.received)}</td>
                <td className="px-3 py-2 text-brand-red">{fmt(totals.balance)}</td>
                {isOwner && <td className="px-3 py-2"></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
