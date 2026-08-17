const jwt = require('jsonwebtoken');
const db = require('../db');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Session revoked' });

  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'Session expired' });
  }

  req.token = token;
  req.user = { googleId: session.google_id, email: session.email, name: session.name };
  next();
}

module.exports = auth;
