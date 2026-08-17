const db = require('./db');

const HOUSES = [
  { id: 1, name: 'கலைசெல்வி' },
  { id: 2, name: 'சங்கீதா' },
  { id: 3, name: 'மகராசி' },
  { id: 4, name: 'சுதா' },
  { id: 5, name: 'பாரிதா' },
  { id: 6, name: 'அன்பு' },
  { id: 7, name: 'சோழன்' },
  { id: 8, name: 'அசீப்' },
  { id: 9, name: 'Akila' },
  { id: 10, name: 'கோகிலா' },
  { id: 11, name: 'பிரபு' },
  { id: 12, name: 'சுவாமிநாதன்' },
  { id: 13, name: 'லட்சுமிகாந்தன்' },
  { id: 14, name: 'பாட்டி' },
  { id: 15, name: 'தீபக்' },
];

function seed() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO houses (id, name, default_rent, water, maintenance, members, eb_rate, status)
    VALUES (@id, @name, 5000, 200, 0, 1, 6.0, 'Active')
  `);

  const insertMany = db.transaction((houses) => {
    for (const house of houses) insert.run(house);
  });

  insertMany(HOUSES);

  const count = db.prepare('SELECT COUNT(*) AS n FROM houses').get().n;
  return { seeded: HOUSES.length, total: count };
}

if (require.main === module) {
  const result = seed();
  console.log(`Seeded houses. Total houses in DB: ${result.total}`);
}

module.exports = { seed, HOUSES };
