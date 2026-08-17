import { useEffect, useState } from 'react';
import { getHouses, getRecords } from '../api';
import type { House, RentRecord } from '../types';
import { fmt, mlabel, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';

interface DueHouse {
  house: House;
  balance: number;
  munBakki: number;
  status: string;
}

function buildMessage(due: DueHouse, month: string): string {
  const lines = [
    `வணக்கம் ${due.house.name} அம்மா/ஐயா,`,
    `வீடு ${due.house.id} — ${mlabel(month)} மாத வாடகை விவரம்:`,
  ];
  if (due.munBakki > 0) lines.push(`📌 முன் பாக்கி: ${fmt(due.munBakki)}`);
  lines.push(`💰 மொத்த நிலுவை: ${fmt(due.balance)}`);
  lines.push('தயவுசெய்து விரைவில் செலுத்தவும்.');
  lines.push('நன்றி 🙏');
  return lines.join('\n');
}

export function WhatsApp() {
  const { showToast } = useToast();
  const [month, setMonth] = useState(todayYM());
  const [dueHouses, setDueHouses] = useState<DueHouse[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [houses, records, prevRecords] = await Promise.all([
        getHouses(),
        getRecords({ month_from: month, month_to: month }),
        getRecords({ month_from: prevYM(month), month_to: prevYM(month) }),
      ]);

      const recordMap: Record<number, RentRecord> = {};
      records.forEach((r) => { recordMap[r.house_id] = r; });
      const prevMap: Record<number, RentRecord> = {};
      prevRecords.forEach((r) => { prevMap[r.house_id] = r; });

      const due = houses
        .filter((h) => h.status === 'Active')
        .map((house) => {
          const record = recordMap[house.id];
          return {
            house,
            balance: record?.balance ?? house.default_rent,
            munBakki: record?.mun_bakki ?? prevMap[house.id]?.balance ?? 0,
            status: record?.pay_status ?? 'none',
          };
        })
        .filter((d) => d.status !== 'full');

      setDueHouses(due);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const copyMessage = async (due: DueHouse) => {
    try {
      await navigator.clipboard.writeText(buildMessage(due, month));
      showToast('நகலெடுக்கப்பட்டது', 'ok');
    } catch {
      showToast('நகலெடுக்க முடியவில்லை', 'err');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-gray-3 px-3 py-2 text-sm"
        />
        <button type="button" onClick={load} className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4">
          ஏற்று
        </button>
      </div>

      {!loading && dueHouses.length === 0 && (
        <div className="rounded-xl border border-gray-3 bg-white p-6 text-center text-sm text-gray">
          நிலுவை இல்லை. அனைவரும் செலுத்திவிட்டனர். 🎉
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {dueHouses.map((due) => (
          <div key={due.house.id} className="rounded-xl border border-gray-3 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-navy">{due.house.id} — {due.house.name}</p>
              <span className="rounded-full bg-brand-red/15 px-2 py-0.5 text-[10px] text-brand-red">
                {due.status === 'partial' ? 'பகுதியாக' : due.status === 'none' ? 'இல்லை' : 'பதிவு இல்லை'}
              </span>
            </div>
            {due.munBakki > 0 && <p className="mt-1 text-xs text-brand-orange">📌 முன் பாக்கி: {fmt(due.munBakki)}</p>}
            <p className="mt-1 text-sm">நிலுவை: <span className="font-semibold text-brand-red">{fmt(due.balance)}</span></p>
            <p className="mt-1 text-xs text-gray">{due.house.phone ?? 'தொலைபேசி இல்லை'}</p>

            <div className="mt-3">
              {due.house.phone ? (
                <a
                  href={`https://wa.me/91${due.house.phone}?text=${encodeURIComponent(buildMessage(due, month))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-1.5 text-sm text-white hover:opacity-90"
                >
                  💬 WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => copyMessage(due)}
                  className="rounded-lg border border-gray-3 px-3 py-1.5 text-sm hover:bg-gray-4"
                >
                  📋 நகல்
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
