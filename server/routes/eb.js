const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { house_id, year } = req.query;
  let query = 'SELECT * FROM eb_readings WHERE 1=1';
  const params = [];
  if (house_id) { query += ' AND house_id = ?'; params.push(house_id); }
  if (year) { query += ' AND month LIKE ?'; params.push(`${year}-%`); }
  query += ' ORDER BY month';
  res.json(db.prepare(query).all(...params));
});

function upsertEBReading({ house_id, month, start_reading = 0, end_reading = 0, rate }) {
  const house = db.prepare('SELECT eb_rate FROM houses WHERE id = ?').get(house_id);
  const effectiveRate = rate ?? house?.eb_rate ?? 6.0;
  const units = Math.max(0, end_reading - start_reading);
  const amount = Math.round(units * effectiveRate);

  const existing = db.prepare('SELECT id FROM eb_readings WHERE house_id = ? AND month = ?').get(house_id, month);
  if (existing) {
    db.prepare('UPDATE eb_readings SET start_reading = ?, end_reading = ?, units = ?, rate = ?, amount = ? WHERE id = ?')
      .run(start_reading, end_reading, units, effectiveRate, amount, existing.id);
    return db.prepare('SELECT * FROM eb_readings WHERE id = ?').get(existing.id);
  }

  const info = db.prepare(`
    INSERT INTO eb_readings (house_id, month, start_reading, end_reading, units, rate, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(house_id, month, start_reading, end_reading, units, effectiveRate, amount);
  return db.prepare('SELECT * FROM eb_readings WHERE id = ?').get(info.lastInsertRowid);
}

router.post('/', auth, (req, res) => {
  if (!req.body.house_id || !req.body.month) return res.status(400).json({ error: 'house_id and month are required' });
  res.json(upsertEBReading(req.body));
});

router.post('/bulk', auth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be an array of readings' });
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

  const run = db.transaction((rows) => rows.map(upsertEBReading));
  const saved = run(valid);
  res.json({ saved: saved.length, errors });
});

module.exports = router;
