const elements = {
  loginBtn: document.getElementById("loginBtn"),
  mobileInput: document.getElementById("mobileInput"),
  otpInput: document.getElementById("otpInput"),
  sessionState: document.getElementById("sessionState"),
  vehicleModel: document.getElementById("vehicleModel"),
  batteryRange: document.getElementById("batteryRange"),
  connectorType: document.getElementById("connectorType"),
  batteryPercent: document.getElementById("batteryPercent"),
  saveVehicleBtn: document.getElementById("saveVehicleBtn"),
  vehicleState: document.getElementById("vehicleState"),
  garageVehicleName: document.getElementById("garageVehicleName"),
  garageVehicleMeta: document.getElementById("garageVehicleMeta"),
  garageRange: document.getElementById("garageRange"),
  garageConnector: document.getElementById("garageConnector"),
  garageBattery: document.getElementById("garageBattery")
};

function setupLogin() {
  const savedMobile = sessionStorage.getItem("plugo_mobile");
  if (savedMobile) {
    elements.sessionState.textContent = savedMobile;
  }

  elements.loginBtn.addEventListener("click", () => {
    const mobile = elements.mobileInput.value.trim();
    const otp = elements.otpInput.value.trim();
    if (mobile.length < 10 || otp.length < 4) {
      elements.sessionState.textContent = "Check details";
      return;
    }
    sessionStorage.setItem("plugo_mobile", mobile);
    elements.sessionState.textContent = mobile;
  });
}

function setupVehicleGarage() {
  const savedVehicle = JSON.parse(localStorage.getItem("plugo_vehicle") || "null");
  if (savedVehicle) {
    elements.vehicleModel.value = savedVehicle.model || "";
    elements.batteryRange.value = savedVehicle.range || "";
    elements.connectorType.value = savedVehicle.connector || "";
    elements.batteryPercent.value = savedVehicle.battery || "";
    renderVehicle(savedVehicle);
  }

  elements.saveVehicleBtn.addEventListener("click", () => {
    const vehicle = {
      model: elements.vehicleModel.value.trim() || "My EV",
      range: elements.batteryRange.value.trim(),
      connector: elements.connectorType.value.trim() || "CCS2",
      battery: elements.batteryPercent.value.trim()
    };

    localStorage.setItem("plugo_vehicle", JSON.stringify(vehicle));
    renderVehicle(vehicle);
  });
}

function renderVehicle(vehicle) {
  elements.vehicleState.textContent = "Attached";
  elements.garageVehicleName.textContent = vehicle.model;
  elements.garageVehicleMeta.textContent = "Plugo will use this profile to judge charger fit, range comfort, and charging urgency.";
  elements.garageRange.textContent = vehicle.range ? `${vehicle.range} km` : "--";
  elements.garageConnector.textContent = vehicle.connector || "--";
  elements.garageBattery.textContent = vehicle.battery ? `${vehicle.battery}%` : "--";
}

setupLogin();
setupVehicleGarage();
