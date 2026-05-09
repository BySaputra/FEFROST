# 🛠️ IMPLEMENTATION GUIDE - FEFROST PERBAIKAN

## PHASE 1 (URGENT - 1-2 Hari): Critical Fixes

---

## 1️⃣ FIX FIREBASE CONFIG - SECURITY

### Problem:
API Key hardcoded & public di source code

### Solusi Sementara (Untuk Development):
```javascript
// ✅ config/firebase-config.js (BARU)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// UNTUK DEVELOPMENT SAJA - ganti dengan environment variables di production
const firebaseConfig = {
  // ⚠️ SEGERA REGENERATE KEY INI DI FIREBASE CONSOLE
  apiKey: "GANTI_DENGAN_KEY_BARU_DARI_FIREBASE",
  authDomain: "fefrost-system.firebaseapp.com",
  databaseURL: "https://fefrost-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fefrost-system",
  storageBucket: "fefrost-system.firebasestorage.app",
  messagingSenderId: "53914539598",
  appId: "1:53914539598:web:3f3aeab824f23b8142151f"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };

// TODO: Implementasi environment variables:
// 1. Setup .env file (jangan commit ke git)
// 2. Gunakan bundler (Webpack/Vite) untuk load .env
// 3. Atau setup Firebase Emulator untuk development
```

### Firebase Security Rules (CRITICAL):
```json
{
  "rules": {
    "fefrost": {
      "monitoring": {
        ".read": true,
        ".write": "auth != null && root.child('admins').child(auth.uid).exists()"
      },
      "products": {
        ".read": true,
        ".write": "auth != null",
        "$key": {
          ".validate": "newData.hasChildren(['product_name', 'category', 'entry_date', 'expired_date'])"
        }
      },
      "fefo_priority": {
        ".read": true,
        ".write": false
      },
      "logs": {
        ".read": true,
        ".write": false
      }
    }
  }
}
```

**Aksi Langsung:**
1. Buka Firebase Console
2. Go to Database → Rules
3. Paste rules di atas
4. Regenerate API key

---

## 2️⃣ FIX DOM LOADING RACE CONDITION

### Problem:
Script diload di `<head>` sebelum DOM siap

### Solution - index.html (BARU):
```html
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FEFROST Dashboard</title>
  <link rel="stylesheet" href="css/style.css">
  <!-- ✅ PINDAHKAN SCRIPT KE BAWAH - LIHAT BODY -->
</head>

<body>
  <div class="container">
    <!-- SIDEBAR -->
    <aside class="sidebar">
      <h2>FEFROST</h2>
      
      <button data-section="monitoring">Monitoring</button>
      <button data-section="products">Products</button>
      <button data-section="fefo">FEFO</button>
      <button data-section="logs">Logs</button>
      
      <!-- ✅ TAMBAH: Connection status -->
      <div id="connection-status" style="margin-top: 20px; padding: 10px; border-radius: 4px; background: #4ade80; color: white; text-align: center;">
        🟢 Online
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="main-content">

      <!-- MONITORING SECTION -->
      <section id="monitoring-section" class="content-section">
        <h1>Realtime Monitoring</h1>
        
        <div class="card">
          <h3>Room Temperature</h3>
          <p id="temp-room">-- °C</p>
        </div>

        <div class="card">
          <h3>Humidity</h3>
          <p id="humidity">-- %</p>
        </div>

        <div class="card">
          <h3>Storage Temperature</h3>
          <p id="temp-storage">-- °C</p>
        </div>

        <div class="card">
          <h3>Status</h3>
          <p id="status">--</p>
        </div>
      </section>

      <!-- PRODUCTS SECTION -->
      <section id="products-section" class="content-section hidden">
        <h1>Product Management</h1>

        <div class="card">
          <input type="text" id="product-name" placeholder="Product Name">
          <input type="text" id="category" placeholder="Category">
          <input type="date" id="entry-date">
          <input type="date" id="expired-date">
          
          <select id="sensitivity">
            <option value="1">Low</option>
            <option value="2">Medium</option>
            <option value="3">High</option>
          </select>
          
          <input type="number" id="ideal-temp" placeholder="Ideal Temperature (-20 to 10)">
          <button id="add-product">Add Product</button>
          
          <!-- ✅ TAMBAH: Form validation message -->
          <div id="product-form-error" style="color: red; margin-top: 10px; display: none;"></div>
          <div id="product-form-success" style="color: green; margin-top: 10px; display: none;"></div>
        </div>

        <div class="card">
          <h2>Product List</h2>
          <ul id="product-list"></ul>
        </div>
      </section>

      <!-- FEFO SECTION -->
      <section id="fefo-section" class="content-section hidden">
        <h1>FEFO Priority</h1>
        <div class="card">
          <ul id="fefo-list"></ul>
        </div>
      </section>

      <!-- LOGS SECTION -->
      <section id="logs-section" class="content-section hidden">
        <h1>Monitoring Logs</h1>
        <div class="card">
          <ul id="logs-list"></ul>
        </div>
      </section>
    </main>
  </div>

  <!-- ✅ SCRIPT DIPINDAHKAN KE SINI (end of body) -->
  <script type="module" src="js/app.js"></script>
</body>

</html>
```

