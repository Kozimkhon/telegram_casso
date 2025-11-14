/**
 * @fileoverview Jest Configuration
 * Central test runner configuration with coverage thresholds
 */

export default {
  // Test environment
  testEnvironment: 'node',
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.spec.js',
    '!src/index.js',
    '!src/**/index.js',
    '!src/config/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './src/core/entities': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/domain/services': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.spec.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Module aliases (if using path mapping)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@data/(.*)$': '<rootDir>/src/data/$1',
    '^@presentation/(.*)$': '<rootDir>/src/presentation/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1'
  },

  // Transform files
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Transform ignore patterns - ensure babel-jest is applied
  transformIgnorePatterns: [
    'node_modules/(?!(telegram)/)'
  ],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',

  // Reporter configuration
  reporters: [
    'default'
  ],

  // Max workers for parallel testing
  maxWorkers: '50%',

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Detect open handles
  detectOpenHandles: false,

  // Force exit (use cautiously)
  forceExit: false,

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined
};
