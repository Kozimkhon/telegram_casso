/**
 * @fileoverview E2E Test Setup & Utilities
 * Provides common setup functions for all E2E tests
 * @module test/setup/e2e-setup.js
 */

import 'reflect-metadata';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Global E2E Test Setup
 * Called before all tests run
 */
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.DB_PATH = ':memory:';

  // Create test directories
  const testDirs = [
    './test-logs',
    './test-failures',
    './coverage'
  ];

  testDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  console.log('✅ E2E Test environment initialized');
});

/**
 * Global E2E Test Teardown
 * Called after all tests complete
 */
afterAll(async () => {
  console.log('✅ E2E Test environment cleaned up');
});

/**
 * Global test helpers
 */
global.waitFor = async (condition, timeout = 5000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
};

global.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.captureConsole = (fn) => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
};

/**
 * Test report writer
 */
global.writeTestReport = (filename, data) => {
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
};

/**
 * Performance tracker
 */
class PerformanceTracker {
  constructor() {
    this.marks = {};
  }

  start(name) {
    this.marks[name] = { start: Date.now() };
  }

  end(name) {
    if (this.marks[name]) {
      this.marks[name].end = Date.now();
      this.marks[name].duration = this.marks[name].end - this.marks[name].start;
    }
  }

  getDuration(name) {
    return this.marks[name]?.duration || 0;
  }

  getReport() {
    return this.marks;
  }
}

global.performanceTracker = new PerformanceTracker();
