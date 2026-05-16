// js/modules/fefo.js

import { store } from "../core/store.js";

// ===============================
// ELEMENT
// ===============================

const fefoList =
document.getElementById("fefo-list");

let lastStorageTemp = null;
let debounceTimer = null;
let lastRenderSignature = "";

const TEMP_THRESHOLD = 0.5;
const DEBOUNCE_MS = 300;

// ===============================
// CONFIG
// ===============================

const SAFE_LIMIT = 5;
const WARNING_LIMIT = 10;

function isFiniteNumber(value) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function buildRenderSignature(products) {
  if (!Array.isArray(products)) {
    return "";
  }

  return products
    .map((product) => {
      const name = product.product_name || "";
      const score = product.risk_score;
      const status = product.status || "";
      const expired = product.expired_date || "";
      return `${name}|${score}|${status}|${expired}`;
    })
    .join("::");
}

function shouldRecalculate(currentTemp) {
  if (!isFiniteNumber(currentTemp)) {
    return false;
  }

  if (!isFiniteNumber(lastStorageTemp)) {
    return true;
  }

  return Math.abs(currentTemp - lastStorageTemp) >= TEMP_THRESHOLD;
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

// HITUNG SELISIH HARI

function getRemainingDays(expiredDate) {

  if (!expiredDate) return 0;

  const today =
  new Date();

  const expired =
  new Date(expiredDate);

  const diffTime =
  expired - today;

  const diffDays =
  Math.ceil(
    diffTime / (1000 * 60 * 60 * 24)
  );

  return diffDays;

}

// HITUNG STATUS

function getStatus(score) {

  if (score > WARNING_LIMIT) {

    return "CRITICAL";

  }

  else if (score > SAFE_LIMIT) {

    return "WARNING";

  }

  return "SAFE";

}

// ===============================
// RISK SCORE ENGINE
// ===============================

function calculateRiskScore(
  product,
  storageTemp
) {

  // VALIDASI

  if (
    storageTemp === undefined ||
    storageTemp === null
  ) {

    return {
      score: 0,
      status: "SAFE"
    };

  }

  // PRODUCT DATA

  const idealTemp =
  Number(product.ideal_temp || 4);

  const sensitivity =
  Number(product.sensitivity || 1);

  // TEMPERATURE DEVIATION

  const deltaTemp =
  Math.abs(
    storageTemp - idealTemp
  );

  // REMAINING DAYS

  const remainingDays =
  getRemainingDays(
    product.expired_date
  );

  // EXPIRED FACTOR

  const expiredFactor =
  remainingDays > 0
    ? 1 / remainingDays
    : 10;

  // FINAL SCORE

  const score =
    (
      deltaTemp * sensitivity
    ) +
    (
      expiredFactor * 10
    );

  // STATUS

  const status =
  getStatus(score);

  return {

    score:
    Number(score.toFixed(2)),

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

  if (products.length === 0) {
    fefoList.innerHTML = `
      <div class="empty-state">
        No products available
      </div>
    `;

    lastRenderSignature = "";
    return;
  }

  // STORAGE TEMP

  const storageTemp =
    Number(liveData.storage_temp);

  if (!isFiniteNumber(storageTemp)) {
    console.warn("[FEFO] Invalid storage temperature:", liveData.storage_temp);
    return;
  }

  if (!force && !shouldRecalculate(storageTemp)) {
    return;
  }

  lastStorageTemp = storageTemp;

  // PROCESS PRODUCTS

  const analyzedProducts =
    products.map((product) => {
      const result =
        calculateRiskScore(
          product,
          storageTemp
        );

      return {
        ...product,
        risk_score:
          result.score,
        status:
          result.status
      };
    });

  // SORT DESCENDING

  analyzedProducts.sort(
    (a, b) =>
      b.risk_score - a.risk_score
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
            Risk Score:
            ${product.risk_score}
          </p>

          <p>
            Sensitivity:
            ${product.sensitivity}
          </p>

          <p>
            Expired:
            ${product.expired_date}
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