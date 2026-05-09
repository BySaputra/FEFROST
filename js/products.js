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

// ELEMENTS

const productList =
document.getElementById("product-list");

const addButton =
document.getElementById("add-product");

// CEK ELEMENT

if (addButton) {

  // ADD PRODUCT

  addButton.addEventListener("click", () => {

    const productName =
    document.getElementById("product-name").value;

    const category =
    document.getElementById("category").value;

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

    // VALIDATION

    if (
      !productName ||
      !category ||
      !entryDate ||
      !expiredDate
    ) {

      alert("Please fill all fields!");

      return;
    }

    // PRODUCT OBJECT

    const product = {

      product_name:
      productName,

      category:
      category,

      entry_date:
      entryDate,

      expired_date:
      expiredDate,

      sensitivity:
      sensitivity,

      ideal_temp:
      idealTemp

    };

    // PUSH TO FIREBASE

    push(
      ref(database, "fefrost/products"),
      product
    );

    // CLEAR INPUT

    document.getElementById("product-name").value = "";

    document.getElementById("category").value = "";

    document.getElementById("entry-date").value = "";

    document.getElementById("expired-date").value = "";

    document.getElementById("ideal-temp").value = "";

  });

}

// REALTIME PRODUCT LISTENER

onValue(
  ref(database, "fefrost/products"),
  (snapshot) => {

    if (!productList) return;

    productList.innerHTML = "";

    if (!snapshot.exists()) return;

    snapshot.forEach((childSnapshot) => {

      const data =
      childSnapshot.val();

      const key =
      childSnapshot.key;

      const li =
      document.createElement("li");

      li.innerHTML = `

        <strong>
          ${data.product_name}
        </strong>

        <br>

        Category:
        ${data.category}

        <br>

        Entry:
        ${data.entry_date}

        <br>

        Expired:
        ${data.expired_date}

        <br>

        Sensitivity:
        ${data.sensitivity}

        <br>

        Ideal Temp:
        ${data.ideal_temp} °C

        <br><br>

        <button
          class="delete-btn"
          onclick="deleteProduct('${key}')">

          Delete

        </button>

      `;

      productList.appendChild(li);

    });

  }
);

// DELETE PRODUCT

window.deleteProduct = function(key) {

  remove(
    ref(database, `fefrost/products/${key}`)
  );

};