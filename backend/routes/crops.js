const express = require('express');
const router = express.Router();
const db = require('../db');
const { readAndValidateReadings } = require('../validateReadings');

//GET/POST/PUT/DELETE and validation for crop cards


function sendServerError(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

//validation rules only for crop card
function validateSharedFields(body) {
  if (typeof body.location !== 'string' || body.location.trim().length < 1) {
     return 'location is required';
  }
  if (body.location.length > 100) {
     return 'location must be at most 100 characters';
  }

  if (typeof body.target_min !== 'number' || Number.isNaN(body.target_min)) {
    return 'target_min is required';
  }
  if (body.target_min < 0 || body.target_min > 100) {
    return 'target_min must be between 0 and 100';
  }

  if (typeof body.target_max !== 'number' || Number.isNaN(body.target_max)) {
    return 'target_max is required';
  }
  if (body.target_max < 0 || body.target_max > 100) {
    return 'target_max must be between 0 and 100';
  }

  if (body.target_min >= body.target_max) {
    return 'target_min must be less than target_max';
  }

  if (typeof body.normal_water !== 'number' || Number.isNaN(body.normal_water)) {
    return 'normal_water is required';
  }
  if (body.normal_water <= 0 || body.normal_water > 10000) {
    return 'normal_water must be greater than 0 and at most 10000';
  }

  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== 'string' || body.notes.length > 500) {
      return 'notes must be a string up to 500 characters';
    }
  }

  return null;
}

//build object for SQL statements
function buildCropValues(body) {
  return {
    location: body.location.trim(),
    target_min: body.target_min,
    target_max: body.target_max,
    normal_water: body.normal_water,
    notes: body.notes ?? ''
  };
}

//GET (all crop cards)
router.get('/', function (req, res) {
  try {
    const rows = db.prepare('SELECT * FROM crops ORDER BY id').all();
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

//GET (one card)
router.get('/:id', function (req, res) {
  try {
    const row = db.prepare('SELECT * FROM crops WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Crop card not found' });
    }
    res.json(row);
  } catch (err) {
    sendServerError(res, err);
  }
});

//POST (create card)
router.post('/', function (req, res) {
  try {
    const body = req.body || {};

    //crop name must be exact match from sensor
    const readingsResult = readAndValidateReadings();
    if (!readingsResult.valid) {
      return res.status(500).json({ error: 'Sensor data file is invalid' });
    }

    if (typeof body.crop_name !== 'string' || body.crop_name.length === 0) {
      return res.status(400).json({ error: 'crop_name is required' });
    }

    const validCropNames = new Set(readingsResult.readings.map(r => r.crop_name));
    if (!validCropNames.has(body.crop_name)) {
      return res.status(400).json({ error: 'crop_name does not exist in sensor data' });
    }

    const fieldError = validateSharedFields(body);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    const existing = db.prepare('SELECT id FROM crops WHERE crop_name = ?').get(body.crop_name);
    if (existing) {
      return res.status(409).json({ error: 'crop_name already exists' });
    }

    const values = buildCropValues(body);
    values.crop_name = body.crop_name;

    const stmt = db.prepare(`
      INSERT INTO crops (crop_name, location, target_min, target_max, normal_water, notes)
      VALUES (@crop_name, @location, @target_min, @target_max, @normal_water, @notes)
    `);
    const result = stmt.run(values);

    const created = db.prepare('SELECT * FROM crops WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    sendServerError(res, err);
  }
});

//PUT (update card)
router.put('/:id', function (req, res) {
  try {
    const existing = db.prepare('SELECT * FROM crops WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Crop card not found' });
    }

    const body = req.body || {};

    //different crop name is rejected
    if (body.crop_name !== undefined && body.crop_name !== null && body.crop_name !== existing.crop_name) {
      return res.status(400).json({ error: 'crop_name cannot be changed' });
    }

    const merged = { ...existing, ...body };

    const fieldError = validateSharedFields(merged);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    const values = buildCropValues(merged);
    values.id = req.params.id;

    db.prepare(`
      UPDATE crops SET
        location = @location,
        target_min = @target_min,
        target_max = @target_max,
        normal_water = @normal_water,
        notes = @notes
      WHERE id = @id
    `).run(values);

    const updated = db.prepare('SELECT * FROM crops WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    sendServerError(res, err);
  }
});

//DELETE (remove card)
router.delete('/:id', function (req, res) {
  try {
    const result = db.prepare('DELETE FROM crops WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Crop card not found' });
    }
    res.json({ deleted: true, id: Number(req.params.id) });
  } catch (err) {
    sendServerError(res, err);
  }
});

module.exports = router;
