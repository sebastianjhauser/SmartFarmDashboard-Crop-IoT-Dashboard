//GET /api/readings - reads and structurally validates sensor-readings.json,
//then returns the raw readings. This route never calculates conditions,
//recommended water, alerts or Overall Farm Status - that all happens in React.

const express = require('express');
const router = express.Router();
const { readAndValidateReadings } = require('../validateReadings');

router.get('/', function (req, res) {
  //re-read the file from disk on every request (no caching) so Refresh Sensor
  //Data actually picks up a changed file without restarting the server
  const result = readAndValidateReadings();

  if (!result.valid) {
    console.error('Sensor data file failed structural validation:', result.reason);
    return res.status(500).json({ error: 'Sensor data file is invalid' });
  }

  res.json(result.readings);
});

module.exports = router;
