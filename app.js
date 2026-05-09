import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue
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

const monitoringRef = ref(database, "fefrost/monitoring");

onValue(monitoringRef, (snapshot) => {
  const data = snapshot.val();

  document.getElementById("temp-room").innerText =
    data.temperature_room + " °C";

  document.getElementById("humidity").innerText =
    data.humidity + " %";

  document.getElementById("temp-storage").innerText =
    data.temperature_storage + " °C";

  document.getElementById("status").innerText =
    data.status;
});