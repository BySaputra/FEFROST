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

import {
  addLog,
  getLatestLogs,
  getLogsBySeverity,
  getLogsByType,
  searchLogs,
  SEVERITY,
  LOG_TYPE
}
from "../utils/logger.js";

// ===============================
// RUNTIME STATE
// ===============================

const runtime = {
  initialized: false,
  unsubscribe: null,
  historyCache: [],
  renderDebounce: null,
  currentFilter: {
    severity: null,
    type: null,
    search: ""
  },
  displayMode: "telemetry" // telemetry | system
};

window.__FEFROST_LOGS__ = runtime;

// ===============================
// CONFIGURATION
// ===============================

const MAX_HISTORY_RENDER = 50;
const MAX_HISTORY_CACHE = 100;
const RENDER_DEBOUNCE_MS = 250;

// ===============================
// DOM HELPERS
// ===============================

function getLogsList() {
  return document.getElementById("logs-list");
}

function getLogsContainer() {
  return document.querySelector("[data-logs-container]");
}

function getFilterControl(name) {
  return document.querySelector(`[data-filter="${name}"]`);
}

// ===============================
// STATUS & SEVERITY MAPPING
// ===============================

function getStatusClass(status) {
  if (status === "DANGER") return "danger";
  if (status === "WARNING") return "warning";
  return "safe";
}

function getSeverityIcon(severity) {
  const icons = {
    danger: "⚠️",
    warning: "⚡",
    info: "ℹ️"
  };
  return icons[severity] || "●";
}

// ===============================
// FILTER & SEARCH ENGINE
// ===============================

function getFilteredLogs() {
  let logs = getLatestLogs(MAX_HISTORY_RENDER);

  // Apply severity filter
  if (runtime.currentFilter.severity) {
    logs = logs.filter(
      (log) => log.severity === runtime.currentFilter.severity
    );
  }

  // Apply type filter
  if (runtime.currentFilter.type) {
    logs = logs.filter(
      (log) => log.type === runtime.currentFilter.type
    );
  }

  // Apply search keyword
  if (runtime.currentFilter.search) {
    const filtered = searchLogs(runtime.currentFilter.search);
    logs = logs.filter((log) =>
      filtered.some((f) => f.id === log.id)
    );
  }

  return logs.reverse();
}

// ===============================
// RENDERING ENGINE
// ===============================

function renderTelemetryLogs() {
  const logsList = getLogsList();

  if (!logsList) return;

  const recentLogs = runtime.historyCache.slice(0, MAX_HISTORY_RENDER);
  const searchKeyword = runtime.currentFilter.search?.toLowerCase().trim();

  const visibleLogs = searchKeyword
    ? recentLogs.filter((data) => {
        const rtcValue = (data.rtc_timestamp || "").toLowerCase();
        const serverValue = formatTimestamp(data.timestamp).toLowerCase();
        const statusValue = (data.status || "").toLowerCase();
        const roomTempValue = String(data.room_temp).toLowerCase();
        const humidityValue = String(data.humidity).toLowerCase();
        const storageTempValue = String(data.storage_temp).toLowerCase();

        return (
          rtcValue.includes(searchKeyword) ||
          serverValue.includes(searchKeyword) ||
          statusValue.includes(searchKeyword) ||
          roomTempValue.includes(searchKeyword) ||
          humidityValue.includes(searchKeyword) ||
          storageTempValue.includes(searchKeyword)
        );
      })
    : recentLogs;

  if (visibleLogs.length === 0) {
    logsList.innerHTML = `
      <tr>
        <td class="empty-row" colspan="6">
          No telemetry data available.
        </td>
      </tr>
    `;
    return;
  }

  logsList.innerHTML = visibleLogs
    .map((data) => `
      <tr class="log-row telemetry">
        <td>${data.rtc_timestamp && typeof data.rtc_timestamp === "string" && data.rtc_timestamp.trim() ? data.rtc_timestamp : "-"}</td>
        <td>
          <span class="timestamp">${formatTimestamp(data.timestamp)}</span>
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
    `)
    .join("");
}

