const fs = require('fs');
const path = require('path');

//structural validation for sensor readings json
const READINGS_PATH = path.join(__dirname, 'data', 'sensor-readings.json');
const ALLOWED_CROPS = ['Tomato', 'Lettuce', 'Wheat', 'Maize'];
const ALLOWED_STATUSES = ['Online', 'Offline', 'Faulty'];
const REQUIRED_FIELDS = ['crop_name', 'timestamp', 'soil_moisture', 'temperature', 'rainfall', 'sensor_status', 'notes'];
//regex for YYYY-MM-DDTHH:MM:SS 24-hour format
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

//array is exactly 20 objects
function hasValidShape(data) {
  return Array.isArray(data) && data.length === 20;
}

//exactly 5 readings for each of the 4 allowed crop names
function hasValidCropCounts(data) {
  const counts = { Tomato: 0, Lettuce: 0, Wheat: 0, Maize: 0 };

  for (const entry of data) {
    if (!entry || typeof entry.crop_name !== 'string' || !(entry.crop_name in counts)) {
      return false; //unknown or missing crop name
    }
    counts[entry.crop_name] += 1;
  }

  return ALLOWED_CROPS.every(crop => counts[crop] === 5);
}

//every entry has exactly 7 required fields with correct types
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

//timestamp matches the required format and is a real calendar date/time
function isValidTimestamp(value) {
  if (typeof value !== 'string' || !TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  //catch fake calendar dates
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
}

//dupe timestamps within same crop
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

//sensor status must be one of the 3 values
function hasValidStatus(entry) {
  return ALLOWED_STATUSES.includes(entry.sensor_status);
}

//run all checks and return status and reason
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

//read sensor readings fresh
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
