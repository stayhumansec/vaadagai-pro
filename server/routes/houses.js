const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const auth = require('../middleware/auth');
const { upsertRentHistory } = require('../lib/rent');

const router = express.Router();

const UPLOAD_PATH = process.env.UPLOAD_PATH || './uploads/';
const resolvedUploadPath = path.isAbsolute(UPLOAD_PATH)
  ? UPLOAD_PATH
  : path.join(__dirname, '..', '..', UPLOAD_PATH);
fs.mkdirSync(resolvedUploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resolvedUploadPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `house_${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const HOUSE_FIELDS = [
  'name', 'phone', 'default_rent', 'water', 'maintenance', 'members',
  'eb_rate', 'proof_type', 'proof_number', 'move_in_date', 'move_out_date', 'status',
];

router.get('/', auth, (req, res) => {
  const houses = db.prepare('SELECT * FROM houses ORDER BY id').all();
  res.json(houses);
});

router.post('/', auth, (req, res) => {
  const maxId = db.prepare('SELECT MAX(id) AS maxId FROM houses').get().maxId || 0;
  const newId = maxId + 1;
  const {
    name, phone, default_rent = 5000, water = 200, maintenance = 0, members = 1,
    eb_rate = 6.0, proof_type = 'Aadhaar', proof_number, move_in_date,
  } = req.body;

  db.prepare(`
    INSERT INTO houses (
      id, name, phone, default_rent, water, maintenance, members, eb_rate,
      proof_type, proof_number, move_in_date, move_out_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'Active')
  `).run(
    newId, name || `வீடு ${newId}`, phone || null, default_rent, water, maintenance,
    members, eb_rate, proof_type, proof_number || null, move_in_date || null
  );

  res.json(db.prepare('SELECT * FROM houses WHERE id = ?').get(newId));
});

router.get('/:id', auth, (req, res) => {
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
  if (!house) return res.status(404).json({ error: 'House not found' });
  res.json(house);
});

// Applies a partial house update, archiving the outgoing tenant into
// tenant_history if the name changed and logging a rent_history revision if
// rent/water/maintenance/eb_rate changed. Shared by the single-house PUT and
// the bulk-upload route so both get the same auto-history behavior. Must be
// called from inside a db.transaction.
function applyHouseUpdate(house, fields, note) {
  const updated = { ...house };
  for (const field of HOUSE_FIELDS) {
    if (fields[field] !== undefined) updated[field] = fields[field];
  }

  const today = new Date().toISOString().slice(0, 10);
  const nameChanged = house.name && String(updated.name).trim() !== String(house.name).trim();
  const rentChanged =
    Number(updated.default_rent) !== Number(house.default_rent) ||
    Number(updated.water) !== Number(house.water) ||
    Number(updated.maintenance) !== Number(house.maintenance) ||
    Number(updated.eb_rate) !== Number(house.eb_rate);

  // A different name on the same house means a new occupant has moved in --
  // archive the outgoing tenant's details before overwriting them, same as
  // the explicit "new tenant" flow does.
  if (nameChanged) {
    db.prepare(`
      INSERT INTO tenant_history (house_id, name, phone, members, proof_type, proof_number, move_in_date, move_out_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(house.id, house.name, house.phone, house.members, house.proof_type, house.proof_number, house.move_in_date, today);
  }

  db.prepare(`
    UPDATE houses SET
      name = @name, phone = @phone, default_rent = @default_rent, water = @water,
      maintenance = @maintenance, members = @members, eb_rate = @eb_rate,
      proof_type = @proof_type, proof_number = @proof_number,
      move_in_date = @move_in_date, move_out_date = @move_out_date, status = @status
    WHERE id = @id
  `).run(updated);

  // Any rent/water/maintenance/EB-rate change made here is a real revision --
  // log it to rent_history so it shows up alongside revisions added from the
  // Rent History page, instead of silently overwriting the house row.
  if (rentChanged) {
    const effectiveFrom = today.slice(0, 7);
    upsertRentHistory(updated.id, effectiveFrom, {
      rent: updated.default_rent, water: updated.water, maintenance: updated.maintenance, eb_rate: updated.eb_rate, note,
    });
  }

  return db.prepare('SELECT * FROM houses WHERE id = ?').get(house.id);
}

router.put('/:id', auth, (req, res) => {
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
  if (!house) return res.status(404).json({ error: 'House not found' });

  const run = db.transaction(() => applyHouseUpdate(house, req.body, 'Updated from Tenant page'));
  res.json(run());
});

router.post('/bulk', auth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be an array of tenant rows' });

  const errors = [];
  const valid = [];
  req.body.forEach((r, i) => {
    if (!r.house_id) {
      errors.push({ row: i + 1, error: 'house_id is required' });
      return;
    }
    const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(r.house_id);
    if (!house) {
      errors.push({ row: i + 1, error: `house_id ${r.house_id} not found` });
      return;
    }
    valid.push({ house, fields: r });
  });

  const run = db.transaction((rows) =>
    rows.map(({ house, fields }) => applyHouseUpdate(house, fields, 'Updated from bulk tenant upload'))
  );
  const saved = run(valid);
  res.json({ saved: saved.length, errors });
});

router.delete('/:id', auth, (req, res) => {
  const ownerEmail = db.prepare("SELECT value FROM settings WHERE key = 'owner_email'").get()?.value;
  if (!ownerEmail || req.user.email?.toLowerCase() !== ownerEmail) {
    return res.status(403).json({ error: 'Only the owner can delete a tenant' });
  }

  const house = db.prepare('SELECT id FROM houses WHERE id = ?').get(req.params.id);
  if (!house) return res.status(404).json({ error: 'House not found' });

  const run = db.transaction(() => {
    db.prepare('DELETE FROM records WHERE house_id = ?').run(house.id);
    db.prepare('DELETE FROM eb_readings WHERE house_id = ?').run(house.id);
    db.prepare('DELETE FROM rent_history WHERE house_id = ?').run(house.id);
    db.prepare('DELETE FROM tenant_history WHERE house_id = ?').run(house.id);
    db.prepare('DELETE FROM houses WHERE id = ?').run(house.id);
  });
  run();

  res.json({ success: true });
});

router.get('/:id/tenant-history', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM tenant_history WHERE house_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(rows);
});

router.post('/:id/new-tenant', auth, (req, res) => {
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
  if (!house) return res.status(404).json({ error: 'House not found' });

  const { name, phone, members, proof_type, proof_number, move_in_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const today = new Date().toISOString().slice(0, 10);

  const run = db.transaction(() => {
    if (house.name) {
      db.prepare(`
        INSERT INTO tenant_history (house_id, name, phone, members, proof_type, proof_number, move_in_date, move_out_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(house.id, house.name, house.phone, house.members, house.proof_type, house.proof_number, house.move_in_date, today);
    }

    db.prepare(`
      UPDATE houses SET
        name = ?, phone = ?, members = ?, proof_type = ?, proof_number = ?,
        move_in_date = ?, move_out_date = NULL, status = 'Active'
      WHERE id = ?
    `).run(name, phone || null, members || 1, proof_type || 'Aadhaar', proof_number || null, move_in_date || today, house.id);
  });
  run();

  res.json(db.prepare('SELECT * FROM houses WHERE id = ?').get(house.id));
});

router.post('/:id/proof', auth, upload.single('proof'), (req, res) => {
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
  if (!house) return res.status(404).json({ error: 'House not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded, or invalid file type' });

  db.prepare('UPDATE houses SET proof_file_path = ? WHERE id = ?').run(req.file.filename, req.params.id);
  res.json({ proof_file_path: req.file.filename });
});

module.exports = router;
