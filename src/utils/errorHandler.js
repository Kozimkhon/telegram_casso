/**
 * Error handler module - responsible for centralized error handling and reporting
 * Provides consistent error processing across the application
 */

import { log } from './logger.js';

/**
 * Custom error classes for different types of application errors
 */
export class AppError extends Error {
  constructor(message, code = 'APP_ERROR', statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class TelegramError extends AppError {
  constructor(message, code = 'TELEGRAM_ERROR', originalError = null) {
    super(message, code, 500);
    this.name = 'TelegramError';
    this.originalError = originalError;
  }
}

export class AuthenticationError extends AppError {
  constructor(message) {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Global error handler for unhandled errors
 * @param {Error} error - The unhandled error
 * @param {string} context - Context where the error occurred
 */
export function handleGlobalError(error, context = 'Unknown') {
  log.error(`Unhandled error in ${context}`, {
    error: error.message,
    stack: error.stack,
    code: error.code || 'UNKNOWN',
    context
  });
  
  // In production, you might want to send this to an error reporting service
  if (process.env.NODE_ENV === 'production') {
    // Send to error reporting service (e.g., Sentry)
    console.error('CRITICAL ERROR:', error);
  }
}

/**
 * Wraps async functions with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error reporting
 * @returns {Function} Wrapped function
 */
export function asyncErrorHandler(fn, context = 'AsyncFunction') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleGlobalError(error, context);
      throw error;
    }
  };
}

/**
 * Handles Telegram API errors with specific handling for common cases
 * @param {Error} error - Telegram API error
 * @param {string} operation - Operation that failed
 * @returns {TelegramError} Processed Telegram error
 */
export function handleTelegramError(error, operation = 'Unknown operation') {
  let message = `Telegram API error during ${operation}`;
  let code = 'TELEGRAM_API_ERROR';
  
  // Handle common Telegram errors
  if (error.message?.includes('FLOOD_WAIT')) {
    const waitTime = error.message.match(/FLOOD_WAIT_(\d+)/)?.[1];
    message = `Rate limited. Wait ${waitTime} seconds before retrying`;
    code = 'TELEGRAM_FLOOD_WAIT';
  } else if (error.message?.includes('USER_DEACTIVATED')) {
    message = 'User has deactivated their account';
    code = 'TELEGRAM_USER_DEACTIVATED';
  } else if (error.message?.includes('CHAT_WRITE_FORBIDDEN')) {
    message = 'Bot cannot write to this chat';
    code = 'TELEGRAM_WRITE_FORBIDDEN';
  } else if (error.message?.includes('BOT_BLOCKED')) {
    message = 'Bot is blocked by user';
    code = 'TELEGRAM_BOT_BLOCKED';
  } else if (error.message?.includes('PHONE_CODE_INVALID')) {
    message = 'Invalid phone verification code';
    code = 'TELEGRAM_INVALID_CODE';
  } else if (error.message?.includes('SESSION_PASSWORD_NEEDED')) {
    message = 'Two-factor authentication password required';
    code = 'TELEGRAM_2FA_REQUIRED';
  }
  
  const telegramError = new TelegramError(message, code, error);
  log.error(message, {
    operation,
    originalError: error.message,
    code
  });
  
  return telegramError;
}

/**
 * Handles database errors with specific context
 * @param {Error} error - Database error
 * @param {string} operation - Database operation that failed
 * @returns {DatabaseError} Processed database error
 */
export function handleDatabaseError(error, operation = 'Unknown operation') {
  let message = `Database error during ${operation}`;
  
  // Handle SQLite specific errors
  if (error.code === 'SQLITE_CONSTRAINT') {
    message = `Database constraint violation during ${operation}`;
  } else if (error.code === 'SQLITE_BUSY') {
    message = `Database is busy during ${operation}`;
  } else if (error.code === 'SQLITE_LOCKED') {
    message = `Database is locked during ${operation}`;
  }
  
  const dbError = new DatabaseError(message, error);
  log.error(message, {
    operation,
    originalError: error.message,
    sqliteCode: error.code
  });
  
  return dbError;
}

/**
 * Retry mechanism for operations that might fail temporarily
 * @param {Function} operation - Operation to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Operation result
 */
export async function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    context = 'Operation'
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      log.warn(`${context} failed (attempt ${attempt}/${maxRetries})`, {
        error: error.message,
        attempt,
        maxRetries
      });
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry certain types of errors
      if (error instanceof AuthenticationError || 
          error instanceof ValidationError ||
          (error instanceof TelegramError && error.code === 'TELEGRAM_BOT_BLOCKED')) {
        break;
      }
      
      // Wait before retrying
      const waitTime = delay * Math.pow(backoff, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}

/**
 * Graceful shutdown handler
 * @param {string} signal - Shutdown signal
 */
export function setupGracefulShutdown(cleanupCallback) {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      log.info(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        if (cleanupCallback) {
          await cleanupCallback();
        }
        log.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        log.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    });
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception', error);
    process.exit(1);
  });
}

export default {
  AppError,
  DatabaseError,
  TelegramError,
  AuthenticationError,
  ValidationError,
  handleGlobalError,
  asyncErrorHandler,
  handleTelegramError,
  handleDatabaseError,
  withRetry,
  setupGracefulShutdown
};