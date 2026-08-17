const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SESSION_DAYS = 7;

router.post('/google', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const token = jwt.sign(
      { sub: payload.sub, email: payload.email },
      process.env.JWT_SECRET,
      { expiresIn: `${SESSION_DAYS}d` }
    );
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (token, google_id, email, name, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(token, payload.sub, payload.email, payload.name, expiresAt);

    res.json({
      token,
      user: { googleId: payload.sub, email: payload.email, name: payload.name },
    });
  } catch (err) {
    console.error('Google auth failed:', err.message);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

router.post('/logout', auth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ success: true });
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
