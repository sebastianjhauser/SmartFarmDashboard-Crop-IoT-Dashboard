const express = require('express');
const router = express.Router();
const { readAndValidateReadings } = require('../validateReadings');

//http layer - reads & validates structure of sensor readings, returns readings

router.get('/', function (req, res) {
  const result = readAndValidateReadings();

  if (!result.valid) {
    console.error('Sensor data file failed structural validation:', result.reason);
    return res.status(500).json({ error: 'Sensor data file is invalid' });
  }

  res.json(result.readings);
});

module.exports = router;