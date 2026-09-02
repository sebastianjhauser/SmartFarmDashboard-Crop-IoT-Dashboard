//all dashboard business logic.

//unique crop names from sensor readings that dont have crop card yet
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

//cropCard & sensor history format recommended water same way
export function formatWater(amount) {
  return amount === 'N/A' ? 'N/A' : `${amount} L`;
}

//greatest timestamp string comparison
export function getLatestReading(cropName, readings) {
  const matches = readings.filter(r => r.crop_name === cropName);
  return [...matches].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
}

//crop card condition, recommended water, alearts, action
export function analyseCrop(cropCard, reading) {
  const alerts = [];
  let condition;
  let recommended_water;
  let action;

  //faulty / offline sensor - overrides all other checks (no recommended water or action)
  if (reading.sensor_status === 'Offline' || reading.sensor_status === 'Faulty') {
    condition = 'Sensor Problem';
    recommended_water = 'N/A';
    alerts.push('Check sensor');
    action = 'Check sensor';
  } else {
    //check if any value is outside normal range

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
      //compare moisture to target range

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

      //additional alerts
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

//farm status
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
