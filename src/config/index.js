/**
 * Configuration module - responsible for loading and validating environment variables
 * Centralizes all configuration management for the application
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    phoneNumber: requireEnv('PHONE_NUMBER', 'Phone number in international format'),
    adminBotToken: requireEnv('ADMIN_BOT_TOKEN', 'Admin Bot token from @BotFather'),
    adminUserId: parseInt(requireEnv('ADMIN_USER_ID', 'Admin user Telegram ID')),
  },

  // Database configuration
  database: {
    path: process.env.DB_PATH || path.join(process.cwd(), 'data', 'telegram_casso.db'),
  },

  // Session and data paths
  paths: {
    sessionPath: process.env.SESSION_PATH || path.join(process.cwd(), 'data', 'userbot_session'),
    dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    logFile: path.join(process.cwd(), 'logs', 'app.log'),
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

    // Validate Admin User ID is a number
    if (isNaN(config.telegram.adminUserId)) {
      throw new Error('ADMIN_USER_ID must be a valid number');
    }

    // Validate phone number format (basic check)
    if (!config.telegram.phoneNumber.startsWith('+')) {
      throw new Error('PHONE_NUMBER must be in international format starting with +');
    }

    console.log('✓ Configuration validation passed');
    return true;
  } catch (error) {
    console.error('✗ Configuration validation failed:', error.message);
    throw error;
  }
}

export default config;