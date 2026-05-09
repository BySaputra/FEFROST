import {
  ref,
  onValue,
  set
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  database
}
from "../config/firebase-config.js";

const fefoList =
document.getElementById("fefo-list");

let monitoringData = {};
let productsData = {};

onValue(
  ref(database, "fefrost/monitoring"),
  (snapshot) => {
    monitoringData =
      snapshot.val();

    calculateFEFO();
  }
);

onValue(
  ref(database, "fefrost/products"),
  (snapshot) => {
    productsData =
      snapshot.val();

    calculateFEFO();
  }
);

function getPriorityClass(status) {
  if (status === "CRITICAL") return "danger";
  if (status === "WARNING") return "warning";

  return "safe";
}

function renderEmptyRow() {
  if (!fefoList) return;

  fefoList.innerHTML = `
    <tr>
      <td class="empty-row" colspan="4">
        Waiting for monitoring and inventory data.
      </td>
    </tr>
  `;
}

function renderFEFO(results) {
  if (!fefoList) return;

  if (results.length === 0) {
    renderEmptyRow();

    return;
  }

  fefoList.innerHTML =
    results.map((item, index) => {
      const score =
        Number(item.score);

      const riskWidth =
        Math.min(score * 8, 100);

      const riskColor =
        item.status === "CRITICAL"
          ? "var(--danger)"
          : item.status === "WARNING"
            ? "var(--warning)"
            : "var(--safe)";

      return `
        <tr>
          <td>
            <strong>#${index + 1}</strong>
          </td>
          <td>${item.name}</td>
          <td>
            ${item.score}
            <span class="risk-bar"
              style="--risk-width: ${riskWidth}%; --risk-color: ${riskColor};">
              <span></span>
            </span>
          </td>
          <td>
            <span class="badge ${getPriorityClass(item.status)}">
              ${item.status}
            </span>
          </td>
        </tr>
      `;
    }).join("");
}

function calculateFEFO() {
  if (!monitoringData || !productsData) {
    renderEmptyRow();

    return;
  }

  const results = [];

  Object.keys(productsData).forEach((key) => {
    const product =
      productsData[key];

    const actualTemp =
      Number(monitoringData.temperature_storage);

    const idealTemp =
      Number(product.ideal_temp);

    if (
      !Number.isFinite(actualTemp) ||
      !Number.isFinite(idealTemp)
    ) {
      return;
    }

    const deltaT =
      Math.abs(actualTemp - idealTemp);

    const today =
      new Date();

    const expired =
      new Date(product.expired_date);

    const remainingDays =
      Math.max(
        (expired - today) / (1000 * 60 * 60 * 24),
        1
      );

    const expiredFactor =
      1 / remainingDays;

    const riskScore =
      (deltaT * Number(product.sensitivity)) +
      (expiredFactor * 10);

    let status =
      "SAFE";

    if (riskScore > 10) {
      status =
        "CRITICAL";
    }

    else if (riskScore > 5) {
      status =
        "WARNING";
    }

    results.push({
      name:
        product.product_name,
      score:
        riskScore.toFixed(2),
      status
    });
  });

  results.sort(
    (a, b) => Number(b.score) - Number(a.score)
  );

  renderFEFO(results);

  set(
    ref(database, "fefrost/fefo_priority"),
    results
  );
}
