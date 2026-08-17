const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || './data/vaadagai.db';
const resolvedPath = path.isAbsolute(DB_PATH) ? DB_PATH : path.join(__dirname, '..', DB_PATH);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const db = new Database(resolvedPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS houses (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      default_rent INTEGER DEFAULT 5000,
      water INTEGER DEFAULT 200,
      maintenance INTEGER DEFAULT 0,
      members INTEGER DEFAULT 1,
      eb_rate REAL DEFAULT 6.0,
      proof_type TEXT DEFAULT 'Aadhaar',
      proof_number TEXT,
      move_in_date TEXT,
      move_out_date TEXT,
      status TEXT DEFAULT 'Active',
      proof_file_path TEXT
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      rent INTEGER DEFAULT 0,
      water INTEGER DEFAULT 0,
      eb INTEGER DEFAULT 0,
      maintenance INTEGER DEFAULT 0,
      mun_bakki INTEGER DEFAULT 0,
      total INTEGER DEFAULT 0,
      pay_status TEXT DEFAULT 'none',
      received INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(house_id, month),
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS eb_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      start_reading INTEGER DEFAULT 0,
      end_reading INTEGER DEFAULT 0,
      units INTEGER DEFAULT 0,
      rate REAL DEFAULT 6.0,
      amount INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(house_id, month),
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS rent_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      house_id INTEGER NOT NULL,
      effective_from TEXT NOT NULL,
      rent INTEGER NOT NULL,
      water INTEGER DEFAULT 0,
      maintenance INTEGER DEFAULT 0,
      eb_rate REAL DEFAULT 6.0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (house_id) REFERENCES houses(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      google_id TEXT NOT NULL,
      email TEXT,
      name TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_house_month ON records(house_id, month);
    CREATE INDEX IF NOT EXISTS idx_eb_readings_house_month ON eb_readings(house_id, month);
    CREATE INDEX IF NOT EXISTS idx_rent_history_house ON rent_history(house_id, effective_from);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);

  // records.other was renamed to records.maintenance -- for a DB created before
  // this change, rename the existing column in place so no data is lost.
  const recordColumns = db.prepare("PRAGMA table_info(records)").all().map((c) => c.name);
  if (recordColumns.includes('other') && !recordColumns.includes('maintenance')) {
    db.exec('ALTER TABLE records RENAME COLUMN other TO maintenance');
  }
}

migrate();

module.exports = db;
