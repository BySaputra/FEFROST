/**
 * GLOBAL CONSTANTS
 * Centralized constants for the FEFROST IoT Dashboard
 */

// TEMPERATURE THRESHOLDS (in °C)
export const TEMP_THRESHOLDS = {
  // Safe operating range
  MIN_SAFE: 2,
  MAX_SAFE: 8,

  // Warning range
  MAX_WARNING: 10,

  // Critical/danger range
  MAX_CRITICAL: 15
};

// HUMIDITY THRESHOLDS (in %)
export const HUMIDITY_THRESHOLDS = {
  MIN_SAFE: 30,
  MAX_SAFE: 80,

  // Out of range warning
  MAX_WARNING: 90
};

// FEFO RISK SCORING
export const FEFO_RISK_LEVELS = {
  CRITICAL_THRESHOLD: 10,
  WARNING_THRESHOLD: 5,
  SAFE_THRESHOLD: 0
};

// UI SETTINGS
export const UI_CONFIG = {
  // Maximum items to display in lists
  MAX_DISPLAY_ITEMS: 50,

  // Maximum history logs to keep
  MAX_HISTORY_LOGS: 100,

  // Maximum alerts to display
  MAX_ALERTS: 50,

  // Refresh interval for manual updates (ms)
  MANUAL_REFRESH_INTERVAL: 5000,

  // Auto-refresh interval (ms)
  AUTO_REFRESH_INTERVAL: 10000
};

// ALERT SEVERITY LEVELS
export const ALERT_SEVERITY = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "info",
  SUCCESS: "success"
};

// STATUS INDICATORS
export const STATUS = {
  SAFE: "SAFE",
  WARNING: "WARNING",
  DANGER: "DANGER",
  UNKNOWN: "UNKNOWN"
};

// DATE FORMATS
export const DATE_FORMATS = {
  FULL: "YYYY-MM-DD HH:mm:ss",
  DATE_ONLY: "YYYY-MM-DD",
  TIME_ONLY: "HH:mm:ss",
  ISO: "ISO8601"
};

// SENSITIVITY LEVELS (for products)
export const SENSITIVITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

export const SENSITIVITY_LABELS = {
  1: "Low",
  2: "Medium",
  3: "High"
};

export default {
  TEMP_THRESHOLDS,
  HUMIDITY_THRESHOLDS,
  FEFO_RISK_LEVELS,
  UI_CONFIG,
  ALERT_SEVERITY,
  STATUS,
  DATE_FORMATS,
  SENSITIVITY_LEVELS,
  SENSITIVITY_LABELS
};
