import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { PayChips } from '../components/PayChips';
import { autoGenerateRecords, getEBReadings, getHouses, getRecords, getRentHistory, saveRecord } from '../api';
import type { EBReading, House, PayStatus, RentHistoryEntry, RentRecord } from '../types';
import { fmt, getEffectiveRent, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

interface EntryForm {
  rent: number;
  water: number;
  maintenance: number;
  eb: number;
  mun_bakki: number;
  pay_status: PayStatus;
  received: number;
  note: string;
}

export function Monthly() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));
  const [houses, setHouses] = useState<House[]>([]);
  const [rentHistory, setRentHistory] = useState<RentHistoryEntry[]>([]);
  const [records, setRecords] = useState<Record<number, RentRecord>>({});
  const [prevRecords, setPrevRecords] = useState<Record<number, RentRecord>>({});
  const [ebReadings, setEbReadings] = useState<Record<number, EBReading>>({});
  const [loading, setLoading] = useState(false);
  const [activeHouse, setActiveHouse] = useState<House | null>(null);
  const [form, setForm] = useState<EntryForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [selectedHouseIds, setSelectedHouseIds] = useState<Set<number>>(new Set());
  const [autoGenerating, setAutoGenerating] = useState(false);

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
      setHouses(houseList.filter((h) => h.status === 'Active'));
      setRentHistory(history);

      const recMap: Record<number, RentRecord> = {};
      monthRecords.forEach((r) => { recMap[r.house_id] = r; });
      setRecords(recMap);

      const prevMap: Record<number, RentRecord> = {};
      prevMonthRecords.forEach((r) => { prevMap[r.house_id] = r; });
      setPrevRecords(prevMap);

      const ebMap: Record<number, EBReading> = {};
      ebList.filter((e) => e.month === month).forEach((e) => { ebMap[e.house_id] = e; });
      setEbReadings(ebMap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const missingEBHouses = houses.filter((h) => !ebReadings[h.id]);

  const openEntry = (house: House) => {
    const existing = records[house.id];
    const eff = getEffectiveRent(house, rentHistory, month);
    const ebAmount = ebReadings[house.id]?.amount ?? 0;
    const munBakki = prevRecords[house.id]?.balance ?? 0;

    setActiveHouse(house);
    setForm(
      existing
        ? {
            rent: existing.rent,
            water: existing.water,
            maintenance: existing.maintenance,
            eb: existing.eb,
            mun_bakki: existing.mun_bakki,
            pay_status: existing.pay_status,
            received: existing.received,
            note: existing.note,
          }
        : {
            rent: eff.rent,
            water: eff.water,
            maintenance: eff.maintenance,
            eb: ebAmount,
            mun_bakki: munBakki,
            pay_status: 'none',
            received: 0,
            note: '',
          }
    );
  };

  const closeEntry = () => {
    setActiveHouse(null);
    setForm(null);
  };

  const total = useMemo(() => {
    if (!form) return 0;
    return form.rent + form.water + form.eb + form.maintenance + form.mun_bakki;
  }, [form]);

  const received = useMemo(() => {
    if (!form) return 0;
    if (form.pay_status === 'full') return total;
    if (form.pay_status === 'none') return 0;
    return form.received;
  }, [form, total]);

  const balance = total - received;

  const openAutoModal = () => {
    setSelectedHouseIds(new Set(houses.map((h) => h.id)));
    setAutoModalOpen(true);
  };

  const toggleSelectedHouse = (houseId: number) => {
    setSelectedHouseIds((prev) => {
      const next = new Set(prev);
      if (next.has(houseId)) next.delete(houseId);
      else next.add(houseId);
      return next;
    });
  };

  const handleAutoGenerate = async () => {
    setAutoGenerating(true);
    try {
      const result = await autoGenerateRecords(month, Array.from(selectedHouseIds));
      showToast(
        `${result.created.length} ${t('monthly.recordsCreated')}, ${result.skipped.length} ${t('monthly.recordsSkipped')}`,
        result.missingEB.length ? 'warn' : 'ok'
      );
      setAutoModalOpen(false);
      load();
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!activeHouse || !form) return;
    setSaving(true);
    try {
      await saveRecord({
        house_id: activeHouse.id,
        month,
        rent: form.rent,
        water: form.water,
        eb: form.eb,
        maintenance: form.maintenance,
        pay_status: form.pay_status,
        received,
        note: form.note,
      });
      showToast(t('common.saved'), 'ok');
      closeEntry();
      load();
    } catch {
      showToast(t('common.saveFailed'), 'err');
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
          {t('common.load')}
        </button>
        <button
          type="button"
          onClick={openAutoModal}
          className="rounded-lg bg-brand-blue px-3 py-2 text-sm text-white hover:opacity-90"
        >
          {t('monthly.autoGenerate')}
        </button>
      </div>

      {houses.length > 0 && (
        <div className={`rounded-lg px-4 py-2 text-sm ${missingEBHouses.length ? 'bg-brand-amber/15 text-brand-amber' : 'bg-brand-green/15 text-brand-green'}`}>
          {missingEBHouses.length
            ? `${missingEBHouses.length} ${t('monthly.missingEB')}: ${missingEBHouses.map((h) => h.id).join(', ')}`
            : t('monthly.allEBPresent')}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">{t('common.house')}</th>
              <th className="px-3 py-2">{t('common.name')}</th>
              <th className="px-3 py-2">{t('common.rent')}</th>
              <th className="px-3 py-2">{t('common.prevBalance')}</th>
              <th className="px-3 py-2">{t('common.eb')}</th>
              <th className="px-3 py-2">{t('common.total')}</th>
              <th className="px-3 py-2">{t('common.status')}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {houses.map((house) => {
              const record = records[house.id];
              const eff = getEffectiveRent(house, rentHistory, month);
              const eb = ebReadings[house.id];
              return (
                <tr key={house.id} className="border-b border-gray-3 last:border-0">
                  <td className="px-3 py-2">{house.id}</td>
                  <td className="px-3 py-2">{house.name}</td>
                  <td className="px-3 py-2">{fmt(record?.rent ?? eff.rent)}</td>
                  <td className="px-3 py-2">{fmt(record?.mun_bakki ?? prevRecords[house.id]?.balance)}</td>
                  <td className="px-3 py-2">{eb ? fmt(eb.amount) : <span className="text-brand-red">{t('common.none')}</span>}</td>
                  <td className="px-3 py-2 font-medium">{record ? fmt(record.total) : '—'}</td>
                  <td className="px-3 py-2">{record ? record.pay_status : t('common.noRecord')}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openEntry(house)}
                      className="rounded border border-gray-3 px-2 py-1 text-xs hover:bg-gray-4"
                    >
                      {record ? `✏️ ${t('common.edit')}` : `➕ ${t('common.add')}`}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && houses.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray">{t('monthly.noActiveHouses')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {activeHouse && form && (
        <Modal
          title={`${t('common.house')} ${activeHouse.id} — ${activeHouse.name}`}
          onClose={closeEntry}
          footer={
            <>
              <button type="button" onClick={closeEntry} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
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
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                {t('common.rent')} ₹
                <input
                  type="number"
                  value={form.rent}
                  onChange={(e) => setForm({ ...form, rent: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                {t('common.water')} ₹
                <input
                  type="number"
                  value={form.water}
                  onChange={(e) => setForm({ ...form, water: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                {t('common.maintenance')} ₹
                <input
                  type="number"
                  value={form.maintenance}
                  onChange={(e) => setForm({ ...form, maintenance: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                {t('monthly.ebAmount')}
                <input
                  type="number"
                  value={form.eb}
                  onChange={(e) => setForm({ ...form, eb: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            </div>

            <div className="rounded-lg bg-gray-4 px-3 py-2 text-sm text-gray">
              {t('common.prevBalance')} ₹ <span className="float-right font-medium text-brand-orange">{fmt(form.mun_bakki)}</span>
            </div>
            <div className="rounded-lg bg-gray-4 px-3 py-2 text-sm text-gray">
              {t('common.total')} ₹ <span className="float-right font-medium text-navy">{fmt(total)}</span>
            </div>

            <div>
              <p className="mb-1 text-sm text-gray">{t('monthly.payStatusLabel')}</p>
              <PayChips value={form.pay_status} onChange={(pay_status) => setForm({ ...form, pay_status })} />
            </div>

            {form.pay_status === 'partial' && (
              <label className="block text-sm">
                {t('monthly.receivedAmount')}
                <input
                  type="number"
                  value={form.received}
                  onChange={(e) => setForm({ ...form, received: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-4 px-3 py-2 text-gray">
                {t('monthly.receivedAmountLabel')} <span className="float-right font-medium">{fmt(received)}</span>
              </div>
              <div className="rounded-lg bg-gray-4 px-3 py-2 text-gray">
                {t('common.balance')} <span className="float-right font-medium text-brand-red">{fmt(balance)}</span>
              </div>
            </div>

            <label className="block text-sm">
              {t('common.note')}
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                rows={2}
              />
            </label>
          </div>
        </Modal>
      )}

      {autoModalOpen && (
        <Modal
          title={t('monthly.autoGenerateTitle')}
          onClose={() => setAutoModalOpen(false)}
          footer={
            <>
              <button type="button" onClick={() => setAutoModalOpen(false)} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={autoGenerating || selectedHouseIds.size === 0}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {autoGenerating ? t('monthly.generating') : `${t('monthly.generate')} (${selectedHouseIds.size})`}
              </button>
            </>
          }
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 border-b border-gray-3 pb-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={selectedHouseIds.size === houses.length && houses.length > 0}
                onChange={(e) => setSelectedHouseIds(e.target.checked ? new Set(houses.map((h) => h.id)) : new Set())}
              />
              {t('monthly.selectAll')}
            </label>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {houses.map((house) => (
                <label key={house.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-4">
                  <input
                    type="checkbox"
                    checked={selectedHouseIds.has(house.id)}
                    onChange={() => toggleSelectedHouse(house.id)}
                  />
                  {t('common.house')} {house.id} — {house.name}
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
