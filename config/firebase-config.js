import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getDatabase }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {

  apiKey: "AIzaSyAYTsELv4EbZYt1JqJH8WBi05NjmLRXvYw",

  authDomain:
  "fefrost-system.firebaseapp.com",

  databaseURL:
  "https://fefrost-system-default-rtdb.asia-southeast1.firebasedatabase.app",

  projectId:
  "fefrost-system",

  storageBucket:
  "fefrost-system.firebasestorage.app",

  messagingSenderId:
  "53914539598",

  appId:
  "1:53914539598:web:3f3aeab824f23b8142151f"
};

const app =
initializeApp(firebaseConfig);

const database =
getDatabase(app);

export { database };