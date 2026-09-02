const express = require('express');
require('./db'); //load db on server start

const cropRoutes = require('./routes/crops');
const readingRoutes = require('./routes/readings');

const app = express();

//allow json in requests
app.use(express.json());

//mount crop card route
app.use('/api/crops', cropRoutes);

//read-only sensor readings
app.use('/api/readings', readingRoutes);

//catch bad json body, unknown routes, thrown errors, etc
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SmartFarm backend running on http://localhost:${PORT}`);
});
