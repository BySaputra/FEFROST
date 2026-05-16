console.log("[APP] Loading modules...");

import "./store.js";
import "../modules/monitoring.js";
import "../modules/products.js";
import "../modules/fefo.js";
import "../modules/logs.js";
import "../modules/alerts.js";

import { setFilter } from "../modules/logs.js";

console.log("[APP] All modules loaded successfully");

// ===============================
// LOG FILTER CONTROL
// ===============================

window.__setLogFilter = function(filterName, value) {
  setFilter(filterName, value);
  console.log(`[APP] Log filter updated: ${filterName}=${value}`);
};

// ===============================
// NAVIGATION & SECTIONS
// ===============================

const sections = [
  "monitoring",
  "products",
  "fefo",
  "logs"
];

console.log("[APP] Registering showSection...");

window.showSection = function(sectionName) {
  sections.forEach((section) => {
    const sectionElement =
      document.getElementById(`${section}-section`);

    const navButton =
      document.querySelector(`[data-section="${section}"]`);

    if (sectionElement) {
      sectionElement.classList.toggle(
        "hidden",
        section !== sectionName
      );
    }

    if (navButton) {
      navButton.classList.toggle(
        "active",
        section === sectionName
      );
    }
  });

  console.log(`[APP] Navigated to: ${sectionName}`);
};

document
  .getElementById("view-graphs")
  ?.addEventListener("click", () => {
    window.showSection("logs");
  });

document
  .getElementById("download-logs")
  ?.addEventListener("click", () => {
    window.downloadMonitoringLogs?.();
  });

document
  .getElementById("export-products")
  ?.addEventListener("click", () => {
    window.exportProductsData?.();
  });

document
  .getElementById("refresh-monitoring")
  ?.addEventListener("click", () => {
    window.showSection("monitoring");
  });
