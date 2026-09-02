# SmartFarmDashboard-Crop-IoT-Dashboard

## Installation and Run Steps

Requires two terminals (Express Node backend and Vite dev server frontend).

1. Clone/unzip the project.
2. **Backend:** `cd backend`, run `npm install` then `npm start`.
3. **Frontend:** `cd frontend`, run `npm install` then `npm run dev`.
4. Open the frontend URL `http://localhost:5173` in the browser.

## Frontend and Backend URLs

- **Backend (Express):** `http://localhost:3001`
- **Frontend (Vite):** `http://localhost:5173` - proxies `/api` requests to the backend

## Database Creation and Seeding

`db.js` creates the SQLite database and `crops` table automatically - the `CREATE TABLE IF NOT EXISTS` statement runs as soon as the file is loaded, which happens when the server starts (`npm start`, since `server.js` requires `db.js`). It then seeds Tomato, Lettuce and Wheat only if the table is completely empty. Maize isn't seeded by default so create can be tested without requiring deletion of a crop card.

If at any point you wish to reset the database simply stop the server and delete `crops.db` from backend. After `crops.db` is deleted start the server again and the crops table will regenerate with the three seeded cards.

## API Routes and Error Format

### API Routes

- `GET /api/crops` - all Crop Cards
- `GET /api/crops/:id` - one Crop Card
- `POST /api/crops` - create a Crop Card
- `PUT /api/crops/:id` - update a Crop Card
- `DELETE /api/crops/:id` - delete a Crop Card
- `GET /api/readings` - read and validate `sensor-readings.json` then return the array

### Error Format

Every failed request responds with a single JSON key:
- missing/invalid field -> 400 `{"error":"location is required"}`
- `crop_name` not in the sensor feed -> 400 `{"error":"crop_name does not exist in sensor data"}`
- attempt to change `crop_name` -> 400 `{"error":"crop_name cannot be changed"}`
- duplicate `crop_name` -> 409 `{"error":"crop_name already exists"}`
- id not found -> 404 `{"error":"Crop card not found"}`
- sensor file structurally invalid -> 500 `{"error":"Sensor data file is invalid"}`
- unexpected server/DB failure -> 500 `{"error":"Internal server error"}`

## Data Ownership

In the project there are two data sources independent of eachother:
1. **Crop Cards** - Stored in SQLite `crops.db`
2. **Sensor readings** - Stored in `sensor-readings.json`

**`crops.db`** is user controlled and managed using Create, Read, Update, and Delete routes through the backend.

**`sensor-readings.json`** is a read-only json file used to store the demo sensor readings and cannot be altered by any means through the app. This means unlike the SQLite database, there is no Create, Update, and Delete routes. However, `GET /api/readings` re-reads the file on every request so when refreshing the sensor data any changes to `sensor-readings.json` are updated and displayed. This simulates how real sensor data would be handled and allows for testing using different sensor data to show live updates, etc.

## Crop Name Matching

`crop_name` is the only join key between a Crop Card and the sensor readings. The match is exact and case-sensitive (`Tomato` matches `Tomato` but not `tomato`).

`getLatestReading` filters all sensor readings down to a card's exact `crop_name` before picking the latest reading by timestamp.

The same rule is enforced on write. The `UNIQUE` constraint on `crop_name` in `crops.db` and the validation in `POST /api/crops` both check for an existing row with that name before insert, returning `409 {"error": "crop_name already exists"}` if one is found.

## Latest Timestamp Selection

As briefly mentioned in `Crop Name Matching`, `getLatestReading` filters all sensor readings down to an exact `crop_name` match returns the one with the greatest `timestamp`. The greatest timestamp is found using a plain string comparison as all timestamps use the same fixed-width `YYYY-MM-DDTHH:mm:ss` format.

The Sensor History view uses the same `crop_name` match and the same string-based timestamp comparison and is sorted by newest to oldest keeping every matching reading instead of just one.


## Dashboard Decision Priority

Crop Cards don't store their own conditions, instead `analyseCrop()` calculates the conditions fresh using the card's values and latest sensor reading. Both the dashboard cards and Sensor History use this function.

The rules are checked in this order with the first match winning:
- **Sensor Problem** - `sensor_status` is Offline or Faulty. Result: Recommended water is N/A, action is Check sensor.
- **Invalid Data** - the reading is Online but `soil_moisture`, `temperature`, or `rainfall` is outside its normal range (0-100 / 0-50 / 0-50). Result: Recommended water is N/A, action is Check reading.
- **Dry** - `soil_moisture < target_min`. Result: Recommended water is the card's `normal_water`, action is Water crop.
- **Healthy** - `soil_moisture` is between `target_min` and `target_max` inclusive. Result: Recommended water is 0L, action is Monitor.
- **Too Wet** - `soil_moisture > target_max`. Result: Recommended water is 0L, action is Stop watering.
- **High temperature** - `temperature` is above 35C. Result: adds a High temperature alert without changing recommended water.
- **Rain detected** - `rainfall` is 5mm or more. Result: adds a Rain detected alert without changing recommended water.

