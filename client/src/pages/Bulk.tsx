import { useEffect, useRef, useState } from 'react';
import { getEBReadings, getHouses, getRecords, getRentHistory, saveRecordsBulk } from '../api';
import type { EBReading, House, PayStatus, RentRecord } from '../types';
import { fmt, getEffectiveRent, prevYM, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

interface BulkRow {
  house: House;
  rent: number;
  water: number;
  maintenance: number;
  eb: number;
  mun_bakki: number;
  pay_status: PayStatus;
  received: number;
}

const PAST_UPLOAD_HEADERS = {
  house: 'வீடு எண்',
  month: 'மாதம் (YYYY-MM)',
  rent: 'வாடகை',
  water: 'தண்ணீர்',
  maintenance: 'பராமரிப்பு',
  eb: 'EB',
  received: 'பெற்ற தொகை',
  note: 'குறிப்பு (விருப்பம்)',
};

export function Bulk() {
  const { showToast } = useToast();
  const { t } = useLanguage();
  // This month's rent is normally only settled and recorded next month, so
  // default to last month's data instead of an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [houses, setHouses] = useState<House[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            maintenance: existing?.maintenance ?? eff.maintenance,
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

  useEffect(() => {
    getHouses().then(setHouses);
    // Warm the exceljs chunk ahead of time so the download/upload buttons
    // don't hit a slow first-import delay (which can cost the click its
    // "user gesture" window on some mobile browsers and fail silently).
    import('../lib/excel');
  }, []);

  const updateRow = (houseId: number, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.house.id === houseId ? { ...r, ...patch } : r)));
  };

  const rowTotal = (r: BulkRow) => r.rent + r.water + r.eb + r.maintenance + r.mun_bakki;

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const { downloadExcel } = await import('../lib/excel');
      const sampleHouse = houses[0];
      await downloadExcel(
        [
          {
            name: 'படிவம்',
            headers: [
              PAST_UPLOAD_HEADERS.house, PAST_UPLOAD_HEADERS.month, PAST_UPLOAD_HEADERS.rent,
              PAST_UPLOAD_HEADERS.water, PAST_UPLOAD_HEADERS.maintenance, PAST_UPLOAD_HEADERS.eb,
              PAST_UPLOAD_HEADERS.received, PAST_UPLOAD_HEADERS.note,
            ],
            rows: [[
              sampleHouse?.id ?? 1, prevYM(todayYM()), sampleHouse?.default_rent ?? 5000,
              sampleHouse?.water ?? 200, sampleHouse?.maintenance ?? 0, 0, sampleHouse?.default_rent ?? 5000, '',
            ]],
          },
          {
            name: 'வீடுகள்',
            headers: ['வீடு எண்', 'பெயர்', 'வாடகை', 'தண்ணீர்', 'பராமரிப்பு'],
            rows: houses.map((h) => [h.id, h.name, h.default_rent, h.water, h.maintenance]),
          },
        ],
        'past-rentals-template.xlsx'
      );
    } catch {
      showToast(t('bulk.templateDownloadFailed'), 'err');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { readExcelSheet } = await import('../lib/excel');
      const fileRows = await readExcelSheet(file);
      const parsed = fileRows.map((r) => ({
        house_id: Number(r[PAST_UPLOAD_HEADERS.house]),
        // Excel often reinterprets a typed "YYYY-MM" as a real date cell;
        // readExcelSheet then hands it back as "YYYY-MM-DD" -- slicing to 7
        // chars handles both that case and plain "YYYY-MM" text.
        month: r[PAST_UPLOAD_HEADERS.month]?.slice(0, 7),
        rent: Number(r[PAST_UPLOAD_HEADERS.rent] || 0),
        water: Number(r[PAST_UPLOAD_HEADERS.water] || 0),
        maintenance: Number(r[PAST_UPLOAD_HEADERS.maintenance] || 0),
        eb: Number(r[PAST_UPLOAD_HEADERS.eb] || 0),
        received: Number(r[PAST_UPLOAD_HEADERS.received] || 0),
        note: r[PAST_UPLOAD_HEADERS.note] || '',
      }));
      if (parsed.length === 0) {
        showToast(t('bulk.noDataInFile'), 'warn');
        return;
      }
      const result = await saveRecordsBulk(parsed);
      showToast(
        result.errors.length
          ? `${result.saved} ${t('bulk.savedWithErrors')}, ${result.errors.length} ${t('bulk.rowErrors')} ${result.errors.map((e) => e.row).join(', ')})`
          : `${result.saved} ${t('bulk.uploaded')}`,
        result.errors.length ? 'warn' : 'ok'
      );
      load();
    } catch {
      showToast(t('bulk.fileReadFailed'), 'err');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
          maintenance: r.maintenance,
          pay_status: r.pay_status,
          received: r.pay_status === 'full' ? rowTotal(r) : r.pay_status === 'none' ? 0 : r.received,
        }))
      );
      showToast(t('common.saved'), 'ok');
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
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloadingTemplate}
            className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {downloadingTemplate ? t('common.downloading') : t('bulk.downloadTemplate')}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {uploading ? t('common.uploading') : t('bulk.uploadPast')}
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
            onClick={handleSaveAll}
            disabled={saving || rows.length === 0}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? t('common.saving') : `💾 ${t('common.saveAll')}`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">{t('common.house')}</th>
              <th className="px-3 py-2">{t('common.name')}</th>
              <th className="px-3 py-2">{t('common.rent')}</th>
              <th className="px-3 py-2">{t('common.water')}</th>
              <th className="px-3 py-2">{t('common.eb')}</th>
              <th className="px-3 py-2">{t('common.prevBalance')}</th>
              <th className="px-3 py-2">{t('common.total')}</th>
              <th className="px-3 py-2">{t('common.status')}</th>
              <th className="px-3 py-2">{t('bulk.received')}</th>
              <th className="px-3 py-2">{t('common.balance')}</th>
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
                      <option value="full">{t('common.full')}</option>
                      <option value="partial">{t('common.partial')}</option>
                      <option value="none">{t('common.none')}</option>
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
              <tr><td colSpan={10} className="px-3 py-6 text-center text-gray">{t('monthly.noActiveHouses')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
