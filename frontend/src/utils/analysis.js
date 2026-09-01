//all of the dashboard's business rules live in this one file.
//analyseCrop and calculateFarmStatus are the ONLY place a condition or farm
//status is worked out - every component that needs one calls these functions
//instead of re-deriving the rules itself.

//unique crop names from the sensor feed that don't already have a Crop Card -
//used to build the Add Crop Card dropdown
export function getAvailableCropNames(readings, crops) {
  if (!readings) return [];

  const usedNames = crops.map(crop => crop.crop_name);

  const uniqueNames = [];
  for (const reading of readings) {
    if (!uniqueNames.includes(reading.crop_name)) {
      uniqueNames.push(reading.crop_name);
    }
  }

  return uniqueNames.filter(name => !usedNames.includes(name));
}

//shared by CropCard and SensorHistory so both format recommended water the same way
export function formatWater(amount) {
  return amount === 'N/A' ? 'N/A' : `${amount} L`;
}

//exact, case-sensitive match on crop_name, then the greatest timestamp.
//string comparison is safe here because every timestamp uses the same
//fixed-width, zero-padded YYYY-MM-DDTHH:mm:ss format, so it sorts correctly.
export function getLatestReading(cropName, readings) {
  const matches = readings.filter(r => r.crop_name === cropName);
  return [...matches].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
}

//works out one Crop Card's condition, recommended water, alerts and action
//from its settings and its latest sensor reading. `reading` is always a real
//reading object here - callers only call this once they have one.
export function analyseCrop(cropCard, reading) {
  const alerts = [];
  let condition;
  let recommended_water;
  let action;

  //priority 1 - a Faulty or Offline sensor overrides everything else, even if
  //the numbers would otherwise look fine
  if (reading.sensor_status === 'Offline' || reading.sensor_status === 'Faulty') {
    condition = 'Sensor Problem';
    recommended_water = 'N/A';
    alerts.push('Check sensor');
    action = 'Check sensor';
  } else {
    //priority 2 - only checked for an Online reading: is any number outside
    //its normal business range?
    const invalidFields = [];
    if (reading.soil_moisture < 0 || reading.soil_moisture > 100) {
      invalidFields.push(`Invalid soil_moisture: ${reading.soil_moisture}`);
    }
    if (reading.temperature < 0 || reading.temperature > 50) {
      invalidFields.push(`Invalid temperature: ${reading.temperature}`);
    }
    if (reading.rainfall < 0 || reading.rainfall > 50) {
      invalidFields.push(`Invalid rainfall: ${reading.rainfall}`);
    }

    if (invalidFields.length > 0) {
      condition = 'Invalid Data';
      recommended_water = 'N/A';
      alerts.push(...invalidFields);
      action = 'Check reading';
    } else {
      //priority 3/4/5 - a valid Online reading, compare moisture to the
      //Crop Card's target range. Equal to either boundary counts as Healthy.
      if (reading.soil_moisture < cropCard.target_min) {
        condition = 'Dry';
        recommended_water = cropCard.normal_water;
        action = 'Water crop';
      } else if (reading.soil_moisture > cropCard.target_max) {
        condition = 'Too Wet';
        recommended_water = 0;
        action = 'Stop watering';
      } else {
        condition = 'Healthy';
        recommended_water = 0;
        action = 'Monitor';
      }

      //additional alerts - only for a valid Online reading, never change the
      //recommended water or action
      if (reading.temperature > 35) {
        alerts.push('High temperature');
      }
      if (reading.rainfall >= 5) {
        alerts.push('Rain detected');
      }
    }
  }

  return {
    crop: {
      id: cropCard.id,
      crop_name: cropCard.crop_name,
      location: cropCard.location,
      target_min: cropCard.target_min,
      target_max: cropCard.target_max,
      normal_water: cropCard.normal_water,
      notes: cropCard.notes,
    },
    latest_reading: {
      timestamp: reading.timestamp,
      soil_moisture: reading.soil_moisture,
      temperature: reading.temperature,
      rainfall: reading.rainfall,
      sensor_status: reading.sensor_status,
      notes: reading.notes,
    },
    condition,
    recommended_water,
    alerts,
    action,
  };
}

//works out the Overall Farm Status shown at the top of the page.
//crops = the raw Crop Card list, readings = current readings state (null
//until the first successful GET /api/readings), results = analyseCrop(...)
//output for whichever crops currently have a reading available.
export function calculateFarmStatus(crops, readings, results) {
  if (crops.length === 0) {
    return 'No Crops';
  }

  if (readings === null) {
    return 'Sensor Feed Unavailable';
  }

  const hasCritical = results.some(r => r.condition === 'Sensor Problem' || r.condition === 'Invalid Data');
  if (hasCritical) {
    return 'Critical';
  }

  const hasWatch = results.some(
    r => r.condition === 'Dry' || r.condition === 'Too Wet' || r.alerts.includes('High temperature')
  );
  if (hasWatch) {
    return 'Watch';
  }

  return 'Normal';
}
