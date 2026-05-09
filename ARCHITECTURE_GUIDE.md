# 📐 BEST PRACTICES & ARCHITECTURE GUIDE

## RECOMMENDED PROJECT STRUCTURE (Production Ready)

```
fefrost-dashboard/
│
├── .env.example
├── .gitignore
├── README.md
├── package.json
│
├── public/
│   └── index.html
│
├── src/
│   ├── index.js
│   ├── styles/
│   │   ├── main.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   └── responsive.css
│   │
│   ├── config/
│   │   ├── firebase.config.js
│   │   ├── constants.js
│   │   └── env.config.js
│   │
│   ├── core/
│   │   ├── app-state.js (centralized state)
│   │   ├── event-emitter.js (pub-sub)
│   │   ├── error-handler.js
│   │   └── logger.js
│   │
│   ├── firebase/
│   │   ├── db.js (database operations)
│   │   ├── listeners.js (listener management)
│   │   ├── cache.js (offline support)
│   │   └── realtime.js (realtime sync)
│   │
│   ├── features/
│   │   ├── monitoring/
│   │   │   ├── monitoring.module.js
│   │   │   ├── monitoring-ui.js
│   │   │   └── index.js
│   │   │
│   │   ├── products/
│   │   │   ├── products.module.js
│   │   │   ├── products-form.js
│   │   │   ├── products-list.js
│   │   │   └── index.js
│   │   │
│   │   ├── fefo/
│   │   │   ├── fefo-engine.js
│   │   │   ├── fefo-ui.js
│   │   │   └── index.js
│   │   │
│   │   └── logs/
│   │       ├── logs-viewer.js
│   │       ├── logs-ui.js
│   │       └── index.js
│   │
│   ├── ui/
│   │   ├── navigation.js
│   │   ├── notification.js
│   │   ├── modal.js
│   │   └── templates.js
│   │
│   ├── utils/
│   │   ├── validators.js
│   │   ├── formatters.js
│   │   ├── sanitizer.js
│   │   ├── dom.js
│   │   └── storage.js
│   │
│   └── services/
│       ├── auth-service.js (future)
│       ├── sync-service.js
│       └── notification-service.js
│
├── tests/
│   ├── unit/
│   │   ├── validators.test.js
│   │   └── fefo-engine.test.js
│   └── integration/
│       └── firebase.test.js
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
│
└── .env
```

---

## 🎯 CORE PATTERNS

### 1. CENTRALIZED STATE MANAGEMENT

```javascript
// ✅ src/core/app-state.js

/**
 * Centralized application state
 * Single source of truth untuk semua data
 */
class AppState {
  constructor() {
    this.state = {
      monitoring: {
        temperature_room: null,
        humidity: null,
        temperature_storage: null,
        status: "IDLE"
      },
      products: {},
      fefo: {
        priority: [],
        lastUpdated: null
      },
      logs: [],
      ui: {
        currentSection: "monitoring",
        isLoading: false,
        connectionStatus: "online",
        errors: []
      },
      metadata: {
        lastSync: null,
        version: "1.0.0"
      }
    };

    this.listeners = new Set();
    this.history = [];
  }

  /**
   * Subscribe ke state changes
   */
  subscribe(listener) {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  notify(changes) {
    const prevState = JSON.parse(JSON.stringify(this.state));
    
    this.listeners.forEach(listener => {
      listener({
        prevState,
        newState: this.state,
        changes
      });
    });
  }

  /**
   * Update state dengan path syntax
   * Example: setState({ "monitoring.temperature_room": 20 })
   */
  setState(updates) {
    const changes = {};

    Object.entries(updates).forEach(([path, value]) => {
      const keys = path.split(".");
      let current = this.state;

      // Navigate to nested property
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }

      // Set value
      const lastKey = keys[keys.length - 1];
      const oldValue = current[lastKey];
      
      if (oldValue !== value) {
        current[lastKey] = value;
        changes[path] = { old: oldValue, new: value };
      }
    });

    // Store history
    this.history.push({
      timestamp: Date.now(),
      changes,
      state: JSON.parse(JSON.stringify(this.state))
    });

    if (changes && Object.keys(changes).length > 0) {
      this.notify(changes);
    }
  }

  /**
   * Get state (immutable copy)
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Get nested value
   */
  getValue(path) {
    const keys = path.split(".");
    let current = this.state;

    for (const key of keys) {
      current = current?.[key];
    }

    return current;
  }

  /**
   * Clear state (untuk testing/reset)
   */
  reset() {
    this.state = JSON.parse(JSON.stringify(this.getInitialState()));
    this.notify({ type: "reset" });
  }

  /**
   * Get state history
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
}

export const appState = new AppState();
```

