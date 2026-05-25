// js/modules/fefo.js

import { store } from "../core/store.js";

// ===============================
// ELEMENT
// ===============================

const fefoList =
  document.getElementById("fefo-list");

let lastStorageTemp = null;
let lastStorageHumidity = null;
let debounceTimer = null;
let lastRenderSignature = "";

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
  humidity_max: 80,
  temperature_factor: 0.2,
  humidity_factor: 0.1
};

const TEMP_DANGER_DELTA = 2;
const HUMIDITY_DANGER_DELTA = 10;
const EXPIRED_BASE_SCORE = 1000;
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
      const baseScore = product.base_score;
      const adaptiveScore = product.adaptive_score;
      const status = product.status || "";
      const expired = product.expired_date || product.expiry_date || "";
      const deltaTemp = product.delta_temperature;
      const deltaHumidity = product.delta_humidity;

      return `${name}|${baseScore}|${adaptiveScore}|${status}|${expired}|${deltaTemp}|${deltaHumidity}`;
    })
    .join("::");
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

function normalizeProductEnvironment(product) {
  const tempMin =
    toFiniteNumber(product.temp_min, DEFAULT_ENVIRONMENT.temp_min);

  const tempMax =
    toFiniteNumber(product.temp_max, DEFAULT_ENVIRONMENT.temp_max);

  const humidityMin =
    toFiniteNumber(product.humidity_min, DEFAULT_ENVIRONMENT.humidity_min);

  const humidityMax =
    toFiniteNumber(product.humidity_max, DEFAULT_ENVIRONMENT.humidity_max);

  return {
    temp_min: Math.min(tempMin, tempMax),
    temp_max: Math.max(tempMin, tempMax),
    humidity_min: Math.min(humidityMin, humidityMax),
    humidity_max: Math.max(humidityMin, humidityMax),
    temperature_factor:
      toFiniteNumber(
        product.temperature_factor,
        DEFAULT_ENVIRONMENT.temperature_factor
      ),
    humidity_factor:
      toFiniteNumber(
        product.humidity_factor,
        DEFAULT_ENVIRONMENT.humidity_factor
      )
  };
}

function calculateBaseScore(remainingDays) {
  if (!isFiniteNumber(remainingDays)) {
    return 100 / INVALID_DATE_REMAINING_DAYS;
  }

  if (remainingDays <= 0) {
    return EXPIRED_BASE_SCORE + (Math.abs(remainingDays) * 100);
  }

  return 100 / Math.max(remainingDays, INVALID_DATE_REMAINING_DAYS);
}

// HITUNG STATUS

function getStatus(deltaTemp, deltaHumidity) {
  const isInsideSafeRange =
    deltaTemp === 0 &&
    deltaHumidity === 0;

  if (isInsideSafeRange) {
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
      base_score: 0,
      adaptive_score: 0,
      delta_temperature: 0,
      delta_humidity: 0,
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

  // BASE FEFO URGENCY

  const remainingDays =
    getRemainingDays(
      getExpiredDate(product)
    );

  const baseScore =
    calculateBaseScore(remainingDays);

  // ADAPTIVE ENVIRONMENTAL SCORE

  const environmentalMultiplier =
    1 +
    (environment.temperature_factor * deltaTemp) +
    (environment.humidity_factor * deltaHumidity);

  const adaptiveScore =
    baseScore * environmentalMultiplier;

  const status =
    getStatus(
      deltaTemp,
      deltaHumidity
    );

  return {
    ...environment,
    remaining_days:
      remainingDays,
    delta_temperature:
      roundMetric(deltaTemp),
    delta_humidity:
      roundMetric(deltaHumidity),
    base_score:
      roundMetric(baseScore),
    adaptive_score:
      roundMetric(adaptiveScore),
    status
  };
}

// ===============================
// FEFO ENGINE
// ===============================

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
    products.map((product) => {
      const result =
        calculateRiskScore(
          product,
          storageTemp,
          storageHumidity
        );

      return {
        ...product,
        ...result,
        product_name:
          getProductName(product),
        expired_date:
          getExpiredDate(product),
        current_temperature:
          roundMetric(storageTemp, 1),
        current_humidity:
          roundMetric(storageHumidity, 1),
        risk_score:
          result.adaptive_score,
        status:
          result.status
      };
    });

  // SORT DESCENDING

  analyzedProducts.sort(
    (a, b) =>
      b.adaptive_score - a.adaptive_score
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

      item.innerHTML = `
        <div class="fefo-rank">
          #${index + 1}
        </div>

        <div class="fefo-content">
          <h3>
            ${product.product_name}
          </h3>

          <p>
            Category:
            ${product.category || "-"}
          </p>

          <p>
            Temperature Range:
            ${product.temp_min} - ${product.temp_max} &deg;C
          </p>

          <p>
            Humidity Range:
            ${product.humidity_min} - ${product.humidity_max} %
          </p>

          <p>
            Current Temperature:
            ${product.current_temperature} &deg;C
          </p>

          <p>
            Current Humidity:
            ${product.current_humidity} %
          </p>

          <p>
            Delta Temperature:
            ${product.delta_temperature} &deg;C
          </p>

          <p>
            Delta Humidity:
            ${product.delta_humidity} %
          </p>

          <p>
            Base Score:
            ${product.base_score}
          </p>

          <p>
            Adaptive Score:
            ${product.adaptive_score}
          </p>

          <p>
            Expired:
            ${product.expired_date || "-"}
          </p>
        </div>

        <div class="fefo-status ${product.status.toLowerCase()}">
          ${product.status}
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
