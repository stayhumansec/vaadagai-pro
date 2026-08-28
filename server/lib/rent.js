const db = require('../db');

function prevYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getEffectiveRent(houseId, month) {
  // Tie-break on id (not just effective_from): several revisions logged for
  // the same month -- e.g. a house edited more than once before its
  // upsertRentHistory call shipped -- would otherwise return in an
  // unspecified order among the tied rows.
  const row = db
    .prepare('SELECT * FROM rent_history WHERE house_id = ? AND effective_from <= ? ORDER BY effective_from DESC, id DESC LIMIT 1')
    .get(houseId, month);
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(houseId);

  return {
    rent: row?.rent ?? house?.default_rent ?? 0,
    water: row?.water ?? house?.water ?? 0,
    maintenance: row?.maintenance ?? house?.maintenance ?? 0,
    eb_rate: row?.eb_rate ?? house?.eb_rate ?? 6.0,
  };
}

// A rent/water/maintenance/EB-rate revision is keyed by the month it takes
// effect. Editing a house more than once in the same month is a correction
// to that same revision, not a second one -- update the existing row for
// (house_id, effective_from) instead of inserting a duplicate, which would
// otherwise leave rent_history with several conflicting rows for one month.
function upsertRentHistory(houseId, effectiveFrom, { rent, water, maintenance, eb_rate, note }) {
  // Same tie-break as getEffectiveRent: if this month already has more than
  // one row (pre-existing duplicates), update the one getEffectiveRent
  // would actually return, not an arbitrary tied row.
  const existing = db
    .prepare('SELECT id FROM rent_history WHERE house_id = ? AND effective_from = ? ORDER BY id DESC LIMIT 1')
    .get(houseId, effectiveFrom);

  if (existing) {
    db.prepare(`
      UPDATE rent_history SET rent = ?, water = ?, maintenance = ?, eb_rate = ?, note = ?
      WHERE id = ?
    `).run(rent, water, maintenance, eb_rate, note, existing.id);
    return db.prepare('SELECT * FROM rent_history WHERE id = ?').get(existing.id);
  }

  const info = db.prepare(`
    INSERT INTO rent_history (house_id, effective_from, rent, water, maintenance, eb_rate, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(houseId, effectiveFrom, rent, water, maintenance, eb_rate, note);
  return db.prepare('SELECT * FROM rent_history WHERE id = ?').get(info.lastInsertRowid);
}

module.exports = { prevYM, getEffectiveRent, upsertRentHistory };