---

## 3️⃣ FIX MEMORY LEAK - CLEANUP LISTENERS

### Problem:
onValue listeners tidak pernah dihentikan, menyebabkan multiple listeners berjalan

### Solution - js/utils/listener-manager.js (BARU):
```javascript
// ✅ js/utils/listener-manager.js

/**
 * Manage Firebase listeners untuk prevent memory leak
 */
class ListenerManager {
  constructor() {
    this.listeners = new Map(); // Map untuk track unsubscribe functions
  }

  /**
   * Register listener dengan unique key
   */
  add(key, unsubscribeFunction) {
    // Cleanup listener lama jika exist
    this.remove(key);
    // Simpan listener baru
    this.listeners.set(key, unsubscribeFunction);
  }

  /**
   * Cleanup specific listener
   */
  remove(key) {
    if (this.listeners.has(key)) {
      const unsubscribe = this.listeners.get(key);
      unsubscribe();
      this.listeners.delete(key);
      console.log(`[ListenerManager] Listener '${key}' removed`);
    }
  }

  /**
   * Cleanup semua listeners
   */
  removeAll() {
    this.listeners.forEach((unsubscribe, key) => {
      unsubscribe();
      console.log(`[ListenerManager] Listener '${key}' removed`);
    });
    this.listeners.clear();
  }

  /**
   * Get info listeners yang active
   */
  getStatus() {
    return {
      count: this.listeners.size,
      keys: Array.from(this.listeners.keys())
    };
  }
}

export default new ListenerManager();
```

### Solution - js/monitoring.js (UPDATED):
```javascript
import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { database } from "../config/firebase-config.js";
import listenerManager from "./utils/listener-manager.js";

const monitoringRef = ref(database, "fefrost/monitoring");

// ✅ CAPTURE unsubscribe function dari onValue
const unsubscribe = onValue(monitoringRef, (snapshot) => {
  const data = snapshot.val();

  if (!data) return;

  // UPDATE UI
  document.getElementById("temp-room").innerText = data.temperature_room + " °C";
  document.getElementById("humidity").innerText = data.humidity + " %";
  document.getElementById("temp-storage").innerText = data.temperature_storage + " °C";

  const statusElement = document.getElementById("status");
  statusElement.innerText = data.status;

  // RESET CLASS
  statusElement.className = "";

  // STATUS COLOR
  if (data.status === "SAFE") {
    statusElement.classList.add("safe");
  } else if (data.status === "WARNING") {
    statusElement.classList.add("warning");
  } else {
    statusElement.classList.add("danger");
  }
});

// ✅ REGISTER listener di manager
listenerManager.add("monitoring-realtime", unsubscribe);

// ✅ EXPORT cleanup function
export function cleanupMonitoring() {
  listenerManager.remove("monitoring-realtime");
}
```

