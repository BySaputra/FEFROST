import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYTsELv4EbZYt1JqJH8WBi05NjmLRXvYw",
  authDomain: "fefrost-system.firebaseapp.com",
  databaseURL: "https://fefrost-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fefrost-system",
  storageBucket: "fefrost-system.firebasestorage.app",
  messagingSenderId: "53914539598",
  appId: "1:53914539598:web:3f3aeab824f23b8142151f"
};


const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function generateData() {

  const temperature_room =
    (Math.random() * (10 - 2) + 2).toFixed(1);

  const humidity =
    Math.floor(Math.random() * (90 - 60) + 60);

  const temperature_storage =
    (Math.random() * (8 - 1) + 1).toFixed(1);

  let status = "SAFE";

  if (temperature_room > 8) {
    status = "DANGER";
  }
  else if (temperature_room > 5) {
    status = "WARNING";
  }

  const monitoringData = {
    temperature_room: Number(temperature_room),
    humidity: humidity,
    temperature_storage: Number(temperature_storage),
    status: status,
    timestamp: new Date().toLocaleString()
  };

  set(ref(database, "fefrost/monitoring"), monitoringData);

  console.log("Data sent:", monitoringData);
}

setInterval(generateData, 5000);