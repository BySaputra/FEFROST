import {
  store
}
from "../core/store.js";

import {
  formatTemperature,
  formatHumidity
}
from "../utils/telemetry.js";

// DOM ELEMENTS

const tempRoom =
document.getElementById("temp-room");

const humidity =
document.getElementById("humidity");

const tempStorage =
document.getElementById("temp-storage");

const status =
document.getElementById("status");

// RENDER MONITORING TELEMETRY

function renderMonitoring() {

  const data =
    store.liveData;

  if (!data) return;

  try {
    if (tempRoom) {
      tempRoom.innerText =
        formatTemperature(data.room_temp);
    }

    if (humidity) {
      humidity.innerText =
        formatHumidity(data.humidity);
    }

    if (tempStorage) {
      tempStorage.innerText =
        formatTemperature(data.storage_temp);
    }

    if (status) {
      status.innerText =
        data.status || "UNKNOWN";

      status.className =
        `status-badge ${data.status.toLowerCase()}`;
    }

    console.log("[MONITORING] Rendered:", data);
  } catch (error) {
    console.error("[MONITORING] Render failed:", error);
  }

}

// LISTEN FOR LIVE DATA UPDATES

if (tempRoom || humidity || tempStorage) {
  window.addEventListener(
    "liveDataUpdated",
    renderMonitoring
  );

  // Initial render if data already loaded
  if (store.liveData) {
    renderMonitoring();
  }
}