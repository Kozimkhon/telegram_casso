import { defaults } from "jest-config";

export default {
  testEnvironment: "node",

  // Test fayllari
  testMatch: ["**/__tests__/**/*.spec.js", "**/?(*.)+(spec|test).js"],

  // Coverage sozlamalari
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/**/*.spec.js",
    "!src/index.js",
    "!src/**/index.js",
    "!src/config/**"
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 75, lines: 75, statements: 75 },
    "./src/core/entities": { branches: 85, functions: 90, lines: 90, statements: 90 },
    "./src/domain/services": { branches: 80, functions: 85, lines: 85, statements: 85 }
  },
  coverageDirectory: "<rootDir>/coverage",

  // Module aliases
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@domain/(.*)$": "<rootDir>/src/domain/$1",
    "^@data/(.*)$": "<rootDir>/src/data/$1",
    "^@presentation/(.*)$": "<rootDir>/src/presentation/$1",
    "^@shared/(.*)$": "<rootDir>/src/shared/$1"
  },

  resolver: 'jest-node-exports-resolver',
  transform: {}, // ESM fayllar Node tomonidan transform qilinadi, Babel kerak emas
  transformIgnorePatterns: ["node_modules/(?!(telegram)/)"],

  // Test opsiyalari
  testTimeout: 10000,
  verbose: true,
  maxWorkers: "50%",
  clearMocks: true,
  restoreMocks: true,
  detectOpenHandles: false,
  forceExit: false,

  // Setup fayli (agar kerak bo‘lsa)
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"]
};
