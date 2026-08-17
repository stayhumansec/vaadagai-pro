const express = require('express');
const auth = require('../middleware/auth');
const { runBackup } = require('../lib/backup');

const router = express.Router();

router.post('/run', auth, async (req, res) => {
  try {
    const result = await runBackup();
    if (!result.sent) {
      return res.status(400).json({ error: 'SMTP_HOST/PORT/USER/PASS மற்றும் BACKUP_EMAIL_TO ஐ .env-ல் அமைக்கவும்' });
    }
    res.json({ sent: true });
  } catch (err) {
    console.error('Backup failed:', err.message);
    res.status(500).json({ error: 'பேக்அப் அனுப்ப முடியவில்லை' });
  }
});

module.exports = router;
