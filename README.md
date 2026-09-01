# SmartFarmDashboard-Crop-IoT-Dashboard

## Installation and Run Steps

Requires two terminals (Express Node backend and Vite dev server frontend).

1. Clone/unzip the project.
2. **Backend:** `cd backend`, run `npm install` then `npm start`.
3. **Frontend:** `cd frontend`, run `npm install` then `npm run dev`.
4. Open the frontend URL below in the browser.

## Frontend and Backend URLs

- **Backend (Express):** `http://localhost:3001`
- **Frontend (Vite):** `http://localhost:5173` - proxies `/api` requests to the backend

## Database Creation and Seeding

`db.js` creates the SQLite database and `crops` table automatically - the `CREATE TABLE IF NOT EXISTS` statement runs as soon as the file is loaded, which happens when the server starts (`npm start`, since `server.js` requires `db.js`). It then seeds Tomato, Lettuce and Wheat only if the table is completely empty. Maize isn't seeded by default so create can be tested without requiring deletion of a crop card.

If at any point you wish to reset the database simply stop the server and delete `crops.db` from the backend. After `crops.db` is deleted start the server again and the crops table will be recreated and reseeded with the three cards.

## API Routes and Error Format

### API Routes

- `GET /api/crops` - all Crop Cards
- `GET /api/crops/:id` - one Crop Card
- `POST /api/crops` - create a Crop Card
- `PUT /api/crops/:id` - update a Crop Card
- `DELETE /api/crops/:id` - delete a Crop Card
- `GET /api/readings` - read and validate `sensor-readings.json` then return the raw array

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

In the project there are two independent data sources:
1. **Crop Cards** - Stored in SQLite `crops.db`
2. **Sensor readings** - Stored in `sensor-readings.json`

**`crops.db`** is user controled and managed using Create, Read, Update, and Delete routes through the backend.

**`sensor-readings.json`** is a read-only json file used to store the demo sensor readings and cannot be altered by any means through the app, meaning unlike the SQLite crops table, there is no Create, Update, and Delete routes. However, `GET /api/readings` re-reads the file on every request so when refreshing the sensor data any changes are updated and displayed. This is to simulate how real sensor data would be handled and allows for testing using differnt sensor data to show live updates, etc.

**Dashboard results**
- condition
- recommended water
- alerts
- action
- overall farm status

are recalculated through the React Frontend every render thus the backend never calculates or stores any of it

## Crop Name Matching

`crop_name` is the only join key between a Crop Card and the sensor readings. The match is exact and case-sensitive (`Tomato` matches `Tomato` but not `tomato`).

`getLatestReading` filters all sensor readings down to a card's exact `crop_name` before picking the latest reading by timestamp.

The same rule is enforced on write. The `UNIQUE` constraint on `crop_name` in `crops.db` and the validation in `POST /api/crops` both check for an existing row with that name before insert, returning `409 {"error": "crop_name already exists"}` if one is found.

## Latest Timestamp Selection

As brefly mentioned in `Crop Name Matching`, `getLatestReading` filters all sensor readings down to an exact `crop_name` match returns the one with the greatest `timestamp`. The greatest timestamp is found using a plain string comparison as all timestamps use the same fixed-width `YYYY-MM-DDTHH:mm:ss` format.

The Sensor History view uses the same `crop_name` match and the same string-based timestamp comparison but keeps every matching reading instead of just one sorted by newest first.


## Dashboard Decision Priority

Crop Cards don't store their own condition, `analyseCrop(cropCard, reading)` works it out fresh from the card's settings and its latest sensor reading. Both the dashboard cards and Sensor History call this same function.

The rules are checked in this order with the first match wining:
- **Sensor Problem** - `sensor_status` is Offline or Faulty. Recommended water is N/A, action is Check sensor. Checked before anything else, even if the numbers would otherwise look fine.
- **Invalid Data** - the reading is Online but `soil_moisture`/`temperature`/`rainfall` is outside its normal business range (0-100 / 0-50 / 0-50). Recommended water is N/A, action is Check reading.
- **Dry** - `soil_moisture < target_min`. Recommended water is the card's `normal_water`, action is Water crop.
- **Healthy** - `soil_moisture` is between `target_min` and `target_max` inclusive. Recommended water is 0L, action is Monitor.
- **Too Wet** - `soil_moisture > target_max`. Recommended water is 0L, action is Stop watering.

