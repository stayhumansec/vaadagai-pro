import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { PayChips } from '../components/PayChips';
import { autoGenerateRecords, getEBReadings, getHouses, getRecords, getRentHistory, saveRecord } from '../api';
import type { EBReading, House, PayStatus, RentHistoryEntry, RentRecord } from '../types';
import { fmt, getEffectiveRent, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';

interface EntryForm {
  rent: number;
  water: number;
  other: number;
  eb: number;
  mun_bakki: number;
  pay_status: PayStatus;
  received: number;
  note: string;
}

export function Monthly() {
  const { showToast } = useToast();
  const [month, setMonth] = useState(todayYM());
  const [houses, setHouses] = useState<House[]>([]);
  const [rentHistory, setRentHistory] = useState<RentHistoryEntry[]>([]);
  const [records, setRecords] = useState<Record<number, RentRecord>>({});
  const [prevRecords, setPrevRecords] = useState<Record<number, RentRecord>>({});
  const [ebReadings, setEbReadings] = useState<Record<number, EBReading>>({});
  const [loading, setLoading] = useState(false);
  const [activeHouse, setActiveHouse] = useState<House | null>(null);
  const [form, setForm] = useState<EntryForm | null>(null);
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
            other: existing.other,
            eb: existing.eb,
            mun_bakki: existing.mun_bakki,
            pay_status: existing.pay_status,
            received: existing.received,
            note: existing.note,
          }
        : {
            rent: eff.rent,
            water: eff.water,
            other: eff.maintenance,
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
    return form.rent + form.water + form.eb + form.other + form.mun_bakki;
  }, [form]);

  const received = useMemo(() => {
    if (!form) return 0;
    if (form.pay_status === 'full') return total;
    if (form.pay_status === 'none') return 0;
    return form.received;
  }, [form, total]);

  const balance = total - received;

  const handleAutoGenerate = async () => {
    const result = await autoGenerateRecords(month);
    showToast(
      `${result.created.length} பதிவுகள் உருவாக்கப்பட்டன, ${result.skipped.length} தவிர்க்கப்பட்டன`,
      result.missingEB.length ? 'warn' : 'ok'
    );
    load();
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
        other: form.other,
        pay_status: form.pay_status,
        received,
        note: form.note,
      });
      showToast('பதிவு சேமிக்கப்பட்டது', 'ok');
      closeEntry();
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
          onClick={handleAutoGenerate}
          className="rounded-lg bg-brand-blue px-3 py-2 text-sm text-white hover:opacity-90"
        >
          ✨ Auto உருவாக்கு
        </button>
      </div>

      {houses.length > 0 && (
        <div className={`rounded-lg px-4 py-2 text-sm ${missingEBHouses.length ? 'bg-brand-amber/15 text-brand-amber' : 'bg-brand-green/15 text-brand-green'}`}>
          {missingEBHouses.length
            ? `${missingEBHouses.length} வீடுகளுக்கு இந்த மாதத்திற்கான EB பதிவு இல்லை: ${missingEBHouses.map((h) => h.id).join(', ')}`
            : 'அனைத்து செயலில் உள்ள வீடுகளுக்கும் EB பதிவு உள்ளது.'}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">வீடு</th>
              <th className="px-3 py-2">பெயர்</th>
              <th className="px-3 py-2">வாடகை</th>
              <th className="px-3 py-2">முன் பாக்கி</th>
              <th className="px-3 py-2">EB</th>
              <th className="px-3 py-2">மொத்தம்</th>
              <th className="px-3 py-2">நிலை</th>
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
                  <td className="px-3 py-2">{eb ? fmt(eb.amount) : <span className="text-brand-red">இல்லை</span>}</td>
                  <td className="px-3 py-2 font-medium">{record ? fmt(record.total) : '—'}</td>
                  <td className="px-3 py-2">{record ? record.pay_status : 'பதிவு இல்லை'}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => openEntry(house)}
                      className="rounded border border-gray-3 px-2 py-1 text-xs hover:bg-gray-4"
                    >
                      {record ? '✏️ திருத்து' : '➕ சேர்'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && houses.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray">செயலில் உள்ள வீடுகள் இல்லை.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {activeHouse && form && (
        <Modal
          title={`வீடு ${activeHouse.id} — ${activeHouse.name}`}
          onClose={closeEntry}
          footer={
            <>
              <button type="button" onClick={closeEntry} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
                ரத்து
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {saving ? 'சேமிக்கிறது...' : 'சேமி'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                வாடகை ₹
                <input
                  type="number"
                  value={form.rent}
                  onChange={(e) => setForm({ ...form, rent: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                தண்ணீர் ₹
                <input
                  type="number"
                  value={form.water}
                  onChange={(e) => setForm({ ...form, water: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                பராமரிப்பு ₹
                <input
                  type="number"
                  value={form.other}
                  onChange={(e) => setForm({ ...form, other: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                EB தொகை ₹
                <input
                  type="number"
                  value={form.eb}
                  onChange={(e) => setForm({ ...form, eb: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            </div>

            <div className="rounded-lg bg-gray-4 px-3 py-2 text-sm text-gray">
              முன் பாக்கி ₹ <span className="float-right font-medium text-brand-orange">{fmt(form.mun_bakki)}</span>
            </div>
            <div className="rounded-lg bg-gray-4 px-3 py-2 text-sm text-gray">
              மொத்தம் ₹ <span className="float-right font-medium text-navy">{fmt(total)}</span>
            </div>

            <div>
              <p className="mb-1 text-sm text-gray">கட்டண நிலை</p>
              <PayChips value={form.pay_status} onChange={(pay_status) => setForm({ ...form, pay_status })} />
            </div>

            {form.pay_status === 'partial' && (
              <label className="block text-sm">
                பெற்ற தொகை ₹
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
                செலுத்திய தொகை <span className="float-right font-medium">{fmt(received)}</span>
              </div>
              <div className="rounded-lg bg-gray-4 px-3 py-2 text-gray">
                இருப்பு <span className="float-right font-medium text-brand-red">{fmt(balance)}</span>
              </div>
            </div>

            <label className="block text-sm">
              குறிப்பு
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
    </div>
  );
}
