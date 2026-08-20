import { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { ReceiptCard } from '../components/ReceiptCard';
import { getEBReadings, getHouses, getRecords } from '../api';
import type { EBReading, House, RentRecord } from '../types';
import { fmt, mlabel, prevYM, todayYM } from '../utils';
import { shareImageViaWhatsApp } from '../lib/whatsappShare';
import { useToast } from '../components/Toast';
import { useLanguage } from '../context/LanguageContext';

interface DueHouse {
  house: House;
  record: RentRecord | null;
  ebReading: EBReading | null;
  balance: number;
  munBakki: number;
  status: string;
}

function waLink(due: DueHouse, month: string): string {
  return `https://wa.me/91${due.house.phone}?text=${encodeURIComponent(buildMessage(due, month))}`;
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
  const { t } = useLanguage();
  // Rent for the current month is usually only settled the following month,
  // so default to last month's dues rather than an always-empty current one.
  const [month, setMonth] = useState(prevYM(todayYM()));
  const [dueHouses, setDueHouses] = useState<DueHouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [queueActive, setQueueActive] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);
  const receiptRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const load = async () => {
    setLoading(true);
    setSentIds(new Set());
    setQueueActive(false);
    try {
      const [houses, records, prevRecords, ebReadings] = await Promise.all([
        getHouses(),
        getRecords({ month_from: month, month_to: month }),
        getRecords({ month_from: prevYM(month), month_to: prevYM(month) }),
        getEBReadings({ year: month.slice(0, 4) }),
      ]);

      const recordMap: Record<number, RentRecord> = {};
      records.forEach((r) => { recordMap[r.house_id] = r; });
      const prevMap: Record<number, RentRecord> = {};
      prevRecords.forEach((r) => { prevMap[r.house_id] = r; });
      const ebMap: Record<number, EBReading> = {};
      ebReadings.filter((e) => e.month === month).forEach((e) => { ebMap[e.house_id] = e; });

      const due = houses
        .filter((h) => h.status === 'Active')
        .map((house) => {
          const record = recordMap[house.id] ?? null;
          return {
            house,
            record,
            ebReading: ebMap[house.id] ?? null,
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
      showToast(t('common.copied'), 'ok');
    } catch {
      showToast(t('common.copyFailed'), 'err');
    }
  };

  // WhatsApp's click-to-chat links can't be sent programmatically -- there's
  // no API to push a message (with or without an attachment) straight into a
  // chat. The best available option is the Web Share API: when a receipt
  // exists for this house/month, render it off-screen, rasterize it, and
  // hand the image + message to WhatsApp via the native share sheet on
  // supporting mobile browsers, so it lands in the chat as one photo message
  // with the reminder text as its caption -- one tap away from actually
  // sending. Browsers that can't share files (mainly desktop) fall back to
  // downloading the image and opening WhatsApp with just the text pre-filled.
  const shareWithReceipt = async (due: DueHouse) => {
    const text = buildMessage(due, month);
    const el = due.record ? receiptRefs.current[due.house.id] : null;

    if (el) {
      try {
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff' });
        const result = await shareImageViaWhatsApp(canvas, `receipt_${month}_house${due.house.id}.png`, text, due.house.phone);
        if (result === 'fallback') showToast(t('whatsapp.shareFallbackHint'), 'warn');
        return;
      } catch {
        // fall through to the plain text reminder below
      }
    }

    // No recorded payment yet for this house/month -- nothing to show a
    // receipt for, so just open the text reminder.
    window.open(waLink(due, month), '_blank', 'noreferrer');
  };

  const queue = useMemo(() => dueHouses.filter((d) => d.house.phone), [dueHouses]);
  const noPhoneCount = dueHouses.length - queue.length;
  const current = queue[queueIndex];

  const startQueue = () => {
    if (queue.length === 0) return;
    setQueueIndex(0);
    setQueueActive(true);
  };

  const advanceQueue = () => {
    setQueueIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        setQueueActive(false);
        showToast(t('whatsapp.allSent'), 'ok');
        return 0;
      }
      return next;
    });
  };

  const sendCurrentAndAdvance = async () => {
    if (!current) return;
    setSentIds((prev) => new Set(prev).add(current.house.id));
    await shareWithReceipt(current);
    advanceQueue();
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
          {t('common.load')}
        </button>
        {!loading && queue.length > 0 && !queueActive && (
          <button
            type="button"
            onClick={startQueue}
            className="ml-auto rounded-lg bg-brand-green px-3 py-2 text-sm text-white hover:opacity-90"
          >
            📤 {t('whatsapp.sendAll')} ({queue.length})
          </button>
        )}
      </div>

      {!loading && dueHouses.length === 0 && (
        <div className="rounded-xl border border-gray-3 bg-white p-6 text-center text-sm text-gray">
          {t('dashboard.allPaid')} 🎉
        </div>
      )}

      {!loading && noPhoneCount > 0 && (
        <div className="rounded-lg bg-brand-amber/15 px-3 py-2 text-xs text-brand-amber">
          {noPhoneCount} {t('whatsapp.noPhoneHint')}
        </div>
      )}

      {queueActive && current && (
        <div className="rounded-xl border border-brand-green bg-brand-green/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-navy">
              {t('whatsapp.sending')} {queueIndex + 1} / {queue.length}
            </p>
            <button type="button" onClick={() => setQueueActive(false)} className="text-xs text-gray hover:underline">
              ✕ {t('common.cancel')}
            </button>
          </div>
          <p className="mt-2 font-medium text-navy">{current.house.id} — {current.house.name}</p>
          <p className="text-xs text-gray">{current.house.phone}</p>
          <p className="mt-1 text-sm">{t('common.balance')}: <span className="font-semibold text-brand-red">{fmt(current.balance)}</span></p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={sendCurrentAndAdvance}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-1.5 text-sm text-white hover:opacity-90"
            >
              💬 {t('whatsapp.openAndNext')}
            </button>
            <button type="button" onClick={advanceQueue} className="rounded-lg border border-gray-3 px-3 py-1.5 text-sm hover:bg-gray-4">
              {t('whatsapp.skip')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {dueHouses.map((due) => {
          const sent = sentIds.has(due.house.id);
          return (
            <div key={due.house.id} className={`rounded-xl border bg-white p-4 ${sent ? 'border-brand-green' : 'border-gray-3'}`}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-navy">{due.house.id} — {due.house.name}</p>
                {sent ? (
                  <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[10px] text-brand-green">✓ {t('whatsapp.sent')}</span>
                ) : (
                  <span className="rounded-full bg-brand-red/15 px-2 py-0.5 text-[10px] text-brand-red">
                    {due.status === 'partial' ? t('common.partial') : due.status === 'none' ? t('common.none') : t('common.noRecord')}
                  </span>
                )}
              </div>
              {due.munBakki > 0 && <p className="mt-1 text-xs text-brand-orange">📌 {t('common.prevBalance')}: {fmt(due.munBakki)}</p>}
              <p className="mt-1 text-sm">{t('common.balance')}: <span className="font-semibold text-brand-red">{fmt(due.balance)}</span></p>
              <p className="mt-1 text-xs text-gray">{due.house.phone ?? t('common.noPhone')}</p>

              <div className="mt-3">
                {due.house.phone ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSentIds((prev) => new Set(prev).add(due.house.id));
                      shareWithReceipt(due);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-1.5 text-sm text-white hover:opacity-90"
                  >
                    💬 WhatsApp
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => copyMessage(due)}
                    className="rounded-lg border border-gray-3 px-3 py-1.5 text-sm hover:bg-gray-4"
                  >
                    📋 {t('common.copy')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed left-[-9999px] top-0">
        {dueHouses.filter((d) => d.record).map((d) => (
          <ReceiptCard
            key={d.house.id}
            ref={(el) => { receiptRefs.current[d.house.id] = el; }}
            house={d.house}
            record={d.record!}
            ebReading={d.ebReading}
          />
        ))}
      </div>
    </div>
  );
}
