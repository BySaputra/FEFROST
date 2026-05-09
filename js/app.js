// IMPORT MODULES

import "./monitoring.js";
import "./products.js";
import "./fefo.js";
import "./logs.js";

// SECTION NAVIGATION

window.showSection = function(sectionName) {

  // SEMUA SECTION

  const sections = [

    "monitoring",
    "products",
    "fefo",
    "logs"

  ];

  // HIDE SEMUA

  sections.forEach((section) => {

    document
      .getElementById(`${section}-section`)
      .classList.add("hidden");

  });

  // TAMPILKAN SECTION DIPILIH

  document
    .getElementById(`${sectionName}-section`)
    .classList.remove("hidden");

};