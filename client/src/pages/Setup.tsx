import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/Toast';
import { getEBReadings, getHouses, getRecords, getRentHistory, getSettings, triggerBackupEmail, updateSettings } from '../api';
import type { Language } from '../i18n/translations';
import { todayYM } from '../utils';

export function Setup() {
  const { user } = useAuth();
  const { t, setLanguage } = useLanguage();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const [ownerName, setOwnerName] = useState('');
  const [defaultEbRate, setDefaultEbRate] = useState(6.0);
  const [defaultLanguage, setDefaultLanguage] = useState<Language>('ta');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setOwnerName(s.owner_name);
      setDefaultEbRate(s.default_eb_rate);
      if (s.default_language === 'en' || s.default_language === 'ta') setDefaultLanguage(s.default_language);
      setOwnerEmail(s.owner_email);
    });
  }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({ owner_name: ownerName, default_eb_rate: defaultEbRate, default_language: defaultLanguage, owner_email: ownerEmail });
      if (!localStorage.getItem('language')) setLanguage(defaultLanguage);
      showToast(t('settings.saved'), 'ok');
    } catch {
      showToast(t('common.saveFailed'), 'err');
    } finally {
      setSavingSettings(false);
    }
  };

  const sendBackupEmail = async () => {
    setEmailing(true);
    try {
      await triggerBackupEmail();
      showToast(t('settings.backupSent'), 'ok');
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(message || t('settings.backupSendFailed'), 'err');
    } finally {
      setEmailing(false);
    }
  };

  const downloadFullBackup = async () => {
    setExporting(true);
    try {
      const [houses, records, ebReadings, rentHistory] = await Promise.all([
        getHouses(),
        getRecords({}),
        getEBReadings({}),
        getRentHistory(),
      ]);
      const houseName = (id: number) => houses.find((h) => h.id === id)?.name ?? `வீடு ${id}`;
      const { downloadExcel } = await import('../lib/excel');

      await downloadExcel(
        [
          {
            name: 'Houses',
            headers: ['ID', 'பெயர்', 'தொலைபேசி', 'வாடகை', 'தண்ணீர்', 'பராமரிப்பு', 'உறுப்பினர்கள்', 'EB விலை', 'நிலை', 'குடி வந்தது', 'குடி வெளியேறியது'],
            rows: houses.map((h) => [
              h.id, h.name, h.phone ?? '', h.default_rent, h.water, h.maintenance, h.members, h.eb_rate, h.status, h.move_in_date ?? '', h.move_out_date ?? '',
            ]),
          },
          {
            name: 'Records',
            headers: ['வீடு', 'பெயர்', 'மாதம்', 'வாடகை', 'தண்ணீர்', 'EB', 'பராமரிப்பு', 'முன் பாக்கி', 'மொத்தம்', 'நிலை', 'வசூல்', 'இருப்பு', 'குறிப்பு'],
            rows: records.map((r) => [
              r.house_id, houseName(r.house_id), r.month, r.rent, r.water, r.eb, r.maintenance, r.mun_bakki, r.total, r.pay_status, r.received, r.balance, r.note,
            ]),
          },
          {
            name: 'EB Readings',
            headers: ['வீடு', 'பெயர்', 'மாதம்', 'தொடக்கம்', 'முடிவு', 'யூனிட்', 'விலை', 'தொகை'],
            rows: ebReadings.map((e) => [
              e.house_id, houseName(e.house_id), e.month, e.start_reading, e.end_reading, e.units, e.rate, e.amount,
            ]),
          },
          {
            name: 'Rent History',
            headers: ['வீடு', 'பெயர்', 'பயன்பாடு மாதம்', 'வாடகை', 'தண்ணீர்', 'பராமரிப்பு', 'EB விலை', 'குறிப்பு'],
            rows: rentHistory.map((h) => [
              h.house_id, houseName(h.house_id), h.effective_from, h.rent, h.water, h.maintenance, h.eb_rate, h.note,
            ]),
          },
        ],
        `vaadagai-pro-backup-${todayYM()}.xlsx`
      );
      showToast(t('settings.backupDownloaded'), 'ok');
    } catch {
      showToast(t('settings.backupDownloadFailed'), 'err');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">{t('settings.language')}</h2>
        <div className="mt-3 space-y-2">
          <label className="block text-sm">
            {t('settings.defaultLanguage')}
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value as Language)}
              className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
            >
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="en">English</option>
            </select>
          </label>
          <p className="text-xs text-gray">{t('settings.defaultLanguageHint')}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">{t('settings.googleOAuth')}</h2>
        <p className="mt-1 text-sm text-gray">
          {t('settings.googleOAuthHint')}
        </p>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">{t('settings.owner')}</h2>
        <p className="mt-1 text-sm text-gray">{user?.name ?? '—'}</p>
        <p className="text-sm text-gray">{user?.email ?? '—'}</p>

        <div className="mt-4 space-y-3 border-t border-gray-3 pt-4">
          <label className="block text-sm">
            {t('settings.ownerName')}
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder={t('settings.ownerNamePlaceholder')}
              className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            {t('settings.defaultEbRate')}
            <input
              type="number"
              step="0.1"
              value={defaultEbRate}
              onChange={(e) => setDefaultEbRate(+e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-3 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            {t('settings.ownerEmail')}
            <div className="mt-1 flex gap-2">
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@gmail.com"
                className="w-full rounded-lg border border-gray-3 px-2 py-1.5"
              />
              {user?.email && (
                <button
                  type="button"
                  onClick={() => setOwnerEmail(user.email)}
                  className="whitespace-nowrap rounded-lg border border-gray-3 px-2 py-1.5 text-xs hover:bg-gray-4"
                >
                  {t('settings.useMyEmail')}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray">{t('settings.ownerEmailHint')}</p>
          </label>
          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {savingSettings ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">{t('settings.backupTitle')}</h2>
        <p className="mt-1 text-sm text-gray">
          {t('settings.backupDesc')}
        </p>
        <button
          type="button"
          onClick={downloadFullBackup}
          disabled={exporting}
          className="mt-3 rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {exporting ? t('common.downloading') : t('settings.downloadAll')}
        </button>

        <div className="mt-4 border-t border-gray-3 pt-4">
          <p className="text-sm text-gray">
            {t('settings.autoBackupDesc')}
          </p>
          <button
            type="button"
            onClick={sendBackupEmail}
            disabled={emailing}
            className="mt-2 rounded-lg border border-gray-3 px-4 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {emailing ? t('settings.sending') : t('settings.sendBackupNow')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4 text-sm text-gray">
        வாடகை Pro v1.0.0
      </div>
    </div>
  );
}
