import {
  ref,
  onValue
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  database
}
from "../config/firebase-config.js";

const logsList =
document.getElementById("logs-list");

let logsCache = [];

function formatTemperature(value) {
  const temperature =
    Number(value);

  if (!Number.isFinite(temperature)) return "-- \u00B0C";

  return `${temperature.toFixed(1)} \u00B0C`;
}

function formatHumidity(value) {
  const humidity =
    Number(value);

  if (!Number.isFinite(humidity)) return "-- %";

  return `${humidity.toFixed(0)} %`;
}

function getStatusClass(status) {
  if (status === "DANGER") return "danger";
  if (status === "WARNING") return "warning";

  return "safe";
}

function renderLogs() {
  if (!logsList) return;

  if (logsCache.length === 0) {
    logsList.innerHTML = `
      <tr>
        <td class="empty-row" colspan="5">
          No monitoring logs available.
        </td>
      </tr>
    `;

    return;
  }

  logsList.innerHTML =
    logsCache.map((data) => `
      <tr>
        <td>
          <strong>${data.timestamp || "--"}</strong>
        </td>
        <td>${formatTemperature(data.temperature_room)}</td>
        <td>${formatHumidity(data.humidity)}</td>
        <td>${formatTemperature(data.temperature_storage)}</td>
        <td>
          <span class="badge ${getStatusClass(data.status)}">
            ${data.status || "--"}
          </span>
        </td>
      </tr>
    `).join("");
}

onValue(
  ref(database, "fefrost/logs"),
  (snapshot) => {
    logsCache = [];

    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        logsCache.unshift(childSnapshot.val());
      });
    }

    renderLogs();
  }
);

window.downloadMonitoringLogs = function() {
  const content =
    JSON.stringify(logsCache, null, 2);

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
    "fefrost-monitoring-logs.json";

  link.click();

  URL.revokeObjectURL(url);
};
