const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { prevYM, getEffectiveRent } = require('../lib/rent');

const router = express.Router();

function upsertRecord({ house_id, month, rent = 0, water = 0, eb = 0, maintenance = 0, pay_status, received = 0, note = '' }) {
  const prevMonth = prevYM(month);
  const prevRecord = db.prepare('SELECT balance FROM records WHERE house_id = ? AND month = ?').get(house_id, prevMonth);
  const mun_bakki = prevRecord?.balance ?? 0;
  const total = rent + water + eb + maintenance + mun_bakki;
  const balance = total - received;
  // When a caller doesn't know the status up front (e.g. bulk-uploading past
  // rentals, where only the actual amount received is known), derive it from
  // received vs. the just-computed total instead of defaulting to 'none'.
  const status = pay_status ?? (received <= 0 ? 'none' : received >= total ? 'full' : 'partial');

  const existing = db.prepare('SELECT id FROM records WHERE house_id = ? AND month = ?').get(house_id, month);

  if (existing) {
    db.prepare(`
      UPDATE records SET
        rent = ?, water = ?, eb = ?, maintenance = ?, mun_bakki = ?, total = ?,
        pay_status = ?, received = ?, balance = ?, note = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(rent, water, eb, maintenance, mun_bakki, total, status, received, balance, note, existing.id);
    return db.prepare('SELECT * FROM records WHERE id = ?').get(existing.id);
  }

  const info = db.prepare(`
    INSERT INTO records (house_id, month, rent, water, eb, maintenance, mun_bakki, total, pay_status, received, balance, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(house_id, month, rent, water, eb, maintenance, mun_bakki, total, status, received, balance, note);
  return db.prepare('SELECT * FROM records WHERE id = ?').get(info.lastInsertRowid);
}

router.get('/', auth, (req, res) => {
  const { house_id, month_from, month_to } = req.query;
  let query = 'SELECT * FROM records WHERE 1=1';
  const params = [];
  if (house_id) { query += ' AND house_id = ?'; params.push(house_id); }
  if (month_from) { query += ' AND month >= ?'; params.push(month_from); }
  if (month_to) { query += ' AND month <= ?'; params.push(month_to); }
  query += ' ORDER BY month, house_id';
  res.json(db.prepare(query).all(...params));
});

router.get('/:house/:month', auth, (req, res) => {
  const record = db.prepare('SELECT * FROM records WHERE house_id = ? AND month = ?').get(req.params.house, req.params.month);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json(record);
});

router.post('/bulk', auth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be an array of records' });

  const errors = [];
  const valid = [];
  req.body.forEach((r, i) => {
    if (!r.house_id || !r.month || !/^\d{4}-\d{2}$/.test(r.month)) {
      errors.push({ row: i + 1, error: 'house_id and a valid month (YYYY-MM) are required' });
    } else if (!db.prepare('SELECT id FROM houses WHERE id = ?').get(r.house_id)) {
      errors.push({ row: i + 1, error: `house_id ${r.house_id} not found` });
    } else {
      valid.push(r);
    }
  });

  // Process oldest month first per house so mun_bakki (previous balance)
  // carries forward correctly when a whole history is uploaded in one batch,
  // regardless of the order rows appeared in the uploaded file.
  valid.sort((a, b) => (a.house_id - b.house_id) || String(a.month).localeCompare(String(b.month)));

  const run = db.transaction((records) => records.map(upsertRecord));
  const saved = run(valid);
  res.json({ saved: saved.length, errors });
});

router.post('/auto-generate', auth, (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ error: 'month is required' });
  const prevMonth = prevYM(month);

  const activeHouses = db.prepare("SELECT * FROM houses WHERE status = 'Active'").all();

  const existing = db.prepare('SELECT house_id FROM records WHERE month = ?').all(month);
  const existingIds = new Set(existing.map((r) => r.house_id));

  const ebReadings = db.prepare('SELECT * FROM eb_readings WHERE month = ?').all(month);
  const ebMap = {};
  ebReadings.forEach((e) => { ebMap[e.house_id] = e.amount; });

  const prevRecs = db.prepare('SELECT * FROM records WHERE month = ?').all(prevMonth);
  const prevMap = {};
  prevRecs.forEach((r) => { prevMap[r.house_id] = r.balance; });

  const created = [];
  const missingEB = [];
  const skipped = [];

  const insert = db.prepare(`
    INSERT INTO records (house_id, month, rent, water, eb, maintenance, mun_bakki, total, pay_status, received, balance, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'none', 0, ?, 'Auto generated')
  `);

  const houseIds = Array.isArray(req.body.house_ids) ? new Set(req.body.house_ids) : null;

  const run = db.transaction(() => {
    for (const house of activeHouses) {
      if (houseIds && !houseIds.has(house.id)) continue;
      if (existingIds.has(house.id)) { skipped.push(house.id); continue; }

      const { rent, water, maintenance } = getEffectiveRent(house.id, month);
      const eb = ebMap[house.id] ?? 0;
      if (ebMap[house.id] === undefined) missingEB.push(house.id);

      const mun_bakki = prevMap[house.id] ?? 0;
      const total = rent + water + eb + maintenance + mun_bakki;

      insert.run(house.id, month, rent, water, eb, maintenance, mun_bakki, total, total);
      created.push(house.id);
    }
  });
  run();

  res.json({ created, skipped, missingEB });
});

router.post('/', auth, (req, res) => {
  if (!req.body.house_id || !req.body.month) return res.status(400).json({ error: 'house_id and month are required' });
  res.json(upsertRecord(req.body));
});

router.delete('/:id', auth, (req, res) => {
  const ownerEmail = db.prepare("SELECT value FROM settings WHERE key = 'owner_email'").get()?.value;
  if (!ownerEmail || req.user.email?.toLowerCase() !== ownerEmail) {
    return res.status(403).json({ error: 'Only the owner can delete records' });
  }

  const record = db.prepare('SELECT id FROM records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: 'Record not found' });

  db.prepare('DELETE FROM records WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
