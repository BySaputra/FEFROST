/**
 * CENTRALIZED LOGGING SYSTEM
 * Smart historical intelligence & structured event logging
 * 
 * Features:
 * - Structured log entries
 * - Deduplication & anti-spam
 * - Firebase persistent logging
 * - Realtime cross-module communication
 * - Historical intelligence foundation
 */

import {
  ref,
  push
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  database
} from "../../config/firebase-config.js";

import {
  FIREBASE_PATHS
} from "./firebase-paths.js";

// ===============================
// CONSTANTS
// ===============================

export const SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  DANGER: "danger"
};

export const LOG_TYPE = {
  TEMPERATURE: "temperature",
  HUMIDITY: "humidity",
  ALERT: "alert",
  PRODUCT: "product",
  SYSTEM: "system",
  FEFO: "fefo"
};

// ===============================
// RUNTIME STATE
// ===============================

const loggerRuntime = {
  logs: [],
  lastLogSignature: {},
  logCooldown: {}
};

// ===============================
// HELPERS
// ===============================

function generateLogSignature(type, source, message) {
  return `${type}|${source}|${message}`;
}

function isLogThrottled(signature, cooldownMs = 5000) {
  const now = Date.now();
  const lastTime = loggerRuntime.logCooldown[signature];

  if (!lastTime) {
    loggerRuntime.logCooldown[signature] = now;
    return false;
  }

  if (now - lastTime < cooldownMs) {
    return true;
  }

  loggerRuntime.logCooldown[signature] = now;
  return false;
}

function isDuplicateLog(type, source, message) {
  const signature = generateLogSignature(type, source, message);
  const lastSig = loggerRuntime.lastLogSignature[type];

  if (lastSig === signature) {
    return true;
  }

  loggerRuntime.lastLogSignature[type] = signature;
  return false;
}

// ===============================
// CREATE LOG ENTRY
// ===============================

function createLogEntry(options = {}) {
  const {
    type = LOG_TYPE.SYSTEM,
    severity = SEVERITY.INFO,
    message = "",
    source = "unknown",
    timestamp = Date.now(),
    metadata = {}
  } = options;

  return {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity,
    message,
    source,
    timestamp,
    metadata
  };
}

// ===============================
// ADD LOG
// ===============================

export async function addLog(options = {}) {
  try {

    // Validation
    if (!options.message) {
      console.warn("[LOGGER] Empty message skipped");
      return null;
    }

    const signature = generateLogSignature(
      options.type || LOG_TYPE.SYSTEM,
      options.source || "unknown",
      options.message
    );

    // Cooldown protection
    if (isLogThrottled(signature)) {
      return null;
    }

    // Duplicate protection
    if (
      isDuplicateLog(
        options.type || LOG_TYPE.SYSTEM,
        options.source || "unknown",
        options.message
      )
    ) {
      return null;
    }

    // Create log
    const logEntry = createLogEntry(options);

    // Store runtime cache
    loggerRuntime.logs.push(logEntry);

    // Limit memory usage
    if (loggerRuntime.logs.length > 300) {
      loggerRuntime.logs.shift();
    }

    // ===============================
    // FIREBASE PERSISTENT LOGGING
    // ===============================

    try {

      // Prevent recursive Firebase logging
      if (options.source !== "firebase-listener") {

        await push(
          ref(database, FIREBASE_PATHS.logs),
          logEntry
        );

      }

    } catch (firebaseError) {

      console.error(
        "[LOGGER] Firebase write failed:",
        firebaseError
      );

    }

    // ===============================
    // CUSTOM EVENT
    // ===============================

    window.dispatchEvent(
      new CustomEvent("logAdded", {
        detail: logEntry
      })
    );

    console.log("[LOGGER] Added:", logEntry);

    return logEntry;

  } catch (error) {

    console.error("[LOGGER] addLog failed:", error);

    return null;
  }
}

// ===============================
// GETTERS
// ===============================

export function getLogs() {
  return [...loggerRuntime.logs];
}

export function getLogsBySeverity(severity) {
  return loggerRuntime.logs.filter(
    (log) => log.severity === severity
  );
}

export function getLogsByType(type) {
  return loggerRuntime.logs.filter(
    (log) => log.type === type
  );
}

export function getLogsBySource(source) {
  return loggerRuntime.logs.filter(
    (log) => log.source === source
  );
}

export function searchLogs(keyword) {

  if (!keyword || typeof keyword !== "string") {
    return [];
  }

  const lowerKeyword = keyword.toLowerCase();

  return loggerRuntime.logs.filter((log) => {

    return (
      log.message.toLowerCase().includes(lowerKeyword) ||
      log.source.toLowerCase().includes(lowerKeyword) ||
      log.type.toLowerCase().includes(lowerKeyword)
    );

  });
}

export function getLatestLogs(limit = 50) {

  return loggerRuntime.logs
    .slice()
    .reverse()
    .slice(0, limit);

}

// ===============================
// CLEARING
// ===============================

export function clearLogs() {

  loggerRuntime.logs = [];
  loggerRuntime.lastLogSignature = {};

  window.dispatchEvent(
    new CustomEvent("logsCleared")
  );

  console.log("[LOGGER] Cleared");

}

export function clearOldLogs(ageMs = 86400000) {

  const cutoffTime = Date.now() - ageMs;

  const before = loggerRuntime.logs.length;

  loggerRuntime.logs =
    loggerRuntime.logs.filter(
      (log) => log.timestamp > cutoffTime
    );

  const cleared =
    before - loggerRuntime.logs.length;

  console.log(
    `[LOGGER] Cleared ${cleared} old logs`
  );

  return cleared;

}

// ===============================
// EXPORT
// ===============================

export function exportLogs() {

  const content =
    JSON.stringify(loggerRuntime.logs, null, 2);

  const blob = new Blob(
    [content],
    {
      type: "application/json"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `fefrost-logs-${Date.now()}.json`;

  link.click();

  URL.revokeObjectURL(url);

}

// ===============================
// STATISTICS
// ===============================

export function getLogStats() {

  const stats = {
    total: loggerRuntime.logs.length,
    bySeverity: {},
    byType: {},
    bySource: {}
  };

  loggerRuntime.logs.forEach((log) => {

    stats.bySeverity[log.severity] =
      (stats.bySeverity[log.severity] || 0) + 1;

    stats.byType[log.type] =
      (stats.byType[log.type] || 0) + 1;

    stats.bySource[log.source] =
      (stats.bySource[log.source] || 0) + 1;

  });

  return stats;

}

// ===============================
// DEFAULT EXPORT
// ===============================

export default {
  addLog,
  getLogs,
  getLogsBySeverity,
  getLogsByType,
  getLogsBySource,
  searchLogs,
  getLatestLogs,
  clearLogs,
  clearOldLogs,
  exportLogs,
  getLogStats,
  SEVERITY,
  LOG_TYPE
};