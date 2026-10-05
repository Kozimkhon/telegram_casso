/**
 * Configuration module - responsible for loading and validating environment variables
 * Centralizes all configuration management for the application
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get project root reliably (2 levels up from src/config/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

// Load environment variables from project root
dotenv.config({ path: path.join(projectRoot, '.env') });

/**
 * Validates that required environment variables are present
 * @param {string} key - Environment variable key
 * @param {string} description - Human-readable description for error messages
 * @returns {string} The environment variable value
 * @throws {Error} If the required variable is missing
 */
function requireEnv(key, description) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key} (${description})`);
  }
  return value;
}

/**
 * Application configuration object
 * Contains all configuration values with validation and defaults
 */
export const config = {
  // Telegram API configuration
  telegram: {
    apiId: parseInt(requireEnv('API_ID', 'Telegram API ID from my.telegram.org')),
    apiHash: requireEnv('API_HASH', 'Telegram API Hash from my.telegram.org'),
    adminBotToken: requireEnv('ADMIN_BOT_TOKEN', 'Admin Bot token from @BotFather'),
  },

  // Database configuration
  database: {
    path: process.env.DB_PATH || path.join(projectRoot, 'data', 'telegram_casso.db'),
  },

  // Session and data paths
  paths: {
    dataDir: process.env.DATA_DIR || path.join(projectRoot, 'data'),
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logFile: process.env.LOG_FILE || path.join(projectRoot, 'logs', 'app.log'),
  },

  // Application settings
  app: {
    name: 'Telegram Casso',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  }
};

/**
 * Validates the entire configuration
 * Checks for required values and logical consistency
 */
export function validateConfig() {
  try {
    // Validate API ID is a number
    if (isNaN(config.telegram.apiId)) {
      throw new Error('API_ID must be a valid number');
    }

    console.log('✓ Configuration validation passed');
    return true;
  } catch (error) {
    console.error('✗ Configuration validation failed:', error.message);
    throw error;
  }
}

export default config;