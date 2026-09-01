import { useState } from 'react';
import { createCrop, updateCrop } from '../services/api.js';

//one combined Add / Edit form - avoids duplicating the same fields and
//validation logic across two separate components.

function blankForm(availableCropNames) {
  return {
    crop_name: availableCropNames[0] ?? '',
    location: '',
    target_min: '',
    target_max: '',
    normal_water: '',
    notes: '',
  };
}

function formFromCrop(crop) {
  return {
    crop_name: crop.crop_name,
    location: crop.location,
    target_min: crop.target_min,
    target_max: crop.target_max,
    normal_water: crop.normal_water,
    notes: crop.notes ?? '',
  };
}

function CropForm({ mode, cropToEdit, availableCropNames, onSaved, onCancel }) {
  const isEditing = mode === 'edit';

  const [form, setForm] = useState(() => (isEditing ? formFromCrop(cropToEdit) : blankForm(availableCropNames)));
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  //mirrors the backend's rules and messages exactly, so the user gets the same
  //feedback here as they would from the API. Reads the raw string fields
  //(not yet converted to numbers) so a blank field is caught as "required"
  //instead of silently becoming 0.
  function validate(form) {
    if (form.location.trim().length < 1 || form.location.length > 100) {
      return 'location is required';
    }

    if (form.target_min.trim() === '' || Number.isNaN(Number(form.target_min))) {
      return 'target_min is required';
    }
    const targetMin = Number(form.target_min);
    if (targetMin < 0 || targetMin > 100) {
      return 'target_min must be between 0 and 100';
    }

    if (form.target_max.trim() === '' || Number.isNaN(Number(form.target_max))) {
      return 'target_max is required';
    }
    const targetMax = Number(form.target_max);
    if (targetMax < 0 || targetMax > 100) {
      return 'target_max must be between 0 and 100';
    }

    if (targetMin >= targetMax) {
      return 'target_min must be less than target_max';
    }

    if (form.normal_water.trim() === '' || Number.isNaN(Number(form.normal_water))) {
      return 'normal_water is required';
    }
    const normalWater = Number(form.normal_water);
    if (normalWater <= 0 || normalWater > 10000) {
      return 'normal_water must be greater than 0 and at most 10000';
    }

    if (form.notes.length > 500) {
      return 'notes must be a string up to 500 characters';
    }

    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    //convert the number fields from strings (what inputs give us) to real numbers -
    //the backend rejects numeric strings
    const body = {
      crop_name: form.crop_name,
      location: form.location,
      target_min: Number(form.target_min),
      target_max: Number(form.target_max),
      normal_water: Number(form.normal_water),
      notes: form.notes,
    };

    setSaving(true);
    setError(null);

    try {
      const saved = isEditing ? await updateCrop(cropToEdit.id, body) : await createCrop(body);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="crop-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? 'Edit Crop Card' : 'Add Crop Card'}</h2>

      {error && <p className="form-error">{error}</p>}

      <div>
        <label>Crop name</label><br />
        {isEditing ? (
          <span className="crop-name-readonly">{form.crop_name}</span>
        ) : (
          <select name="crop_name" value={form.crop_name} onChange={handleChange}>
            {availableCropNames.length === 0 && <option value="">No crop names available</option>}
            {availableCropNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        )}
      </div>

      <div>
        <label>Location</label><br />
        <input name="location" value={form.location} onChange={handleChange} />
      </div>

      <div>
        <label>Target moisture min (%)</label><br />
        <input type="number" name="target_min" value={form.target_min} onChange={handleChange} />
      </div>

      <div>
        <label>Target moisture max (%)</label><br />
        <input type="number" name="target_max" value={form.target_max} onChange={handleChange} />
      </div>

      <div>
        <label>Normal water amount (L)</label><br />
        <input type="number" name="normal_water" value={form.normal_water} onChange={handleChange} />
      </div>

      <div>
        <label>Notes</label><br />
        <textarea name="notes" value={form.notes} onChange={handleChange} />
      </div>

      <br />
      <button type="submit" disabled={saving || (!isEditing && availableCropNames.length === 0)}>
        {isEditing ? 'Save Changes' : 'Create Crop Card'}
      </button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

export default CropForm;
