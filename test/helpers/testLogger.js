/**
 * Test Logger
 * Structured logging for test execution
 */

const testLogger = {
  info: (message, metadata = {}) => {
    console.log(`[INFO] ${message}`, JSON.stringify(metadata));
  },
  
  error: (message, metadata = {}) => {
    console.error(`[ERROR] ${message}`, JSON.stringify(metadata));
  },
  
  warn: (message, metadata = {}) => {
    console.warn(`[WARN] ${message}`, JSON.stringify(metadata));
  },
  
  debug: (message, metadata = {}) => {
    console.log(`[DEBUG] ${message}`, JSON.stringify(metadata));
  }
};

module.exports = { testLogger };