## Final AI Prompt

Used to generate the first draft of `sensor-readings.json`:

```
Generate a valid JSON array containing exactly 20 simulated SmartFarm sensor readings.

Use these crop_name values exactly and create exactly 5 readings for each: Tomato,
Lettuce, Wheat, Maize.

Every object must contain exactly these fields: crop_name, timestamp, soil_moisture,
temperature, rainfall, sensor_status, notes.

Use timestamps in YYYY-MM-DDTHH:mm:ss format. Timestamps must be distinct within each
crop. The same timestamp may be used by different crops.

For every one of the four crops, the reading with the latest timestamp must NOT be
the last occurrence of that crop_name in the array — interleave crops throughout the
array rather than grouping them.

Use sensor_status only as Online, Offline or Faulty. Numeric values must be realistic
(soil_moisture 0-100, temperature 0-50, rainfall 0-50) for every reading EXCEPT one.

Include exactly one structurally valid older reading (not the latest for its crop)
with sensor_status Online and exactly one numeric field outside its business range.
It must be Online specifically — an Offline or Faulty reading with a bad number does
not count, since sensor_status is checked first and would mask the out-of-range value.

Make the latest readings produce these cases using these target ranges:
Tomato 55-75, Lettuce 60-80, Wheat 35-55, Maize 50-70 (soil_moisture, inclusive):
- latest Tomato: sensor_status Online, soil_moisture below 55, temperature above 35C
- latest Lettuce: sensor_status Online, soil_moisture between 60 and 80 inclusive
- latest Wheat: sensor_status Online, soil_moisture above 55, rainfall at least 5mm
- latest Maize: sensor_status Faulty

Do not reuse the specific numeric values from any previously published SmartFarm
worked examples — generate distinct values that satisfy the same conditions.

Return only the JSON array. Do not use Markdown or explanation.
```

## Checks/Corrections Made to the Sensor JSON

Checked:

- Exactly 20 objects
- Exactly 5 readings per crop
- Every object has all 7 required fields with correct types
- Every timestamp matches `YYYY-MM-DDTHH:mm:ss`, is a real calendar date and is distinct within its crop
- `sensor_status` is one of Online, Offline, or Faulty
- The timestamp with the oldest value is not the last entry to confirm order is mixed
- Exactly one older reading is valid but has one out-of-range number, and it is Online
- etc.

Corrections Made:

I didn't alter any thing in the actual Sensor JSON, instead I altered the prompt used to genreate Sensor JSON. Changes to the prompt:

- Added that the out-of-range reading must be Online, not Offline/Faulty, otherwise it displays as Sensor Problem instead of Invalid Data.
- Added the exact target moisture ranges per crop so the AI knows what counts as Dry/Healthy/Too Wet.
- Changed "mix the array order" to a precise rule: each crop's latest reading must not be its last occurrence in the array.

## AI Use

### AI/Tool used
- Claude

### What it helped with
Claude was utilised in collaboration throughout all stages of development such as:
- Explaining concepts.
- Review of code and core logic.
- Architecture and file structure against best practices (e.g. splitting functionality into specialised files and folders).
- General syntax and formating.
- Project set up, starter code, code, refactoring, and debugging code.
- Backend and frontend guidance.
- Generating sensor-readings using above prompt.
- Audits for redundant or duplicate code against specifications.
- README wording and formatting.

### What I personally implemented/checked
- Checked and reviewed all project set up and starter code.
- Translated core logic.
- Tested the all fields and values against specifications.
- Audited codebase against each section of the specifications.
- Core functions and logic.
- Manually checked and reviewed everything altered, refactored, generated or otherwise touched by AI to ensure best coding practices, no redundant/incorrect/overengineered code, and to ensure functionality against specifications.
- Ran the app through the full business flow.
- Made decisions where specifications left gaps, was unclear or ambiguous.
- Manually checked generated sensor data.
- Verified API error responses using `curl`


### Decisions I made

I chose to split functionality across the following files instead of putting everything directly in `server.js` and `App.jsx`.

Files:

- `backend/routes/crops.js`
- `backend/routes/readings.js`
- `frontend/src/components/CropCard.jsx`
- `frontend/src/components/CropForm.jsx`
- `frontend/src/components/FarmSummary.jsx`
- `frontend/src/components/SensorHistory.jsx`

I decided to do this for readability, to reduce code duplication, and to ensure functionality lives in one place rather than large `server.js` and `App.jsx` files holding routes, UI, and logic all at once.

Additionally, I added two parameters to `calculateFarmStatus`instead of the suggested one to ensure "No Crops" and "Sensor Feed Unavailable" errors surface correctly.

## One Project Limitation

Because the app uses a single page and not multiple different pages for `add`, `edit`, and `history` if the site is refreshed while mid-edit or viewing Sensor History the site defaults back to the dashboard view instead of staying on their original screen.