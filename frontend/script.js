const GOOGLE_MAPS_API_KEY = "";
const API_BASE = "";

let map;
let infoWindow;
let userMarker;
let bestMarker;
let heatmap;
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
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: demandColor(demand),
    fillOpacity: 0.95,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 9
  };
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
  const data = await apiGet("/stations");
  stations = data.stations || [];
  renderNetwork();

  if (map) {
    renderMarkers();
  }
}

function renderNetwork() {
  elements.stationCount.textContent = `${stations.length} stations`;
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
  markers.forEach((marker) => marker.setMap(null));
  markers = [];

  if (heatmap) {
    heatmap.setMap(null);
  }

  const bounds = new google.maps.LatLngBounds();
  stations.forEach((station) => {
    const position = { lat: station.latitude, lng: station.longitude };
    const marker = new google.maps.Marker({
      position,
      map,
      title: station.name,
      icon: markerIcon(station.predicted_demand)
    });

    marker.addListener("click", () => showStationInfo(station, marker));
    markers.push(marker);
    bounds.extend(position);
  });

  if (stations.length) {
    map.fitBounds(bounds);
  }

  if (google.maps.visualization) {
    const heatData = stations.map((station) => ({
      location: new google.maps.LatLng(station.latitude, station.longitude),
      weight: station.predicted_demand === "High" ? 3 : station.predicted_demand === "Medium" ? 2 : 1
    }));
    heatmap = new google.maps.visualization.HeatmapLayer({ data: heatData, radius: 28 });
    heatmap.setMap(map);
  }
}

function showStationInfo(station, marker) {
  const html = `
    <div class="info-window">
      <h3>${station.name}</h3>
      <p><strong>Demand:</strong> ${station.predicted_demand}</p>
      <p><strong>Confidence:</strong> ${Math.round(station.confidence * 100)}%</p>
      <p><strong>Wait:</strong> ${station.estimated_waiting_time} minutes</p>
      <p><strong>Status:</strong> ${station.status}</p>
    </div>
  `;
  infoWindow.setContent(html);
  infoWindow.open({ map, anchor: marker });
}

function initMap() {
  const start = {
    lat: Number(elements.latInput.value) || 12.1056,
    lng: Number(elements.lngInput.value) || 75.2117
  };
  map = new google.maps.Map(document.getElementById("map"), {
    center: start,
    zoom: 10,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#dce7df" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#b9d8d3" }] }
    ]
  });
  infoWindow = new google.maps.InfoWindow();
  updateUserMarker();
  loadStations().catch(showError);
}

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) {
    elements.mapFallback.classList.remove("hidden");
    loadStations().catch(showError);
    return;
  }

  window.initMap = initMap;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=visualization&callback=initMap`;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

function updateUserMarker() {
  if (!map) return;
  const position = {
    lat: Number(elements.latInput.value),
    lng: Number(elements.lngInput.value)
  };
  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return;

  if (!userMarker) {
    userMarker = new google.maps.Marker({
      position,
      map,
      title: "Your location",
      label: "You"
    });
  } else {
    userMarker.setPosition(position);
  }
}

function showBestStation(station) {
  elements.recommendationPanel.innerHTML = `
    <div class="panel-heading">
            <span>Recommendation</span>
            <strong>Score ${station.score}</strong>
    </div>
    <h3>${station.name}</h3>
    <p class="muted">${station.distance_km} km away / ${station.estimated_waiting_time} min wait</p>
    <div class="station-meta">
      <span class="pill"><i class="dot ${demandClass(station.predicted_demand)}"></i>${station.predicted_demand}</span>
      <span class="pill">${station.reliability_score}% reliable</span>
    </div>
  `;

  if (map) {
    const position = { lat: station.latitude, lng: station.longitude };
    if (bestMarker) bestMarker.setMap(null);
    bestMarker = new google.maps.Marker({
      position,
      map,
      title: `Best: ${station.name}`,
      icon: {
        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
        fillColor: "#3159d8",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 7
      }
    });
    map.panTo(position);
    map.setZoom(13);
  }
}

async function findRecommendation() {
  elements.recommendBtn.disabled = true;
  elements.heroRecommendBtn.disabled = true;
  elements.recommendBtn.textContent = "Finding...";
  elements.heroRecommendBtn.textContent = "Finding...";

  try {
    const params = new URLSearchParams({
      user_lat: elements.latInput.value,
      user_lng: elements.lngInput.value,
      vehicle_type: selectedVehicle,
      charger_type: selectedCharger
    });
    const data = await apiGet(`/recommend?${params.toString()}`);
    showBestStation(data.best_station);
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

function detectLocation() {
  if (!navigator.geolocation) {
    showError(new Error("Location detection is unavailable in this browser"));
    return;
  }

  elements.detectBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      elements.latInput.value = position.coords.latitude.toFixed(6);
      elements.lngInput.value = position.coords.longitude.toFixed(6);
      elements.locationLabel.textContent = "Current location";
      updateUserMarker();
      elements.detectBtn.disabled = false;
    },
    () => {
      showError(new Error("Could not detect location"));
      elements.detectBtn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function updateSelectionLabel() {
  const vehicle = selectedVehicle.charAt(0).toUpperCase() + selectedVehicle.slice(1);
  const charger = selectedCharger.charAt(0).toUpperCase() + selectedCharger.slice(1);
  elements.selectionLabel.textContent = `${vehicle} / ${charger}`;
}

function setupSegments() {
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
elements.detectBtn.addEventListener("click", detectLocation);
elements.latInput.addEventListener("change", updateUserMarker);
elements.lngInput.addEventListener("change", updateUserMarker);

setupSegments();
updateSelectionLabel();
loadGoogleMaps();
