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
  normalizeNumber,
  normalizeTelemetry,
  calculateTempDelta,
  calculateDaysRemaining
}
from "../utils/telemetry.js";

const fefoList =
document.getElementById("fefo-list");

const runtime =
window.__FEFROST_FEFO__ || {
  initialized: false,
  liveUnsubscribe: null,
  productsUnsubscribe: null,
  calculateTimer: null,
  monitoringData: null,
  productsData: null
};

window.__FEFROST_FEFO__ = runtime;

function scheduleCalculateFEFO() {
  if (runtime.calculateTimer) return;

  runtime.calculateTimer =
    window.setTimeout(() => {
      runtime.calculateTimer =
        null;

      calculateFEFO();
    }, 0);
}

function getPriorityClass(status) {
  if (status === "CRITICAL") return "danger";
  if (status === "WARNING") return "warning";

  return "safe";
}

function renderEmptyRow() {
  if (!fefoList) return;

  fefoList.innerHTML = `
    <tr>
      <td class="empty-row" colspan="4">
        Waiting for monitoring and inventory data.
      </td>
    </tr>
  `;
}

function renderFEFO(results) {
  if (!fefoList) return;

  if (results.length === 0) {
    renderEmptyRow();

    return;
  }

  fefoList.innerHTML =
    results.map((item, index) => {
      const score =
        Number(item.score);

      const riskWidth =
        Math.min(score * 8, 100);

      const riskColor =
        item.status === "CRITICAL"
          ? "var(--danger)"
          : item.status === "WARNING"
            ? "var(--warning)"
            : "var(--safe)";

      return `
        <tr>
          <td>
            <strong>#${index + 1}</strong>
          </td>
          <td>${item.name}</td>
          <td>
            ${item.score}
            <span class="risk-bar"
              style="--risk-width: ${riskWidth}%; --risk-color: ${riskColor};">
              <span></span>
            </span>
          </td>
          <td>
            <span class="badge ${getPriorityClass(item.status)}">
              ${item.status}
            </span>
          </td>
        </tr>
      `;
    }).join("");
}

function calculateFEFO() {
  if (!runtime.monitoringData || !runtime.productsData || !Array.isArray(runtime.productsData)) {
    renderEmptyRow();

    return;
  }

  const results = [];

  runtime.productsData.forEach((product) => {
    try {
      // Validate required product fields
      if (!product || typeof product !== "object") {
        return;
      }

      const actualTemp =
        normalizeNumber(runtime.monitoringData.storage_temp);

      const idealTemp =
        normalizeNumber(product.ideal_temp);

      const sensitivity =
        normalizeNumber(product.sensitivity);

      if (
        !Number.isFinite(actualTemp) ||
        !Number.isFinite(idealTemp) ||
        !Number.isFinite(sensitivity) ||
        sensitivity <= 0
      ) {
        return;
      }

      const deltaT =
        calculateTempDelta(actualTemp, idealTemp);

      const remainingDays =
        calculateDaysRemaining(product.expired_date);

      const expiredFactor =
        1 / remainingDays;

      const riskScore =
        (deltaT * sensitivity) +
        (expiredFactor * 10);

      let status =
        "SAFE";

      if (riskScore > 10) {
        status =
          "CRITICAL";
      }
      else if (riskScore > 5) {
        status =
          "WARNING";
      }

      results.push({
        name:
          product.product_name || "--",
        score:
          riskScore.toFixed(2),
        status
      });

    } catch (error) {
      console.warn("[FEFO] Error calculating product risk:", product, error);
    }
  });

  results.sort(
    (a, b) => Number(b.score) - Number(a.score)
  );

  renderFEFO(results);
}

export function initFEFO() {
  if (runtime.initialized) return;

  runtime.liveUnsubscribe =
    onValue(
      ref(database, FIREBASE_PATHS.live),
      (snapshot) => {
        runtime.monitoringData =
          snapshot.exists()
            ? normalizeTelemetry(snapshot.val())
            : null;

        scheduleCalculateFEFO();
      },
      (error) => {
        console.error("[FEFO] Live telemetry listener failed:", error);
      }
    );

  runtime.productsUnsubscribe =
    onValue(
      ref(database, FIREBASE_PATHS.products),
      (snapshot) => {
        runtime.productsData =
          snapshot.exists()
            ? snapshot.val()
            : null;

        scheduleCalculateFEFO();
      },
      (error) => {
        console.error("[FEFO] Products listener failed:", error);
      }
    );

  runtime.initialized =
    true;
}

export function stopFEFO() {
  runtime.liveUnsubscribe?.();
  runtime.productsUnsubscribe?.();

  runtime.liveUnsubscribe =
    null;

  runtime.productsUnsubscribe =
    null;

  runtime.initialized =
    false;
}

initFEFO();
