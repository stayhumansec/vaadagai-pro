import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { addNewTenant, createHouse, deleteHouse, getHouses, getRecords, getRentHistory, getSettings, getTenantHistory, updateHouse, updateHousesBulk, uploadHouseProof } from '../api';
import type { House, HouseStatus, RentHistoryEntry, RentRecord, TenantHistoryEntry } from '../types';
import { fmt, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const TENANT_UPLOAD_HEADERS = {
  house: 'வீடு எண்',
  name: 'பெயர்',
  phone: 'தொலைபேசி',
  members: 'உறுப்பினர்கள்',
  rent: 'வாடகை',
  water: 'தண்ணீர்',
  maintenance: 'பராமரிப்பு',
  ebRate: 'EB விலை',
  moveIn: 'குடி வந்த தேதி',
  moveOut: 'குடி வெளியேறிய தேதி',
  status: 'நிலை (செயலில்/செயலற்றது)',
  proofType: 'ஆவண வகை',
  proofNumber: 'ஆவண எண்',
};

const TENANT_EXPORT_HEADERS = [
  TENANT_UPLOAD_HEADERS.house, TENANT_UPLOAD_HEADERS.name, TENANT_UPLOAD_HEADERS.phone,
  TENANT_UPLOAD_HEADERS.members, TENANT_UPLOAD_HEADERS.rent, TENANT_UPLOAD_HEADERS.water,
  TENANT_UPLOAD_HEADERS.maintenance, TENANT_UPLOAD_HEADERS.ebRate, TENANT_UPLOAD_HEADERS.moveIn,
  TENANT_UPLOAD_HEADERS.moveOut, TENANT_UPLOAD_HEADERS.status, TENANT_UPLOAD_HEADERS.proofType,
  TENANT_UPLOAD_HEADERS.proofNumber,
];

function houseExportRow(h: House): (string | number)[] {
  return [
    h.id, h.name, h.phone ?? '', h.members, h.default_rent, h.water, h.maintenance, h.eb_rate,
    h.move_in_date ?? '', h.move_out_date ?? '', h.status === 'Active' ? 'செயலில்' : 'செயலற்றது',
    h.proof_type, h.proof_number ?? '',
  ];
}

function parseStatus(v: string): HouseStatus | undefined {
  const s = v.trim().toLowerCase();
  if (['active', 'செயலில்'].includes(s)) return 'Active';
  if (['inactive', 'செயலற்றது'].includes(s)) return 'Inactive';
  return undefined;
}

interface NewTenantForm {
  name: string;
  phone: string;
  members: number;
  proof_type: string;
  proof_number: string;
  move_in_date: string;
}

const emptyNewTenantForm = (): NewTenantForm => ({
  name: '',
  phone: '',
  members: 1,
  proof_type: 'Aadhaar',
  proof_number: '',
  move_in_date: new Date().toISOString().slice(0, 10),
});

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
  const { t } = useLanguage();
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [editing, setEditing] = useState<HouseForm | null>(null);
  const [history, setHistory] = useState<RentHistoryEntry[]>([]);
  const [tenantHistory, setTenantHistory] = useState<TenantHistoryEntry[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newTenantMode, setNewTenantMode] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState<NewTenantForm>(emptyNewTenantForm());
  const [startingNewTenant, setStartingNewTenant] = useState(false);
  const [addingHouse, setAddingHouse] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [houseList, recordList] = await Promise.all([getHouses(), getRecords({})]);
    setHouses(houseList);
    setRecords(recordList);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    // Warm the exceljs chunk ahead of time so the download/upload buttons
    // don't hit a slow first-import delay (which can cost the click its
    // "user gesture" window on some mobile browsers and fail silently).
    import('../lib/excel');
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    getSettings()
      .then((s) => setIsOwner(!!s.owner_email && s.owner_email === user.email.toLowerCase()))
      .catch(() => {});
  }, [user?.email]);

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
    setNewTenantMode(false);
    setNewTenantForm(emptyNewTenantForm());
    getRentHistory(house.id).then(setHistory);
    getTenantHistory(house.id).then(setTenantHistory);
  };

  const closeEdit = () => {
    setEditing(null);
    setHistory([]);
    setTenantHistory([]);
    setProofFile(null);
    setNewTenantMode(false);
  };

  const handleNewTenant = async () => {
    if (!editing || !newTenantForm.name.trim()) return;
    setStartingNewTenant(true);
    try {
      await addNewTenant(editing.id, newTenantForm);
      showToast(t('tenants.newTenantSaved'), 'ok');
      const updatedHouses = await getHouses();
      setHouses(updatedHouses);
      const updatedHouse = updatedHouses.find((h) => h.id === editing.id);
      if (updatedHouse) openEdit(updatedHouse);
    } catch {
      showToast(t('common.saveFailed'), 'err');
    } finally {
      setStartingNewTenant(false);
    }
  };

  const handleAddHouse = async () => {
    setAddingHouse(true);
    try {
      const newHouse = await createHouse({});
      showToast(t('tenants.houseAdded'), 'ok');
      const updatedHouses = await getHouses();
      setHouses(updatedHouses);
      openEdit(newHouse);
    } catch {
      showToast(t('tenants.addHouseFailed'), 'err');
    } finally {
      setAddingHouse(false);
    }
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
      showToast(t('tenants.saved'), 'ok');
      closeEdit();
      load();
    } catch {
      showToast(t('common.saveFailed'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(t('tenants.deleteConfirm'))) return;
    setDeleting(true);
    try {
      await deleteHouse(editing.id);
      showToast(t('tenants.deleted'), 'ok');
      closeEdit();
      load();
    } catch {
      showToast(t('tenants.deleteFailed'), 'err');
    } finally {
      setDeleting(false);
    }
  };

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const { downloadExcel } = await import('../lib/excel');
      const sample = houses[0];
      await downloadExcel(
        [
          {
            name: 'படிவம்',
            headers: Object.values(TENANT_UPLOAD_HEADERS),
            rows: sample ? [houseExportRow(sample)] : [],
          },
          {
            name: 'வீடுகள்',
            headers: ['வீடு எண்', 'பெயர்'],
            rows: houses.map((h) => [h.id, h.name]),
          },
        ],
        'tenants-bulk-template.xlsx'
      );
    } catch {
      showToast(t('tenants.templateDownloadFailed'), 'err');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { downloadExcel } = await import('../lib/excel');
      await downloadExcel(
        [{ name: 'குடியிருப்பாளர்கள்', headers: TENANT_EXPORT_HEADERS, rows: houses.map(houseExportRow) }],
        'tenants-export.xlsx'
      );
    } catch {
      showToast(t('tenants.exportFailed'), 'err');
    } finally {
      setExporting(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { readExcelSheet } = await import('../lib/excel');
      const fileRows = await readExcelSheet(file);
      const parsed = fileRows
        .filter((r) => r[TENANT_UPLOAD_HEADERS.house])
        .map((r) => {
          const status = r[TENANT_UPLOAD_HEADERS.status] ? parseStatus(r[TENANT_UPLOAD_HEADERS.status]) : undefined;
          const row: { house_id: number } & Partial<House> = { house_id: Number(r[TENANT_UPLOAD_HEADERS.house]) };
          if (r[TENANT_UPLOAD_HEADERS.name]) row.name = r[TENANT_UPLOAD_HEADERS.name];
          if (r[TENANT_UPLOAD_HEADERS.phone]) row.phone = r[TENANT_UPLOAD_HEADERS.phone];
          if (r[TENANT_UPLOAD_HEADERS.members]) row.members = Number(r[TENANT_UPLOAD_HEADERS.members]);
          if (r[TENANT_UPLOAD_HEADERS.rent]) row.default_rent = Number(r[TENANT_UPLOAD_HEADERS.rent]);
          if (r[TENANT_UPLOAD_HEADERS.water]) row.water = Number(r[TENANT_UPLOAD_HEADERS.water]);
          if (r[TENANT_UPLOAD_HEADERS.maintenance]) row.maintenance = Number(r[TENANT_UPLOAD_HEADERS.maintenance]);
          if (r[TENANT_UPLOAD_HEADERS.ebRate]) row.eb_rate = Number(r[TENANT_UPLOAD_HEADERS.ebRate]);
          if (r[TENANT_UPLOAD_HEADERS.moveIn]) row.move_in_date = r[TENANT_UPLOAD_HEADERS.moveIn];
          if (r[TENANT_UPLOAD_HEADERS.proofType]) row.proof_type = r[TENANT_UPLOAD_HEADERS.proofType];
          if (r[TENANT_UPLOAD_HEADERS.proofNumber]) row.proof_number = r[TENANT_UPLOAD_HEADERS.proofNumber];
          if (status) {
            row.status = status;
            // An Active tenant can't also carry a move-out date -- clear it,
            // same invariant the single-house edit form enforces.
            row.move_out_date = status === 'Active' ? null : r[TENANT_UPLOAD_HEADERS.moveOut] || null;
          } else if (r[TENANT_UPLOAD_HEADERS.moveOut]) {
            row.move_out_date = r[TENANT_UPLOAD_HEADERS.moveOut];
          }
          return row;
        });
      if (parsed.length === 0) {
        showToast(t('tenants.noDataInFile'), 'warn');
        return;
      }
      const result = await updateHousesBulk(parsed);
      showToast(
        result.errors.length
          ? `${result.saved} ${t('tenants.savedWithErrors')}, ${result.errors.length} ${t('tenants.rowErrors')} ${result.errors.map((e) => e.row).join(', ')})`
          : `${result.saved} ${t('tenants.uploaded')}`,
        result.errors.length ? 'warn' : 'ok'
      );
      load();
    } catch {
      showToast(t('tenants.fileReadFailed'), 'err');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-green/15 px-3 py-1 text-sm text-brand-green">{t('common.active')} {activeCount}</span>
        <span className="rounded-full bg-gray-3 px-3 py-1 text-sm text-gray">{t('common.inactive')} {inactiveCount}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloadingTemplate}
            className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {downloadingTemplate ? t('common.downloading') : t('tenants.downloadTemplate')}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {uploading ? t('common.uploading') : t('tenants.bulkUpload')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadFile(file);
            }}
          />
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {exporting ? t('common.downloading') : t('tenants.export')}
          </button>
          <button
            type="button"
            onClick={handleAddHouse}
            disabled={addingHouse}
            className="rounded-lg bg-brand-blue px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
          >
            {addingHouse ? t('common.saving') : t('tenants.addHouse')}
          </button>
        </div>
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
                    {house.status === 'Active' ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray">
                <p>{t('common.ebRate')}: ₹{house.eb_rate}/யூ</p>
                <p>{t('tenants.members')}: {house.members}</p>
                <p>{t('common.phone')}: {house.phone ?? '—'}</p>
                <p>{t('tenants.moveInDate')}: {house.move_in_date ?? '—'}</p>
                <p>{t('common.month')}: {thisMonth ? thisMonth.pay_status : t('common.noRecord')}</p>
                <p className="font-medium text-navy">{t('tenants.totalCollected')}: {fmt(totalCollected)}</p>
              </div>
            </button>
          );
        })}
      </div>

      {editing && (
        <Modal
          title={`${t('common.house')} ${editing.id} — ${t('tenants.tenantInfoTitle')}`}
          onClose={closeEdit}
          footer={
            <>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="mr-auto rounded-lg border border-brand-red px-4 py-2 text-sm text-brand-red hover:bg-brand-red/10 disabled:opacity-60"
                >
                  {deleting ? t('common.saving') : t('tenants.delete')}
                </button>
              )}
              <button type="button" onClick={closeEdit} className="rounded-lg border border-gray-3 px-4 py-2 text-sm">
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
            <div className="flex items-center justify-between rounded-lg bg-gray-4 px-3 py-2">
              <span className="text-sm text-navy">{editing.status === 'Active' ? t('common.active') : t('common.inactive')}</span>
              <button
                type="button"
                onClick={() => setEditing({ ...editing, status: editing.status === 'Active' ? 'Inactive' : 'Active' })}
                className={`relative h-6 w-11 rounded-full transition-colors ${editing.status === 'Active' ? 'bg-brand-green' : 'bg-gray-3'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${editing.status === 'Active' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewTenantMode((v) => !v);
                setNewTenantForm(emptyNewTenantForm());
              }}
              className="w-full rounded-lg border border-dashed border-brand-blue px-3 py-2 text-sm text-brand-blue hover:bg-brand-blue/5"
            >
              {newTenantMode ? t('tenants.newTenantToggleOff') : t('tenants.newTenantToggleOn')}
            </button>

            {newTenantMode && (
              <div className="space-y-2 rounded-lg border border-brand-blue bg-brand-blue/5 p-3">
                <p className="text-xs text-gray">
                  {t('tenants.newTenantHint')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    {t('tenants.newName')}
                    <input
                      value={newTenantForm.name}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                    />
                  </label>
                  <label className="text-sm">
                    {t('common.phone')}
                    <input
                      value={newTenantForm.phone}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, phone: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs">
                    {t('tenants.members')}
                    <input
                      type="number"
                      value={newTenantForm.members}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, members: +e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                    />
                  </label>
                  <label className="text-xs">
                    {t('tenants.proofType')}
                    <select
                      value={newTenantForm.proof_type}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, proof_type: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                    >
                      <option value="Aadhaar">Aadhaar</option>
                      <option value="Voter ID">Voter ID</option>
                      <option value="PAN">PAN</option>
                      <option value="Passport">Passport</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    {t('tenants.proofNumber')}
                    <input
                      value={newTenantForm.proof_number}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, proof_number: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  {t('tenants.moveInDate')}
                  <input
                    type="date"
                    value={newTenantForm.move_in_date}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, move_in_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleNewTenant}
                  disabled={startingNewTenant || !newTenantForm.name.trim()}
                  className="w-full rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
                >
                  {startingNewTenant ? t('common.saving') : t('tenants.confirmNewTenant')}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                {t('common.houseNo')}
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
                {t('common.name')}
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                {t('common.phone')}
                <input
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                {t('tenants.members')}
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
                {t('common.rent')} ₹
                <input type="number" value={editing.default_rent} onChange={(e) => setEditing({ ...editing, default_rent: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                {t('common.water')} ₹
                <input type="number" value={editing.water} onChange={(e) => setEditing({ ...editing, water: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                {t('common.maintenance')} ₹
                <input type="number" value={editing.maintenance} onChange={(e) => setEditing({ ...editing, maintenance: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
              <label className="text-xs">
                EB ₹/யூ
                <input type="number" step="0.1" value={editing.eb_rate} onChange={(e) => setEditing({ ...editing, eb_rate: +e.target.value })} className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                {t('tenants.moveInDate')}
                <input
                  type="date"
                  value={editing.move_in_date}
                  onChange={(e) => setEditing({ ...editing, move_in_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                {t('tenants.moveOutDate')}
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
                {t('tenants.proofType')}
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
                {t('tenants.proofNumber')}
                <input
                  value={editing.proof_number}
                  onChange={(e) => setEditing({ ...editing, proof_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
                />
              </label>
            </div>

            <label className="block text-sm">
              {t('tenants.proofFile')}
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="mt-1 w-full text-xs"
              />
            </label>

            <div className="rounded-lg bg-brand-amber/15 px-3 py-2 text-xs text-brand-amber">
              {t('tenants.rentHistoryHint')}
            </div>

            {history.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-navy">{t('tenants.rentHistoryTitle')}</p>
                <div className="overflow-x-auto rounded-lg border border-gray-3">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-3 text-gray">
                        <th className="px-2 py-1">{t('rentHistory.effectiveFrom')}</th>
                        <th className="px-2 py-1">{t('common.rent')}</th>
                        <th className="px-2 py-1">{t('common.water')}</th>
                        <th className="px-2 py-1">{t('common.maintenance')}</th>
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

            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-sm font-medium text-navy">{t('tenants.previousTenants')}</p>
                <Link to={`/rent-history?house=${editing.id}`} className="text-xs text-brand-blue hover:underline">
                  {t('rentHistory.viewTenantHistory')}
                </Link>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-3 text-gray">
                      <th className="px-2 py-1">{t('common.name')}</th>
                      <th className="px-2 py-1">{t('common.phone')}</th>
                      <th className="px-2 py-1">{t('tenants.moveInDate')}</th>
                      <th className="px-2 py-1">{t('tenants.moveOutDate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantHistory.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-3 last:border-0">
                        <td className="px-2 py-1">{entry.name}</td>
                        <td className="px-2 py-1">{entry.phone ?? '—'}</td>
                        <td className="px-2 py-1">{entry.move_in_date ?? '—'}</td>
                        <td className="px-2 py-1">{entry.move_out_date ?? '—'}</td>
                      </tr>
                    ))}
                    {tenantHistory.length === 0 && (
                      <tr><td colSpan={4} className="px-2 py-4 text-center text-gray">{t('common.noRecords')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
