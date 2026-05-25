/**
 * TELEMETRY DATA UTILITIES
 * Data normalization, validation, and formatting for IoT metrics
 * 
 * Handles:
 * - Temperature, humidity, and timestamp normalization
 * - Numeric validation and type coercion
 * - Display formatting for UI rendering
 * - Data integrity checks for Firebase listeners
 */

/**
 * Safely convert value to finite number
 * @param {*} value - Any value to normalize
 * @returns {number} Normalized number or 0 if invalid
 */
export function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Validate and normalize complete telemetry object
 * Ensures all telemetry fields are valid numbers
 * 
 * @param {Object} data - Raw telemetry data from Firebase
 * @returns {Object} Validated telemetry object
 */
export function normalizeTelemetry(data) {
  if (!data || typeof data !== "object") {
    return {
      room_temp: 0,
      storage_temp: 0,
      storage_humidity: 0,
      humidity: 0,
      timestamp: Date.now(),
      status: "UNKNOWN"
    };
  }

  const roomTemp = normalizeNumber(data.room_temp);
  const storageTemp = normalizeNumber(data.storage_temp);
  const humidity = normalizeNumber(data.humidity);
  const storageHumidity = normalizeNumber(data.storage_humidity ?? data.humidity);
  const timestamp = normalizeNumber(data.timestamp) || Date.now();

  // Determine status based on storage temperature
  let status = "SAFE";
  if (storageTemp > 8) {
    status = "DANGER";
  } else if (storageTemp > 5) {
    status = "WARNING";
  }

  return {
    room_temp: roomTemp,
    storage_temp: storageTemp,
    storage_humidity: storageHumidity,
    humidity,
    timestamp,
    status
  };
}

/**
 * Format temperature value for display
 * @param {number} value - Temperature value in Celsius
 * @returns {string} Formatted temperature string
 */
export function formatTemperature(value) {
  const temp = normalizeNumber(value);

  if (!Number.isFinite(temp)) {
    return "-- °C";
  }

  return `${temp.toFixed(1)} °C`;
}

/**
 * Format humidity value for display
 * @param {number} value - Humidity percentage
 * @returns {string} Formatted humidity string
 */
export function formatHumidity(value) {
  const humidity = normalizeNumber(value);

  if (!Number.isFinite(humidity)) {
    return "-- %";
  }

  return `${humidity.toFixed(1)} %`;
}

/**
 * Format timestamp for display
 * @param {number|Date} timestamp - Unix timestamp in milliseconds or Date object
 * @returns {string} Formatted date and time string
 */
export function formatTimestamp(timestamp) {
  try {
    const date = timestamp instanceof Date
      ? timestamp
      : new Date(normalizeNumber(timestamp));

    if (!Number.isFinite(date.getTime())) {
      return "-- :--:--";
    }

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.warn("[TELEMETRY] Invalid timestamp:", timestamp, error);
    return "-- :--:--";
  }
}

/**
 * Calculate temperature difference from ideal
 * Used for FEFO risk scoring
 * 
 * @param {number} actual - Actual storage temperature
 * @param {number} ideal - Ideal storage temperature for product
 * @returns {number} Absolute temperature difference
 */
export function calculateTempDelta(actual, ideal) {
  const actualTemp = normalizeNumber(actual);
  const idealTemp = normalizeNumber(ideal);

  return Math.abs(actualTemp - idealTemp);
}

/**
 * Calculate days remaining until expiration
 * Used for FEFO risk scoring
 * 
 * @param {string} expiredDate - Expiration date string (YYYY-MM-DD format)
 * @returns {number} Days remaining (minimum 1)
 */
export function calculateDaysRemaining(expiredDate) {
  try {
    const today = new Date();
    const expired = new Date(expiredDate);

    if (!Number.isFinite(expired.getTime())) {
      return 1;
    }

    const remainingMs = expired - today;
    const remainingDays = remainingMs / (1000 * 60 * 60 * 24);

    return Math.max(remainingDays, 1);
  } catch (error) {
    console.warn("[TELEMETRY] Invalid expiration date:", expiredDate, error);
    return 1;
  }
}

export default {
  normalizeNumber,
  normalizeTelemetry,
  formatTemperature,
  formatHumidity,
  formatTimestamp,
  calculateTempDelta,
  calculateDaysRemaining
};
