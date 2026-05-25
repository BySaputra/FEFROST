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
  normalizeTelemetry
}
from "../utils/telemetry.js";

// PRODUCT NORMALIZATION - Support new environmental schema with fallback
const PRODUCT_FALLBACKS = {
  temp_min: 2,
  temp_max: 8,
  humidity_min: 50,
  humidity_max: 80,
  temperature_factor: 0.2,
  humidity_factor: 0.1
};

function normalizeProduct(product) {
  return {
    // New schema fields
    name: product.name || product.product_name || "--",
    expiry_date: product.expiry_date || product.expired_date || "--",
    temp_min: Number(product.temp_min) || PRODUCT_FALLBACKS.temp_min,
    temp_max: Number(product.temp_max) || PRODUCT_FALLBACKS.temp_max,
    humidity_min: Number(product.humidity_min) || PRODUCT_FALLBACKS.humidity_min,
    humidity_max: Number(product.humidity_max) || PRODUCT_FALLBACKS.humidity_max,
    temperature_factor: Number(product.temperature_factor) || PRODUCT_FALLBACKS.temperature_factor,
    humidity_factor: Number(product.humidity_factor) || PRODUCT_FALLBACKS.humidity_factor,
    // Keep original fields for backward compatibility
    ...product
  };
}

// GLOBAL STORE - Centralized realtime data management
// All modules read data from this store via CustomEvent listeners

export const store = {

  liveData: null,

  historyData: [],

  productsData: [],

  alertsData: []

};

// LIVE TELEMETRY LISTENER
// Real-time monitoring data: temperature, humidity, timestamp

try {
  onValue(
    ref(database, FIREBASE_PATHS.live),
    (snapshot) => {

      if (snapshot.exists()) {
        store.liveData =
          normalizeTelemetry(snapshot.val());
      } else {
        store.liveData = null;
      }

      console.log(
        "[STORE] LIVE UPDATED:",
        store.liveData
      );

      window.dispatchEvent(
        new CustomEvent("liveDataUpdated", {
          detail: store.liveData
        })
      );

    },
    (error) => {
      console.error(
        "[STORE] Live telemetry listener failed:",
        error
      );
    }
  );
} catch (error) {
  console.error(
    "[STORE] Failed to initialize live listener:",
    error
  );
}

// HISTORY LISTENER
// Historical telemetry logs with 100-item limit

try {
  onValue(
    ref(database, FIREBASE_PATHS.history),
    (snapshot) => {

      const history = [];

      if (snapshot.exists()) {
        snapshot.forEach((child) => {

          history.push(normalizeTelemetry(child.val()));

        });
      }

      store.historyData = history.reverse().slice(0, 100);

      console.log(
        "[STORE] HISTORY UPDATED:",
        store.historyData.length,
        "items"
      );

      window.dispatchEvent(
        new CustomEvent("historyUpdated", {
          detail: store.historyData
        })
      );

    },
    (error) => {
      console.error(
        "[STORE] History listener failed:",
        error
      );
    }
  );
} catch (error) {
  console.error(
    "[STORE] Failed to initialize history listener:",
    error
  );
}

// PRODUCTS LISTENER
// Inventory products for FEFO calculations

try {
  onValue(
    ref(database, FIREBASE_PATHS.products),
    (snapshot) => {

      const products = [];

      if (snapshot.exists()) {
        snapshot.forEach((child) => {

          const productData = child.val();
          const normalizedProduct = normalizeProduct(productData);

          products.push({

            key: child.key,

            ...normalizedProduct

          });

        });
      }

      store.productsData = products;

      console.log(
        "[STORE] PRODUCTS UPDATED:",
        store.productsData.length,
        "items"
      );

      window.dispatchEvent(
        new CustomEvent("productsUpdated", {
          detail: store.productsData
        })
      );

    },
    (error) => {
      console.error(
        "[STORE] Products listener failed:",
        error
      );
    }
  );
} catch (error) {
  console.error(
    "[STORE] Failed to initialize products listener:",
    error
  );
}

// ALERTS LISTENER
// Alert events with latest-first ordering

try {
  onValue(
    ref(database, FIREBASE_PATHS.alerts),
    (snapshot) => {

      const alerts = [];

      if (snapshot.exists()) {
        snapshot.forEach((child) => {

          alerts.push(child.val());

        });
      }

      store.alertsData = alerts.reverse();

      console.log(
        "[STORE] ALERTS UPDATED:",
        store.alertsData.length,
        "items"
      );

      window.dispatchEvent(
        new CustomEvent("alertsUpdated", {
          detail: store.alertsData
        })
      );

    },
    (error) => {
      console.error(
        "[STORE] Alerts listener failed:",
        error
      );
    }
  );
} catch (error) {
  console.error(
    "[STORE] Failed to initialize alerts listener:",
    error
  );
}