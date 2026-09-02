import { analyseCrop, formatWater } from '../utils/analysis.js';

//sensor readings for a crop (newest to oldest)

function SensorHistory({ crop, readings, onClose }) {
  const cropReadings = readings
    .filter(r => r.crop_name === crop.crop_name)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="sensor-history">
      <h2>Sensor History - {crop.crop_name}</h2>
      <button onClick={onClose}>Back to dashboard</button>

      {cropReadings.length === 0 && <p>No readings found for this crop.</p>}

      <ul>
        {cropReadings.map(reading => {
          const result = analyseCrop(crop, reading);
          return (
            <li key={reading.timestamp} className="sensor-history-row">
              <p>{reading.timestamp}</p>
              <p>
                Moisture: {reading.soil_moisture}% &nbsp;
                Temperature: {reading.temperature}C &nbsp;
                Rainfall: {reading.rainfall}mm &nbsp;
                Status: {reading.sensor_status}
              </p>
              <p>
                Condition: {result.condition}
                &nbsp; Recommended: {formatWater(result.recommended_water)}
              </p>
              {result.alerts.length > 0 && <p>Alert: {result.alerts.join(', ')}</p>}
              <p>Action: {result.action}</p>
              {reading.notes && <p>Notes: {reading.notes}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default SensorHistory;