### Solution - js/fefo.js (UPDATED):
```javascript
import {
  ref,
  onValue,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { database } from "../config/firebase-config.js";
import listenerManager from "./utils/listener-manager.js";

const fefoList = document.getElementById("fefo-list");

let monitoringData = {};
let productsData = {};

// ✅ Track listeners untuk cleanup
let monitoringUnsubscribe = null;
let productsUnsubscribe = null;

// ✅ Debounce untuk prevent multiple calculateFEFO() calls
let fefoCalculationTimer = null;

function scheduleFefoCalculation() {
  if (fefoCalculationTimer) clearTimeout(fefoCalculationTimer);
  
  fefoCalculationTimer = setTimeout(() => {
    calculateFEFO();
  }, 500);
}

// MONITORING LISTENER
monitoringUnsubscribe = onValue(
  ref(database, "fefrost/monitoring"),
  (snapshot) => {
    monitoringData = snapshot.val();
    scheduleFefoCalculation();
  }
);

listenerManager.add("fefo-monitoring", monitoringUnsubscribe);

// PRODUCT LISTENER
productsUnsubscribe = onValue(
  ref(database, "fefrost/products"),
  (snapshot) => {
    productsData = snapshot.val();
    scheduleFefoCalculation();
  }
);

listenerManager.add("fefo-products", productsUnsubscribe);

// ✅ FEFO ENGINE dengan error handling
async function calculateFEFO() {
  try {
    if (!monitoringData || !productsData) return;

    const results = [];

    Object.keys(productsData).forEach((key) => {
      const product = productsData[key];

      const actualTemp = monitoringData.temperature_storage;
      const idealTemp = product.ideal_temp;
      const deltaT = Math.abs(actualTemp - idealTemp);

      const today = new Date();
      const expired = new Date(product.expired_date);
      const remainingDays = Math.max((expired - today) / (1000 * 60 * 60 * 24), 1);
      const expiredFactor = 1 / remainingDays;

      const riskScore = (deltaT * product.sensitivity) + (expiredFactor * 10);

      let status = "SAFE";
      if (riskScore > 10) {
        status = "CRITICAL";
      } else if (riskScore > 5) {
        status = "WARNING";
      }

      results.push({
        name: product.product_name,
        score: riskScore.toFixed(2),
        status: status
      });
    });

    results.sort((a, b) => b.score - a.score);

    // ✅ Clear dan render UI
    fefoList.innerHTML = "";
    const fragment = document.createDocumentFragment();

    results.forEach((item, index) => {
      const li = document.createElement("li");
      let statusClass = "safe";

      if (item.status === "WARNING") {
        statusClass = "warning";
      } else if (item.status === "CRITICAL") {
        statusClass = "danger";
      }

      li.innerHTML = `
        <strong>${index + 1}. ${item.name}</strong>
        <br>
        Risk Score: ${item.score}
        <br>
        Status: <span class="${statusClass}">${item.status}</span>
      `;

      fragment.appendChild(li);
    });

    fefoList.appendChild(fragment);

    // ✅ Save to Firebase dengan error handling
    await set(ref(database, "fefrost/fefo_priority"), results);
  } catch (error) {
    console.error("[FEFO] Calculation error:", error);
  }
}

// ✅ Export cleanup function
export function cleanupFEFO() {
  if (fefoCalculationTimer) clearTimeout(fefoCalculationTimer);
  listenerManager.remove("fefo-monitoring");
  listenerManager.remove("fefo-products");
}
```

### Solution - js/app.js (UPDATED):
```javascript
// ✅ IMPORT CLEANUP FUNCTIONS
import { cleanupMonitoring } from "./monitoring.js";
import { cleanupProducts } from "./products.js";
import { cleanupFEFO } from "./fefo.js";
import { cleanupLogs } from "./logs.js";
import listenerManager from "./utils/listener-manager.js";

// SECTION NAVIGATION
window.showSection = function(sectionName) {
  // ✅ CLEANUP listeners dari section yang ditinggal
  // (bisa di-expand untuk selective cleanup)

  const sections = ["monitoring", "products", "fefo", "logs"];

  sections.forEach((section) => {
    const element = document.getElementById(`${section}-section`);
    if (element) {
      element.classList.add("hidden");
    }
  });

  // ✅ TAMPILKAN section dipilih
  const targetElement = document.getElementById(`${sectionName}-section`);
  if (targetElement) {
    targetElement.classList.remove("hidden");
  }
};

// ✅ CONNECTION STATUS MONITORING
window.addEventListener("online", () => {
  const status = document.getElementById("connection-status");
  if (status) {
    status.textContent = "🟢 Online";
    status.style.background = "#4ade80";
  }
  console.log("[APP] Connection restored");
});

window.addEventListener("offline", () => {
  const status = document.getElementById("connection-status");
  if (status) {
    status.textContent = "🔴 Offline";
    status.style.background = "#ef4444";
  }
  console.log("[APP] Connection lost");
});

// ✅ CLEANUP saat page unload
window.addEventListener("beforeunload", () => {
  console.log("[APP] Cleaning up listeners before unload");
  listenerManager.removeAll();
});

// ✅ Initialize sections dengan navigation buttons
document.addEventListener("DOMContentLoaded", () => {
  // Setup navigation buttons
  const navButtons = document.querySelectorAll("[data-section]");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const section = e.target.dataset.section;
      showSection(section);
    });
  });

  // Default show monitoring section
  showSection("monitoring");

  console.log("[APP] Initialized successfully");
  console.log("[APP] Listeners:", listenerManager.getStatus());
});
```

