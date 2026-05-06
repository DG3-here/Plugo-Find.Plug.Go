# Plugo - Find. Plug. Go

Plugo is a smart EV charging station MVP. It shows charging stations, predicts live demand with a trained ML model, estimates waiting time, and recommends the best station based on distance, demand, and station reliability.

## Project Structure

```text
Plugo/
├── app.py
├── backend/
│   ├── app.py
│   ├── routes.py
│   ├── model_loader.py
│   └── utils.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── data/
│   ├── dataset.csv
│   └── ml_dataset.csv
├── models/
│   ├── plugo_model.pkl
│   ├── charger_encoder.pkl
│   ├── status_encoder.pkl
│   └── demand_encoder.pkl
├── model.py
└── requirements.txt
```

## Run Locally

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## Maps And Live Station Data

The app uses Leaflet with OpenStreetMap tiles, so no Google Maps API key is required for the map.

For live charging-station search, create an Open Charge Map API key and set it before starting the backend:

```powershell
$env:OPENCHARGEMAP_API_KEY="YOUR_KEY_HERE"
python app.py
```

If no Open Charge Map key is configured, Plugo falls back to `data/ml_dataset.csv`, which currently provides 200 local MVP stations.

## API Endpoints

### `GET /stations`

Returns stations with normalized station data plus predicted demand, confidence, waiting time, and reliability.

Optional query parameters:

```text
/stations?user_lat=12.9716&user_lng=77.5946&radius_km=35&max_results=80
```

When `OPENCHARGEMAP_API_KEY` is configured and coordinates are provided, this searches live Open Charge Map stations near the user. Otherwise it returns the local fallback dataset.

### `POST /predict`

Request:

```json
{
  "hour": 18,
  "day_of_week": 5,
  "charger_type": "fast",
  "status": "Operational"
}
```

Response:

```json
{
  "predicted_demand": "Low",
  "confidence": 0.92,
  "demand_color": "green",
  "estimated_waiting_time": 5
}
```

### `GET /recommend`

Example:

```text
/recommend?user_lat=12.1056&user_lng=75.2117&vehicle_type=car&charger_type=fast
```

The recommendation score uses:

```text
score = (distance * 0.4) + (demand_weight * 0.4) + (status_weight * 0.2)
```

Lower score is better.

## Data Behavior

`data/dataset.csv` is treated as a real station export. If it is empty, Plugo automatically falls back to `data/ml_dataset.csv` so the MVP still runs locally. Live station search uses Open Charge Map when `OPENCHARGEMAP_API_KEY` is present.

## Retrain Model

```bash
python model.py
```

The retraining script writes updated artifacts into `models/`.
