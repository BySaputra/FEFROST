import { getAdaptiveFefoProducts } from "./fefo.js";

const runtime = {
  initialized: false
};

function getAlertCenterList() {
  return document.getElementById("alert-center-list");
}

function getAlertCenterCount() {
  return document.getElementById("alert-center-count");
}

function getAlertCenterStatus() {
  return document.getElementById("alert-center-status");
}

function getStatusClass(status) {
  if (status === "DANGER") return "danger";
  if (status === "WARNING") return "warning";
  return "safe";
}

function getStatusIcon(status) {
  if (status === "DANGER") return "🔴";
  if (status === "WARNING") return "🟡";
  return "✅";
}

function formatPriorityScore(score) {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    return "0.00";
  }

  return numericScore.toFixed(2);
}

function formatExpiredDate(dateValue) {
  if (!dateValue) {
    return "No expiry data";
  }

  const trimmed = String(dateValue).trim();

  if (!trimmed) {
    return "No expiry data";
  }

  const parsed = new Date(trimmed);

  if (!Number.isFinite(parsed.getTime())) {
    return trimmed;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

function getAlertItems() {
  const products = getAdaptiveFefoProducts();

  return products
    .filter((product) => product.status === "WARNING" || product.status === "DANGER")
    .sort((a, b) => {
      const severityRank = {
        DANGER: 0,
        WARNING: 1
      };

      const severityDifference = severityRank[a.status] - severityRank[b.status];

      if (severityDifference !== 0) {
        return severityDifference;
      }

      const priorityDifference = Number(b.priority_score || 0) - Number(a.priority_score || 0);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const aDate = Date.parse(a.expired_date || "");
      const bDate = Date.parse(b.expired_date || "");

      if (Number.isFinite(aDate) && Number.isFinite(bDate) && aDate !== bDate) {
        return aDate - bDate;
      }

      return (a.original_index || 0) - (b.original_index || 0);
    })
    .slice(0, 5);
}

function renderAlertCenter() {
  const list = getAlertCenterList();
  const countBadge = getAlertCenterCount();
  const statusBadge = getAlertCenterStatus();

  const alertItems = getAlertItems();
  const hasAlerts = alertItems.length > 0;

  if (countBadge) {
    countBadge.textContent = String(alertItems.length);
    countBadge.className = `status-pill ${hasAlerts ? "status-danger" : "status-safe"}`;
  }

  if (statusBadge) {
    statusBadge.textContent = hasAlerts ? "ATTENTION" : "SAFE";
    statusBadge.className = `status-pill ${hasAlerts ? "status-danger" : "status-safe"}`;
  }

  if (!list) {
    return;
  }

  if (!hasAlerts) {
    list.innerHTML = `
      <div class="alert-center-empty">
        <span class="alert-center-empty-icon">✅</span>
        <div>
          <strong>All Products Safe</strong>
          <p>No products require immediate attention.</p>
        </div>
      </div>
    `;

    return;
  }

  list.innerHTML = alertItems.map((product) => `
    <article class="alert-center-item alert-${getStatusClass(product.status)}">
      <span class="alert-center-icon">${getStatusIcon(product.status)}</span>
      <div class="alert-center-body">
        <div class="alert-center-title-row">
          <strong>${product.product_name || "--"}</strong>
          <span class="alert-center-score">Priority Score : ${formatPriorityScore(product.priority_score)}</span>
        </div>
        <div class="alert-center-meta">
          <span>Status : ${product.status}</span>
          <span>•</span>
          <span>Expires : ${formatExpiredDate(product.expired_date)}</span>
        </div>
      </div>
    </article>
  `).join("");
}

export function initAlerts() {
  if (runtime.initialized) {
    return;
  }

  renderAlertCenter();

  window.addEventListener("liveDataUpdated", renderAlertCenter);
  window.addEventListener("productsUpdated", renderAlertCenter);

  runtime.initialized = true;
}

export function stopAlerts() {
  runtime.initialized = false;
}

initAlerts();

export default {
  initAlerts,
  stopAlerts,
  renderAlertCenter
};
