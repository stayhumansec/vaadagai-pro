const db = require('../db');

function prevYM(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getEffectiveRent(houseId, month) {
  const row = db
    .prepare('SELECT * FROM rent_history WHERE house_id = ? AND effective_from <= ? ORDER BY effective_from DESC LIMIT 1')
    .get(houseId, month);
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(houseId);

  return {
    rent: row?.rent ?? house?.default_rent ?? 0,
    water: row?.water ?? house?.water ?? 0,
    maintenance: row?.maintenance ?? house?.maintenance ?? 0,
    eb_rate: row?.eb_rate ?? house?.eb_rate ?? 6.0,
  };
}

module.exports = { prevYM, getEffectiveRent };
