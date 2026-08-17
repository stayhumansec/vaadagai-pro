import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { getEBReadings, getHouses, getRecords, getRentHistory, triggerBackupEmail } from '../api';
import { todayYM } from '../utils';

export function Setup() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const sendBackupEmail = async () => {
    setEmailing(true);
    try {
      await triggerBackupEmail();
      showToast('பேக்அப் மின்னஞ்சலுக்கு அனுப்பப்பட்டது', 'ok');
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(message || 'அனுப்ப முடியவில்லை', 'err');
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
              r.house_id, houseName(r.house_id), r.month, r.rent, r.water, r.eb, r.other, r.mun_bakki, r.total, r.pay_status, r.received, r.balance, r.note,
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
      showToast('பேக்அப் பதிவிறக்கப்பட்டது', 'ok');
    } catch {
      showToast('பேக்அப் பதிவிறக்க முடியவில்லை', 'err');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">Google OAuth</h2>
        <p className="mt-1 text-sm text-gray">
          Client ID மற்றும் redirect URI சர்வர் / கிளையண்ட் .env கோப்புகளில் அமைக்கப்படுகின்றன.
        </p>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">உரிமையாளர்</h2>
        <p className="mt-1 text-sm text-gray">{user?.name ?? '—'}</p>
        <p className="text-sm text-gray">{user?.email ?? '—'}</p>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4">
        <h2 className="font-medium text-navy">தரவு பேக்அப்</h2>
        <p className="mt-1 text-sm text-gray">
          வீடுகள், அனைத்து மாத பதிவுகள், EB மற்றும் வாடகை வரலாறு — ஒரு Excel கோப்பாக (தனித்தனி shts) பதிவிறக்கவும்.
        </p>
        <button
          type="button"
          onClick={downloadFullBackup}
          disabled={exporting}
          className="mt-3 rounded-lg bg-brand-blue px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {exporting ? 'தயார் செய்கிறது...' : '⬇️ அனைத்து தரவையும் Excel ஆக பதிவிறக்கு'}
        </button>

        <div className="mt-4 border-t border-gray-3 pt-4">
          <p className="text-sm text-gray">
            ஒவ்வொரு நாளும் தானாக ஒரு பேக்அப் மின்னஞ்சல் அனுப்பப்படும் (சர்வரில் SMTP அமைக்கப்பட்டிருந்தால்). இப்போதே ஒரு சோதனை பேக்அப் அனுப்ப:
          </p>
          <button
            type="button"
            onClick={sendBackupEmail}
            disabled={emailing}
            className="mt-2 rounded-lg border border-gray-3 px-4 py-2 text-sm hover:bg-gray-4 disabled:opacity-60"
          >
            {emailing ? 'அனுப்புகிறது...' : '📧 இப்போது பேக்அப் அனுப்பு'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-3 bg-white p-4 text-sm text-gray">
        வாடகை Pro v1.0.0
      </div>
    </div>
  );
}