---

## 4️⃣ FIX XSS VULNERABILITY

### Problem:
Unsafe innerHTML dengan user input tidak di-sanitize

### Solution - js/utils/sanitizer.js (BARU):
```javascript
// ✅ js/utils/sanitizer.js

/**
 * Sanitize HTML dari user input
 */
export function sanitizeHTML(html) {
  const div = document.createElement("div");
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Safe element creation dari data
 */
export function createSafeElement(tag, content, attributes = {}) {
  const element = document.createElement(tag);
  
  // Set text content (safe)
  if (typeof content === "string") {
    element.textContent = content;
  } else if (typeof content === "object") {
    Object.entries(content).forEach(([key, value]) => {
      element.textContent += `${key}: ${value}\n`;
    });
  }
  
  // Set attributes (safe)
  Object.entries(attributes).forEach(([key, value]) => {
    if (key.startsWith("on")) {
      console.warn(`[Sanitizer] Event handler '${key}' not allowed`);
      return;
    }
    element.setAttribute(key, String(value));
  });
  
  return element;
}

/**
 * Escape special HTML characters
 */
export function escapeHTML(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
```

### Solution - js/products.js (UPDATED):
```javascript
import {
  ref,
  push,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { database } from "../config/firebase-config.js";
import { escapeHTML, createSafeElement } from "./utils/sanitizer.js";
import listenerManager from "./utils/listener-manager.js";

const productList = document.getElementById("product-list");
const addButton = document.getElementById("add-product");

// ✅ VALIDATION FUNCTION
function validateProduct(data) {
  const errors = [];
  
  if (!data.productName?.trim()) errors.push("Product name required");
  if (!data.category?.trim()) errors.push("Category required");
  if (!data.entryDate) errors.push("Entry date required");
  if (!data.expiredDate) errors.push("Expired date required");
  
  const entryDate = new Date(data.entryDate);
  const expiredDate = new Date(data.expiredDate);
  const today = new Date();
  
  if (expiredDate < today) {
    errors.push("Expired date sudah lewat!");
  }
  if (entryDate > expiredDate) {
    errors.push("Entry date harus sebelum expired date");
  }
  
  if (data.idealTemp < -20 || data.idealTemp > 10) {
    errors.push("Ideal temp harus -20°C hingga 10°C");
  }
  
  return { isValid: errors.length === 0, errors };
}

// ✅ SHOW MESSAGE
function showMessage(type, message) {
  const errorElement = document.getElementById("product-form-error");
  const successElement = document.getElementById("product-form-success");
  
  if (type === "error") {
    errorElement.textContent = message;
    errorElement.style.display = "block";
    successElement.style.display = "none";
  } else if (type === "success") {
    successElement.textContent = message;
    successElement.style.display = "block";
    errorElement.style.display = "none";
  }
}

// ✅ ADD PRODUCT WITH ERROR HANDLING
if (addButton) {
  addButton.addEventListener("click", async () => {
    try {
      const productName = document.getElementById("product-name").value;
      const category = document.getElementById("category").value;
      const entryDate = document.getElementById("entry-date").value;
      const expiredDate = document.getElementById("expired-date").value;
      const sensitivity = Number(document.getElementById("sensitivity").value);
      const idealTemp = Number(document.getElementById("ideal-temp").value);

      // ✅ VALIDATE
      const validation = validateProduct({
        productName,
        category,
        entryDate,
        expiredDate,
        idealTemp,
        sensitivity
      });

      if (!validation.isValid) {
        showMessage("error", validation.errors.join("\n"));
        return;
      }

      const product = {
        product_name: productName.trim(),
        category: category.trim(),
        entry_date: entryDate,
        expired_date: expiredDate,
        sensitivity: sensitivity,
        ideal_temp: idealTemp
      };

      // ✅ PUSH TO FIREBASE
      await push(ref(database, "fefrost/products"), product);
      
      showMessage("success", "✅ Product added successfully!");

      // ✅ CLEAR INPUT
      document.getElementById("product-name").value = "";
      document.getElementById("category").value = "";
      document.getElementById("entry-date").value = "";
      document.getElementById("expired-date").value = "";
      document.getElementById("ideal-temp").value = "";
    } catch (error) {
      console.error("[Products] Add error:", error);
      showMessage("error", `❌ Error: ${error.message}`);
    }
  });
}

// ✅ REALTIME PRODUCT LISTENER
const unsubscribe = onValue(
  ref(database, "fefrost/products"),
  (snapshot) => {
    try {
      if (!productList) return;

      productList.innerHTML = "";

      if (!snapshot.exists()) {
        productList.innerHTML = "<li>No products yet</li>";
        return;
      }

      const fragment = document.createDocumentFragment();

      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        const key = childSnapshot.key;

        const li = document.createElement("li");

        // ✅ SAFE: Gunakan textContent
        const strong = document.createElement("strong");
        strong.textContent = data.product_name;
        li.appendChild(strong);

        li.appendChild(document.createElement("br"));
        
        const details = document.createElement("div");
        details.innerHTML = `
          Category: ${escapeHTML(data.category)}<br>
          Entry: ${data.entry_date}<br>
          Expired: ${data.expired_date}<br>
          Sensitivity: ${data.sensitivity}<br>
          Ideal Temp: ${data.ideal_temp} °C
        `;
        li.appendChild(details);

        li.appendChild(document.createElement("br"));

        // ✅ SAFE: addEventListener instead of onclick
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "delete-btn";
        deleteBtn.addEventListener("click", async () => {
          if (confirm("Delete this product?")) {
            try {
              await remove(ref(database, `fefrost/products/${key}`));
              showMessage("success", "✅ Product deleted");
            } catch (error) {
              console.error("[Products] Delete error:", error);
              showMessage("error", `❌ Error: ${error.message}`);
            }
          }
        });
        li.appendChild(deleteBtn);

        fragment.appendChild(li);
      });

      productList.appendChild(fragment);
    } catch (error) {
      console.error("[Products] Listener error:", error);
    }
  }
);

listenerManager.add("products-realtime", unsubscribe);

// ✅ EXPORT cleanup function
export function cleanupProducts() {
  listenerManager.remove("products-realtime");
}
```

