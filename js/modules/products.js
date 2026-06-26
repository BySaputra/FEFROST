import {
  ref,
  push,
  onValue,
  remove
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
  formatTemperature
}
from "../utils/telemetry.js";

const productList =
document.getElementById("product-list");

const addButton =
document.getElementById("add-product");

const searchInput =
document.getElementById("product-search");

const inventoryCount =
document.getElementById("inventory-count");

let productsCache = [];

function injectRangeInputStyles() {
  if (document.getElementById("range-input-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "range-input-styles";
  style.textContent = `
    .range-input-group {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      align-items: center;
    }

    .range-input {
      width: 100%;
      box-sizing: border-box;
    }
  `;

  document.head.appendChild(style);
}

function setupRangeInputs() {
  injectRangeInputStyles();

  const temperatureInput = document.getElementById("temperature-range");
  if (temperatureInput) {
    const temperatureLabel = temperatureInput.closest("label");
    if (temperatureLabel) {
      const temperatureGroup = document.createElement("div");
      temperatureGroup.className = "range-input-group";
      temperatureGroup.innerHTML = `
        <input type="number" id="temperature-range-min" class="range-input" step="any" inputmode="decimal" placeholder="Min" aria-label="Temperature minimum">
        <input type="number" id="temperature-range-max" class="range-input" step="any" inputmode="decimal" placeholder="Max" aria-label="Temperature maximum">
      `;
      temperatureInput.replaceWith(temperatureGroup);
      temperatureLabel.insertBefore(temperatureGroup, temperatureLabel.firstChild);
    }
  }

  const humidityInput = document.getElementById("humidity-range");
  if (humidityInput) {
    const humidityLabel = humidityInput.closest("label");
    if (humidityLabel) {
      const humidityGroup = document.createElement("div");
      humidityGroup.className = "range-input-group";
      humidityGroup.innerHTML = `
        <input type="number" id="humidity-range-min" class="range-input" step="any" inputmode="decimal" placeholder="Min" min="0" aria-label="Humidity minimum">
        <input type="number" id="humidity-range-max" class="range-input" step="any" inputmode="decimal" placeholder="Max" min="0" aria-label="Humidity maximum">
      `;
      humidityInput.replaceWith(humidityGroup);
      humidityLabel.insertBefore(humidityGroup, humidityLabel.firstChild);
    }
  }
}

function buildRangeString(minValue, maxValue) {
  const normalizedMin = typeof minValue === "string"
    ? minValue.trim()
    : String(minValue ?? "");

  const normalizedMax = typeof maxValue === "string"
    ? maxValue.trim()
    : String(maxValue ?? "");

  return `${normalizedMin}-${normalizedMax}`;
}

// Normalize product to simplified schema
function normalizeProduct(product) {
  return {
    product_name: product.product_name || product.name || "--",
    expired_date: product.expired_date || product.expiry_date || "--",
    temperature_range: product.temperature_range || "2-8",
    humidity_range: product.humidity_range || "50-80",
    // Keep original for reference
    ...product
  };
}

// VALIDATE RANGE FORMAT
// Accepted format: "number-number" (e.g., "2-8", "-5-5", "50-80")
function validateRangeFormat(rangeStr, fieldName) {
  if (!rangeStr || typeof rangeStr !== "string") {
    return `${fieldName} is required`;
  }

  const trimmed = rangeStr.trim();

  // Check if format matches signed number-number
  const rangeRegex = /^([+-]?\d+(?:\.\d+)?)-([+-]?\d+(?:\.\d+)?)$/;
  const match = trimmed.match(rangeRegex);

  if (!match) {
    return `${fieldName} must be in format: number-number (e.g., "2-8")`;
  }

  const min = parseFloat(match[1]);
  const max = parseFloat(match[2]);

  if (min >= max) {
    return `${fieldName}: first number must be less than second number`;
  }

  if (fieldName === "Humidity range" && (min < 0 || max < 0)) {
    return `${fieldName} values must be positive`;
  }

  return null; // Valid
}

// Validation function
function validateProduct(product) {
  const errors = [];

  if (!product.product_name || product.product_name.trim() === "") {
    errors.push("Product name is required");
  }

  if (!product.expired_date) {
    errors.push("Expiry date is required");
  }

  const tempRangeError = validateRangeFormat(product.temperature_range, "Temperature range");
  if (tempRangeError) {
    errors.push(tempRangeError);
  }

  const humidityRangeError = validateRangeFormat(product.humidity_range, "Humidity range");
  if (humidityRangeError) {
    errors.push(humidityRangeError);
  }

  return errors;
}

function renderEmptyRow(message) {
  if (!productList) return;

  productList.innerHTML = `
    <tr>
      <td class="empty-row" colspan="5">
        ${message}
      </td>
    </tr>
  `;
}

function renderProducts() {
  if (!productList) return;

  const query =
    searchInput?.value.trim().toLowerCase() || "";

  const filteredProducts =
    productsCache.filter((product) => {
      const normalized = normalizeProduct(product);
      const searchable =
        [
          normalized.product_name,
          normalized.expired_date
        ]
          .join(" ")
          .toLowerCase();

      return searchable.includes(query);
    });

  if (inventoryCount) {
    inventoryCount.textContent =
      String(productsCache.length);
  }

  if (filteredProducts.length === 0) {
    renderEmptyRow(
      query
        ? "No products match your search."
        : "No inventory products registered."
    );

    return;
  }

  productList.innerHTML =
    filteredProducts.map((product) => {
      const normalized = normalizeProduct(product);
      return `
      <tr>
        <td>
          <strong>${normalized.product_name}</strong>
        </td>
        <td>${normalized.expired_date}</td>
        <td>
          ${normalized.temperature_range}
        </td>
        <td>
          ${normalized.humidity_range}
        </td>
        <td>
          <button
            class="delete-btn"
            onclick="deleteProduct('${product.key}')">
            Delete
          </button>
        </td>
      </tr>
    `;
    }).join("");
}

setupRangeInputs();

if (addButton) {
  addButton.addEventListener("click", () => {
    try {
      // Collect form data
      const productName =
        document.getElementById("product-name").value.trim();

      const expiryDate =
        document.getElementById("expired-date").value;

      const temperatureMinValue =
        document.getElementById("temperature-range-min")?.value;

      const temperatureMaxValue =
        document.getElementById("temperature-range-max")?.value;

      const humidityMinValue =
        document.getElementById("humidity-range-min")?.value;

      const humidityMaxValue =
        document.getElementById("humidity-range-max")?.value;

      const temperatureRange =
        buildRangeString(temperatureMinValue, temperatureMaxValue);

      const humidityRange =
        buildRangeString(humidityMinValue, humidityMaxValue);

      // Build product object
      const newProduct = {
        product_name: productName,
        expired_date: expiryDate,
        temperature_range: temperatureRange,
        humidity_range: humidityRange
      };

      // Validate product
      const validationErrors = validateProduct(newProduct);

      if (validationErrors.length > 0) {
        alert("Validation errors:\n\n" + validationErrors.join("\n"));
        return;
      }

      // Submit to Firebase
      push(
        ref(database, FIREBASE_PATHS.products),
        newProduct
      ).then(() => {
        // Clear form
        document.getElementById("product-name").value = "";
        document.getElementById("expired-date").value = "";
        document.getElementById("temperature-range-min").value = "";
        document.getElementById("temperature-range-max").value = "";
        document.getElementById("humidity-range-min").value = "";
        document.getElementById("humidity-range-max").value = "";
        
        console.log("[PRODUCTS] Product added successfully");
      }).catch((error) => {
        console.error("[PRODUCTS] Failed to add product:", error);
        alert("Failed to add product: " + error.message);
      });

    } catch (error) {
      console.error("[PRODUCTS] Form submission error:", error);
      alert("Error processing form: " + error.message);
    }
  });
}

searchInput
  ?.addEventListener("input", renderProducts);

onValue(
  ref(database, FIREBASE_PATHS.products),
  (snapshot) => {
    productsCache = [];

    try {
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const productData = childSnapshot.val();
          
          // Normalize and apply fallback values
          const normalizedProduct = normalizeProduct(productData);
          
          productsCache.push({
            key: childSnapshot.key,
            ...normalizedProduct
          });
        });
      }

      renderProducts();
      
    } catch (error) {
      console.error("[PRODUCTS] Error processing snapshot:", error);
    }
  },
  (error) => {
    console.error("[PRODUCTS] Listener failed:", error);
  }
);

window.deleteProduct = function(key) {
  if (!confirm("Are you sure you want to delete this product?")) {
    return;
  }

  remove(
    ref(database, `${FIREBASE_PATHS.products}/${key}`)
  ).then(() => {
    console.log("[PRODUCTS] Product deleted successfully");
  }).catch((error) => {
    console.error("[PRODUCTS] Failed to delete product:", error);
    alert("Failed to delete product: " + error.message);
  });
};

window.exportProductsData = function() {
  try {
    const content =
      JSON.stringify(productsCache, null, 2);

    const blob =
      new Blob([content], {
        type: "application/json"
      });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href =
      url;

    link.download =
      "fefrost-products.json";

    link.click();

    URL.revokeObjectURL(url);
    
    console.log("[PRODUCTS] Data exported successfully");
  } catch (error) {
    console.error("[PRODUCTS] Export failed:", error);
    alert("Failed to export data: " + error.message);
  }
};
