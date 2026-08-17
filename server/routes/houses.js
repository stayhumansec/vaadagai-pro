const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const auth = require('../middleware/auth');

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

router.put('/:id', auth, (req, res) => {
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id);
  if (!house) return res.status(404).json({ error: 'House not found' });

  const updated = { ...house };
  for (const field of HOUSE_FIELDS) {
    if (req.body[field] !== undefined) updated[field] = req.body[field];
  }

  db.prepare(`
    UPDATE houses SET
      name = @name, phone = @phone, default_rent = @default_rent, water = @water,
      maintenance = @maintenance, members = @members, eb_rate = @eb_rate,
      proof_type = @proof_type, proof_number = @proof_number,
      move_in_date = @move_in_date, move_out_date = @move_out_date, status = @status
    WHERE id = @id
  `).run(updated);

  res.json(db.prepare('SELECT * FROM houses WHERE id = ?').get(req.params.id));
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
