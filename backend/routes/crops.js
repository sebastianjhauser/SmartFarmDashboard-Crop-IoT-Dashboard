//validation and CRUD routes for Crop Cards (the ONLY thing this route file
//touches is the SQLite crops table - sensor readings are read-only and
//never written to from here).

const express = require('express');
const router = express.Router();
const db = require('../db');
const { readAndValidateReadings } = require('../validateReadings');

//every route below hits this on an unexpected DB/file failure - one place to
//log it and send the same generic error the API contract requires
function sendServerError(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

//checks the fields that are the same for Create and Edit: location,
//target_min, target_max, normal_water, notes. Returns the FIRST problem found
//as a plain string, or null if everything is fine - the API only ever
//shows one error message at a time.
function validateSharedFields(body) {
  if (typeof body.location !== 'string' || body.location.trim().length < 1 || body.location.length > 100) {
    return 'location is required';
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

//builds the values object that gets passed straight into the SQL statements,
//filling in defaults the same way for Create and Edit
function buildCropValues(body) {
  return {
    location: body.location.trim(),
    target_min: body.target_min,
    target_max: body.target_max,
    normal_water: body.normal_water,
    notes: body.notes ?? '',
  };
}

//GET - all crop cards
router.get('/', function (req, res) {
  try {
    const rows = db.prepare('SELECT * FROM crops ORDER BY id').all();
    res.json(rows);
  } catch (err) {
    sendServerError(res, err);
  }
});

//GET - one crop card by id. The frontend doesn't call this (Edit already has
//the crop card in memory), but it's part of the required API.
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

//POST - create a crop card
router.post('/', function (req, res) {
  try {
    const body = req.body || {};

    //crop_name must exactly match a name found in a structurally valid
    //sensor feed. Re-read and re-validate the file here rather than trusting
    //whatever the frontend dropdown sent.
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

    const existing = db.prepare('SELECT id FROM crops WHERE crop_name = ?').get(body.crop_name);
    if (existing) {
      return res.status(409).json({ error: 'crop_name already exists' });
    }

    const fieldError = validateSharedFields(body);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
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

//PUT - update an existing crop card. crop_name can never change.
router.put('/:id', function (req, res) {
  try {
    const existing = db.prepare('SELECT * FROM crops WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Crop card not found' });
    }

    const body = req.body || {};

    //crop_name may be omitted or sent unchanged - a DIFFERENT value is rejected
    if (body.crop_name !== undefined && body.crop_name !== null && body.crop_name !== existing.crop_name) {
      return res.status(400).json({ error: 'crop_name cannot be changed' });
    }

    const fieldError = validateSharedFields(body);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    const values = buildCropValues(body);
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

//DELETE - removes only the crop card. The sensor JSON file is never touched.
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
