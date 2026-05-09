import {
  ref,
  onValue
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  database
}
from "../config/firebase-config.js";

// ELEMENT

const logsList =
document.getElementById("logs-list");

// REALTIME LOG LISTENER

onValue(
  ref(database, "fefrost/logs"),
  (snapshot) => {

    logsList.innerHTML = "";

    if (!snapshot.exists()) return;

    snapshot.forEach((childSnapshot) => {

      const data =
      childSnapshot.val();

      const li =
      document.createElement("li");

      let statusClass = "safe";

      if (data.status === "WARNING") {

        statusClass = "warning";

      }

      else if (data.status === "DANGER") {

        statusClass = "danger";

      }

      li.innerHTML = `

        <strong>
          ${data.timestamp}
        </strong>

        <br>

        Room Temp:
        ${data.temperature_room} °C

        <br>

        Humidity:
        ${data.humidity} %

        <br>

        Storage Temp:
        ${data.temperature_storage} °C

        <br>

        Status:
        <span class="${statusClass}">
          ${data.status}
        </span>

      `;

      // DATA BARU DI ATAS

      logsList.prepend(li);

    });

  }
);