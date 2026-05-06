const API_BASE = "";

let map;
let userMarker;
let bestMarker;
let stationLayer;
let routeLine;
let vehicleMarker;
let vehicleAnimation;
let stations = [];
let markers = [];
let selectedVehicle = "car";
let selectedCharger = "fast";

const elements = {
  stationCount: document.getElementById("stationCount"),
  stationList: document.getElementById("stationList"),
  recommendBtn: document.getElementById("recommendBtn"),
  heroRecommendBtn: document.getElementById("heroRecommendBtn"),
  recommendationPanel: document.getElementById("recommendationPanel"),
  detectBtn: document.getElementById("detectBtn"),
  latInput: document.getElementById("latInput"),
  lngInput: document.getElementById("lngInput"),
  mapFallback: document.getElementById("mapFallback"),
  selectionLabel: document.getElementById("selectionLabel"),
  placeInput: document.getElementById("placeInput"),
  locationLabel: document.getElementById("locationLabel")
};

function demandColor(demand) {
  if (demand === "Low") return "#19b565";
  if (demand === "Medium") return "#f0bf2f";
  if (demand === "High") return "#ef5148";
  return "#697873";
}

function demandClass(demand) {
  return String(demand || "").toLowerCase();
}

function markerIcon(demand) {
  return L.divIcon({
    className: "station-marker-wrap",
    html: `<span class="station-marker" style="--marker-color: ${demandColor(demand)}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12]
  });
}

function userIcon() {
  return L.divIcon({
    className: "user-marker-wrap",
    html: `<span class="user-marker">You</span>`,
    iconSize: [42, 28],
    iconAnchor: [21, 14],
    popupAnchor: [0, -14]
  });
}

function bestStationIcon() {
  return L.divIcon({
    className: "best-marker-wrap",
    html: `<span class="best-marker"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16]
  });
}

