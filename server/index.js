const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
require('./db');
const { seed } = require('./seed');
const authRoutes = require('./routes/auth');
const housesRoutes = require('./routes/houses');
const recordsRoutes = require('./routes/records');
const ebRoutes = require('./routes/eb');
const rentHistoryRoutes = require('./routes/rentHistory');
const reportsRoutes = require('./routes/reports');

seed();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/houses', housesRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/eb', ebRoutes);
app.use('/api/rent-history', rentHistoryRoutes);
app.use('/api/reports', reportsRoutes);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`வாடகை Pro server running on port ${PORT}`);
});

module.exports = app;
