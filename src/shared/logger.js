/**
 * Logger module - responsible for application logging using Winston
 * Provides structured logging with multiple transports and log levels
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';

/**
 * Ensures the logs directory exists
 */
async function ensureLogDirectory() {
  try {
    const logDir = path.dirname(config.logging.logFile);
    await fs.mkdir(logDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create log directory:', error.message);
  }
}

// Initialize logger with deferred directory setup
let loggerInitialized = false;

/**
 * Initializes logger (call once at application startup)
 */
export async function initializeLogger() {
  if (!loggerInitialized) {
    await ensureLogDirectory();
    loggerInitialized = true;
  }
}

/**
 * Custom log format for better readability
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

/**
 * Winston logger instance with multiple transports
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // Console transport with colorized output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: config.logging.logFile,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Separate file for errors only
    new winston.transports.File({
      filename: path.join(path.dirname(config.logging.logFile), 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      tailable: true
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(path.dirname(config.logging.logFile), 'exceptions.log')
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(path.dirname(config.logging.logFile), 'rejections.log')
    })
  ]
});

/**
 * Enhanced logging methods with context
 */
export const log = {
  /**
   * Log debug information
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug: (message, meta = {}) => {
    logger.debug(message, meta);
  },

  /**
   * Log informational messages
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info: (message, meta = {}) => {
    logger.info(message, meta);
  },

  /**
   * Log warning messages
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn: (message, meta = {}) => {
    logger.warn(message, meta);
  },

  /**
   * Log error messages
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or metadata
   */
  error: (message, error = {}) => {
    if (error instanceof Error) {
      logger.error(message, { error: error.message, stack: error.stack });
    } else {
      logger.error(message, error);
    }
  },

  /**
   * Log bot-specific events
   * @param {string} botType - Type of bot (userbot/adminbot)
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  botEvent: (botType, event, data = {}) => {
    logger.info(`[${botType.toUpperCase()}] ${event}`, {
      botType,
      event,
      ...data
    });
  },

  /**
   * Log database operations
   * @param {string} operation - Database operation
   * @param {string} table - Table name
   * @param {Object} data - Operation data
   */
  dbOperation: (operation, table, data = {}) => {
    logger.debug(`[DB] ${operation} on ${table}`, {
      operation,
      table,
      ...data
    });
  },

  /**
   * Log message forwarding events
   * @param {string} channelId - Source channel ID
   * @param {string} userId - Target user ID
   * @param {string} status - Forwarding status (success/failed)
   * @param {Object} meta - Additional metadata
   */
  messageForward: (channelId, userId, status, meta = {}) => {
    const level = status === 'success' ? 'info' : 'warn';
    logger[level](`[FORWARD] Message ${status}`, {
      channelId,
      userId,
      status,
      ...meta
    });
  }
};

/**
 * Creates a child logger with additional context
 * @param {Object} context - Context to add to all log messages
 * @returns {Object} Child logger instance
 */
export function createChildLogger(context) {
  return {
    debug: (message, meta = {}) => log.debug(message, { ...context, ...meta }),
    info: (message, meta = {}) => log.info(message, { ...context, ...meta }),
    warn: (message, meta = {}) => log.warn(message, { ...context, ...meta }),
    error: (message, error = {}) => log.error(message, error),
    botEvent: (botType, event, data = {}) => log.botEvent(botType, event, { ...context, ...data }),
    dbOperation: (operation, table, data = {}) => log.dbOperation(operation, table, { ...context, ...data }),
    messageForward: (channelId, userId, status, meta = {}) => log.messageForward(channelId, userId, status, { ...context, ...meta })
  };
}

export default log;