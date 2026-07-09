// js/modules/fefo.js

import {
  ref,
  set
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { store } from "../core/store.js";

import {
  database
}
from "../../config/firebase-config.js";

import {
  FIREBASE_PATHS
}
from "../utils/firebase-paths.js";

// ===============================
// ELEMENT
// ===============================

const fefoList =
  document.getElementById("fefo-list");

let lastStorageTemp = null;
let lastStorageHumidity = null;
let debounceTimer = null;
let lastRenderSignature = "";
let lastSummarySyncSignature = null;

const TEMP_THRESHOLD = 0.5;
const HUMIDITY_THRESHOLD = 1;
const DEBOUNCE_MS = 300;

// ===============================
// CONFIG
// ===============================

const DEFAULT_ENVIRONMENT = {
  temp_min: 2,
  temp_max: 8,
  humidity_min: 50,
  humidity_max: 80
};

const TEMP_DANGER_DELTA = 2;
const HUMIDITY_DANGER_DELTA = 10;
const INVALID_DATE_REMAINING_DAYS = 1;

function isFiniteNumber(value) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function toFiniteNumber(value, fallback = 0) {
  const numberValue =
    Number(value);

  return isFiniteNumber(numberValue)
    ? numberValue
    : fallback;
}

function roundMetric(value, decimals = 2) {
  if (!isFiniteNumber(value)) {
    return 0;
  }

  return Number(value.toFixed(decimals));
}

function buildRenderSignature(products) {
  if (!Array.isArray(products)) {
    return "";
  }

  return products
    .map((product) => {
      const name = product.product_name || product.name || "";
      const priorityScore = product.priority_score;
      const status = product.status || "";
      const expired = product.expired_date || product.expiry_date || "";
      const remainingDays = product.remaining_days;
      const effectiveRemainingDays = product.effective_remaining_days;
      const deltaTemp = product.delta_temperature;
      const deltaHumidity = product.delta_humidity;
      const tempMin = product.temp_min;
      const tempMax = product.temp_max;
      const humidityMin = product.humidity_min;
      const humidityMax = product.humidity_max;
      const currentTemp = product.current_temperature;
      const currentHumidity = product.current_humidity;

      return `${name}|${priorityScore}|${status}|${expired}|${remainingDays}|${effectiveRemainingDays}|${deltaTemp}|${deltaHumidity}|${tempMin}|${tempMax}|${humidityMin}|${humidityMax}|${currentTemp}|${currentHumidity}`;
    })
    .join("::");
}

function buildProductSummary(products) {
  const summary = {
    total_products: 0,
    safe_products: 0,
    warning_products: 0,
    danger_products: 0,
    last_update: Date.now()
  };

  if (!Array.isArray(products)) {
    return summary;
  }

  summary.total_products = products.length;

  products.forEach((product) => {
    const status =
      String(product.status || "").toUpperCase();

    if (status === "SAFE") {
      summary.safe_products += 1;
    } else if (status === "WARNING") {
      summary.warning_products += 1;
    } else if (status === "DANGER") {
      summary.danger_products += 1;
    }
  });

  return summary;
}

function syncProductSummary(products, signature = buildRenderSignature(products)) {
  if (signature === lastSummarySyncSignature) {
    return;
  }

  lastSummarySyncSignature = signature;

  const summary =
    buildProductSummary(products);

  set(
    ref(database, FIREBASE_PATHS.productSummary),
    summary
  ).then(() => {
    console.log(
      "[FEFO] Product summary synced:",
      summary
    );
  }).catch((error) => {
    lastSummarySyncSignature = null;

    console.error(
      "[FEFO] Failed to sync product summary:",
      error
    );
  });
}

function shouldRecalculate(currentTemp, currentHumidity) {
  if (
    !isFiniteNumber(currentTemp) ||
    !isFiniteNumber(currentHumidity)
  ) {
    return false;
  }

  if (
    !isFiniteNumber(lastStorageTemp) ||
    !isFiniteNumber(lastStorageHumidity)
  ) {
    return true;
  }

  const tempChanged =
    Math.abs(currentTemp - lastStorageTemp) >= TEMP_THRESHOLD;

  const humidityChanged =
    Math.abs(currentHumidity - lastStorageHumidity) >= HUMIDITY_THRESHOLD;

  return tempChanged || humidityChanged;
}

function scheduleFEFOUpdate(force = false) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    generateFEFO(force);
  }, DEBOUNCE_MS);
}

// ===============================
// HELPERS
// ===============================

function getProductName(product) {
  return product.product_name || product.name || "--";
}

function getExpiredDate(product) {
  return product.expired_date || product.expiry_date || "";
}

function formatPriorityScore(score) {
  return toFiniteNumber(score, 0).toFixed(2);
}

