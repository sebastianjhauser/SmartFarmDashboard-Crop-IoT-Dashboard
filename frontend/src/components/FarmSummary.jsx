//top summary bar: title, Overall Farm Status, crop count, last refresh time,
//and the Add / Refresh buttons. Purely props in, events out - no fetching here.

function formatLastRefresh(lastRefresh) {
  if (lastRefresh === 'Never') return 'Never';
  return lastRefresh.toLocaleTimeString();
}

function FarmSummary({ farmStatus, cropCount, lastRefresh, onAddClick, onRefreshClick, refreshDisabled, addDisabled }) {
  return (
    <div>
      <h1>SmartFarm Crop Dashboard</h1>

      <p className="farm-summary-stats">
        <span className="farm-status">Overall Status: {farmStatus}</span>
        {' | '}Crop cards: {cropCount}
        {' | '}Last sensor refresh: {formatLastRefresh(lastRefresh)}
      </p>

      <button onClick={onAddClick} disabled={addDisabled}>Add Crop Card</button>
      <button onClick={onRefreshClick} disabled={refreshDisabled}>Refresh Sensor Data</button>
    </div>
  );
}

export default FarmSummary;
