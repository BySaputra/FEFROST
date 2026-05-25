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

// FALLBACK for backward compatibility
const PRODUCT_FALLBACKS = {
  temp_min: 2,
  temp_max: 8,
  humidity_min: 50,
  humidity_max: 80,
  temperature_factor: 0.2,
  humidity_factor: 0.1
};

// Normalize product with fallback values
function normalizeProduct(product) {
  return {
    name: product.name || product.product_name || "--",
    expiry_date: product.expiry_date || product.expired_date || "--",
    temp_min: Number(product.temp_min) || PRODUCT_FALLBACKS.temp_min,
    temp_max: Number(product.temp_max) || PRODUCT_FALLBACKS.temp_max,
    humidity_min: Number(product.humidity_min) || PRODUCT_FALLBACKS.humidity_min,
    humidity_max: Number(product.humidity_max) || PRODUCT_FALLBACKS.humidity_max,
    temperature_factor: Number(product.temperature_factor) || PRODUCT_FALLBACKS.temperature_factor,
    humidity_factor: Number(product.humidity_factor) || PRODUCT_FALLBACKS.humidity_factor,
    // Keep original for compatibility
    ...product
  };
}

// Validation function
function validateProduct(product) {
  const errors = [];

  if (!product.name || product.name.trim() === "") {
    errors.push("Product name is required");
  }

  if (!product.expiry_date) {
    errors.push("Expiry date is required");
  }

  const tempMin = Number(product.temp_min);
  const tempMax = Number(product.temp_max);

  if (isNaN(tempMin) || isNaN(tempMax)) {
    errors.push("Temperature values must be numbers");
  } else if (tempMin >= tempMax) {
    errors.push("Min temperature must be less than max temperature");
  }

  const humidityMin = Number(product.humidity_min);
  const humidityMax = Number(product.humidity_max);

  if (isNaN(humidityMin) || isNaN(humidityMax)) {
    errors.push("Humidity values must be numbers");
  } else if (humidityMin >= humidityMax) {
    errors.push("Min humidity must be less than max humidity");
  }

  const tempFactor = Number(product.temperature_factor);
  const humidityFactor = Number(product.humidity_factor);

  if (isNaN(tempFactor) || tempFactor < 0) {
    errors.push("Temperature factor must be >= 0");
  }

  if (isNaN(humidityFactor) || humidityFactor < 0) {
    errors.push("Humidity factor must be >= 0");
  }

  return errors;
}

function renderEmptyRow(message) {
  if (!productList) return;

  productList.innerHTML = `
    <tr>
      <td class="empty-row" colspan="8">
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
          normalized.name,
          normalized.expiry_date
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
          <strong>${normalized.name}</strong>
        </td>
        <td>${normalized.expiry_date}</td>
        <td>
          ${normalized.temp_min}°C - ${normalized.temp_max}°C
        </td>
        <td>
          ${normalized.humidity_min}% - ${normalized.humidity_max}%
        </td>
        <td>
          <span class="factor-badge" title="Temperature Sensitivity">T: ${normalized.temperature_factor.toFixed(2)}</span>
        </td>
        <td>
          <span class="factor-badge" title="Humidity Sensitivity">H: ${normalized.humidity_factor.toFixed(2)}</span>
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

if (addButton) {
  addButton.addEventListener("click", () => {
    try {
      // Collect form data
      const productName =
        document.getElementById("product-name").value.trim();

      const expiryDate =
        document.getElementById("expired-date").value;

      const tempMin =
        Number(document.getElementById("temp-min").value);

      const tempMax =
        Number(document.getElementById("temp-max").value);

      const humidityMin =
        Number(document.getElementById("humidity-min").value);

      const humidityMax =
        Number(document.getElementById("humidity-max").value);

      const temperatureFactor =
        Number(document.getElementById("temperature-factor").value);

      const humidityFactor =
        Number(document.getElementById("humidity-factor").value);

      // Build product object
      const newProduct = {
        name: productName,
        expiry_date: expiryDate,
        temp_min: tempMin,
        temp_max: tempMax,
        humidity_min: humidityMin,
        humidity_max: humidityMax,
        temperature_factor: temperatureFactor,
        humidity_factor: humidityFactor
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
        document.getElementById("temp-min").value = "";
        document.getElementById("temp-max").value = "";
        document.getElementById("humidity-min").value = "";
        document.getElementById("humidity-max").value = "";
        document.getElementById("temperature-factor").value = "";
        document.getElementById("humidity-factor").value = "";
        
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
