const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { house_id } = req.query;
  let query = 'SELECT * FROM rent_history WHERE 1=1';
  const params = [];
  if (house_id) { query += ' AND house_id = ?'; params.push(house_id); }
  query += ' ORDER BY house_id, effective_from DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', auth, (req, res) => {
  const { house_id, effective_from, rent, water = 0, maintenance = 0, eb_rate = 6.0, note = '' } = req.body;
  if (!house_id || !effective_from || rent === undefined) {
    return res.status(400).json({ error: 'house_id, effective_from, and rent are required' });
  }

  const info = db.prepare(`
    INSERT INTO rent_history (house_id, effective_from, rent, water, maintenance, eb_rate, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(house_id, effective_from, rent, water, maintenance, eb_rate, note);
  res.json(db.prepare('SELECT * FROM rent_history WHERE id = ?').get(info.lastInsertRowid));
});

module.exports = router;