function formatCompactNumber(value, decimals = 1) {
  const numberValue =
    toFiniteNumber(value, 0);

  if (Number.isInteger(numberValue)) {
    return String(numberValue);
  }

  return numberValue.toFixed(decimals);
}

function formatDisplayDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const dateParts =
    String(dateValue).split("-");

  const displayDate =
    dateParts.length === 3
      ? new Date(
          Number(dateParts[0]),
          Number(dateParts[1]) - 1,
          Number(dateParts[2])
        )
      : new Date(dateValue);

  if (!isFiniteNumber(displayDate.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(displayDate);
}

function getSortableDate(product) {
  const dateValue =
    product.entry_date || product.created_at;

  if (!dateValue) {
    return null;
  }

  const sortableDate =
    new Date(dateValue);

  return isFiniteNumber(sortableDate.getTime())
    ? sortableDate.getTime()
    : null;
}

// HITUNG SELISIH HARI

function getRemainingDays(expiredDate) {
  if (!expiredDate) {
    return INVALID_DATE_REMAINING_DAYS;
  }

  const today =
    new Date();

  const expired =
    new Date(expiredDate);

  if (!isFiniteNumber(expired.getTime())) {
    return INVALID_DATE_REMAINING_DAYS;
  }

  const diffTime =
    expired - today;

  const diffDays =
    Math.ceil(
      diffTime / (1000 * 60 * 60 * 24)
    );

  return diffDays;
}

function calculateThresholdDeviation(value, min, max) {
  if (value > max) {
    return value - max;
  }

  if (value < min) {
    return min - value;
  }

  return 0;
}

// PARSE TEMPERATURE RANGE STRING
// Input: "2-8" => Output: { min: 2, max: 8 }

function parseTemperatureRange(range) {
  if (!range || typeof range !== "string") {
    return {
      min: DEFAULT_ENVIRONMENT.temp_min,
      max: DEFAULT_ENVIRONMENT.temp_max
    };
  }

  const parts = range.split("-");
  const min = toFiniteNumber(parts[0], DEFAULT_ENVIRONMENT.temp_min);
  const max = toFiniteNumber(parts[1], DEFAULT_ENVIRONMENT.temp_max);

  return {
    min: Math.min(min, max),
    max: Math.max(min, max)
  };
}

// PARSE HUMIDITY RANGE STRING
// Input: "50-80" => Output: { min: 50, max: 80 }

function parseHumidityRange(range) {
  if (!range || typeof range !== "string") {
    return {
      min: DEFAULT_ENVIRONMENT.humidity_min,
      max: DEFAULT_ENVIRONMENT.humidity_max
    };
  }

  const parts = range.split("-");
  const min = toFiniteNumber(parts[0], DEFAULT_ENVIRONMENT.humidity_min);
  const max = toFiniteNumber(parts[1], DEFAULT_ENVIRONMENT.humidity_max);

  return {
    min: Math.min(min, max),
    max: Math.max(min, max)
  };
}

function normalizeProductEnvironment(product) {
  // Parse temperature_range and humidity_range from product
  const tempRange = parseTemperatureRange(product.temperature_range);
  const humidityRange = parseHumidityRange(product.humidity_range);

  return {
    temp_min: tempRange.min,
    temp_max: tempRange.max,
    humidity_min: humidityRange.min,
    humidity_max: humidityRange.max
  };
}

function calculatePenalty(deltaTemp, deltaHumidity) {
  return deltaTemp + (deltaHumidity / 5);
}

function calculateEffectiveRemainingDays(remainingDays, deltaTemp, deltaHumidity) {
  if (!isFiniteNumber(remainingDays)) {
    return INVALID_DATE_REMAINING_DAYS;
  }

  const penalty = calculatePenalty(deltaTemp, deltaHumidity);

  return Math.max(INVALID_DATE_REMAINING_DAYS, remainingDays - penalty);
}

// HITUNG STATUS

function getStatus(deltaTemp, deltaHumidity) {

  const isSafe =
    deltaTemp === 0 &&
    deltaHumidity === 0;

  if (isSafe) {
    return "SAFE";
  }

  const hasLargeDeviation =
    deltaTemp >= TEMP_DANGER_DELTA ||
    deltaHumidity >= HUMIDITY_DANGER_DELTA;

  if (hasLargeDeviation) {
    return "DANGER";
  }

  return "WARNING";
}
// ===============================
// RISK SCORE ENGINE
// ===============================

function calculateRiskScore(
  product,
  storageTemp,
  storageHumidity
) {
  // VALIDASI

  if (
    !isFiniteNumber(storageTemp) ||
    !isFiniteNumber(storageHumidity)
  ) {
    return {
      remaining_days: 0,
      effective_remaining_days: INVALID_DATE_REMAINING_DAYS,
      delta_temperature: 0,
      delta_humidity: 0,
      priority_score: 0,
      status: "SAFE"
    };
  }

  // PRODUCT SAFE OPERATING RANGE

  const environment =
    normalizeProductEnvironment(product);

  // THRESHOLD-BASED ENVIRONMENTAL DEVIATION

  const deltaTemp =
    calculateThresholdDeviation(
      storageTemp,
      environment.temp_min,
      environment.temp_max
    );

  const deltaHumidity =
    calculateThresholdDeviation(
      storageHumidity,
      environment.humidity_min,
      environment.humidity_max
    );

  const remainingDays =
    getRemainingDays(
      getExpiredDate(product)
    );

  const effectiveRemainingDays =
    calculateEffectiveRemainingDays(
      remainingDays,
      deltaTemp,
      deltaHumidity
    );

  const priorityScore =
    100 / effectiveRemainingDays;

  const status =
    getStatus(
      deltaTemp,
      deltaHumidity
    );

  return {
    ...environment,
    remaining_days:
      remainingDays,
    effective_remaining_days:
      roundMetric(effectiveRemainingDays, 2),
    delta_temperature:
      roundMetric(deltaTemp),
    delta_humidity:
      roundMetric(deltaHumidity),
    priority_score:
      roundMetric(priorityScore, 2),
    status
  };
}

// ===============================
// FEFO ENGINE
// ===============================

function buildAnalyzedProducts(products, storageTemp, storageHumidity) {
  return products.map((product, originalIndex) => {
    const result =
      calculateRiskScore(
        product,
        storageTemp,
        storageHumidity
      );

    return {
      ...product,
      ...result,
      product_name: getProductName(product),
      expired_date: getExpiredDate(product),
      current_temperature: roundMetric(storageTemp, 1),
      current_humidity: roundMetric(storageHumidity, 1),
      risk_score: result.priority_score,
      original_index: originalIndex,
      status: result.status
    };
  });
}

export function getAdaptiveFefoProducts() {
  const liveData = store.liveData;
  const products = store.productsData;

  if (!liveData || !Array.isArray(products) || products.length === 0) {
    return [];
  }

  const storageTemp = Number(liveData.storage_temp);
  const storageHumidity = Number(liveData.storage_humidity ?? liveData.humidity);

  if (!isFiniteNumber(storageTemp) || !isFiniteNumber(storageHumidity)) {
    return [];
  }

  const analyzedProducts = buildAnalyzedProducts(products, storageTemp, storageHumidity);

  analyzedProducts.sort((a, b) => {
    const scoreDifference = b.priority_score - a.priority_score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const aDate = getSortableDate(a);
    const bDate = getSortableDate(b);

    if (aDate !== null && bDate !== null && aDate !== bDate) {
      return aDate - bDate;
    }

    if (aDate !== null && bDate === null) {
      return -1;
    }

    if (aDate === null && bDate !== null) {
      return 1;
    }

    return a.original_index - b.original_index;
  });

  return analyzedProducts;
}

function generateFEFO(force = false) {
  // STORE DATA

  const liveData =
    store.liveData;

  const products =
    store.productsData;

  // VALIDASI

  if (!liveData) return;

  if (!Array.isArray(products)) return;

  if (!fefoList) return;

  if (products.length === 0) {
    fefoList.innerHTML = `
      <div class="empty-state">
        No products available
      </div>
    `;

    lastRenderSignature = "";
    syncProductSummary([]);
    return;
  }

  // STORAGE ENVIRONMENT

  const storageTemp =
    Number(liveData.storage_temp);

  const storageHumidity =
    Number(
      liveData.storage_humidity ?? liveData.humidity
    );

  if (!isFiniteNumber(storageTemp)) {
    console.warn("[FEFO] Invalid storage temperature:", liveData.storage_temp);
    return;
  }

  if (!isFiniteNumber(storageHumidity)) {
    console.warn(
      "[FEFO] Invalid storage humidity:",
      liveData.storage_humidity ?? liveData.humidity
    );
    return;
  }

  if (!force && !shouldRecalculate(storageTemp, storageHumidity)) {
    return;
  }

  lastStorageTemp = storageTemp;
  lastStorageHumidity = storageHumidity;

  // PROCESS PRODUCTS

  const analyzedProducts =
    buildAnalyzedProducts(
      products,
      storageTemp,
      storageHumidity
    );

  // SORT DESCENDING

  analyzedProducts.sort(
    (a, b) => {
      const scoreDifference =
        b.priority_score - a.priority_score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const aDate =
        getSortableDate(a);

      const bDate =
        getSortableDate(b);

      if (aDate !== null && bDate !== null && aDate !== bDate) {
        return aDate - bDate;
      }

      if (aDate !== null && bDate === null) {
        return -1;
      }

      if (aDate === null && bDate !== null) {
        return 1;
      }

      return a.original_index - b.original_index;
    }
  );

  syncProductSummary(
    analyzedProducts
  );

  // RENDER

  renderFEFO(
    analyzedProducts
  );
}

// ===============================
// RENDER UI
// ===============================

function renderFEFO(products) {
  const signature = buildRenderSignature(products);

  if (signature === lastRenderSignature) {
    return;
  }

  lastRenderSignature = signature;
  fefoList.innerHTML = "";

  products.forEach(
    (product, index) => {
      const item =
        document.createElement("div");

      item.classList.add(
        "fefo-card"
      );

      const displayScore =
        product.risk_score > 9999
          ? "9999+"
          : formatPriorityScore(product.risk_score);

      const expirationDate =
        formatDisplayDate(product.expired_date);

      const invalidExpiration =
        expirationDate === "-";

      const currentTemperature =
        formatCompactNumber(product.current_temperature);

      const currentHumidity =
        formatCompactNumber(product.current_humidity);

      const tempMin =
        formatCompactNumber(product.temp_min);

      const tempMax =
        formatCompactNumber(product.temp_max);

      const humidityMin =
        formatCompactNumber(product.humidity_min);

      const humidityMax =
        formatCompactNumber(product.humidity_max);

      const remainingDays =
        formatCompactNumber(product.remaining_days, 0);

      const effectiveRemainingDays =
        formatCompactNumber(product.effective_remaining_days, 2);

      const deltaTemperature =
        toFiniteNumber(product.delta_temperature, 0);

      const deltaHumidity =
        toFiniteNumber(product.delta_humidity, 0);

      const tempDeviationRow =
        deltaTemperature > 0
          ? `
            <div class="fefo-detail fefo-deviation">
              <span>
                Temperature deviation:
              </span>

              <strong>
                +${formatCompactNumber(deltaTemperature)}&deg;C
              </strong>
            </div>
          `
          : "";

      const humidityDeviationRow =
        deltaHumidity > 0
          ? `
            <div class="fefo-detail fefo-deviation">
              <span>
                Humidity deviation:
              </span>

              <strong>
                +${formatCompactNumber(deltaHumidity)}%
              </strong>
            </div>
          `
          : "";

      const invalidDateWarning =
        invalidExpiration
          ? `
            <small class="fefo-data-warning">
              Invalid date - check data
            </small>
          `
          : "";

      item.innerHTML = `
        <div class="fefo-card-header">
          <div class="fefo-title-row">
            <span class="fefo-rank">
              #${index + 1}
            </span>

            <h3>
              ${product.product_name}
            </h3>
          </div>

          <div class="fefo-status ${product.status.toLowerCase()}">
            ${product.status}
          </div>
        </div>

        <div class="fefo-content">
          <div class="fefo-priority">
            <span>
              Priority Score
            </span>

            <strong>
              ${displayScore}
            </strong>
          </div>

          <div class="fefo-detail-grid">
            <div class="fefo-detail">
              <span>
                Expires:
              </span>

              <strong>
                ${expirationDate}
              </strong>

              ${invalidDateWarning}
            </div>

            <div class="fefo-detail">
              <span>
                Storage:
              </span>

              <strong>
                ${currentTemperature}&deg;C &bull; ${currentHumidity}%
              </strong>
            </div>

            <div class="fefo-detail">
              <span>
                Safe Range:
              </span>

              <strong>
                ${tempMin}&deg;C - ${tempMax}&deg;C
              </strong>
            </div>

            <div class="fefo-detail">
              <span>
                Humidity Range:
              </span>

              <strong>
                ${humidityMin}% - ${humidityMax}%
              </strong>
            </div>

            <div class="fefo-detail">
              <span>
                Remaining Days:
              </span>

              <strong>
                ${remainingDays}
              </strong>
            </div>

            <div class="fefo-detail">
              <span>
                Effective Remaining Days:
              </span>

              <strong>
                ${effectiveRemainingDays}
              </strong>
            </div>

            ${tempDeviationRow}
            ${humidityDeviationRow}

            <div class="fefo-detail">
              <span>
                Status:
              </span>

              <strong>
                ${product.status}
              </strong>
            </div>
          </div>
        </div>
      `;

      fefoList.appendChild(
        item
      );
    }
  );

  console.log(
    "[FEFO] Rendered:",
    products
  );
}


// ===============================
// REALTIME EVENTS
// ===============================

// LIVE DATA CHANGED

window.addEventListener(
  "liveDataUpdated",
  () => scheduleFEFOUpdate(false)
);

// PRODUCTS CHANGED

window.addEventListener(
  "productsUpdated",
  () => scheduleFEFOUpdate(true)
);
