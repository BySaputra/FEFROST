import {
  ref,
  onValue,
  push,
  runTransaction,
  serverTimestamp
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  database
}
from "../config/firebase-config.js";

const THRESHOLDS = {
  safeMax: 5,
  warningMax: 8
};

const ALERT_MESSAGES = {
  SAFE:
    "System is operating normally. Storage temperature is within safe range.",
  WARNING:
    "Warning: storage temperature is elevated. Monitor cold storage closely.",
  DANGER:
    "Danger: storage temperature is too high. Immediate action is required.",
  UNKNOWN:
    "Monitoring data is unavailable or invalid."
};

const monitoringRef =
ref(database, "fefrost/monitoring");

const alertsRef =
ref(database, "fefrost/alerts");

const alertStateRef =
ref(database, "fefrost/alert_state/current");

const runtime =
window.__FEFROST_MONITORING__ || {
  unsubscribe: null,
  initialized: false
};

window.__FEFROST_MONITORING__ = runtime;

function getElements() {
  return {
    tempRoom:
      document.getElementById("temp-room"),
    humidity:
      document.getElementById("humidity"),
    tempStorage:
      document.getElementById("temp-storage"),
    status:
      document.getElementById("status"),
    alertBox:
      document.getElementById("alert-box"),
    alertStatus:
      document.getElementById("alert-status"),
    alertMessage:
      document.getElementById("alert-message"),
    alertTime:
      document.getElementById("alert-time")
  };
}

function normalizeNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

export function getStatusFromTemperature(value) {
  const temperature =
    normalizeNumber(value);

  if (temperature === null) return "UNKNOWN";
  if (temperature <= THRESHOLDS.safeMax) return "SAFE";
  if (temperature <= THRESHOLDS.warningMax) return "WARNING";

  return "DANGER";
}

function getAlertMessage(status) {
  return ALERT_MESSAGES[status] || ALERT_MESSAGES.UNKNOWN;
}

function formatTemperature(value) {
  const temperature =
    normalizeNumber(value);

  if (temperature === null) return "-- \u00B0C";

  return `${temperature.toFixed(1)} \u00B0C`;
}

function formatHumidity(value) {
  const humidity =
    normalizeNumber(value);

  if (humidity === null) return "-- %";

  return `${humidity.toFixed(0)} %`;
}

function getAlertClass(status) {
  return `alert alert-${status.toLowerCase()}`;
}

function renderMonitoring(data) {
  const elements =
    getElements();

  const status =
    getStatusFromTemperature(data.temperature_storage);

  const message =
    getAlertMessage(status);

  if (elements.tempRoom) {
    elements.tempRoom.textContent =
      formatTemperature(data.temperature_room);
  }

  if (elements.humidity) {
    elements.humidity.textContent =
      formatHumidity(data.humidity);
  }

  if (elements.tempStorage) {
    elements.tempStorage.textContent =
      formatTemperature(data.temperature_storage);
  }

  if (elements.status) {
    elements.status.textContent =
      status;

    elements.status.className =
      `status-pill status-${status.toLowerCase()}`;
  }

  if (elements.alertBox) {
    elements.alertBox.className =
      getAlertClass(status);
  }

  if (elements.alertStatus) {
    elements.alertStatus.textContent =
      status;
  }

  if (elements.alertMessage) {
    elements.alertMessage.textContent =
      message;
  }

  if (elements.alertTime) {
    elements.alertTime.textContent =
      data.timestamp || new Date().toLocaleString("id-ID");
  }

  return {
    status,
    message
  };
}

async function logAlertIfStatusChanged(status, message, data) {
  const timestamp =
    data.timestamp || new Date().toISOString();

  try {
    const result =
      await runTransaction(alertStateRef, (currentState) => {
        if (currentState && currentState.status === status) {
          return;
        }

        return {
          status,
          message,
          timestamp,
          temperature_storage:
            normalizeNumber(data.temperature_storage),
          updated_at:
            serverTimestamp()
        };
      });

    if (!result.committed) return;

    await push(alertsRef, {
      status,
      message,
      temperature_storage:
        normalizeNumber(data.temperature_storage),
      temperature_room:
        normalizeNumber(data.temperature_room),
      humidity:
        normalizeNumber(data.humidity),
      timestamp,
      created_at:
        serverTimestamp()
    });
  }

  catch (error) {
    console.error("Failed to log alert status change:", error);
  }
}

function handleMonitoringSnapshot(snapshot) {
  const data =
    snapshot.val();

  if (!data) return;

  const alert =
    renderMonitoring(data);

  if (alert.status === "UNKNOWN") return;

  logAlertIfStatusChanged(
    alert.status,
    alert.message,
    data
  );
}

export function initMonitoring() {
  if (runtime.initialized && runtime.unsubscribe) {
    return runtime.unsubscribe;
  }

  runtime.unsubscribe =
    onValue(monitoringRef, handleMonitoringSnapshot, (error) => {
      console.error("Monitoring listener failed:", error);
    });

  runtime.initialized =
    true;

  return runtime.unsubscribe;
}

export function stopMonitoring() {
  if (runtime.unsubscribe) {
    runtime.unsubscribe();
    runtime.unsubscribe = null;
  }

  runtime.initialized =
    false;
}

initMonitoring();
