/**
 * @fileoverview Throttle Service - Domain Service for Rate Limiting
 * 
 * Implements rate limiting strategy following DDD principles.
 * Manages rate limiting for message forwarding with token bucket algorithm.
 * 
 * @module domain/services/ThrottleService
 * @see {@link PerMemberThrottle} For per-user throttling
 * @see {@link ChannelThrottle} For channel-specific throttling
 */

import { log } from '../../shared/logger.js';

/**
 * Rate Limiter Value Object
 * Manages tokens using token bucket algorithm
 * 
 * @class RateLimiterVO
 */
class RateLimiterVO {
  #tokens;
  #lastRefill;
  #tokensPerInterval;
  #interval;
  #minDelayMs;
  #maxDelayMs;
  #refillTimer;

  /**
   * Creates rate limiter value object
   * @param {Object} config - Configuration
   * @param {number} config.tokensPerInterval - Tokens per interval
   * @param {number} config.interval - Interval in milliseconds
   * @param {number} config.minDelayMs - Minimum delay between messages
   * @param {number} config.maxDelayMs - Maximum delay between messages
   */
  constructor(config = {}) {
    this.#tokensPerInterval = config.tokensPerInterval || 10;
    this.#interval = config.interval || 60000;
    this.#minDelayMs = config.minDelayMs || 1000;
    this.#maxDelayMs = config.maxDelayMs || 5000;
    
    this.#tokens = this.#tokensPerInterval;
    this.#lastRefill = Date.now();
    
    // Start token refill timer
    this.#refillTimer = setInterval(() => this.#refillTokens(), this.#interval / 10);
  }

