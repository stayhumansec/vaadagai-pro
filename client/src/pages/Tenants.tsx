import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { getHouses, getRecords, getRentHistory, updateHouse, uploadHouseProof } from '../api';
import type { House, HouseStatus, RentHistoryEntry, RentRecord } from '../types';
import { fmt, todayYM } from '../utils';
import { useToast } from '../components/Toast';

interface HouseForm {
  id: number;
  name: string;
  phone: string;
  status: HouseStatus;
  members: number;
  default_rent: number;
  water: number;
  maintenance: number;
  eb_rate: number;
  move_in_date: string;
  move_out_date: string;
  proof_type: string;
  proof_number: string;
}

function toForm(house: House): HouseForm {
  return {
    id: house.id,
    name: house.name,
    phone: house.phone ?? '',
    status: house.status,
    members: house.members,
    default_rent: house.default_rent,
    water: house.water,
    maintenance: house.maintenance,
    eb_rate: house.eb_rate,
    move_in_date: house.move_in_date ?? '',
    move_out_date: house.move_out_date ?? '',
    proof_type: house.proof_type,
    proof_number: house.proof_number ?? '',
  };
}

export function Tenants() {
  const { showToast } = useToast();
  const [houses, setHouses] = useState<House[]>([]);
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [editing, setEditing] = useState<HouseForm | null>(null);
  const [history, setHistory] = useState<RentHistoryEntry[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [houseList, recordList] = await Promise.all([getHouses(), getRecords({})]);
    setHouses(houseList);
    setRecords(recordList);
  };

  useEffect(() => { load(); }, []);

  const activeCount = houses.filter((h) => h.status === 'Active').length;
  const inactiveCount = houses.length - activeCount;

  const recordsByHouse = useMemo(() => {
    const map: Record<number, RentRecord[]> = {};
    records.forEach((r) => {
      (map[r.house_id] ??= []).push(r);
    });
    return map;
  }, [records]);

  const openEdit = (house: House) => {
    setEditing(toForm(house));
    setProofFile(null);
    getRentHistory(house.id).then(setHistory);
  };

  const closeEdit = () => {
    setEditing(null);
    setHistory([]);
    setProofFile(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateHouse(editing.id, {
        name: editing.name,
        phone: editing.phone || null,
        status: editing.status,
        members: editing.members,
        default_rent: editing.default_rent,
        water: editing.water,
        maintenance: editing.maintenance,
        eb_rate: editing.eb_rate,
        move_in_date: editing.move_in_date || null,
        move_out_date: editing.status === 'Inactive' ? editing.move_out_date || null : null,
        proof_type: editing.proof_type,
        proof_number: editing.proof_number || null,
      });
      if (proofFile) {
        await uploadHouseProof(editing.id, proofFile);
      }
      showToast('குடியிருப்பாளர் தகவல் சேமிக்கப்பட்டது', 'ok');
      closeEdit();
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
        <span className="rounded-full bg-brand-green/15 px-3 py-1 text-sm text-brand-green">செயலில் {activeCount}</span>
        <span className="rounded-full bg-gray-3 px-3 py-1 text-sm text-gray">செயலற்றது {inactiveCount}</span>
        <button
          type="button"
          onClick={() => houses[0] && openEdit(houses[0])}
          className="ml-auto rounded-lg bg-brand-blue px-3 py-2 text-sm text-white hover:opacity-90"
        >
          ➕ குடியிருப்பாளர் சேர்
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {houses.map((house) => {
          const houseRecords = recordsByHouse[house.id] ?? [];
          const thisMonth = houseRecords.find((r) => r.month === todayYM());
          const totalCollected = houseRecords.reduce((s, r) => s + r.received, 0);
          return (
            <button
              key={house.id}
              type="button"
              onClick={() => openEdit(house)}
              className="rounded-xl border border-gray-3 bg-white p-4 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                  {house.id}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy">{house.name}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${house.status === 'Active' ? 'bg-brand-green/15 text-brand-green' : 'bg-gray-3 text-gray'}`}>
                    {house.status === 'Active' ? 'செயலில்' : 'செயலற்றது'}
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray">
                <p>EB விலை: ₹{house.eb_rate}/யூ</p>
                <p>உறுப்பினர்கள்: {house.members}</p>
                <p>தொலைபேசி: {house.phone ?? '—'}</p>
                <p>குடி வந்தது: {house.move_in_date ?? '—'}</p>
                <p>இந்த மாதம்: {thisMonth ? thisMonth.pay_status : 'பதிவு இல்லை'}</p>
                <p className="font-medium text-navy">மொத்த வசூல்: {fmt(totalCollected)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {editing && (
        <Modal
          title={`வீடு ${editing.id} — குடியிருப்பாளர் தகவல்`}
          onClose={closeEdit}
          footer={
            <>
              <button type="button" onClick={closeEdit} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
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
            <div className="flex items-center justify-between rounded-lg bg-gray-4 px-3 py-2">
              <span className="text-sm text-navy">{editing.status === 'Active' ? 'செயலில்' : 'செயலற்றது'}</span>
              <button
                type="button"
                onClick={() => setEditing({ ...editing, status: editing.status === 'Active' ? 'Inactive' : 'Active' })}
                className={`relative h-6 w-11 rounded-full transition-colors ${editing.status === 'Active' ? 'bg-brand-green' : 'bg-gray-3'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editing.status === 'Active' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                வீடு எண்
                <select
                  value={editing.id}
                  onChange={(e) => {
                    const house = houses.find((h) => h.id === +e.target.value);
                    if (house) openEdit(house);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                >
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>{h.id} — {h.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                பெயர்
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                தொலைபேசி
                <input
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                உறுப்பினர்கள்
                <input
                  type="number"
                  value={editing.members}
                  onChange={(e) => setEditing({ ...editing, members: +e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <label className="text-xs">
                வாடகை ₹
                <input type="number" value={editing.default_rent} onChange={(e) => setEditing({ ...editing, default_rent: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                தண்ணீர் ₹
                <input type="number" value={editing.water} onChange={(e) => setEditing({ ...editing, water: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                பராமரிப்பு ₹
                <input type="number" value={editing.maintenance} onChange={(e) => setEditing({ ...editing, maintenance: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                EB ₹/யூ
                <input type="number" step="0.1" value={editing.eb_rate} onChange={(e) => setEditing({ ...editing, eb_rate: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                குடி வந்த தேதி
                <input
                  type="date"
                  value={editing.move_in_date}
                  onChange={(e) => setEditing({ ...editing, move_in_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                குடி வெளியேறிய தேதி
                <input
                  type="date"
                  value={editing.move_out_date}
                  disabled={editing.status === 'Active'}
                  onChange={(e) => setEditing({ ...editing, move_out_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5 disabled:bg-gray-4"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                ஆவண வகை
                <select
                  value={editing.proof_type}
                  onChange={(e) => setEditing({ ...editing, proof_type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                >
                  <option value="Aadhaar">Aadhaar</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="PAN">PAN</option>
                  <option value="Passport">Passport</option>
                </select>
              </label>
              <label className="text-sm">
                ஆவண எண்
                <input
                  value={editing.proof_number}
                  onChange={(e) => setEditing({ ...editing, proof_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            </div>

            <label className="block text-sm">
              ஆவண கோப்பு
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-xs"
              />
            </label>

            <div className="rounded-lg bg-brand-amber/15 px-3 py-2 text-xs text-brand-amber">
              வாடகை மாற்றங்களை வாடகை வரலாறு-ல் பதிவு செய்யவும்
            </div>

            {history.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-navy">வாடகை வரலாறு</p>
                <div className="overflow-x-auto rounded-lg border border-gray-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-3 text-gray">
                        <th className="px-2 py-1">முதல்</th>
                        <th className="px-2 py-1">வாடகை</th>
                        <th className="px-2 py-1">தண்ணீர்</th>
                        <th className="px-2 py-1">பராமரிப்பு</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b border-gray-3 last:border-0">
                          <td className="px-2 py-1">{h.effective_from}</td>
                          <td className="px-2 py-1">{fmt(h.rent)}</td>
                          <td className="px-2 py-1">{fmt(h.water)}</td>
                          <td className="px-2 py-1">{fmt(h.maintenance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
