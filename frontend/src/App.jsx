import { useState, useEffect } from 'react';
import { getCrops, getReadings, deleteCrop } from './services/api.js';
import { getAvailableCropNames, getLatestReading, analyseCrop, calculateFarmStatus } from './utils/analysis.js';
import FarmSummary from './components/FarmSummary.jsx';
import CropCard from './components/CropCard.jsx';
import CropForm from './components/CropForm.jsx';
import SensorHistory from './components/SensorHistory.jsx';

function App() {
  //crop cards (from SQLite via the backend)
  const [crops, setCrops] = useState([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [cropsError, setCropsError] = useState(null);

  //sensor readings (from the read-only JSON feed via the backend).
  //readings stays null until the FIRST successful fetch ever happens.
  const [readings, setReadings] = useState(null);
  const [readingsError, setReadingsError] = useState(null);

  //a failed Delete shows its own banner instead of using cropsError, which
  //would replace the whole dashboard with a full-page error screen
  const [deleteError, setDeleteError] = useState(null);

  //lastRefresh is plain React state - never sent to or read from the backend
  const [lastRefresh, setLastRefresh] = useState('Never');

  //which part of the single page is showing right now
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'add' | 'edit' | 'history'
  const [activeCrop, setActiveCrop] = useState(null);

  //loads the crop cards from the backend - used on first load and for Retry
  function loadCrops() {
    setCropsLoading(true);
    setCropsError(null);
    getCrops()
      .then(data => {
        setCrops(data);
        setCropsLoading(false);
      })
      .catch(err => {
        setCropsError(err.message);
        setCropsLoading(false);
      });
  }

  //initial load - fires both requests together, once
  useEffect(() => {
    loadCrops();

    getReadings()
      .then(data => {
        setReadings(data);
        setLastRefresh(new Date());
        setReadingsError(null);
      })
      .catch(err => {
        //first sensor request failed - readings stays null on purpose, so
        //calculateFarmStatus reports Sensor Feed Unavailable
        setReadingsError(err.message);
      });
  }, []);

  //Refresh Sensor Data button - a LATER request, success replaces readings,
  //failure must leave everything exactly as it was
  function handleRefresh() {
    getReadings()
      .then(data => {
        setReadings(data);
        setLastRefresh(new Date());
        setReadingsError(null);
      })
      .catch(err => {
        setReadingsError(err.message);
        //do NOT touch readings or lastRefresh here - the previous good state must survive
      });
  }

  function handleAddClick() {
    setView('add');
  }

  function handleEdit(crop) {
    setActiveCrop(crop);
    setView('edit');
  }

  function handleViewHistory(crop) {
    setActiveCrop(crop);
    setView('history');
  }

  function handleDelete(crop) {
    setDeleteError(null);
    deleteCrop(crop.id)
      .then(() => loadCrops())
      .catch(err => setDeleteError(err.message));
  }

  //called by CropForm after a successful create or update
  function handleSaved() {
    loadCrops();
    setView('dashboard');
    setActiveCrop(null);
  }

  function handleCancelForm() {
    setView('dashboard');
    setActiveCrop(null);
  }

  function handleCloseHistory() {
    setView('dashboard');
    setActiveCrop(null);
  }

  //build the dashboard results directly in the render body (no extra state) -
  //this app's data is tiny, recalculating on every render keeps the logic simple
  const results = crops.map(crop => {
    if (readings === null) return null;
    const reading = getLatestReading(crop.crop_name, readings);
    //a structurally valid sensor file always has 5 readings per allowed crop,
    //so this should never actually be null - but don't crash if it somehow is
    return reading ? analyseCrop(crop, reading) : null;
  });

  const farmStatus = calculateFarmStatus(crops, readings, results.filter(r => r !== null));
  const availableCropNames = getAvailableCropNames(readings, crops);

  //true only until the first GET /api/readings has settled, success or failure -
  //derived instead of tracked separately, since readings/readingsError already say this
  const readingsLoading = readings === null && readingsError === null;

  //don't show cards or forms until the crop cards have loaded successfully
  if (cropsLoading) {
    return <p>Loading crop cards...</p>;
  }

  if (cropsError) {
    return (
      <>
        <p className="error-banner">{cropsError}</p>
        <button onClick={loadCrops}>Retry</button>
      </>
    );
  }

  return (
    <>
      <FarmSummary
        farmStatus={farmStatus}
        cropCount={crops.length}
        lastRefresh={lastRefresh}
        onAddClick={handleAddClick}
        onRefreshClick={handleRefresh}
        refreshDisabled={readingsLoading}
        addDisabled={readings === null}
      />

      {readingsError && <p className="error-banner">Sensor refresh failed: {readingsError}</p>}
      {deleteError && <p className="error-banner">Delete failed: {deleteError}</p>}

      {view === 'dashboard' && (
        crops.length === 0 ? (
          <p className="empty-state">No Crop Cards yet. Click "Add Crop Card" to create one.</p>
        ) : (
          <div>
            {crops.map((crop, i) => (
              <CropCard
                key={crop.id}
                crop={crop}
                result={results[i]}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewHistory={handleViewHistory}
              />
            ))}
          </div>
        )
      )}

      {view === 'add' && (
        <CropForm
          mode="add"
          availableCropNames={availableCropNames}
          onSaved={handleSaved}
          onCancel={handleCancelForm}
        />
      )}

      {view === 'edit' && (
        <CropForm
          mode="edit"
          cropToEdit={activeCrop}
          availableCropNames={availableCropNames}
          onSaved={handleSaved}
          onCancel={handleCancelForm}
        />
      )}

      {view === 'history' && (
        <SensorHistory crop={activeCrop} readings={readings ?? []} onClose={handleCloseHistory} />
      )}
    </>
  );
}

export default App;
