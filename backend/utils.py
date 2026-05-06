import csv
import math
import os
import urllib.parse
import urllib.request
import json
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OPEN_CHARGE_MAP_URL = "https://api.openchargemap.io/v3/poi/"

DEMAND_COLORS = {
    "Low": "green",
    "Medium": "yellow",
    "High": "red",
}

DEMAND_WEIGHTS = {
    "Low": 1,
    "Medium": 2,
    "High": 3,
}

STATUS_WEIGHTS = {
    "Operational": 1,
    "Partly Operational (Mixed)": 2,
    "Temporarily Unavailable": 3,
    "Unknown": 3,
}


def normalize_charger_type(value, vehicle_type=None):
    text = str(value or "").strip()
    lowered = text.lower()

    if "fast" in lowered or "ccs" in lowered:
        return "CCS (Type 2)"
    if "slow" in lowered or "type 2" in lowered:
        return "Type 2 (Tethered Connector)"
    if vehicle_type == "scooter":
        return "Type 2 (Tethered Connector)"
    return text or "Unknown"


def normalize_status(value):
    text = str(value or "").strip()
    lowered = text.lower()

    if "temporarily" in lowered or "unavailable" in lowered:
        return "Temporarily Unavailable"
    if "partly" in lowered or "mixed" in lowered:
        return "Partly Operational (Mixed)"
    if "operational" in lowered or "available" in lowered:
        return "Operational"
    return text or "Unknown"


def safe_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def safe_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def current_hour_and_day():
    now = datetime.now()
    return now.hour, now.weekday()


def load_station_rows():
    data_file = DATA_DIR / "dataset.csv"
    fallback_file = DATA_DIR / "ml_dataset.csv"

    # The real Open Charge Map export should live in dataset.csv. During local
    # development this project currently has an empty dataset.csv, so we use the
    # ML dataset as a reliable fallback.
    if not data_file.exists() or data_file.stat().st_size == 0:
        data_file = fallback_file

    if not data_file.exists() or data_file.stat().st_size == 0:
        return []

    with data_file.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.DictReader(csv_file))


def station_from_row(row, index):
    latitude = safe_float(row.get("latitude") or row.get("Latitude"))
    longitude = safe_float(row.get("longitude") or row.get("Longitude"))
    charger_type = normalize_charger_type(
        row.get("charger_type") or row.get("Charger Type") or row.get("connection_type")
    )
    status = normalize_status(row.get("status") or row.get("Status"))

    return {
        "id": str(row.get("station_id") or row.get("id") or index),
        "name": row.get("name") or row.get("Name") or f"Charging Station {index + 1}",
        "latitude": latitude,
        "longitude": longitude,
        "charger_type": charger_type,
        "status": status,
        "usage_count": safe_int(row.get("usage_count"), 0),
        "base_waiting_time": safe_int(row.get("waiting_time"), 0),
    }


def connection_title(connections):
    if not connections:
        return "Unknown"

    connection = connections[0] or {}
    connection_type = connection.get("ConnectionType") or {}
    level = connection.get("Level") or {}
    title = connection_type.get("Title") or level.get("Title")
    return normalize_charger_type(title)


def station_from_open_charge_map(item):
    address = item.get("AddressInfo") or {}
    status = item.get("StatusType") or {}
    connections = item.get("Connections") or []
    latitude = safe_float(address.get("Latitude"))
    longitude = safe_float(address.get("Longitude"))
    status_title = status.get("Title")

    if status.get("IsOperational") is True:
        status_title = "Operational"
    elif status.get("IsOperational") is False:
        status_title = status_title or "Temporarily Unavailable"

    return {
        "id": f"ocm-{item.get('ID')}",
        "name": address.get("Title") or "Charging Station",
        "latitude": latitude,
        "longitude": longitude,
        "charger_type": connection_title(connections),
        "status": normalize_status(status_title),
        "usage_count": safe_int(item.get("NumberOfPoints"), 0),
        "base_waiting_time": 0,
        "source": "open_charge_map",
    }


def fetch_open_charge_map_stations(latitude, longitude, radius_km=25, max_results=80):
    api_key = os.getenv("OPENCHARGEMAP_API_KEY") or os.getenv("OCM_API_KEY")
    if not api_key or latitude is None or longitude is None:
        return []

    params = {
        "output": "json",
        "compact": "false",
        "verbose": "false",
        "latitude": latitude,
        "longitude": longitude,
        "distance": radius_km,
        "distanceunit": "KM",
        "maxresults": max_results,
    }
    url = f"{OPEN_CHARGE_MAP_URL}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url,
        headers={
            "X-API-Key": api_key,
            "User-Agent": "Plugo MVP",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError):
        return []

    stations = []
    for item in payload:
        station = station_from_open_charge_map(item)
        if station["latitude"] and station["longitude"]:
            stations.append(station)
    return stations


def load_local_stations(latitude=None, longitude=None, radius_km=25):
    stations = []
    for index, row in enumerate(load_station_rows()):
        station = station_from_row(row, index)
        if station["latitude"] and station["longitude"]:
            if latitude is not None and longitude is not None:
                dist = haversine_km(latitude, longitude, station["latitude"], station["longitude"])
                if dist > radius_km:
                    continue
            station["source"] = "local_dataset"
            stations.append(station)
    return stations


def load_stations(latitude=None, longitude=None, radius_km=25, max_results=80):
    live_stations = fetch_open_charge_map_stations(
        latitude, longitude, radius_km=radius_km, max_results=max_results
    )
    return live_stations or load_local_stations(latitude, longitude, radius_km)


def estimate_waiting_time(demand, base_waiting_time=0):
    demand_wait = {
        "Low": 5,
        "Medium": 15,
        "High": 30,
    }.get(demand, 20)
    return max(safe_int(base_waiting_time), demand_wait)


def haversine_km(lat1, lng1, lat2, lng2):
    radius_km = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def demand_color(demand):
    return DEMAND_COLORS.get(demand, "gray")


def reliability_score(status):
    weight = STATUS_WEIGHTS.get(status, 3)
    return max(0, round(100 - ((weight - 1) * 35), 1))
