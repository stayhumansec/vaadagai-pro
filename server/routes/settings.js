const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const DEFAULTS = { owner_name: '', default_eb_rate: '6.0' };

function readSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    owner_name: stored.owner_name ?? DEFAULTS.owner_name,
    default_eb_rate: Number(stored.default_eb_rate ?? DEFAULTS.default_eb_rate),
  };
}

router.get('/', auth, (req, res) => {
  res.json(readSettings());
});

router.put('/', auth, (req, res) => {
  const { owner_name, default_eb_rate } = req.body;
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const run = db.transaction(() => {
    if (owner_name !== undefined) upsert.run('owner_name', String(owner_name));
    if (default_eb_rate !== undefined) upsert.run('default_eb_rate', String(default_eb_rate));
  });
  run();
  res.json(readSettings());
});

module.exports = router;
