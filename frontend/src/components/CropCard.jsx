import { formatWater } from '../utils/analysis.js';

//single dashboard card

function CropCard({ crop, result, onEdit, onDelete, onViewHistory }) {
  function handleDelete() {
    const confirmed = window.confirm(`Delete the ${crop.crop_name} crop card? This will not affect the sensor data.`);
    if (confirmed) {
      onDelete(crop);
    }
  }

  return (
    <div className="crop-card">
      <h2>{crop.crop_name} - {crop.location}</h2>
      <p>
        Target moisture: {crop.target_min}% - {crop.target_max}% | Normal water: {crop.normal_water} L
      </p>
      {crop.notes && <p>Notes: {crop.notes}</p>}

      {result ? (
        <>
          <p>Latest: {result.latest_reading.timestamp}</p>
          <p className="reading-values">
            <span>Moisture: {result.latest_reading.soil_moisture}%</span>
            <span>Temperature: {result.latest_reading.temperature}C</span>
            <span>Rainfall: {result.latest_reading.rainfall}mm</span>
          </p>
          <p>
            Condition: {result.condition} - Recommended: {formatWater(result.recommended_water)}
          </p>
          {result.alerts.length > 0 && <p>Alert: {result.alerts.join(', ')}</p>}
          <p>Action: {result.action}</p>
        </>
      ) : (
        <p>Sensor data unavailable (N/A)</p>
      )}

      <div className="crop-card-actions">
        <button onClick={() => onEdit(crop)}>Edit</button>
        <button onClick={handleDelete}>Delete</button>
        <button onClick={() => onViewHistory(crop)}>View Sensor History</button>
      </div>
    </div>
  );
}

export default CropCard;