function movingVehicleIcon() {
  return L.divIcon({
    className: "moving-vehicle-wrap",
    html: `<span class="moving-vehicle"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
}

function savedVehicle() {
  try {
    return JSON.parse(localStorage.getItem("plugo_vehicle") || "null");
  } catch {
    return null;
  }
}

function currentPosition() {
  if (!elements.latInput.value || !elements.lngInput.value) return null;
  const lat = Number(elements.latInput.value);
  const lng = Number(elements.lngInput.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function availableRangeKm(vehicle) {
  const range = Number(vehicle?.range);
  const battery = Number(vehicle?.battery);
  if (!Number.isFinite(range) || !Number.isFinite(battery)) return null;
  return Math.max(0, Math.round(range * (battery / 100)));
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

async function loadStations() {
  const params = new URLSearchParams({ radius_km: "35", max_results: "80" });
  const position = currentPosition();
  if (position) {
    params.set("user_lat", position.lat);
    params.set("user_lng", position.lng);
  }

  const data = await apiGet(`/stations?${params.toString()}`);
  stations = data.stations || [];
  renderNetwork(data.source);

  if (map) {
    renderMarkers();
  }
}

function renderNetwork(source) {
  const sourceLabel = source === "open_charge_map" ? "live" : "local";
  elements.stationCount.textContent = `${stations.length} ${sourceLabel} stations`;
  renderStationCards(stations.slice(0, 6));
}

function renderStationCards(items) {
  elements.stationList.innerHTML = items.map((station) => `
    <article class="station-card" data-id="${station.id}">
      <div class="station-card-head">
        <h3>${station.name}</h3>
        <span class="pill"><i class="dot ${demandClass(station.predicted_demand)}"></i>${station.predicted_demand}</span>
      </div>
      <p class="muted">${station.charger_type} / ${station.status}</p>
      <div class="station-meta">
        <span class="pill">${station.estimated_waiting_time} min wait</span>
        <span class="pill">${station.reliability_score}% reliable</span>
      </div>
    </article>
  `).join("");
}

function renderMarkers() {
  markers.forEach((marker) => marker.remove());
  markers = [];

  if (stationLayer) {
    stationLayer.clearLayers();
  }

  const bounds = [];
  stations.forEach((station) => {
    const position = [station.latitude, station.longitude];
    const marker = L.marker(position, {
      title: station.name,
      icon: markerIcon(station.predicted_demand)
    }).bindPopup(stationInfoHtml(station));

    marker.addTo(stationLayer);
    markers.push(marker);
    bounds.push(position);
  });

  if (stations.length) {
    map.fitBounds(bounds, { padding: [42, 42], maxZoom: 13 });
  }
}

function stationInfoHtml(station) {
  return `
    <div class="info-window">
      <h3>${station.name}</h3>
      <p><strong>Demand:</strong> ${station.predicted_demand}</p>
      <p><strong>Confidence:</strong> ${Math.round(station.confidence * 100)}%</p>
      <p><strong>Wait:</strong> ${station.estimated_waiting_time} minutes</p>
      <p><strong>Status:</strong> ${station.status}</p>
      <p><strong>Source:</strong> ${station.source === "open_charge_map" ? "Live Open Charge Map" : "Local dataset"}</p>
    </div>
  `;
}

function initMap() {
  const start = {
    lat: Number(elements.latInput.value) || 20.5937,
    lng: Number(elements.lngInput.value) || 78.9629
  };
  if (!window.L) {
    elements.mapFallback.classList.remove("hidden");
    throw new Error("Map library could not load. Check your internet connection.");
  }

  map = L.map("map", {
    center: [start.lat, start.lng],
    zoom: 10,
    zoomControl: false,
    scrollWheelZoom: true
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  stationLayer = L.layerGroup().addTo(map);
  updateUserMarker();
  detectLocation({ silent: true, refreshStations: true }).catch(() => {
    elements.locationLabel.textContent = "Location unavailable";
    loadStations().catch(showError);
  });
}

function updateUserMarker() {
  if (!map) return;
  const position = {
    lat: Number(elements.latInput.value),
    lng: Number(elements.lngInput.value)
  };
  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;

  if (!userMarker) {
    userMarker = L.marker([position.lat, position.lng], {
      title: "Your location",
      icon: userIcon(),
      zIndexOffset: 600
    }).addTo(map);
  } else {
    userMarker.setLatLng([position.lat, position.lng]);
  }
}

function showRecommendations(data) {
  const station = data.best_station;
  const vehicle = savedVehicle();
  const rangeKm = availableRangeKm(vehicle);
  const rangeText = rangeKm === null
    ? "Add vehicle range for trip comfort"
    : `${rangeKm} km usable range now`;
  const rangeClass = rangeKm !== null && station.distance_km > rangeKm ? "range-risk" : "";

  let html = `
    <div class="panel-heading">
            <span>Best Recommendation</span>
            <strong>Score ${station.score}</strong>
    </div>
    <h3 style="font-size: 1.4rem; margin-bottom: 0.2rem;">${station.name}</h3>
    <p class="muted" style="margin-bottom: 1rem;">${station.distance_km} km away</p>
    
    <div class="dashboard-metrics" style="display: flex; gap: 10px; margin-bottom: 1rem;">
      <div class="metric-box" style="flex: 1; background: var(--surface-2); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--line);">
        <span style="display: block; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; font-weight: 800;">Wait Time</span>
        <strong style="display: block; font-size: 1.8rem; color: var(--ink); line-height: 1;">${station.estimated_waiting_time}<span style="font-size: 1rem;">m</span></strong>
      </div>
      <div class="metric-box" style="flex: 1; background: var(--surface-2); padding: 10px; border-radius: 8px; text-align: center; border: 1px solid var(--line);">
        <span style="display: block; font-size: 0.75rem; color: var(--muted); text-transform: uppercase; font-weight: 800;">Reliability</span>
        <strong style="display: block; font-size: 1.8rem; color: var(--teal); line-height: 1;">${station.reliability_score}<span style="font-size: 1rem;">%</span></strong>
      </div>
    </div>

    <p class="muted ${rangeClass}" style="font-size: 0.85rem; padding: 8px; background: rgba(0,0,0,0.03); border-radius: 6px;">
      <strong>${vehicle?.model || "Vehicle"}:</strong> ${rangeText}
    </p>
    <div class="station-meta">
      <span class="pill"><i class="dot ${demandClass(station.predicted_demand)}"></i>${station.predicted_demand} Demand</span>
    </div>
  `;

  if (data.other_options && data.other_options.length > 0) {
    html += `<div style="margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid var(--border);">
      <span class="eyebrow" style="margin-bottom: 0.8rem; display: block;">Other Options</span>
    `;
    data.other_options.forEach(opt => {
        html += `
          <div class="alternative-option" onclick="document.querySelector('.station-card[data-id=\\'${opt.id}\\']')?.scrollIntoView({behavior: 'smooth'})" style="padding: 8px; border-radius: 8px; transition: all 0.2s; cursor: pointer; border: 1px solid transparent;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="font-size: 0.9rem; color: var(--ink);">${opt.name}</strong>
              <span style="font-weight: 800; color: var(--teal); font-size: 0.8rem;">${opt.estimated_waiting_time}m wait</span>
            </div>
            <span class="muted" style="font-size: 0.8rem;">${opt.distance_km} km away (Score ${opt.score})</span>
          </div>
        `;
    });
    html += `</div>`;
  }

  elements.recommendationPanel.innerHTML = html;

  if (map) {
    const position = [station.latitude, station.longitude];
    if (bestMarker) bestMarker.remove();
    bestMarker = L.marker(position, {
      title: `Best: ${station.name}`,
      icon: bestStationIcon(),
      zIndexOffset: 900
    }).bindPopup(stationInfoHtml(station)).addTo(map);
    map.setView(position, 13);
    bestMarker.openPopup();
    drawRoutePreview(station);
  }
}

async function findRecommendation() {
  elements.recommendBtn.disabled = true;
  elements.heroRecommendBtn.disabled = true;
  elements.recommendBtn.textContent = "Calculating...";
  elements.heroRecommendBtn.textContent = "Calculating...";
  
  // Loading skeleton state
  elements.recommendationPanel.innerHTML = `
    <div class="panel-heading">
      <span>AI Engine</span>
      <strong>Analyzing...</strong>
    </div>
    <div class="skeleton-line" style="height: 24px; width: 70%; margin-bottom: 12px; background: var(--line); border-radius: 4px; animation: pulse 1.5s infinite;"></div>
    <div class="skeleton-line" style="height: 14px; width: 40%; margin-bottom: 24px; background: var(--line); border-radius: 4px; animation: pulse 1.5s infinite;"></div>
    <div style="display: flex; gap: 10px;">
      <div style="flex: 1; height: 60px; background: var(--line); border-radius: 8px; animation: pulse 1.5s infinite;"></div>
      <div style="flex: 1; height: 60px; background: var(--line); border-radius: 8px; animation: pulse 1.5s infinite;"></div>
    </div>
  `;

  try {
    if (!currentPosition()) {
      await detectLocation({ silent: false, refreshStations: true });
    }

    const vehicle = savedVehicle();
    let queryVehicleType = selectedVehicle;
    let queryChargerType = selectedCharger;
    
    if (vehicle) {
        queryVehicleType = vehicle.category === "2-wheeler" ? "scooter" : "car";
        queryChargerType = vehicle.connector;
    }

    const params = new URLSearchParams({
      user_lat: elements.latInput.value,
      user_lng: elements.lngInput.value,
      vehicle_type: queryVehicleType,
      charger_type: queryChargerType
    });
    const data = await apiGet(`/recommend?${params.toString()}`);
    showRecommendations(data);
    document.getElementById("finder").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showError(error);
  } finally {
    elements.recommendBtn.disabled = false;
    elements.heroRecommendBtn.disabled = false;
    elements.recommendBtn.textContent = "Find Best Station";
    elements.heroRecommendBtn.textContent = "Find Best Station";
  }
}

function drawRoutePreview(station) {
  const start = currentPosition();
  if (!map || !start) return;

  const end = { lat: station.latitude, lng: station.longitude };
  const route = [[start.lat, start.lng], [end.lat, end.lng]];

  if (routeLine) routeLine.remove();
  if (vehicleMarker) vehicleMarker.remove();
  if (vehicleAnimation) cancelAnimationFrame(vehicleAnimation);

  routeLine = L.polyline(route, {
    color: "#3159d8",
    weight: 5,
    opacity: 0.82,
    dashArray: "10 12"
  }).addTo(map);

  vehicleMarker = L.marker(route[0], {
    title: "Vehicle route preview",
    icon: movingVehicleIcon(),
    zIndexOffset: 1000
  }).addTo(map);

  const startedAt = performance.now();
  const duration = 2600;
  const animate = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const lat = start.lat + ((end.lat - start.lat) * progress);
    const lng = start.lng + ((end.lng - start.lng) * progress);
    vehicleMarker.setLatLng([lat, lng]);
    if (progress < 1) {
      vehicleAnimation = requestAnimationFrame(animate);
    }
  };
  vehicleAnimation = requestAnimationFrame(animate);
}

function detectLocation(options = {}) {
  const { silent = false, refreshStations = false } = options;
  if (!navigator.geolocation) {
    if (!silent) showError(new Error("Location detection is unavailable in this browser"));
    return Promise.reject(new Error("Location detection is unavailable in this browser"));
  }

  elements.detectBtn.disabled = true;
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        elements.latInput.value = position.coords.latitude.toFixed(6);
        elements.lngInput.value = position.coords.longitude.toFixed(6);
        elements.locationLabel.textContent = "Current location";
        updateUserMarker();
        map?.setView([position.coords.latitude, position.coords.longitude], 12);
        elements.detectBtn.disabled = false;

        if (refreshStations) {
          await loadStations().catch(showError);
        }
        resolve(position);
      },
      () => {
        const error = new Error("Could not detect location");
        if (!silent) showError(error);
        elements.detectBtn.disabled = false;
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function updateSelectionLabel() {
  const vehicle = selectedVehicle.charAt(0).toUpperCase() + selectedVehicle.slice(1);
  const charger = selectedCharger.charAt(0).toUpperCase() + selectedCharger.slice(1);
  elements.selectionLabel.textContent = `${vehicle} / ${charger}`;
}

function setupSegments() {
  const vehicle = savedVehicle();
  if (vehicle) {
    const isScooter = vehicle.category === "2-wheeler";
    selectedVehicle = isScooter ? "scooter" : "car";
    selectedCharger = vehicle.connector;
    
    const panel = elements.selectionLabel.closest(".panel");
    panel.innerHTML = `
      <div class="panel-heading">
        <span>Vehicle</span>
        <strong>Attached</strong>
      </div>
      <div style="margin-bottom: 1rem;">
        <strong style="display: block; font-size: 0.9rem;">${vehicle.brand || ""} ${vehicle.model}</strong>
        <span class="muted" style="font-size: 0.8rem;">Connector: ${vehicle.connector}</span>
      </div>
      <button id="recommendBtn" class="primary-btn wide">Find Best Station</button>
    `;
    elements.recommendBtn = document.getElementById("recommendBtn");
    elements.recommendBtn.addEventListener("click", findRecommendation);
  } else {
    document.querySelectorAll("[data-vehicle]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedVehicle = button.dataset.vehicle;
        document.querySelectorAll("[data-vehicle]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        updateSelectionLabel();
      });
    });

    document.querySelectorAll("[data-charger]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCharger = button.dataset.charger;
        document.querySelectorAll("[data-charger]").forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        updateSelectionLabel();
      });
    });
  }
}

function showError(error) {
  elements.recommendationPanel.innerHTML = `
    <div class="panel-heading">
      <span>Charge readiness</span>
      <strong>Notice</strong>
    </div>
    <p class="muted">${error.message || "Something went wrong"}</p>
  `;
}

elements.recommendBtn.addEventListener("click", findRecommendation);
elements.heroRecommendBtn.addEventListener("click", findRecommendation);
elements.detectBtn.addEventListener("click", () => {
  detectLocation({ refreshStations: true }).catch(() => {});
});
elements.latInput.addEventListener("change", updateUserMarker);
elements.lngInput.addEventListener("change", updateUserMarker);

setupSegments();
updateSelectionLabel();

try {
  initMap();
} catch (error) {
  showError(error);
  loadStations().catch(showError);
}
