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

// ELEMENT

const fefoList =
document.getElementById("fefo-list");

// DATA STORAGE

let monitoringData = {};
let productsData = {};

// MONITORING LISTENER

onValue(
  ref(database, "fefrost/monitoring"),
  (snapshot) => {

    monitoringData = snapshot.val();

    calculateFEFO();

  }
);

// PRODUCT LISTENER

onValue(
  ref(database, "fefrost/products"),
  (snapshot) => {

    productsData = snapshot.val();

    calculateFEFO();

  }
);

// FEFO ENGINE

function calculateFEFO() {

  if (!monitoringData || !productsData) return;

  const results = [];

  Object.keys(productsData).forEach((key) => {

    const product =
    productsData[key];

    // STORAGE TEMP

    const actualTemp =
    monitoringData.temperature_storage;

    const idealTemp =
    product.ideal_temp;

    // DELTA T

    const deltaT =
    Math.abs(actualTemp - idealTemp);

    // EXPIRED CALCULATION

    const today =
    new Date();

    const expired =
    new Date(product.expired_date);

    const remainingDays =
    Math.max(
      (expired - today)
      / (1000 * 60 * 60 * 24),
      1
    );

    const expiredFactor =
    1 / remainingDays;

    // RISK SCORE

    const riskScore =
    (deltaT * product.sensitivity)
    +
    (expiredFactor * 10);

    // STATUS

    let status = "SAFE";

    if (riskScore > 10) {

      status = "CRITICAL";

    }

    else if (riskScore > 5) {

      status = "WARNING";

    }

    // PUSH RESULT

    results.push({

      name:
      product.product_name,

      score:
      riskScore.toFixed(2),

      status:
      status

    });

  });

  // SORT DESCENDING

  results.sort(
    (a, b) => b.score - a.score
  );

  // CLEAR UI

  fefoList.innerHTML = "";

  // DISPLAY RESULT

  results.forEach((item, index) => {

    const li =
    document.createElement("li");

    let statusClass = "safe";

    if (item.status === "WARNING") {

      statusClass = "warning";

    }

    else if (item.status === "CRITICAL") {

      statusClass = "danger";

    }

    li.innerHTML = `

      <strong>
        ${index + 1}. ${item.name}
      </strong>

      <br>

      Risk Score:
      ${item.score}

      <br>

      Status:
      <span class="${statusClass}">
        ${item.status}
      </span>

    `;

    fefoList.appendChild(li);

  });

  // SAVE TO FIREBASE

  set(
    ref(database, "fefrost/fefo_priority"),
    results
  );

}