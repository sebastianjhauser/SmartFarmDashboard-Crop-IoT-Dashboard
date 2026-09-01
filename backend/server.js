const express = require('express');
require('./db'); //loads db.js so the table is created/seeded as soon as the server starts

const cropRoutes = require('./routes/crops');
const readingRoutes = require('./routes/readings');

const app = express();

//allow parsing of JSON in requests
app.use(express.json());

//mount the crop card routes at /api/crops
app.use('/api/crops', cropRoutes);

//mount the read-only sensor readings route at /api/readings
app.use('/api/readings', readingRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SmartFarm backend running on http://localhost:${PORT}`);
});
