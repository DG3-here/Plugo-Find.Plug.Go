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

## Google Maps

Add your Google Maps JavaScript API key in `frontend/script.js`:

```js
const GOOGLE_MAPS_API_KEY = "YOUR_KEY_HERE";
```

The app uses the Visualization library for the optional demand heatmap.

## API Endpoints

### `GET /stations`

Returns all stations with normalized station data plus predicted demand, confidence, waiting time, and reliability.

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

`data/dataset.csv` is treated as the real Open Charge Map export. If it is empty, Plugo automatically falls back to `data/ml_dataset.csv` so the MVP still runs locally.

## Retrain Model

```bash
python model.py
```

The retraining script writes updated artifacts into `models/`.