### Usage:
```javascript
// Subscribe to changes
const unsubscribe = appState.subscribe(({ prevState, newState, changes }) => {
  console.log("State changed:", changes);
  updateUI(newState);
});

// Update state
appState.setState({
  "monitoring.temperature_room": 25,
  "ui.currentSection": "products"
});

// Get state
const currentState = appState.getState();

// Unsubscribe
unsubscribe();
```

---

### 2. PUB-SUB EVENT EMITTER

```javascript
// ✅ src/core/event-emitter.js

/**
 * Event-driven architecture
 */
class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to event
   */
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    this.events.get(eventName).push(callback);

    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * One-time subscription
   */
  once(eventName, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(eventName, wrapper);
    };

    this.on(eventName, wrapper);
  }

  /**
   * Unsubscribe from event
   */
  off(eventName, callback) {
    if (!this.events.has(eventName)) return;

    const callbacks = this.events.get(eventName);
    const index = callbacks.indexOf(callback);

    if (index > -1) {
      callbacks.splice(index, 1);
    }

    if (callbacks.length === 0) {
      this.events.delete(eventName);
    }
  }

  /**
   * Emit event
   */
  emit(eventName, ...args) {
    if (!this.events.has(eventName)) return;

    const callbacks = this.events.get(eventName);
    
    callbacks.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`[EventEmitter] Error in ${eventName}:`, error);
      }
    });
  }

  /**
   * Get event info
   */
  getEventInfo() {
    const info = {};
    this.events.forEach((callbacks, eventName) => {
      info[eventName] = callbacks.length;
    });
    return info;
  }

  /**
   * Clear all events
   */
  clear() {
    this.events.clear();
  }
}

export const eventEmitter = new EventEmitter();
```

### Usage:
```javascript
import { eventEmitter } from "./core/event-emitter.js";

// Subscribe
eventEmitter.on("product:added", (product) => {
  console.log("New product:", product);
});

// One-time
eventEmitter.once("sync:complete", () => {
  console.log("Sync completed");
});

// Emit
eventEmitter.emit("product:added", {
  name: "Ice Cream",
  category: "Frozen"
});

// Unsubscribe
const unsubscribe = eventEmitter.on("event", callback);
unsubscribe();
```

---

### 3. FIREBASE OPERATIONS WRAPPER

```javascript
// ✅ src/firebase/db.js

import {
  ref,
  push,
  remove,
  set,
  update,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { database } from "../config/firebase.config.js";
import { errorHandler } from "../core/error-handler.js";
import { appState } from "../core/app-state.js";

/**
 * Database operations wrapper
 */
export const db = {
  /**
   * Add product
   */
  async addProduct(product) {
    try {
      appState.setState({ "ui.isLoading": true });

      const result = await push(ref(database, "fefrost/products"), product);

      appState.setState({ "ui.isLoading": false });

      return {
        success: true,
        id: result.key,
        data: product
      };
    } catch (error) {
      appState.setState({ "ui.isLoading": false });
      return {
        success: false,
        error: errorHandler.handleFirebaseError(error, "addProduct")
      };
    }
  },

  /**
   * Delete product
   */
  async deleteProduct(productId) {
    try {
      await remove(ref(database, `fefrost/products/${productId}`));

      return {
        success: true,
        id: productId
      };
    } catch (error) {
      return {
        success: false,
        error: errorHandler.handleFirebaseError(error, "deleteProduct")
      };
    }
  },

  /**
   * Update product
   */
  async updateProduct(productId, updates) {
    try {
      await update(ref(database, `fefrost/products/${productId}`), updates);

      return {
        success: true,
        id: productId,
        updates
      };
    } catch (error) {
      return {
        success: false,
        error: errorHandler.handleFirebaseError(error, "updateProduct")
      };
    }
  },

  /**
   * Get all products (one-time read)
   */
  async getAllProducts() {
    try {
      const snapshot = await get(ref(database, "fefrost/products"));
      
      if (!snapshot.exists()) {
        return { success: true, data: {} };
      }

      return {
        success: true,
        data: snapshot.val()
      };
    } catch (error) {
      return {
        success: false,
        error: errorHandler.handleFirebaseError(error, "getAllProducts")
      };
    }
  }
};
```

---

