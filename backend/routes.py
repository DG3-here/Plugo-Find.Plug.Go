from flask import Blueprint, jsonify, request

from .model_loader import model_bundle
from .utils import (
    DEMAND_WEIGHTS,
    STATUS_WEIGHTS,
    current_hour_and_day,
    demand_color,
    estimate_waiting_time,
    haversine_km,
    load_stations,
    normalize_charger_type,
    normalize_status,
    reliability_score,
    safe_float,
    safe_int,
)


api = Blueprint("api", __name__)


@api.get("/health")
def health():
    return jsonify({"status": "ok", "app": "Plugo"})


@api.get("/stations")
def stations():
    hour, day_of_week = current_hour_and_day()
    user_lat = safe_float(request.args.get("user_lat"), None)
    user_lng = safe_float(request.args.get("user_lng"), None)
    radius_km = safe_int(request.args.get("radius_km"), 25)
    max_results = safe_int(request.args.get("max_results"), 80)
    enriched = []

    for station in load_stations(user_lat, user_lng, radius_km, max_results):
        prediction = model_bundle.predict(
            hour=hour,
            day_of_week=day_of_week,
            charger_type=station["charger_type"],
            status=station["status"],
        )
        demand = prediction["predicted_demand"]
        enriched.append(
            {
                **station,
                "predicted_demand": demand,
                "confidence": prediction["confidence"],
                "demand_color": demand_color(demand),
                "estimated_waiting_time": estimate_waiting_time(
                    demand, station.get("base_waiting_time", 0)
                ),
                "reliability_score": reliability_score(station["status"]),
            }
        )

    source = enriched[0].get("source", "local_dataset") if enriched else "none"
    return jsonify({"stations": enriched, "count": len(enriched), "source": source})


@api.post("/predict")
def predict():
    data = request.get_json(silent=True) or {}
    required = ["hour", "day_of_week", "charger_type", "status"]
    missing = [field for field in required if field not in data]

    if missing:
        return jsonify({"error": "Missing required fields", "missing": missing}), 400

    charger_type = normalize_charger_type(data.get("charger_type"), data.get("vehicle_type"))
    status = normalize_status(data.get("status"))
    prediction = model_bundle.predict(
        hour=safe_int(data.get("hour")),
        day_of_week=safe_int(data.get("day_of_week")),
        charger_type=charger_type,
        status=status,
    )
    demand = prediction["predicted_demand"]

    return jsonify(
        {
            "predicted_demand": demand,
            "confidence": prediction["confidence"],
            "demand_color": demand_color(demand),
            "estimated_waiting_time": estimate_waiting_time(demand),
        }
    )


@api.get("/recommend")
def recommend():
    user_lat = safe_float(request.args.get("user_lat"), None)
    user_lng = safe_float(request.args.get("user_lng"), None)

    if user_lat is None or user_lng is None:
        return jsonify({"error": "user_lat and user_lng are required"}), 400

    vehicle_type = request.args.get("vehicle_type", "car")
    requested_charger = normalize_charger_type(
        request.args.get("charger_type", ""), vehicle_type=vehicle_type
    )
    hour, day_of_week = current_hour_and_day()
    candidates = []

    for station in load_stations(user_lat, user_lng):
        if requested_charger != "Unknown" and station["charger_type"] != requested_charger:
            continue

        prediction = model_bundle.predict(
            hour=hour,
            day_of_week=day_of_week,
            charger_type=station["charger_type"],
            status=station["status"],
        )
        demand = prediction["predicted_demand"]
        distance = haversine_km(
            user_lat, user_lng, station["latitude"], station["longitude"]
        )
        demand_weight = DEMAND_WEIGHTS.get(demand, 3)
        status_weight = STATUS_WEIGHTS.get(station["status"], 3)

        score = (distance * 0.4) + (demand_weight * 0.4) + (status_weight * 0.2)
        candidates.append(
            {
                **station,
                "distance_km": round(distance, 2),
                "predicted_demand": demand,
                "confidence": prediction["confidence"],
                "demand_color": demand_color(demand),
                "estimated_waiting_time": estimate_waiting_time(
                    demand, station.get("base_waiting_time", 0)
                ),
                "reliability_score": reliability_score(station["status"]),
                "score": round(score, 3),
            }
        )

    if not candidates:
        return jsonify({"error": "No matching stations found"}), 404

    sorted_candidates = sorted(candidates, key=lambda item: item["score"])
    best_station = sorted_candidates[0]
    other_options = sorted_candidates[1:4]
    return jsonify({"best_station": best_station, "other_options": other_options, "candidates_checked": len(candidates)})
