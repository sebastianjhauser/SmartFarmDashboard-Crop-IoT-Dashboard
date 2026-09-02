import { useState, useEffect } from 'react';
import { getCrops, getCrop, getReadings, deleteCrop } from './services/api.js';
import { getAvailableCropNames, getLatestReading, analyseCrop, calculateFarmStatus } from './utils/analysis.js';
import FarmSummary from './components/FarmSummary.jsx';
import CropCard from './components/CropCard.jsx';
import CropForm from './components/CropForm.jsx';
import SensorHistory from './components/SensorHistory.jsx';

//orchestrator - manages state and data

function App() {
  //crop cards
  const [crops, setCrops] = useState([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [cropsError, setCropsError] = useState(null);

  //sensor readings
  const [readings, setReadings] = useState(null);
  const [readingsError, setReadingsError] = useState(null);

  //failed delete shows its own banner
  const [deleteError, setDeleteError] = useState(null);

  //edit and view sensor history
  const [singleCropError, setSingleCropError] = useState(null);
  //successful save or delete confirmation
  const [statusMessage, setStatusMessage] = useState(null);
  //last sensor refresh timestap
  const [lastRefresh, setLastRefresh] = useState('Never');

  //which part of page is showing - 'dashboard', 'add' , 'edit', 'history'
  const [view, setView] = useState('dashboard');
  const [activeCrop, setActiveCrop] = useState(null);

  //load crop cards (first load and retry)
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

  //initial load fires both requests together
  //crop cards can load even if the sensor readings fail and vice versa
  useEffect(() => {
    loadCrops();

    getReadings()
      .then(data => {
        setReadings(data);
        setLastRefresh(new Date());
        setReadingsError(null);
      })
      .catch(err => {
        setReadingsError(err.message);
      });
  }, []);

  //refresh sensor data button
  //failure must leave everything as it was
  function handleRefresh() {
    getReadings()
      .then(data => {
        setReadings(data);
        setLastRefresh(new Date());
        setReadingsError(null);
      })
      .catch(err => {
        setReadingsError(err.message);
      });
  }

  function handleAddClick() {
    setStatusMessage(null);
    setView('add');
  }

  //edit card by id
  function handleEdit(crop) {
    setSingleCropError(null);
    setStatusMessage(null);
    getCrop(crop.id)
      .then(data => {
        setActiveCrop(data);
        setView('edit');
      })
      .catch(err => {
        setSingleCropError(err.message);
      });
  }

  //fetch card by id
  function handleViewHistory(crop) {
    setSingleCropError(null);
    getCrop(crop.id)
      .then(data => {
        setActiveCrop(data);
        setView('history');
      })
      .catch(err => {
        setSingleCropError(err.message);
      });
  }

  //delete card by id
  function handleDelete(crop) {
    setDeleteError(null);
    setStatusMessage(null);
    deleteCrop(crop.id)
      .then(() => {
        setStatusMessage(`${crop.crop_name} crop card deleted. Sensor readings are unchanged.`);
        loadCrops();
      })
      .catch(err => setDeleteError(err.message));
  }

  //called by CropForm after a successful create or update
  function handleSaved(saved) {
    setStatusMessage(`${saved.crop_name} crop card ${view === 'edit' ? 'updated' : 'created'}.`);
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

  //build dashboard
  const results = crops.map(crop => {
    if (readings === null) return null;
    const reading = getLatestReading(crop.crop_name, readings);

    return reading ? analyseCrop(crop, reading) : null;
  });

  const farmStatus = calculateFarmStatus(crops, readings, results.filter(r => r !== null));
  const availableCropNames = getAvailableCropNames(readings, crops);

  //gates sensor refresh button util first GET succeeds or fails
  const readingsLoading = readings === null && readingsError === null;

  //don't show cards or forms until the crop cards load
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

      {statusMessage && <p className="status-banner">{statusMessage}</p>}
      {readingsError && <p className="error-banner">Sensor refresh failed: {readingsError}</p>}
      {deleteError && <p className="error-banner">Delete failed: {deleteError}</p>}
      {singleCropError && <p className="error-banner">Could not load crop card: {singleCropError}</p>}

      {view === 'dashboard' && (
        crops.length === 0 ? (
          <p>No Crop Cards yet. Click "Add Crop Card" to create one.</p>
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