### 4. LISTENER MANAGEMENT WITH CLEANUP

```javascript
// ✅ src/firebase/listeners.js

import { onValue, onChildAdded } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { database } from "../config/firebase.config.js";
import { appState } from "../core/app-state.js";

/**
 * Listener registry untuk prevent memory leak
 */
class ListenerRegistry {
  constructor() {
    this.listeners = new Map();
    this.subscriptions = new Map();
  }

  /**
   * Setup monitoring listener
   */
  setupMonitoringListener() {
    const key = "monitoring";
    this.cleanup(key);

    const unsubscribe = onValue(
      ref(database, "fefrost/monitoring"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          appState.setState({
            "monitoring.temperature_room": data.temperature_room,
            "monitoring.humidity": data.humidity,
            "monitoring.temperature_storage": data.temperature_storage,
            "monitoring.status": data.status
          });
        }
      },
      (error) => {
        console.error("[Monitoring] Listener error:", error);
        appState.setState({ "ui.errors": [error.message] });
      }
    );

    this.listeners.set(key, unsubscribe);
    console.log(`[ListenerRegistry] Monitoring listener setup`);
  }

  /**
   * Setup products listener
   */
  setupProductsListener() {
    const key = "products";
    this.cleanup(key);

    const unsubscribe = onValue(
      ref(database, "fefrost/products"),
      (snapshot) => {
        const products = snapshot.exists() ? snapshot.val() : {};
        appState.setState({ "products": products });
      },
      (error) => {
        console.error("[Products] Listener error:", error);
      }
    );

    this.listeners.set(key, unsubscribe);
    console.log(`[ListenerRegistry] Products listener setup`);
  }

  /**
   * Setup logs listener
   */
  setupLogsListener() {
    const key = "logs";
    this.cleanup(key);

    const unsubscribe = onValue(
      ref(database, "fefrost/logs"),
      (snapshot) => {
        const logs = snapshot.exists() ? Object.values(snapshot.val()) : [];
        // Sort by timestamp descending
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        appState.setState({ "logs": logs.slice(0, 100) }); // Keep last 100
      }
    );

    this.listeners.set(key, unsubscribe);
    console.log(`[ListenerRegistry] Logs listener setup`);
  }

  /**
   * Cleanup specific listener
   */
  cleanup(key) {
    if (this.listeners.has(key)) {
      const unsubscribe = this.listeners.get(key);
      unsubscribe();
      this.listeners.delete(key);
      console.log(`[ListenerRegistry] Listener '${key}' cleaned up`);
    }
  }

  /**
   * Cleanup all listeners
   */
  cleanupAll() {
    this.listeners.forEach((unsubscribe, key) => {
      unsubscribe();
      console.log(`[ListenerRegistry] Listener '${key}' cleaned up`);
    });
    this.listeners.clear();
  }

  /**
   * Get status
   */
  getStatus() {
    const status = {};
    this.listeners.forEach((_, key) => {
      status[key] = "active";
    });
    return status;
  }
}

export const listenerRegistry = new ListenerRegistry();
```

---

## 🧪 VALIDATION UTILITIES

```javascript
// ✅ src/utils/validators.js

/**
 * Comprehensive validation utilities
 */
export const validators = {
  /**
   * Validate product data
   */
  validateProduct(data) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!data.productName?.trim()) {
      errors.push("Product name is required");
    } else if (data.productName.length > 100) {
      errors.push("Product name too long (max 100 chars)");
    }

    if (!data.category?.trim()) {
      errors.push("Category is required");
    }

    if (!data.entryDate) {
      errors.push("Entry date is required");
    }

    if (!data.expiredDate) {
      errors.push("Expired date is required");
    }

    // Date validations
    if (data.entryDate && data.expiredDate) {
      const entry = new Date(data.entryDate);
      const expired = new Date(data.expiredDate);
      const today = new Date();

      if (expired < today) {
        errors.push("Expired date sudah lewat");
      }

      if (entry > expired) {
        errors.push("Entry date harus sebelum expired date");
      }

      const daysLeft = Math.ceil((expired - today) / (1000 * 60 * 60 * 24));
      if (daysLeft < 7) {
        warnings.push(`⚠️ Product expires in ${daysLeft} days`);
      }
    }

    // Temperature validation
    if (data.idealTemp !== null && data.idealTemp !== undefined) {
      const temp = Number(data.idealTemp);
      
      if (isNaN(temp)) {
        errors.push("Ideal temperature must be a number");
      } else if (temp < -30 || temp > 15) {
        errors.push("Ideal temperature must be between -30°C and 15°C");
      } else if (temp < -20 || temp > 10) {
        warnings.push("⚠️ Temperature outside normal cold storage range");
      }
    }

    // Sensitivity validation
    if (![1, 2, 3].includes(data.sensitivity)) {
      errors.push("Invalid sensitivity level");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  /**
   * Validate email
   */
  validateEmail(email) {
    const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    return regex.test(email);
  },

  /**
   * Validate temperature
   */
  validateTemperature(temp, min = -30, max = 15) {
    const value = Number(temp);
    
    if (isNaN(value)) return false;
    if (value < min || value > max) return false;
    
    return true;
  },

  /**
   * Validate date range
   */
  validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return start <= end;
  }
};
```

