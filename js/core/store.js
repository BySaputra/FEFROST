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

// PRODUCT NORMALIZATION - Simplified schema
function normalizeProduct(product) {
  return {
    product_name: product.product_name || product.name || "--",
    expired_date: product.expired_date || product.expiry_date || "--",
    temperature_range: product.temperature_range || "2-8",
    humidity_range: product.humidity_range || "50-80",
    // Keep original fields for reference
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