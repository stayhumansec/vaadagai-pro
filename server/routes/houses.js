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
  'eb_rate', 'proof_type', 'proof_number', 'move_in_date', 'move_out_date', 'status', 'advance', 'advance_date',
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
    eb_rate = 6.0, proof_type = 'Aadhaar', proof_number, move_in_date, advance = 0, advance_date,
  } = req.body;

  db.prepare(`
    INSERT INTO houses (
      id, name, phone, default_rent, water, maintenance, members, eb_rate,
      proof_type, proof_number, move_in_date, move_out_date, status, advance, advance_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'Active', ?, ?)
  `).run(
    newId, name || `வீடு ${newId}`, phone || null, default_rent, water, maintenance,
    members, eb_rate, proof_type, proof_number || null, move_in_date || null, advance, advance_date || null
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
  const today = new Date().toISOString().slice(0, 10);
  const incomingName = fields.name !== undefined ? String(fields.name).trim() : house.name;
  const nameChanged = house.name && incomingName !== String(house.name).trim();

  if (nameChanged) {
    // This row names a different tenant than the one currently on the
    // house. Before treating it as "a new tenant has moved in," check
    // whether it's actually a replay of a stint already on record --
    // re-uploading a reconstruction file (one row per tenancy, oldest
    // first) processes every row again on each upload, including ones for
    // tenants who were already archived last time.
    const incomingMoveIn = fields.move_in_date ?? null;
    const incomingMoveOut = fields.move_out_date ?? null;
    const alreadyRecorded = db.prepare(`
      SELECT id FROM tenant_history
      WHERE house_id = ? AND name = ? AND move_in_date IS ? AND move_out_date IS ?
    `).get(house.id, incomingName, incomingMoveIn, incomingMoveOut);

    if (alreadyRecorded) {
      // Nothing new here -- leave the live house exactly as it is, so a
      // re-upload can't clobber the current occupant with a stale
      // predecessor's data or spuriously re-archive the current occupant.
      return db.prepare('SELECT * FROM houses WHERE id = ?').get(house.id);
    }

    // A genuine new occupant: archive the current tenant's own details.
    // Prefer their own recorded move_out_date (this row displacing them
    // is itself the move-out event when they have none) over today's
    // date, which is only a reasonable guess for a live "just changed the
    // name" edit.
    db.prepare(`
      INSERT INTO tenant_history (house_id, name, phone, members, proof_type, proof_number, move_in_date, move_out_date, advance, advance_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(house.id, house.name, house.phone, house.members, house.proof_type, house.proof_number, house.move_in_date, house.move_out_date || today, house.advance, house.advance_date);
  }

  const updated = { ...house };
  for (const field of HOUSE_FIELDS) {
    if (fields[field] !== undefined) updated[field] = fields[field];
  }

  if (nameChanged) {
    // A new occupant starts with a clean slate -- a field this row doesn't
    // mention shouldn't silently carry over from whoever lived there
    // before (e.g. their phone number, or a stale move-in date from a row
    // with missing data).
    if (fields.phone === undefined) updated.phone = null;
    if (fields.members === undefined) updated.members = 1;
    if (fields.proof_type === undefined) updated.proof_type = 'Aadhaar';
    if (fields.proof_number === undefined) updated.proof_number = null;
    if (fields.move_in_date === undefined) updated.move_in_date = null;
    if (fields.move_out_date === undefined) updated.move_out_date = null;
    if (fields.advance === undefined) updated.advance = 0;
    if (fields.advance_date === undefined) updated.advance_date = null;
  }

  const rentChanged =
    Number(updated.default_rent) !== Number(house.default_rent) ||
    Number(updated.water) !== Number(house.water) ||
    Number(updated.maintenance) !== Number(house.maintenance) ||
    Number(updated.eb_rate) !== Number(house.eb_rate);

  db.prepare(`
    UPDATE houses SET
      name = @name, phone = @phone, default_rent = @default_rent, water = @water,
      maintenance = @maintenance, members = @members, eb_rate = @eb_rate,
      proof_type = @proof_type, proof_number = @proof_number,
      move_in_date = @move_in_date, move_out_date = @move_out_date, status = @status,
      advance = @advance, advance_date = @advance_date
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

// A bulk tenant row whose house_id has no matching house is a new house to
// create (e.g. re-uploading after a house was deleted, or setting up a
// fleet from scratch), not an error -- mirrors POST / but with the
// caller-supplied id instead of an auto-incremented one.
function createHouseFromBulkRow(id, fields) {
  const {
    name, phone, default_rent = 5000, water = 200, maintenance = 0, members = 1,
    eb_rate = 6.0, proof_type = 'Aadhaar', proof_number, move_in_date, move_out_date, status = 'Active',
    advance = 0, advance_date,
  } = fields;

  db.prepare(`
    INSERT INTO houses (
      id, name, phone, default_rent, water, maintenance, members, eb_rate,
      proof_type, proof_number, move_in_date, move_out_date, status, advance, advance_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name || `வீடு ${id}`, phone || null, default_rent, water, maintenance,
    members, eb_rate, proof_type, proof_number || null, move_in_date || null, move_out_date || null, status,
    advance, advance_date || null
  );

  return db.prepare('SELECT * FROM houses WHERE id = ?').get(id);
}

router.post('/bulk', auth, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body must be an array of tenant rows' });

  const errors = [];
  const valid = [];
  req.body.forEach((r, i) => {
    if (!r.house_id) {
      errors.push({ row: i + 1, error: 'house_id is required' });
      return;
    }
    valid.push(r);
  });

  // Look up each row's house inside the transaction, not in a pre-pass --
  // an upload legitimately has more than one row for the same new house_id
  // (e.g. a second row logging a later rent revision), and a pre-pass would
  // see "not found" for every occurrence and try to INSERT the same id twice.
  const run = db.transaction((rows) =>
    rows.map((fields) => {
      const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(fields.house_id);
      return house
        ? applyHouseUpdate(house, fields, 'Updated from bulk tenant upload')
        : createHouseFromBulkRow(fields.house_id, fields);
    })
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
        INSERT INTO tenant_history (house_id, name, phone, members, proof_type, proof_number, move_in_date, move_out_date, advance, advance_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(house.id, house.name, house.phone, house.members, house.proof_type, house.proof_number, house.move_in_date, house.move_out_date || today, house.advance, house.advance_date);
    }

    // Deposit belongs to the tenancy that paid it -- a new tenant starts at
    // 0/unset, not whatever the outgoing tenant's advance happened to be.
    db.prepare(`
      UPDATE houses SET
        name = ?, phone = ?, members = ?, proof_type = ?, proof_number = ?,
        move_in_date = ?, move_out_date = NULL, status = 'Active', advance = 0, advance_date = NULL
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

// proof_file_path is always a filename this route's own multer storage
// generated (house_<id>_<timestamp>.<ext>) -- never taken from the client on
// this path -- so joining it onto resolvedUploadPath is safe from traversal.
router.get('/:id/proof', auth, (req, res) => {
  const house = db.prepare('SELECT proof_file_path FROM houses WHERE id = ?').get(req.params.id);
  if (!house || !house.proof_file_path) return res.status(404).json({ error: 'No proof file uploaded' });

  const filePath = path.join(resolvedUploadPath, house.proof_file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Proof file not found on disk' });

  res.download(filePath, house.proof_file_path);
});

module.exports = router;