---

## 📦 FEATURE MODULE PATTERN

```javascript
// ✅ src/features/products/products.module.js

/**
 * Products feature module
 * Encapsulates all product-related functionality
 */
export class ProductsModule {
  constructor(appState, eventEmitter, db) {
    this.appState = appState;
    this.eventEmitter = eventEmitter;
    this.db = db;
    
    this.unsubscribers = [];
    this.isInitialized = false;
  }

  /**
   * Initialize module
   */
  async init() {
    if (this.isInitialized) return;

    console.log("[ProductsModule] Initializing...");

    // Subscribe to state changes
    const unsubscribe = this.appState.subscribe(({ changes }) => {
      if (changes.products) {
        this.onProductsChanged();
      }
    });

    this.unsubscribers.push(unsubscribe);

    // Subscribe to events
    this.eventEmitter.on("product:add", (data) => this.addProduct(data));
    this.eventEmitter.on("product:delete", (id) => this.deleteProduct(id));

    this.isInitialized = true;
  }

  /**
   * Add product
   */
  async addProduct(productData) {
    const result = await this.db.addProduct(productData);

    if (result.success) {
      this.eventEmitter.emit("product:added", result.data);
      console.log("[ProductsModule] Product added:", result.id);
    } else {
      this.eventEmitter.emit("product:error", result.error);
    }

    return result;
  }

  /**
   * Delete product
   */
  async deleteProduct(productId) {
    const result = await this.db.deleteProduct(productId);

    if (result.success) {
      this.eventEmitter.emit("product:deleted", productId);
    } else {
      this.eventEmitter.emit("product:error", result.error);
    }

    return result;
  }

  /**
   * Products changed handler
   */
  onProductsChanged() {
    const products = this.appState.getValue("products");
    console.log("[ProductsModule] Products updated:", Object.keys(products).length);

    // Trigger FEFO recalculation
    this.eventEmitter.emit("fefo:recalculate");
  }

  /**
   * Cleanup module
   */
  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.isInitialized = false;

    console.log("[ProductsModule] Destroyed");
  }
}
```

---

## 🚀 APPLICATION INITIALIZATION

