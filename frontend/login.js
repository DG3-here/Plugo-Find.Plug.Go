const elements = {
  loginBtn: document.getElementById("loginBtn"),
  mobileInput: document.getElementById("mobileInput"),
  otpInput: document.getElementById("otpInput"),
  sessionState: document.getElementById("sessionState"),
  vehicleCategory: document.getElementById("vehicleCategory"),
  vehicleBrand: document.getElementById("vehicleBrand"),
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

const vehicleDB = {
  "4-wheeler": {
    "Tata": [
      { name: "Nexon.ev", range: 320, connector: "CCS2" },
      { name: "Punch.ev", range: 315, connector: "CCS2" },
      { name: "Tiago.ev", range: 250, connector: "CCS2" },
      { name: "Tigor.ev", range: 210, connector: "CCS2" }
    ],
    "MG": [
      { name: "ZS EV", range: 461, connector: "CCS2" },
      { name: "Comet EV", range: 230, connector: "Type 2" }
    ],
    "Hyundai": [
      { name: "Ioniq 5", range: 631, connector: "CCS2" },
      { name: "Kona Electric", range: 452, connector: "CCS2" }
    ],
    "BYD": [
      { name: "Atto 3", range: 521, connector: "CCS2" },
      { name: "Seal", range: 650, connector: "CCS2" }
    ],
    "Mahindra": [
      { name: "XUV400", range: 375, connector: "CCS2" }
    ]
  },
  "2-wheeler": {
    "Ather": [
      { name: "450X", range: 111, connector: "Ather Grid" }
    ],
    "Ola": [
      { name: "S1 Pro", range: 195, connector: "Ola Hypercharger" },
      { name: "S1 Air", range: 151, connector: "Ola Hypercharger" }
    ],
    "TVS": [
      { name: "iQube", range: 100, connector: "15A" }
    ],
    "Bajaj": [
      { name: "Chetak", range: 108, connector: "15A" }
    ]
  }
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

function updateBrands() {
  const category = elements.vehicleCategory.value;
  elements.vehicleBrand.innerHTML = '<option value="" disabled selected>Select brand</option>';
  elements.vehicleModel.innerHTML = '<option value="" disabled selected>Select model</option>';
  elements.vehicleBrand.disabled = true;
  elements.vehicleModel.disabled = true;
  elements.connectorType.value = "";
  elements.batteryRange.value = "";

  if (category && vehicleDB[category]) {
    Object.keys(vehicleDB[category]).forEach(brand => {
      const option = document.createElement("option");
      option.value = brand;
      option.textContent = brand;
      elements.vehicleBrand.appendChild(option);
    });
    elements.vehicleBrand.disabled = false;
  }
}

function updateModels() {
  const category = elements.vehicleCategory.value;
  const brand = elements.vehicleBrand.value;
  elements.vehicleModel.innerHTML = '<option value="" disabled selected>Select model</option>';
  elements.vehicleModel.disabled = true;
  elements.connectorType.value = "";
  elements.batteryRange.value = "";

  if (category && brand && vehicleDB[category][brand]) {
    vehicleDB[category][brand].forEach(model => {
      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      elements.vehicleModel.appendChild(option);
    });
    elements.vehicleModel.disabled = false;
  }
}

function updateDetails() {
  const category = elements.vehicleCategory.value;
  const brand = elements.vehicleBrand.value;
  const modelName = elements.vehicleModel.value;
  
  if (category && brand && modelName && vehicleDB[category][brand]) {
    const model = vehicleDB[category][brand].find(m => m.name === modelName);
    if (model) {
      elements.connectorType.value = model.connector;
      elements.batteryRange.value = model.range;
    }
  }
}

function setupVehicleGarage() {
  if(elements.vehicleCategory) elements.vehicleCategory.addEventListener("change", updateBrands);
  if(elements.vehicleBrand) elements.vehicleBrand.addEventListener("change", updateModels);
  if(elements.vehicleModel) elements.vehicleModel.addEventListener("change", updateDetails);

  const savedVehicle = JSON.parse(localStorage.getItem("plugo_vehicle") || "null");
  if (savedVehicle) {
    if (savedVehicle.category) {
        elements.vehicleCategory.value = savedVehicle.category;
        updateBrands();
        if (savedVehicle.brand) {
            elements.vehicleBrand.value = savedVehicle.brand;
            updateModels();
            if (savedVehicle.model) {
                elements.vehicleModel.value = savedVehicle.model;
                updateDetails();
            }
        }
    } else if (savedVehicle.model) {
        // Fallback for old saved data
        elements.vehicleModel.innerHTML = `<option value="${savedVehicle.model}" selected>${savedVehicle.model}</option>`;
        elements.vehicleModel.disabled = false;
    }

    elements.batteryRange.value = savedVehicle.range || "";
    elements.connectorType.value = savedVehicle.connector || "";
    elements.batteryPercent.value = savedVehicle.battery || "";
    renderVehicle(savedVehicle);
  }

  elements.saveVehicleBtn.addEventListener("click", () => {
    const vehicle = {
      category: elements.vehicleCategory.value,
      brand: elements.vehicleBrand.value,
      model: elements.vehicleModel.value || "My EV",
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
  elements.garageVehicleName.textContent = vehicle.brand ? `${vehicle.brand} ${vehicle.model}` : vehicle.model;
  elements.garageVehicleMeta.textContent = "Plugo will use this profile to judge charger fit, range comfort, and charging urgency.";
  elements.garageRange.textContent = vehicle.range ? `${vehicle.range} km` : "--";
  elements.garageConnector.textContent = vehicle.connector || "--";
  elements.garageBattery.textContent = vehicle.battery ? `${vehicle.battery}%` : "--";
}

setupLogin();
setupVehicleGarage();