And for valid online readings there are two extra alearts that can be added:
- **High temperature** (temperature above 35C) and
- **Rain detected** (rainfall 5mm or more)

## Final AI Prompt

Used to generate the first draft of `sensor-readings.json`:

```
Generate a valid JSON array containing exactly 20 simulated SmartFarm sensor readings.

Use these crop_name values exactly and create exactly 5 readings for each: Tomato,
Lettuce, Wheat, Maize.

Every object must contain exactly these fields: crop_name, timestamp, soil_moisture,
temperature, rainfall, sensor_status, notes.

Use timestamps in YYYY-MM-DDTHH:mm:ss format. Timestamps must be distinct within each
crop. The same timestamp may be used by different crops. Mix the array order so the
latest reading is not always the last object.

Use sensor_status only as Online, Offline or Faulty. Most numeric values must be
realistic: soil_moisture 0-100, temperature 0-50, rainfall 0-50. Include exactly one
structurally valid older reading with one deliberately out-of-range numeric value.
That invalid reading must not be the latest reading for its crop.

Make the latest readings produce these cases with the default Crop Card settings:
- latest Tomato: Online, Dry, temperature above 35 C;
- latest Lettuce: Online and Healthy;
- latest Wheat: Online, Too Wet, rainfall at least 5 mm;
- latest Maize: sensor_status Faulty.
Return only the JSON array. Do not use Markdown or explanation.
```

## Checks/Corrections Made to the Sensor JSON

I Checked the whole file for 20 objects, 5 per crop, correct fields/types, all timestamps distinct within their crop, exactly one out-of-range reading (Wheat, `soil_moisture: 120`, not the latest Wheat reading).

## AI Use

### AI/Tool used
- Claude

### What it helped with
Claude was utilised in collaboration throughout all stages of development such as:
- Explaining concepts.
- Review of code and core logic.
- Architecture and file structure (e.g. spliting functionality spechalised files ).
- General syntax and formating.
- Project set up, starter code, refactoring, and debugging code.
- Backend and frontend guidance.
- Generating sensor-readings using above prompt.
- Audits for redundant or duplicate code against specifications.
- README wording and formatting.

### What I personally implemented/checked
- Checked and reviewed all project set up and starter code.
- Translated core logic into code.
- Tested the all fields and values against specifications.
- Audited codebase against each section of the specifications.
- Wrote core functions and logic.
- Manually checked and reviewed everything altered, refactored, generated or otherwise touched by AI to ensure best coding practices, no reduanant/incorrect/overengineered code, and to ensure functionality against specifications.
- Ran the app through the full business flow in browser.
- Made decisions where specifications left gaps, was unclear or ambigus.
- Manualy checked generated sensor data.

**ADD AFTER TESTING**
- Verified API error responses using `curl`              ###required JSON shape and messages with, including the 500 case by feeding it a deliberately corrupted sensor file###.


### One decision I made

A decision I made was having the calculateFarmStatus function take three arguments (crops, readings, results) instead of the suggested one. The reason I did this is because "No Crops" and "Sensor Feed Unavailable" cannot be told apart from a results array alone, as both cases produce an empty array. To be able to tell the difference between the two cases I needed the raw crop count and the readings state, so I added them as parameters instead of having it calculated in App.jsx. This is because farm-status logic needs to live in a single place (calculateFarmStatus), per the specifications.

## One Project Limitation

Because the app uses a single page and not multiple different pages for `add`, `edit`, and `history` if the site is refreshed while mid-edit or viewing Sensor History the site defaults back to the dashboard view instead of staying on their original screen.#   S m a r t F a r m D a s h b o a r d - C r o p - I o T - D a s h b o a r d 
 
 