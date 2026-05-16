/**
 * ALERTS MODULE
 * Manages alert events and notifications
 * 
 * Provides:
 * - Real-time alert listener
 * - Alert rendering and display
 * - Alert history management
 * - Alert severity classification
 */

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
  formatTimestamp
}
from "../utils/telemetry.js";

// RUNTIME STATE

const runtime = {
  initialized: false,
  unsubscribe: null,
  alertsCache: []
};

// DOM ELEMENTS

function getAlertsList() {
  return document.getElementById("alerts-list");
}

function getAlertBadge() {
  return document.getElementById("alert-count");
}

// UTILITY FUNCTIONS

function getAlertSeverityClass(severity) {
  const map = {
    "critical": "danger",
    "warning": "warning",
    "info": "info",
    "success": "safe"
  };

  return map[severity?.toLowerCase()] || "info";
}

function getSeverityIcon(severity) {
  const map = {
    "critical": "⚠️",
    "warning": "⚡",
    "info": "ℹ️",
    "success": "✓"
  };

  return map[severity?.toLowerCase()] || "●";
}

// RENDER ALERTS

function renderAlerts() {
  const alertsList = getAlertsList();
  const alertBadge = getAlertBadge();

  if (!alertsList) return;

  // Update alert badge count
  if (alertBadge) {
    const criticalCount = runtime.alertsCache.filter(
      a => a.severity?.toLowerCase() === "critical"
    ).length;

    if (criticalCount > 0) {
      alertBadge.textContent = String(criticalCount);
      alertBadge.style.display = "block";
    } else {
      alertBadge.style.display = "none";
    }
  }

  if (runtime.alertsCache.length === 0) {
    alertsList.innerHTML = `
      <div class="alert-empty">
        <p>No alerts</p>
        <small>All systems operating normally</small>
      </div>
    `;

    return;
  }

  alertsList.innerHTML = runtime.alertsCache
    .slice(0, 50)
    .map((alert) => `
      <div class="alert-item alert-${getAlertSeverityClass(alert.severity)}">
        <div class="alert-icon">
          ${getSeverityIcon(alert.severity)}
        </div>
        <div class="alert-content">
          <strong>${alert.message || "Alert"}</strong>
          <small>${formatTimestamp(alert.timestamp)}</small>
        </div>
        <div class="alert-severity">
          <span class="badge ${getAlertSeverityClass(alert.severity)}">
            ${alert.severity || "--"}
          </span>
        </div>
      </div>
    `).join("");
}

// INITIALIZE ALERTS LISTENER

export function initAlerts() {
  if (runtime.initialized && runtime.unsubscribe) {
    return runtime.unsubscribe;
  }

  try {
    runtime.unsubscribe = onValue(
      ref(database, FIREBASE_PATHS.alerts),
      (snapshot) => {
        runtime.alertsCache = [];

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            runtime.alertsCache.push({
              key: childSnapshot.key,
              ...childSnapshot.val()
            });
          });
        }

        // Sort by timestamp (newest first)
        runtime.alertsCache.sort(
          (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
        );

        renderAlerts();

        console.log("[ALERTS] Updated:", runtime.alertsCache.length, "alerts");
      },
      (error) => {
        console.error("[ALERTS] Listener failed:", error);
      }
    );

    runtime.initialized = true;

    return runtime.unsubscribe;
  } catch (error) {
    console.error("[ALERTS] Initialization failed:", error);
    return null;
  }
}

// STOP ALERTS LISTENER

export function stopAlerts() {
  runtime.unsubscribe?.();

  runtime.unsubscribe = null;
  runtime.initialized = false;
}

// AUTO-INITIALIZE ON MODULE LOAD

initAlerts();

export default {
  initAlerts,
  stopAlerts,
  getAlertsList,
  getAlertBadge
};