```javascript
// ✅ src/index.js (Main entry point)

import { appState } from "./core/app-state.js";
import { eventEmitter } from "./core/event-emitter.js";
import { listenerRegistry } from "./firebase/listeners.js";
import { db } from "./firebase/db.js";

import { ProductsModule } from "./features/products/products.module.js";
import { MonitoringModule } from "./features/monitoring/monitoring.module.js";
import { FefoModule } from "./features/fefo/fefo.module.js";
import { LogsModule } from "./features/logs/logs.module.js";

/**
 * Application class
 */
class FeFrostApp {
  constructor() {
    this.modules = {};
    this.isInitialized = false;
  }

  /**
   * Initialize app
   */
  async init() {
    try {
      console.log("[FeFrostApp] Starting initialization...");

      // Wait for DOM ready
      if (document.readyState === "loading") {
        await new Promise(resolve => {
          document.addEventListener("DOMContentLoaded", resolve);
        });
      }

      // Setup state subscriptions
      this.setupStateSubscriptions();

      // Setup event listeners
      this.setupEventListeners();

      // Initialize Firebase listeners
      listenerRegistry.setupMonitoringListener();
      listenerRegistry.setupProductsListener();
      listenerRegistry.setupLogsListener();

      // Initialize modules
      this.modules.products = new ProductsModule(appState, eventEmitter, db);
      this.modules.monitoring = new MonitoringModule(appState, eventEmitter, db);
      this.modules.fefo = new FefoModule(appState, eventEmitter, db);
      this.modules.logs = new LogsModule(appState, eventEmitter, db);

      // Init all modules
      await Promise.all(
        Object.values(this.modules).map(m => m.init())
      );

      // Setup UI navigation
      this.setupNavigation();

      // Setup connection monitoring
      this.setupConnectionMonitoring();

      this.isInitialized = true;

      console.log("[FeFrostApp] Initialization complete");
      eventEmitter.emit("app:ready");
    } catch (error) {
      console.error("[FeFrostApp] Initialization error:", error);
      eventEmitter.emit("app:error", error);
    }
  }

  /**
   * Setup state subscriptions
   */
  setupStateSubscriptions() {
    appState.subscribe(({ newState, changes }) => {
      if (changes["ui.currentSection"]) {
        this.handleSectionChange(newState.ui.currentSection);
      }
    });
  }

  /**
   * Setup window events
   */
  setupEventListeners() {
    window.addEventListener("online", () => {
      appState.setState({ "ui.connectionStatus": "online" });
      console.log("[FeFrostApp] Connection restored");
    });

    window.addEventListener("offline", () => {
      appState.setState({ "ui.connectionStatus": "offline" });
      console.log("[FeFrostApp] Connection lost");
    });

    window.addEventListener("beforeunload", () => {
      this.destroy();
    });
  }

  /**
   * Setup navigation
   */
  setupNavigation() {
    const navButtons = document.querySelectorAll("[data-section]");
    navButtons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const section = e.target.dataset.section;
        appState.setState({ "ui.currentSection": section });
      });
    });

    // Default section
    appState.setState({ "ui.currentSection": "monitoring" });
  }

  /**
   * Handle section change
   */
  handleSectionChange(sectionName) {
    const sections = ["monitoring", "products", "fefo", "logs"];

    sections.forEach(section => {
      const el = document.getElementById(`${section}-section`);
      if (el) {
        el.classList.toggle("hidden", section !== sectionName);
      }
    });

    console.log("[FeFrostApp] Section changed to:", sectionName);
  }

  /**
   * Setup connection monitoring
   */
  setupConnectionMonitoring() {
    const statusEl = document.getElementById("connection-status");
    if (!statusEl) return;

    appState.subscribe(({ changes }) => {
      if (changes["ui.connectionStatus"]) {
        const status = appState.getValue("ui.connectionStatus");
        statusEl.textContent = status === "online" ? "🟢 Online" : "🔴 Offline";
        statusEl.style.background = status === "online" ? "#4ade80" : "#ef4444";
      }
    });
  }

  /**
   * Destroy app
   */
  destroy() {
    console.log("[FeFrostApp] Destroying...");

    // Cleanup modules
    Object.values(this.modules).forEach(m => m.destroy?.());

    // Cleanup listeners
    listenerRegistry.cleanupAll();

    // Clear state
    eventEmitter.clear();

    this.isInitialized = false;
  }

  /**
   * Get app info
   */
  getInfo() {
    return {
      initialized: this.isInitialized,
      modules: Object.keys(this.modules),
      listeners: listenerRegistry.getStatus(),
      state: appState.getState(),
      history: appState.getHistory(5)
    };
  }
}

// Initialize app
const app = new FeFrostApp();
app.init().catch(error => {
  console.error("Fatal error:", error);
});

// Export for debugging
window.__FEFROST_APP__ = app;
```

---

## 🧩 FEATURE MODULE EXAMPLE: FEFO