function renderSystemLogs() {
  const logsContainer = getLogsContainer();

  if (!logsContainer) return;

  const filteredLogs = getFilteredLogs();

  if (filteredLogs.length === 0) {
    logsContainer.innerHTML = `
      <div class="logs-empty">
        <p>No logs found</p>
        <small>Try adjusting your filters</small>
      </div>
    `;
    return;
  }

  logsContainer.innerHTML = filteredLogs
    .map((log) => `
      <div class="log-card log-${log.severity}">
        <div class="log-header">
          <div class="log-info">
            <span class="log-icon">${getSeverityIcon(log.severity)}</span>
            <span class="log-type">${log.type}</span>
            <span class="log-source">${log.source}</span>
          </div>
          <span class="log-time">${formatTimestamp(log.timestamp)}</span>
        </div>
        <div class="log-message">
          ${log.message}
        </div>
        <div class="log-meta">
          <span class="log-severity ${log.severity}">${log.severity.toUpperCase()}</span>
        </div>
      </div>
    `)
    .join("");
}

function scheduleRender(mode) {
  if (runtime.renderDebounce) {
    clearTimeout(runtime.renderDebounce);
  }

  runtime.renderDebounce = window.setTimeout(() => {
    runtime.renderDebounce = null;

    if (mode === "telemetry") {
      renderTelemetryLogs();
    } else if (mode === "system") {
      renderSystemLogs();
    }
  }, RENDER_DEBOUNCE_MS);
}

// ===============================
// FILTER CONTROLS
// ===============================

export function setFilter(filterName, value) {
  runtime.currentFilter[filterName] = value;
  scheduleRender(runtime.displayMode);
}

export function getFilters() {
  return { ...runtime.currentFilter };
}

// ===============================
// FIREBASE TELEMETRY LISTENER
// ===============================

export function initLogs() {
  if (runtime.initialized && runtime.unsubscribe) {
    return runtime.unsubscribe;
  }

  try {
    runtime.unsubscribe = onValue(
      ref(database, FIREBASE_PATHS.history),
      (snapshot) => {
        runtime.historyCache = [];

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const telemetry = normalizeTelemetry(childSnapshot.val());

            // Auto-log significant temperature changes
            if (
              telemetry.status &&
              telemetry.status !== "SAFE"
            ) {
              addLog({
                type: LOG_TYPE.TEMPERATURE,
                severity: telemetry.status === "DANGER" ? SEVERITY.DANGER : SEVERITY.WARNING,
                message: `Storage temperature ${telemetry.storage_temp}°C - Status: ${telemetry.status}`,
                source: "telemetry",
                timestamp: telemetry.timestamp,
                metadata: {
                  room_temp: telemetry.room_temp,
                  storage_temp: telemetry.storage_temp,
                  humidity: telemetry.humidity
                }
              });
            }

            runtime.historyCache.push(telemetry);
          });
        }

        runtime.historyCache.sort(
          (a, b) => b.timestamp - a.timestamp
        );

        runtime.historyCache =
          runtime.historyCache.slice(0, MAX_HISTORY_CACHE);

        scheduleRender(runtime.displayMode);

        window.dispatchEvent(
          new CustomEvent("historyUpdated", {
            detail: runtime.historyCache
          })
        );
      },
      (error) => {
        console.error("[LOGS] Telemetry listener failed:", error);

        addLog({
          type: LOG_TYPE.SYSTEM,
          severity: SEVERITY.WARNING,
          message: `Firebase telemetry listener error: ${error.message}`,
          source: "logs"
        });
      }
    );

    runtime.initialized = true;
    console.log("[LOGS] Initialized");

    return runtime.unsubscribe;
  } catch (error) {
    console.error("[LOGS] Initialization failed:", error);
    return null;
  }
}

export function stopLogs() {
  runtime.unsubscribe?.();
  runtime.unsubscribe = null;
  runtime.initialized = false;

  if (runtime.renderDebounce) {
    clearTimeout(runtime.renderDebounce);
    runtime.renderDebounce = null;
  }

  console.log("[LOGS] Stopped");
}

// ===============================
// EXPORT FUNCTIONS
// ===============================

window.downloadMonitoringLogs = function() {
  const content = JSON.stringify(runtime.historyCache, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `fefrost-telemetry-${Date.now()}.json`;
  link.click();

  URL.revokeObjectURL(url);
};

// ===============================
// INITIALIZATION
// ===============================

initLogs();
