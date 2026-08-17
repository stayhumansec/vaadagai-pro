const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const DEFAULTS = { owner_name: '', default_eb_rate: '6.0', default_language: 'ta', owner_email: '' };

function readSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    owner_name: stored.owner_name ?? DEFAULTS.owner_name,
    default_eb_rate: Number(stored.default_eb_rate ?? DEFAULTS.default_eb_rate),
    default_language: stored.default_language ?? DEFAULTS.default_language,
    owner_email: stored.owner_email ?? DEFAULTS.owner_email,
  };
}

router.get('/', auth, (req, res) => {
  res.json(readSettings());
});

router.put('/', auth, (req, res) => {
  const { owner_name, default_eb_rate, default_language, owner_email } = req.body;
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const run = db.transaction(() => {
    if (owner_name !== undefined) upsert.run('owner_name', String(owner_name));
    if (default_eb_rate !== undefined) upsert.run('default_eb_rate', String(default_eb_rate));
    if (default_language !== undefined && ['ta', 'en'].includes(default_language)) {
      upsert.run('default_language', default_language);
    }
    if (owner_email !== undefined) upsert.run('owner_email', String(owner_email).trim().toLowerCase());
  });
  run();
  res.json(readSettings());
});

module.exports = router;