  /**
   * Refills tokens based on elapsed time
   * @private
   */
  #refillTokens() {
    const now = Date.now();
    const elapsed = now - this.#lastRefill;
    const tokensToAdd = Math.floor((elapsed / this.#interval) * this.#tokensPerInterval);
    
    if (tokensToAdd > 0) {
      this.#tokens = Math.min(this.#tokens + tokensToAdd, this.#tokensPerInterval);
      this.#lastRefill = now;
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Exponential backoff calculator
   * @param {number} retryCount - Current retry attempt
   * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
   * @param {number} maxDelay - Maximum delay in milliseconds (default: 60000)
   * @returns {number} Delay in milliseconds
   */
  calculateExponentialBackoff(retryCount, baseDelay = 1000, maxDelay = 60000) {
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    // Add jitter (random ±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }
  /**
   * Waits for a token to become available
   * @async
   * @returns {Promise<void>}
   */
  async waitForToken() {
    this.#refillTokens();
    
    while (this.#tokens <= 0) {
      await this.sleep(100);
      this.#refillTokens();
    }
    
    this.#tokens--;
    
    // Add random delay between messages (jitter)
    const delay = Math.floor(
      this.#minDelayMs + Math.random() * (this.#maxDelayMs - this.#minDelayMs)
    );
    await this.sleep(delay);
  }

  /**
   * Gets available tokens count
   * @returns {number} Available tokens
   */
  getTokensCount() {
    return this.#tokens;
  }

  /**
   * Stops the rate limiter
   */
  stop() {
    if (this.#refillTimer) {
      clearInterval(this.#refillTimer);
      this.#refillTimer = null;
    }
  }
}

/**
 * Per-User Throttle Value Object
 * Manages throttling per individual user
 * 
 * @class PerUserThrottleVO
 */
class PerUserThrottleVO {
  #userDelayMap; // userId -> lastSentTime
  #delayMs;

  /**
   * Creates per-user throttle
   * @param {number} delayMs - Delay between messages to same user
   */
  constructor(delayMs = 500) {
    this.#userDelayMap = new Map();
    this.#delayMs = delayMs;
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Waits before sending to specific user
   * @async
   * @param {string} userId - User identifier
   * @returns {Promise<void>}
   */
  async waitForUser(userId) {
    const lastSent = this.#userDelayMap.get(userId);
    
    if (lastSent) {
      const elapsed = Date.now() - lastSent;
      const remaining = this.#delayMs - elapsed;
      
      if (remaining > 0) {
        await this.sleep(remaining);
      }
    }
    
    this.#userDelayMap.set(userId, Date.now());
  }

  /**
   * Clears throttle for specific user
   * @param {string} userId - User identifier
   */
  clearUser(userId) {
    this.#userDelayMap.delete(userId);
  }

  /**
   * Clears all throttle data
   */
  clearAll() {
    this.#userDelayMap.clear();
  }
}

/**
 * Throttle Service - Domain Service
 * 
 * Manages rate limiting for domain entities following token bucket algorithm.
 * Provides per-session, per-user, and global rate limiting.
 * 
 * Responsibilities:
 * - Enforce rate limits for message forwarding
 * - Track forwarding attempts within time windows
 * - Calculate remaining capacity
 * - Provide monitoring metrics
 * 
 * @class ThrottleService
 */
class ThrottleService {
  #rateLimiter;
  #perUserThrottle;
  #logger;
  #config;

  /**
   * Creates throttle service instance
   * @param {Object} options - Configuration options
   * @param {number} options.tokensPerInterval - Tokens per interval (default: 10)
   * @param {number} options.interval - Interval in ms (default: 60000)
   * @param {number} options.minDelayMs - Min delay between messages (default: 1000)
   * @param {number} options.maxDelayMs - Max delay between messages (default: 5000)
   * @param {number} options.userDelayMs - Delay per user (default: 500)
   * @param {Object} options.logger - Logger instance (default: log)
   */
  constructor(options = {}) {
    this.#config = {
      tokensPerInterval: options.tokensPerInterval || 10,
      interval: options.interval || 60000,
      minDelayMs: options.minDelayMs || 1000,
      maxDelayMs: options.maxDelayMs || 5000,
      userDelayMs: options.userDelayMs || 500
    };

    this.#logger = options.logger || log;
    
    this.#rateLimiter = new RateLimiterVO(this.#config);
    this.#perUserThrottle = new PerUserThrottleVO(this.#config.userDelayMs);

    this.#logger.debug('[ThrottleService] Initialized', this.#config);
  }

  /**
   * Waits for throttle permission
   * Applies both global and per-user rate limiting
   * 
   * @async
   * @param {string} [userId] - Optional user identifier for per-user throttling
   * @returns {Promise<void>}
   * @throws {Error} If waiting is interrupted
   */
  async waitForThrottle(userId = null) {
    // Global rate limit via token bucket
    await this.#rateLimiter.waitForToken();
    
    // Per-user throttling if userId provided
    if (userId) {
      await this.#perUserThrottle.waitForUser(userId);
    }

    this.#logger.debug('[ThrottleService] Throttle granted', { userId });
  }

  /**
   * Checks if forwarding is permitted (non-blocking check)
   * @returns {boolean} True if can forward immediately
   */
  canForwardNow() {
    return this.#rateLimiter.getTokensCount() > 0;
  }

  /**
   * Resets throttle state
   * Useful for testing or resetting limits
   * 
   * @param {boolean} [resetUsers=true] - Also reset per-user throttling
   */
  reset(resetUsers = true) {
    if (resetUsers) {
      this.#perUserThrottle.clearAll();
    }
    this.#logger.info('[ThrottleService] Throttle reset');
  }

  /**
   * Gets current statistics for monitoring
   * @returns {Object} Statistics object
   */
  getStatistics() {
    return {
      tokensAvailable: this.#rateLimiter.getTokensCount(),
      minDelayMs: this.#config.minDelayMs,
      maxDelayMs: this.#config.maxDelayMs,
      interval: this.#config.interval,
      tokensPerInterval: this.#config.tokensPerInterval
    };
  }

  /**
   * Clears per-user throttle for specific user
   * @param {string} userId - User identifier
   */
  clearUserThrottle(userId) {
    this.#perUserThrottle.clearUser(userId);
    this.#logger.debug('[ThrottleService] Cleared user throttle', { userId });
  }

  /**
   * Gets global throttle status
   * @returns {Object} Global status
   */
  getGlobalStatus() {
    return {
      tokensAvailable: this.#rateLimiter.getTokensCount(),
      tokensPerInterval: this.#config.tokensPerInterval,
      interval: this.#config.interval
    };
  }

  /**
   * Gets per-user throttle status
   * @param {string} userId - User identifier
   * @returns {Object} User status
   */
  getPerUserStatus(userId) {
    return {
      userId,
      tokensAvailable: this.#rateLimiter.getTokensCount(), // Simplified - same as global for now
      tokensPerInterval: this.#config.tokensPerInterval,
      interval: this.#config.interval
    };
  }

  /**
   * Handles flood wait error from Telegram
   * @param {string} adminId - Admin identifier
   * @param {number} waitSeconds - Seconds to wait
   */
  handleFloodWait(adminId, waitSeconds) {
    this.#logger.warn('[ThrottleService] Flood wait detected', {
      adminId,
      waitSeconds
    });
    // Could implement additional logic here if needed
  }

  /**
   * Shutdown service and cleanup resources
   * @async
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.stop();
    this.#logger.info('[ThrottleService] Service shutdown complete');
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Exponential backoff calculator
   * @param {number} retryCount - Current retry attempt
   * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
   * @param {number} maxDelay - Maximum delay in milliseconds (default: 60000)
   * @returns {number} Delay in milliseconds
   */
  calculateExponentialBackoff(retryCount, baseDelay = 1000, maxDelay = 60000) {
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    // Add jitter (random ±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Stops the service and cleanup resources
   */
  stop() {
    this.#rateLimiter.stop();
    this.#perUserThrottle.clearAll();
    this.#logger.info('[ThrottleService] Service stopped');
  }

  /**
   * Retry operation with exponential backoff
   * @async
   * @param {Function} operation - Async operation to retry
   * @param {Object} options - Retry options
   * @returns {Promise<*>} Operation result
   * @throws {Error} If all retries exhausted
   */
  async retryWithBackoff(operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 60000
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = this.calculateExponentialBackoff(attempt, baseDelay, maxDelay);
          this.#logger.debug('[ThrottleService] Retrying with backoff', {
            attempt: attempt + 1,
            maxRetries,
            delay,
            error: error.message
          });
          
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
}

export default ThrottleService;