```javascript
// ✅ src/features/fefo/fefo-engine.js

/**
 * FEFO (First Expired First Out) calculation engine
 */
export class FefoEngine {
  constructor(config = {}) {
    this.config = {
      tempWeightFactor: 1.0,
      expiryWeightFactor: 1.0,
      criticalThreshold: 10,
      warningThreshold: 5,
      ...config
    };
  }

  /**
   * Calculate risk scores for all products
   */
  calculate(monitoring, products) {
    if (!monitoring || !products || Object.keys(products).length === 0) {
      return [];
    }

    const results = Object.entries(products).map(([id, product]) => {
      return {
        id,
        ...this.calculateProductRisk(product, monitoring)
      };
    });

    // Sort by risk score (highest first)
    results.sort((a, b) => b.riskScore - a.riskScore);

    return results;
  }

  /**
   * Calculate risk score for single product
   */
  calculateProductRisk(product, monitoring) {
    try {
      // Temperature delta factor
      const actualTemp = monitoring.temperature_storage;
      const idealTemp = product.ideal_temp;
      const deltaT = Math.abs(actualTemp - idealTemp);
      const tempRisk = deltaT * product.sensitivity * this.config.tempWeightFactor;

      // Expiry factor
      const today = new Date();
      const expiryDate = new Date(product.expired_date);
      const daysLeft = Math.max(
        Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)),
        0
      );
      
      const expiryRisk = daysLeft > 0
        ? (30 / Math.max(daysLeft, 1)) * this.config.expiryWeightFactor
        : 100; // Already expired

      // Total risk
      const riskScore = tempRisk + expiryRisk;

      // Determine status
      let status = "SAFE";
      if (riskScore >= this.config.criticalThreshold) {
        status = "CRITICAL";
      } else if (riskScore >= this.config.warningThreshold) {
        status = "WARNING";
      }

      return {
        name: product.product_name,
        category: product.category,
        riskScore: parseFloat(riskScore.toFixed(2)),
        daysLeft,
        tempDelta: parseFloat(deltaT.toFixed(2)),
        sensitivity: product.sensitivity,
        status
      };
    } catch (error) {
      console.error("[FefoEngine] Error calculating risk:", error);
      return {
        name: product.product_name,
        riskScore: 0,
        status: "ERROR",
        error: error.message
      };
    }
  }

  /**
   * Get statistics
   */
  getStatistics(results) {
    if (results.length === 0) {
      return {
        total: 0,
        critical: 0,
        warning: 0,
        safe: 0,
        avgRiskScore: 0
      };
    }

    const stats = {
      total: results.length,
      critical: results.filter(r => r.status === "CRITICAL").length,
      warning: results.filter(r => r.status === "WARNING").length,
      safe: results.filter(r => r.status === "SAFE").length,
      avgRiskScore: parseFloat(
        (results.reduce((sum, r) => sum + r.riskScore, 0) / results.length).toFixed(2)
      )
    };

    return stats;
  }
}
```

---

## 📋 TESTING EXAMPLES

```javascript
// ✅ tests/unit/fefo-engine.test.js

import { FefoEngine } from "../../src/features/fefo/fefo-engine.js";

describe("FefoEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new FefoEngine();
  });

  test("should calculate risk scores", () => {
    const monitoring = {
      temperature_storage: 5
    };

    const products = {
      "prod1": {
        product_name: "Ice Cream",
        ideal_temp: -5,
        sensitivity: 2,
        expired_date: "2025-06-01"
      }
    };

    const results = engine.calculate(monitoring, products);

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty("riskScore");
    expect(results[0]).toHaveProperty("status");
  });

  test("should handle already expired products", () => {
    const monitoring = { temperature_storage: 5 };
    
    const products = {
      "prod1": {
        product_name: "Expired Item",
        ideal_temp: 0,
        sensitivity: 1,
        expired_date: "2025-01-01"
      }
    };

    const results = engine.calculate(monitoring, products);

    expect(results[0].daysLeft).toBeLessThanOrEqual(0);
  });

  test("should calculate statistics", () => {
    const results = [
      { status: "CRITICAL", riskScore: 15 },
      { status: "WARNING", riskScore: 7 },
      { status: "SAFE", riskScore: 2 }
    ];

    const stats = engine.getStatistics(results);

    expect(stats.total).toBe(3);
    expect(stats.critical).toBe(1);
    expect(stats.warning).toBe(1);
    expect(stats.safe).toBe(1);
  });
});
```

---

## 📚 KEY IMPROVEMENTS SUMMARY

| Aspect | Current | Recommended | Benefit |
|--------|---------|-------------|---------|
| State Management | Global variables | Centralized AppState | Single source of truth |
| Event Handling | Inline onclick | EventEmitter (pub-sub) | Decoupled, scalable |
| Error Handling | None | Global ErrorHandler | Consistent error flow |
| Listeners | No cleanup | ListenerRegistry | No memory leaks |
| Module Structure | Flat | Feature-based | Better organization |
| Validation | Minimal | Comprehensive validators | Data integrity |
| Testing | None | Jest/Vitest ready | Quality assurance |
| Type Safety | None | JSDoc + TypeScript (optional) | Better IDE support |

---

## 🎯 ADOPTION ROADMAP

**Week 1:** Implement Phase 1 critical fixes (security, memory, XSS)  
**Week 2:** Implement Phase 2 (error handling, modularization)  
**Week 3:** Refactor to new architecture (AppState, EventEmitter, Modules)  
**Week 4:** Add testing & documentation  
**Week 5:** Performance optimization & deployment setup  

---

**End of Architecture Guide**
