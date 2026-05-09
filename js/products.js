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
from "../config/firebase-config.js";

const productList =
document.getElementById("product-list");

const addButton =
document.getElementById("add-product");

const searchInput =
document.getElementById("product-search");

const inventoryCount =
document.getElementById("inventory-count");

let productsCache = [];

function formatTemperature(value) {
  const temperature =
    Number(value);

  if (!Number.isFinite(temperature)) return "-- \u00B0C";

  return `${temperature.toFixed(1)} \u00B0C`;
}

function getSensitivityLabel(value) {
  const labels = {
    1: "Low",
    2: "Medium",
    3: "High"
  };

  return labels[Number(value)] || value || "--";
}

function renderEmptyRow(message) {
  if (!productList) return;

  productList.innerHTML = `
    <tr>
      <td class="empty-row" colspan="7">
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
      const searchable =
        [
          product.product_name,
          product.category,
          product.entry_date,
          product.expired_date
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
    filteredProducts.map((product) => `
      <tr>
        <td>
          <strong>${product.product_name || "--"}</strong>
        </td>
        <td>${product.category || "--"}</td>
        <td>${product.entry_date || "--"}</td>
        <td>${product.expired_date || "--"}</td>
        <td>
          <span class="badge">
            ${getSensitivityLabel(product.sensitivity)}
          </span>
        </td>
        <td>${formatTemperature(product.ideal_temp)}</td>
        <td>
          <button
            class="delete-btn"
            onclick="deleteProduct('${product.key}')">
            Delete
          </button>
        </td>
      </tr>
    `).join("");
}

if (addButton) {
  addButton.addEventListener("click", () => {
    const productName =
      document.getElementById("product-name").value.trim();

    const category =
      document.getElementById("category").value.trim();

    const entryDate =
      document.getElementById("entry-date").value;

    const expiredDate =
      document.getElementById("expired-date").value;

    const sensitivity =
      Number(
        document.getElementById("sensitivity").value
      );

    const idealTemp =
      Number(
        document.getElementById("ideal-temp").value
      );

    if (
      !productName ||
      !category ||
      !entryDate ||
      !expiredDate
    ) {
      alert("Please fill all fields!");

      return;
    }

    push(
      ref(database, "fefrost/products"),
      {
        product_name:
          productName,
        category,
        entry_date:
          entryDate,
        expired_date:
          expiredDate,
        sensitivity,
        ideal_temp:
          idealTemp
      }
    );

    document.getElementById("product-name").value = "";
    document.getElementById("category").value = "";
    document.getElementById("entry-date").value = "";
    document.getElementById("expired-date").value = "";
    document.getElementById("ideal-temp").value = "";
  });
}

searchInput
  ?.addEventListener("input", renderProducts);

onValue(
  ref(database, "fefrost/products"),
  (snapshot) => {
    productsCache = [];

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        productsCache.push({
          key:
            childSnapshot.key,
          ...childSnapshot.val()
        });
      });
    }

    renderProducts();
  }
);

window.deleteProduct = function(key) {
  remove(
    ref(database, `fefrost/products/${key}`)
  );
};

window.exportProductsData = function() {
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
};
