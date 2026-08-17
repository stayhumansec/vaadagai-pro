import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { addRentHistory, getHouses, getRentHistory, getTenantHistory } from '../api';
import type { House, RentHistoryEntry, TenantHistoryEntry } from '../types';
import { fmt, mlabel, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

interface RevisionForm {
  house_id: number;
  effective_from: string;
  rent: number;
  water: number;
  maintenance: number;
  eb_rate: number;
  note: string;
}

export function RentHistory() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseFilter, setHouseFilter] = useState<number | 'all'>(() => {
    const fromQuery = Number(searchParams.get('house'));
    return fromQuery > 0 ? fromQuery : 'all';
  });
  const [entries, setEntries] = useState<RentHistoryEntry[]>([]);
  const [tenantHistory, setTenantHistory] = useState<TenantHistoryEntry[]>([]);
  const [form, setForm] = useState<RevisionForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [houseList, history] = await Promise.all([
      getHouses(),
      getRentHistory(houseFilter === 'all' ? undefined : houseFilter),
    ]);
    setHouses(houseList);
    setEntries(history);
    if (houseFilter !== 'all') {
      setTenantHistory(await getTenantHistory(houseFilter));
    } else {
      setTenantHistory([]);
    }
  };

  useEffect(() => { load(); }, [houseFilter]);

  const houseName = (id: number) => houses.find((h) => h.id === id)?.name ?? `வீடு ${id}`;

  const currentIds = useMemo(() => {
    const month = todayYM();
    const latestByHouse: Record<number, RentHistoryEntry> = {};
    entries
      .filter((e) => e.effective_from <= month)
      .forEach((e) => {
        const existing = latestByHouse[e.house_id];
        if (!existing || e.effective_from > existing.effective_from) latestByHouse[e.house_id] = e;
      });
    return new Set(Object.values(latestByHouse).map((e) => e.id));
  }, [entries]);

  const openAdd = () => {
    const defaultHouse = houseFilter === 'all' ? houses[0]?.id : houseFilter;
    const house = houses.find((h) => h.id === defaultHouse);
    setForm({
      house_id: defaultHouse ?? 1,
      effective_from: todayYM(),
      rent: house?.default_rent ?? 5000,
      water: house?.water ?? 200,
      maintenance: house?.maintenance ?? 0,
      eb_rate: house?.eb_rate ?? 6.0,
      note: '',
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await addRentHistory(form);
      showToast(t('rentHistory.saved'), 'ok');
      setForm(null);
      load();
    } catch {
      showToast(t('common.saveFailed'), 'err');
    } finally {
      setSaving(false);
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
        <button
          type="button"
          onClick={openAdd}
          className="rounded-lg bg-brand-blue px-3 py-2 text-sm text-white hover:opacity-90"
        >
          {t('rentHistory.addRevision')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">{t('common.house')}</th>
              <th className="px-3 py-2">{t('rentHistory.effectiveFrom')}</th>
              <th className="px-3 py-2">{t('common.rent')}</th>
              <th className="px-3 py-2">{t('common.water')}</th>
              <th className="px-3 py-2">{t('common.maintenance')}</th>
              <th className="px-3 py-2">{t('common.ebRate')}</th>
              <th className="px-3 py-2">{t('common.note')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className={`border-b border-gray-3 last:border-0 ${currentIds.has(e.id) ? 'bg-brand-green/10' : ''}`}>
                <td className="px-3 py-2">{e.house_id} — {houseName(e.house_id)}</td>
                <td className="px-3 py-2">
                  {mlabel(e.effective_from, language)}
                  {currentIds.has(e.id) && (
                    <span className="ml-2 rounded-full bg-brand-green px-2 py-0.5 text-[10px] text-white">{t('rentHistory.current')}</span>
                  )}
                </td>
                <td className="px-3 py-2">{fmt(e.rent)}</td>
                <td className="px-3 py-2">{fmt(e.water)}</td>
                <td className="px-3 py-2">{fmt(e.maintenance)}</td>
                <td className="px-3 py-2">₹{e.eb_rate}/யூ</td>
                <td className="px-3 py-2 text-gray">{e.note || '—'}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray">{t('rentHistory.noRevisions')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {houseFilter === 'all' ? (
        <p className="text-xs text-gray">{t('rentHistory.selectHouseHint')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
          <p className="border-b border-gray-3 px-3 py-2 text-sm font-medium text-navy">{t('tenants.previousTenants')}</p>
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-3 text-gray">
                <th className="px-3 py-2">{t('common.name')}</th>
                <th className="px-3 py-2">{t('common.phone')}</th>
                <th className="px-3 py-2">{t('tenants.moveInDate')}</th>
                <th className="px-3 py-2">{t('tenants.moveOutDate')}</th>
              </tr>
            </thead>
            <tbody>
              {tenantHistory.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-3 last:border-0">
                  <td className="px-3 py-2">{entry.name}</td>
                  <td className="px-3 py-2">{entry.phone ?? '—'}</td>
                  <td className="px-3 py-2">{entry.move_in_date ?? '—'}</td>
                  <td className="px-3 py-2">{entry.move_out_date ?? '—'}</td>
                </tr>
              ))}
              {tenantHistory.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-gray">{t('common.noRecords')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal
          title={t('rentHistory.addTitle')}
          onClose={() => setForm(null)}
          footer={
            <>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm">
              {t('common.house')}
              <select
                value={form.house_id}
                onChange={(e) => setForm({ ...form, house_id: +e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
              >
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.id} — {h.name}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              {t('rentHistory.effectiveFromInput')}
              <input
                type="month"
                value={form.effective_from}
                onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
              />
            </label>

            <div className="grid grid-cols-4 gap-2">
              <label className="text-xs">
                {t('common.rent')} ₹
                <input type="number" value={form.rent} onChange={(e) => setForm({ ...form, rent: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                {t('common.water')} ₹
                <input type="number" value={form.water} onChange={(e) => setForm({ ...form, water: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                {t('common.maintenance')} ₹
                <input type="number" value={form.maintenance} onChange={(e) => setForm({ ...form, maintenance: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                EB ₹/யூ
                <input type="number" step="0.1" value={form.eb_rate} onChange={(e) => setForm({ ...form, eb_rate: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
            </div>

            <label className="block text-sm">
              {t('rentHistory.reasonNote')}
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
              />
            </label>

            <div className="rounded-lg bg-brand-blue/10 px-3 py-2 text-xs text-brand-blue">
              {t('rentHistory.futureOnlyHint')}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
