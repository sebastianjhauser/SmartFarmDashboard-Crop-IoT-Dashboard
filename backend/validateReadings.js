//structural validation for backend/data/sensor-readings.json.
//this only checks SHAPE (counts, fields, types, timestamp format, status
//values), never whether a number is a sensible business value (0-100
//moisture etc). An out-of-range number on an otherwise structurally valid
//reading is not a structural error - it must still be returned as-is.

const fs = require('fs');
const path = require('path');

const READINGS_PATH = path.join(__dirname, 'data', 'sensor-readings.json');
const ALLOWED_CROPS = ['Tomato', 'Lettuce', 'Wheat', 'Maize'];
const ALLOWED_STATUSES = ['Online', 'Offline', 'Faulty'];
const REQUIRED_FIELDS = ['crop_name', 'timestamp', 'soil_moisture', 'temperature', 'rainfall', 'sensor_status', 'notes'];
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

//check 1 - top level value is an array of exactly 20 objects
function hasValidShape(data) {
  return Array.isArray(data) && data.length === 20;
}

//check 2 - exactly 5 readings for each of the 4 allowed crop names
function hasValidCropCounts(data) {
  const counts = { Tomato: 0, Lettuce: 0, Wheat: 0, Maize: 0 };

  for (const entry of data) {
    if (!entry || typeof entry.crop_name !== 'string' || !(entry.crop_name in counts)) {
      return false; //unknown or missing crop_name
    }
    counts[entry.crop_name] += 1;
  }

  return ALLOWED_CROPS.every(crop => counts[crop] === 5);
}

//check 3 - every entry has exactly the 7 required fields with the correct types
function hasValidFieldsAndTypes(entry) {
  if (!entry || typeof entry !== 'object') return false;

  const keys = Object.keys(entry);
  if (keys.length !== REQUIRED_FIELDS.length) return false;
  for (const field of REQUIRED_FIELDS) {
    if (!keys.includes(field)) return false;
  }

  if (typeof entry.crop_name !== 'string') return false;
  if (typeof entry.timestamp !== 'string') return false;
  if (typeof entry.sensor_status !== 'string') return false;
  if (typeof entry.notes !== 'string') return false;
  if (typeof entry.soil_moisture !== 'number') return false;
  if (typeof entry.temperature !== 'number') return false;
  if (typeof entry.rainfall !== 'number') return false;

  return true;
}

//check 4 - timestamp matches the required format AND is a real calendar date/time
//(e.g. 2026-02-30 must fail even though it matches the pattern)
function isValidTimestamp(value) {
  if (typeof value !== 'string' || !TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  //if JS "normalised" the date (e.g. Feb 30 -> Mar 2) the original value was fake
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

//check 5 - within a single crop, every timestamp must be distinct.
//the SAME timestamp is allowed across two different crops.
function hasDistinctTimestampsPerCrop(data) {
  const seenPerCrop = {};

  for (const entry of data) {
    const crop = entry.crop_name;
    const ts = entry.timestamp;
    if (!seenPerCrop[crop]) seenPerCrop[crop] = new Set();

    if (seenPerCrop[crop].has(ts)) {
      return false;
    }
    seenPerCrop[crop].add(ts);
  }

  return true;
}

//check 6 - sensor_status must be one of the 3 allowed values
function hasValidStatus(entry) {
  return ALLOWED_STATUSES.includes(entry.sensor_status);
}

//runs every check above and returns { valid: true } or { valid: false, reason }.
//reason is for server-side logging only, never sent to the client.
function validateReadingsFile(data) {
  if (!hasValidShape(data)) {
    return { valid: false, reason: 'top-level value is not an array of exactly 20 objects' };
  }

  if (!hasValidCropCounts(data)) {
    return { valid: false, reason: 'does not contain exactly 5 readings for each of Tomato, Lettuce, Wheat, Maize' };
  }

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];

    if (!hasValidFieldsAndTypes(entry)) {
      return { valid: false, reason: `entry ${i} is missing a required field or has the wrong type` };
    }

    if (!isValidTimestamp(entry.timestamp)) {
      return { valid: false, reason: `entry ${i} has an invalid timestamp: ${entry.timestamp}` };
    }

    if (!hasValidStatus(entry)) {
      return { valid: false, reason: `entry ${i} has an invalid sensor_status: ${entry.sensor_status}` };
    }
  }

  if (!hasDistinctTimestampsPerCrop(data)) {
    return { valid: false, reason: 'duplicate timestamp found within the same crop' };
  }

  return { valid: true };
}

//reads the file fresh from disk (no caching) and runs every structural check.
//returns { valid: true, readings } or { valid: false, reason }.
//"readings" is the raw array, returned exactly as read - never modified.
function readAndValidateReadings() {
  let raw;
  try {
    raw = fs.readFileSync(READINGS_PATH, 'utf8');
  } catch (err) {
    return { valid: false, reason: `could not read sensor-readings.json: ${err.message}` };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { valid: false, reason: `sensor-readings.json is not valid JSON: ${err.message}` };
  }

  const result = validateReadingsFile(data);
  if (!result.valid) {
    return result;
  }

  return { valid: true, readings: data };
}

module.exports = { readAndValidateReadings, validateReadingsFile };
