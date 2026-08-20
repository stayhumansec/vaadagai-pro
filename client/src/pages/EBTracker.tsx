import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getEBReadings, getHouses, saveEBReading, saveEBReadingsBulk } from '../api';
import type { EBReading, House } from '../types';
import { fmt, mlabel, todayYM } from '../utils';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

const MONTH_SHORT_TA = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];
const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const UPLOAD_HEADERS = {
  house: 'வீடு எண்',
  month: 'மாதம் (YYYY-MM)',
  start: 'தொடக்க வாசிப்பு',
  end: 'முடிவு வாசிப்பு',
  rate: 'விலை (விருப்பம்)',
};

export function EBTracker() {
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseId, setHouseId] = useState<number | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [readings, setReadings] = useState<EBReading[]>([]);
  const [month, setMonth] = useState(todayYM());
  const [startReading, setStartReading] = useState(0);
  const [endReading, setEndReading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getHouses().then((list) => {
      setHouses(list);
      if (list.length > 0) setHouseId(list[0].id);
    });
    // Warm the exceljs chunk ahead of time so the download/upload buttons
    // don't hit a slow first-import delay (which can cost the click its
    // "user gesture" window on some mobile browsers and fail silently).
    import('../lib/excel');
  }, []);

  const load = async () => {
    if (!houseId) return;
    const data = await getEBReadings({ house_id: houseId, year });
    setReadings(data);
  };

  useEffect(() => { load(); }, [houseId, year]);

  const selectedHouse = houses.find((h) => h.id === houseId);
  const rate = selectedHouse?.eb_rate ?? 6.0;

  const readingByMonth = useMemo(() => {
    const map: Record<string, EBReading> = {};
    readings.forEach((r) => { map[r.month] = r; });
    return map;
  }, [readings]);

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { month: (language === 'en' ? MONTH_SHORT_EN : MONTH_SHORT_TA)[i], amount: readingByMonth[ym]?.amount ?? 0 };
  });

  const units = Math.max(0, endReading - startReading);
  const amount = Math.round(units * rate);

  const handleSave = async () => {
    if (!houseId) return;
    setSaving(true);
    try {
      await saveEBReading({ house_id: houseId, month, start_reading: startReading, end_reading: endReading });
      showToast(t('eb.saved'), 'ok');
      load();
    } catch {
      showToast(t('common.saveFailed'), 'err');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const { downloadExcel } = await import('../lib/excel');
      await downloadExcel(
        [
          {
            name: 'படிவம்',
            headers: [UPLOAD_HEADERS.house, UPLOAD_HEADERS.month, UPLOAD_HEADERS.start, UPLOAD_HEADERS.end, UPLOAD_HEADERS.rate],
            rows: [[1, todayYM(), 1000, 1120, '']],
          },
          {
            name: 'வீடுகள்',
            headers: ['வீடு எண்', 'பெயர்'],
            rows: houses.map((h) => [h.id, h.name]),
          },
        ],
        'eb-readings-template.xlsx'
      );
    } catch {
      showToast(t('eb.templateDownloadFailed'), 'err');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    try {
      const { readExcelSheet } = await import('../lib/excel');
      const rows = await readExcelSheet(file);
      const parsed = rows.map((r) => ({
        house_id: Number(r[UPLOAD_HEADERS.house]),
        // Excel often reinterprets a typed "YYYY-MM" as a real date cell;
        // readExcelSheet then hands it back as "YYYY-MM-DD" -- slicing to 7
        // chars handles both that case and plain "YYYY-MM" text.
        month: r[UPLOAD_HEADERS.month]?.slice(0, 7),
        start_reading: Number(r[UPLOAD_HEADERS.start] || 0),
        end_reading: Number(r[UPLOAD_HEADERS.end] || 0),
        rate: r[UPLOAD_HEADERS.rate] ? Number(r[UPLOAD_HEADERS.rate]) : undefined,
      }));
      if (parsed.length === 0) {
        showToast(t('eb.noDataInFile'), 'warn');
        return;
      }
      const result = await saveEBReadingsBulk(parsed);
      showToast(
        result.errors.length
          ? `${result.saved} ${t('eb.savedWithErrors')}, ${result.errors.length} ${t('eb.rowErrors')} ${result.errors.map((e) => e.row).join(', ')})`
          : `${result.saved} ${t('eb.uploaded')}`,
        result.errors.length ? 'warn' : 'ok'
      );
      load();
    } catch {
      showToast(t('eb.fileReadFailed'), 'err');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          {t('common.house')}
          <select
            value={houseId ?? ''}
            onChange={(e) => setHouseId(+e.target.value)}
            className="mt-1 block rounded-lg border border-gray-3 px-3 py-2"
          >
            {houses.map((h) => (
              <option key={h.id} value={h.id}>{h.id} — {h.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t('common.year')}
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="mt-1 block w-24 rounded-lg border border-gray-3 px-3 py-2"
          />
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloadingTemplate}
            className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {downloadingTemplate ? t('common.downloading') : t('eb.downloadTemplate')}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-gray-3 px-3 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {uploading ? t('common.uploading') : t('eb.bulkUpload')}
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
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
        {chartData.map((m, i) => {
          const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
          const reading = readingByMonth[ym];
          return (
            <div key={ym} className={`rounded-lg border p-2 text-center text-xs ${reading ? 'border-brand-blue/40 bg-brand-blue/5' : 'border-gray-3'}`}>
              <p className="text-gray">{m.month}</p>
              <p className="mt-1 font-medium text-navy">{reading ? `${reading.units} யூ` : '—'}</p>
              <p className="text-gray">{reading ? fmt(reading.amount) : ''}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-navy">{t('eb.newEntry')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            {t('common.month')}
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 block rounded-lg border border-gray-3 px-3 py-2" />
          </label>
          <label className="text-sm">
            {t('eb.startReading')}
            <input
              type="number"
              value={startReading}
              onChange={(e) => setStartReading(+e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-gray-3 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            {t('eb.endReading')}
            <input
              type="number"
              value={endReading}
              onChange={(e) => setEndReading(+e.target.value)}
              className="mt-1 block w-28 rounded-lg border border-gray-3 px-3 py-2"
            />
          </label>
          <div className="text-sm text-gray">
            {t('common.units')}: <span className="font-medium text-navy">{units}</span> · {t('eb.rate')}: <span className="font-medium text-navy">{fmt(amount)}</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !houseId}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-3 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-3 text-gray">
              <th className="px-3 py-2">{t('common.month')}</th>
              <th className="px-3 py-2">{t('eb.startReading')}</th>
              <th className="px-3 py-2">{t('eb.endReading')}</th>
              <th className="px-3 py-2">{t('common.units')}</th>
              <th className="px-3 py-2">{t('eb.rate')}</th>
              <th className="px-3 py-2">{t('eb.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-b border-gray-3 last:border-0">
                <td className="px-3 py-2">{mlabel(r.month, language)}</td>
                <td className="px-3 py-2">{r.start_reading}</td>
                <td className="px-3 py-2">{r.end_reading}</td>
                <td className="px-3 py-2">{r.units}</td>
                <td className="px-3 py-2">₹{r.rate}/யூ</td>
                <td className="px-3 py-2 font-medium">{fmt(r.amount)}</td>
              </tr>
            ))}
            {readings.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray">{t('common.noRecords')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
