/**
 * FIREBASE REALTIME DATABASE - PATH CONSTANTS
 * Centralized Firebase path configuration for all modules
 * 
 * Database Structure:
 * fefrost/
 *   ├── live/ (current telemetry)
 *   ├── history/ (historical logs)
 *   ├── products/ (inventory)
 *   ├── alerts/ (alert events)
 *   └── logs/ (system logs)
 */

export const FIREBASE_PATHS = {
  // Real-time monitoring data
  live: "fefrost/live",

  // Historical telemetry logs
  history: "fefrost/history",

  // Product inventory
  products: "fefrost/products",

  // FEFO product status summary
  productSummary: "fefrost/product_summary",

  // Alert events
  alerts: "fefrost/alerts",

  // System logs
  logs: "fefrost/logs"
};

export default FIREBASE_PATHS;
