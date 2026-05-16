import {
  ref,
  onValue
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  database
}
from "../../config/firebase-config.js";

import {
  FIREBASE_PATHS
}
from "../utils/firebase-paths.js";

import {
  formatHumidity,
  formatTemperature,
  formatTimestamp,
  normalizeTelemetry
}
from "../utils/telemetry.js";

const runtime =
window.__FEFROST_HISTORY__ || {
  initialized: false,
  unsubscribe: null,
  logsCache: []
};

window.__FEFROST_HISTORY__ = runtime;

function getLogsList() {
  return document.getElementById("logs-list");
}

function getStatusClass(status) {
  if (status === "DANGER") return "danger";
  if (status === "WARNING") return "warning";

  return "safe";
}

function renderLogs() {
  const logsList =
    getLogsList();

  if (!logsList) return;

  if (runtime.logsCache.length === 0) {
    logsList.innerHTML = `
      <tr>
        <td class="empty-row" colspan="5">
          No monitoring logs available.
        </td>
      </tr>
    `;

    return;
  }

  logsList.innerHTML =
    runtime.logsCache.map((data) => `
      <tr>
        <td>
          <strong>${formatTimestamp(data.timestamp)}</strong>
        </td>
        <td>${formatTemperature(data.room_temp)}</td>
        <td>${formatHumidity(data.humidity)}</td>
        <td>${formatTemperature(data.storage_temp)}</td>
        <td>
          <span class="badge ${getStatusClass(data.status)}">
            ${data.status || "--"}
          </span>
        </td>
      </tr>
    `).join("");
}

export function initLogs() {
  if (runtime.initialized && runtime.unsubscribe) {
    return runtime.unsubscribe;
  }

  runtime.unsubscribe =
    onValue(
      ref(database, FIREBASE_PATHS.history),
      (snapshot) => {
        runtime.logsCache = [];

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            runtime.logsCache.push(
              normalizeTelemetry(childSnapshot.val())
            );
          });
        }

        runtime.logsCache.sort(
          (a, b) => b.timestamp - a.timestamp
        );

        runtime.logsCache =
          runtime.logsCache.slice(0, 100);

        renderLogs();
      },
      (error) => {
        console.error("[HISTORY] Listener failed:", error);
      }
    );

  runtime.initialized =
    true;

  return runtime.unsubscribe;
}

export function stopLogs() {
  runtime.unsubscribe?.();

  runtime.unsubscribe =
    null;

  runtime.initialized =
    false;
}

window.downloadMonitoringLogs = function() {
  const content =
    JSON.stringify(runtime.logsCache, null, 2);

  const blob =
    new Blob([content], {
      type: "application/json"
    });

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href =
    url;

  link.download =
    "fefrost-monitoring-logs.json";

  link.click();

  URL.revokeObjectURL(url);
};

initLogs();
