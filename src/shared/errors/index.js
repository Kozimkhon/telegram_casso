/**
 * Enhanced Error Handling System
 * Provides custom error classes and error handling utilities
 * 
 * @module shared/errors
 */

import { ErrorType } from './constants/index.js';

/**
 * @class AppError
 * @extends {Error}
 * @description Base application error class
 */
export class AppError extends Error {
  /**
   * Creates a new AppError
   * @param {string} message - Error message
   * @param {string} type - Error type
   * @param {number} [statusCode=500] - HTTP status code
   * @param {boolean} [isOperational=true] - Whether error is operational
   * @param {Object} [context] - Additional context
   */
  constructor(message, type, statusCode = 500, isOperational = true, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts error to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * @class ValidationError
 * @extends {AppError}
 * @description Error for validation failures
 */
export class ValidationError extends AppError {
  /**
   * Creates a new ValidationError
   * @param {string} message - Error message
   * @param {Array<string>} [errors=[]] - Validation errors
   * @param {Object} [context] - Additional context
   */
  constructor(message, errors = [], context = {}) {
    super(message, ErrorType.VALIDATION, 400, true, { ...context, errors });
    this.errors = errors;
  }
}

/**
 * @class DatabaseError
 * @extends {AppError}
 * @description Error for database operations
 */
export class DatabaseError extends AppError {
  /**
   * Creates a new DatabaseError
   * @param {string} message - Error message
   * @param {Error} [originalError] - Original error
   * @param {Object} [context] - Additional context
   */
  constructor(message, originalError = null, context = {}) {
    super(message, ErrorType.DATABASE, 500, true, context);
    this.originalError = originalError;
  }
}

/**
 * @class AuthenticationError
 * @extends {AppError}
 * @description Error for authentication failures
 */
export class AuthenticationError extends AppError {
  /**
   * Creates a new AuthenticationError
   * @param {string} message - Error message
   * @param {Object} [context] - Additional context
   */
  constructor(message, context = {}) {
    super(message, ErrorType.AUTHENTICATION, 401, true, context);
  }
}

/**
 * @class TelegramError
 * @extends {AppError}
 * @description Error for Telegram API operations
 */
export class TelegramError extends AppError {
  /**
   * Creates a new TelegramError
   * @param {string} message - Error message
   * @param {Error} [originalError] - Original Telegram error
   * @param {Object} [context] - Additional context
   */
  constructor(message, originalError = null, context = {}) {
    super(message, ErrorType.TELEGRAM, 500, true, context);
    this.originalError = originalError;
  }
}

/**
 * @class RateLimitError
 * @extends {AppError}
 * @description Error for rate limiting
 */
export class RateLimitError extends AppError {
  /**
   * Creates a new RateLimitError
   * @param {string} message - Error message
   * @param {number} retryAfter - Seconds to wait before retry
   * @param {Object} [context] - Additional context
   */
  constructor(message, retryAfter, context = {}) {
    super(message, ErrorType.RATE_LIMIT, 429, true, { ...context, retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * @class PermissionError
 * @extends {AppError}
 * @description Error for permission/authorization failures
 */
export class PermissionError extends AppError {
  /**
   * Creates a new PermissionError
   * @param {string} message - Error message
   * @param {string} [requiredPermission] - Required permission
   * @param {Object} [context] - Additional context
   */
  constructor(message, requiredPermission = null, context = {}) {
    super(message, ErrorType.PERMISSION, 403, true, { ...context, requiredPermission });
    this.requiredPermission = requiredPermission;
  }
}

/**
 * @class NetworkError
 * @extends {AppError}
 * @description Error for network operations
 */
export class NetworkError extends AppError {
  /**
   * Creates a new NetworkError
   * @param {string} message - Error message
   * @param {Error} [originalError] - Original network error
   * @param {Object} [context] - Additional context
   */
  constructor(message, originalError = null, context = {}) {
    super(message, ErrorType.NETWORK, 503, true, context);
    this.originalError = originalError;
  }
}

/**
 * Error handler utility class
 */
export class ErrorHandler {
  /**
   * Handles an error appropriately
   * @param {Error} error - Error to handle
   * @param {Object} logger - Logger instance
   * @param {Object} [context] - Additional context
   */
  static handle(error, logger, context = {}) {
    if (error instanceof AppError) {
      if (error.isOperational) {
        logger.error(error.message, {
          type: error.type,
          statusCode: error.statusCode,
          context: { ...error.context, ...context },
          stack: error.stack
        });
      } else {
        // Non-operational error - critical
        logger.error('Critical error occurred', {
          error: error.message,
          type: error.type,
          context: { ...error.context, ...context },
          stack: error.stack
        });
      }
    } else {
      // Unknown error
      logger.error('Unknown error occurred', {
        error: error.message,
        stack: error.stack,
        context
      });
    }
  }

  /**
   * Determines if error is operational
   * @param {Error} error - Error to check
   * @returns {boolean} True if operational
   */
  static isOperational(error) {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Wraps a function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} logger - Logger instance
   * @returns {Function} Wrapped function
   */
  static wrap(fn, logger) {
    return async function(...args) {
      try {
        return await fn.apply(this, args);
      } catch (error) {
        ErrorHandler.handle(error, logger, { function: fn.name });
        throw error;
      }
    };
  }

  /**
   * Retries a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {Object} [options] - Retry options
   * @param {number} [options.maxAttempts=3] - Maximum attempts
   * @param {number} [options.delayMs=1000] - Initial delay in ms
   * @param {number} [options.backoffMultiplier=2] - Backoff multiplier
   * @param {Object} [options.logger] - Logger instance
   * @returns {Promise<any>} Function result
   */
  static async retry(fn, options = {}) {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoffMultiplier = 2,
      logger = console
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          break;
        }

        const waitTime = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        
        logger.warn(`Attempt ${attempt} failed, retrying in ${waitTime}ms`, {
          error: error.message,
          attempt,
          maxAttempts
        });

        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError;
  }
}

/**
 * Async error boundary decorator
 * @param {Object} logger - Logger instance
 * @returns {Function} Decorator function
 */
export function asyncErrorBoundary(logger) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        ErrorHandler.handle(error, logger, {
          class: target.constructor.name,
          method: propertyKey
        });
        throw error;
      }
    };

    return descriptor;
  };
}

export default {
  AppError,
  ValidationError,
  DatabaseError,
  AuthenticationError,
  TelegramError,
  RateLimitError,
  PermissionError,
  NetworkError,
  ErrorHandler,
  asyncErrorBoundary
};
