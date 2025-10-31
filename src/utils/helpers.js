/**
 * Helper utilities module - responsible for common utility functions
 * Provides reusable helper functions across the application
 */

import fs from 'fs/promises';
import path from 'path';
import { log } from './logger.js';

/**
 * Sleep utility for async delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formats a timestamp to a human-readable string
 * @param {Date|number} timestamp - Timestamp to format
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(timestamp = new Date()) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Sanitizes text for safe logging and database storage
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum length of sanitized text
 * @returns {string} Sanitized text
 */
export function sanitizeText(text, maxLength = 1000) {
  if (!text || typeof text !== 'string') return '';
  
  // Remove or replace potentially problematic characters
  let sanitized = text
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
  }
  
  return sanitized;
}

/**
 * Extracts channel information from Telegram channel object
 * @param {Object} channel - Telegram channel object
 * @returns {Object} Extracted channel info
 */
export function extractChannelInfo(channel) {
  const channelId = channel.id?.toString() || '';
  const title = sanitizeText(channel.title || channel.name || 'Unknown Channel');
  
  return {
    channelId,
    title,
    username: channel.username || null,
    participantsCount: channel.participantsCount || 0,
    isChannel: channel.className === 'Channel',
    isGroup: channel.className === 'Chat',
    isMegagroup: channel.megagroup || false
  };
}

/**
 * Extracts user information from Telegram user object
 * @param {Object} user - Telegram user object
 * @returns {Object} Extracted user info
 */
export function extractUserInfo(user) {
  const userId = user.id?.toString() || '';
  const firstName = sanitizeText(user.firstName || user.first_name || '');
  const lastName = sanitizeText(user.lastName || user.last_name || '');
  const username = user.username || null;
  const phone = user.phone || null;
  
  return {
    userId,
    firstName,
    lastName,
    username,
    phone,
    isBot: user.bot || false,
    isPremium: user.premium || false
  };
}

/**
 * Validates if a string is a valid Telegram channel/chat ID
 * @param {string} channelId - Channel ID to validate
 * @returns {boolean} True if valid
 */
export function isValidChannelId(channelId) {
  if (!channelId || typeof channelId !== 'string') return false;
  
  // Telegram channel IDs are typically negative numbers for supergroups/channels
  // or positive numbers for users/bots
  const numericId = parseInt(channelId);
  return !isNaN(numericId) && Math.abs(numericId) > 0;
}

/**
 * Validates if a string is a valid Telegram user ID
 * @param {string} userId - User ID to validate
 * @returns {boolean} True if valid
 */
export function isValidUserId(userId) {
  if (!userId || typeof userId !== 'string') return false;
  
  // Telegram user IDs are positive integers
  const numericId = parseInt(userId);
  return !isNaN(numericId) && numericId > 0;
}

/**
 * Creates a rate limiter function
 * @param {number} limit - Maximum number of calls
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Rate limiter function
 */
export function createRateLimiter(limit, windowMs) {
  const calls = new Map();
  
  return function(key) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    for (const [callKey, callTime] of calls.entries()) {
      if (callTime < windowStart) {
        calls.delete(callKey);
      }
    }
    
    // Count calls for this key in the current window
    const keyCalls = Array.from(calls.entries())
      .filter(([callKey, callTime]) => 
        callKey.startsWith(key + ':') && callTime >= windowStart
      ).length;
    
    if (keyCalls >= limit) {
      return false; // Rate limit exceeded
    }
    
    // Record this call
    calls.set(`${key}:${now}`, now);
    return true; // Rate limit not exceeded
  };
}

/**
 * Chunks an array into smaller arrays of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Size of each chunk
 * @returns {Array[]} Array of chunks
 */
export function chunkArray(array, size) {
  if (!Array.isArray(array) || size <= 0) return [];
  
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Safely parses JSON with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed object or default value
 */
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    log.warn('Failed to parse JSON', { jsonString, error: error.message });
    return defaultValue;
  }
}

/**
 * Safely stringifies JSON with error handling
 * @param {*} object - Object to stringify
 * @param {string} defaultValue - Default value if stringification fails
 * @returns {string} JSON string or default value
 */
export function safeJsonStringify(object, defaultValue = '{}') {
  try {
    return JSON.stringify(object);
  } catch (error) {
    log.warn('Failed to stringify JSON', { error: error.message });
    return defaultValue;
  }
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dirPath - Directory path
 * @returns {Promise<void>}
 */
export async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
      log.debug(`Created directory: ${dirPath}`);
    } else {
      throw error;
    }
  }
}

/**
 * Reads a file with error handling
 * @param {string} filePath - Path to file
 * @param {string} encoding - File encoding
 * @returns {Promise<string|null>} File contents or null if file doesn't exist
 */
export async function safeReadFile(filePath, encoding = 'utf8') {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

/**
 * Writes a file with error handling and directory creation
 * @param {string} filePath - Path to file
 * @param {string} data - Data to write
 * @param {string} encoding - File encoding
 * @returns {Promise<void>}
 */
export async function safeWriteFile(filePath, data, encoding = 'utf8') {
  const dirPath = path.dirname(filePath);
  await ensureDirectory(dirPath);
  await fs.writeFile(filePath, data, encoding);
}

/**
 * Generates a random string of specified length
 * @param {number} length - Length of random string
 * @param {string} charset - Character set to use
 * @returns {string} Random string
 */
export function generateRandomString(length = 8, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

export default {
  sleep,
  formatTimestamp,
  sanitizeText,
  extractChannelInfo,
  extractUserInfo,
  isValidChannelId,
  isValidUserId,
  createRateLimiter,
  chunkArray,
  safeJsonParse,
  safeJsonStringify,
  ensureDirectory,
  safeReadFile,
  safeWriteFile,
  generateRandomString
};