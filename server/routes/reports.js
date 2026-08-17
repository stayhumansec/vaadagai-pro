const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/monthly', auth, (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'year is required' });

  const rows = db.prepare(`
    SELECT
      month,
      COALESCE(SUM(total), 0) AS billed,
      COALESCE(SUM(received), 0) AS collected,
      COALESCE(SUM(balance), 0) AS balance
    FROM records
    WHERE month LIKE ?
    GROUP BY month
    ORDER BY month
  `).all(`${year}-%`);

  res.json(rows);
});

router.get('/houses', auth, (req, res) => {
  const { year } = req.query;
  if (!year) return res.status(400).json({ error: 'year is required' });

  const rows = db.prepare(`
    SELECT
      r.house_id,
      h.name,
      COUNT(*) AS months,
      COALESCE(SUM(r.total), 0) AS billed,
      COALESCE(SUM(r.received), 0) AS collected,
      COALESCE(SUM(r.balance), 0) AS balance
    FROM records r
    JOIN houses h ON h.id = r.house_id
    WHERE r.month LIKE ?
    GROUP BY r.house_id
    ORDER BY r.house_id
  `).all(`${year}-%`);

  res.json(rows);
});

router.get('/dashboard', auth, (req, res) => {
  const month = req.query.month || currentYM();
  const rows = db.prepare('SELECT * FROM records WHERE month = ?').all(month);

  const billed = rows.reduce((s, r) => s + r.total, 0);
  const collected = rows.reduce((s, r) => s + r.received, 0);
  const balance = rows.reduce((s, r) => s + r.balance, 0);
  const mun_bakki = rows.reduce((s, r) => s + r.mun_bakki, 0);
  const dueCount = rows.filter((r) => r.pay_status !== 'full').length;

  const activeCount = db.prepare("SELECT COUNT(*) AS n FROM houses WHERE status = 'Active'").get().n;
  const inactiveCount = db.prepare("SELECT COUNT(*) AS n FROM houses WHERE status = 'Inactive'").get().n;

  res.json({ month, billed, collected, balance, mun_bakki, dueCount, activeCount, inactiveCount });
});

module.exports = router;