---

## 5️⃣ ERROR HANDLING UTILITIES

### Solution - js/utils/error-handler.js (BARU):
```javascript
// ✅ js/utils/error-handler.js

/**
 * Centralized error handling
 */
class ErrorHandler {
  constructor() {
    this.errorListeners = [];
  }

  /**
   * Subscribe to errors
   */
  onError(callback) {
    this.errorListeners.push(callback);
  }

  /**
   * Handle Firebase errors
   */
  handleFirebaseError(error, context = "") {
    const errorMessage = this.getReadableMessage(error);
    
    console.error(`[Firebase Error] ${context}:`, error);
    
    this.errorListeners.forEach(listener => {
      listener({
        type: "firebase",
        message: errorMessage,
        context,
        original: error
      });
    });
    
    return errorMessage;
  }

  /**
   * Get user-friendly error message
   */
  getReadableMessage(error) {
    if (error.code === "PERMISSION_DENIED") {
      return "❌ Permission denied. Please check Firebase rules.";
    }
    if (error.code === "NETWORK_ERROR") {
      return "❌ Network error. Check your connection.";
    }
    if (error.code === "DATABASE_UNAVAILABLE") {
      return "❌ Database unavailable. Try again later.";
    }
    
    return `❌ Error: ${error.message || "Unknown error"}`;
  }

  /**
   * Show error in UI
   */
  showErrorUI(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-notification";
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
}

export default new ErrorHandler();
```

---

## SUMMARY - PHASE 1 CHANGES

| File | Changes | Status |
|------|---------|--------|
| `index.html` | Move script to end of body, add connection status | ✅ READY |
| `config/firebase-config.js` | Add comments, note API key regeneration | ✅ READY |
| `js/app.js` | Add connection monitoring, cleanup | ✅ READY |
| `js/utils/listener-manager.js` | NEW: Listener management | ✅ NEW |
| `js/utils/sanitizer.js` | NEW: XSS prevention | ✅ NEW |
| `js/utils/error-handler.js` | NEW: Error handling | ✅ NEW |
| `js/monitoring.js` | Add listener manager, cleanup | ✅ READY |
| `js/fefo.js` | Add debounce, error handling, cleanup | ✅ READY |
| `js/products.js` | Add validation, error handling, safe DOM | ✅ READY |
| `js/logs.js` | (Next in Phase 2) | ⏳ |

---

## NEXT: PHASE 2 Implementation

File berikutnya: `js/logs.js` dengan pagination, error handling, dan format timestamp.

Semua kode di atas siap untuk di-implementasikan secara langsung!
