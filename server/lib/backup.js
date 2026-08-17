const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const db = require('../db');

function houseNameLookup(houses) {
  const map = {};
  houses.forEach((h) => { map[h.id] = h.name; });
  return (id) => map[id] ?? `வீடு ${id}`;
}

async function buildBackupWorkbook() {
  const houses = db.prepare('SELECT * FROM houses ORDER BY id').all();
  const records = db.prepare('SELECT * FROM records ORDER BY month, house_id').all();
  const ebReadings = db.prepare('SELECT * FROM eb_readings ORDER BY month, house_id').all();
  const rentHistory = db.prepare('SELECT * FROM rent_history ORDER BY house_id, effective_from').all();
  const houseName = houseNameLookup(houses);

  const workbook = new ExcelJS.Workbook();

  const addSheet = (name, headers, rows) => {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((col) => { col.width = 16; });
  };

  addSheet(
    'Houses',
    ['ID', 'பெயர்', 'தொலைபேசி', 'வாடகை', 'தண்ணீர்', 'பராமரிப்பு', 'உறுப்பினர்கள்', 'EB விலை', 'நிலை', 'குடி வந்தது', 'குடி வெளியேறியது'],
    houses.map((h) => [h.id, h.name, h.phone ?? '', h.default_rent, h.water, h.maintenance, h.members, h.eb_rate, h.status, h.move_in_date ?? '', h.move_out_date ?? ''])
  );
  addSheet(
    'Records',
    ['வீடு', 'பெயர்', 'மாதம்', 'வாடகை', 'தண்ணீர்', 'EB', 'பராமரிப்பு', 'முன் பாக்கி', 'மொத்தம்', 'நிலை', 'வசூல்', 'இருப்பு', 'குறிப்பு'],
    records.map((r) => [r.house_id, houseName(r.house_id), r.month, r.rent, r.water, r.eb, r.other, r.mun_bakki, r.total, r.pay_status, r.received, r.balance, r.note])
  );
  addSheet(
    'EB Readings',
    ['வீடு', 'பெயர்', 'மாதம்', 'தொடக்கம்', 'முடிவு', 'யூனிட்', 'விலை', 'தொகை'],
    ebReadings.map((e) => [e.house_id, houseName(e.house_id), e.month, e.start_reading, e.end_reading, e.units, e.rate, e.amount])
  );
  addSheet(
    'Rent History',
    ['வீடு', 'பெயர்', 'பயன்பாடு மாதம்', 'வாடகை', 'தண்ணீர்', 'பராமரிப்பு', 'EB விலை', 'குறிப்பு'],
    rentHistory.map((h) => [h.house_id, houseName(h.house_id), h.effective_from, h.rent, h.water, h.maintenance, h.eb_rate, h.note])
  );

  return workbook.xlsx.writeBuffer();
}

function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: +SMTP_PORT,
    secure: +SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function runBackup() {
  const { SMTP_FROM, SMTP_USER, BACKUP_EMAIL_TO } = process.env;
  const mailer = getMailer();
  if (!mailer || !BACKUP_EMAIL_TO) {
    console.log('[backup] SMTP not configured, skipping');
    return { sent: false, reason: 'not_configured' };
  }

  const buffer = await buildBackupWorkbook();
  const today = new Date().toISOString().slice(0, 10);

  await mailer.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: BACKUP_EMAIL_TO,
    subject: `வாடகை Pro பேக்அப் — ${today}`,
    text: `இணைக்கப்பட்ட Excel கோப்பில் ${today} நாளுக்கான முழு தரவும் உள்ளது.`,
    attachments: [{ filename: `vaadagai-pro-backup-${today}.xlsx`, content: buffer }],
  });

  console.log(`[backup] sent to ${BACKUP_EMAIL_TO} at ${new Date().toISOString()}`);
  return { sent: true };
}

module.exports = { runBackup, buildBackupWorkbook };
