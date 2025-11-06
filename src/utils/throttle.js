/**
 * Throttling and Rate Limiting utilities for spam protection
 */

import { log } from './logger.js';

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff calculator
 * @param {number} retryCount - Current retry attempt
 * @param {number} baseDelay - Base delay in milliseconds (default: 1000)
 * @param {number} maxDelay - Maximum delay in milliseconds (default: 60000)
 * @returns {number} Delay in milliseconds
 */
export function calculateExponentialBackoff(retryCount, baseDelay = 1000, maxDelay = 60000) {
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  // Add jitter (random ±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Rate limiter class for managing message sending rates
 */
export class RateLimiter {
  constructor(options = {}) {
    this.minDelayMs = options.minDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 5000;
    this.tokensPerInterval = options.tokensPerInterval || 10;
    this.interval = options.interval || 60000; // 1 minute
    
    this.tokens = this.tokensPerInterval;
    this.lastRefill = Date.now();
    this.queue = [];
    
    // Start token refill timer
    this.refillTimer = setInterval(() => this.refillTokens(), this.interval / 10);
  }

  /**
   * Refills tokens based on time elapsed
   */
  refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor((elapsed / this.interval) * this.tokensPerInterval);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.tokens + tokensToAdd, this.tokensPerInterval);
      this.lastRefill = now;
    }
  }

  /**
   * Waits for a token to become available
   * @returns {Promise<void>}
   */
  async waitForToken() {
    this.refillTokens();
    
    while (this.tokens <= 0) {
      await sleep(100);
      this.refillTokens();
    }
    
    this.tokens--;
    
    // Add random delay between messages
    const delay = Math.floor(
      this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs)
    );
    await sleep(delay);
  }

  /**
   * Stops the rate limiter
   */
  stop() {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }
}

/**
 * Per-member throttling manager
 */
export class PerMemberThrottle {
  constructor(delayMs = 500) {
    this.delayMs = delayMs;
    this.lastSentTime = new Map(); // userId -> timestamp
  }

  /**
   * Waits before sending to a specific user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async waitForUser(userId) {
    const lastSent = this.lastSentTime.get(userId);
    
    if (lastSent) {
      const elapsed = Date.now() - lastSent;
      const remaining = this.delayMs - elapsed;
      
      if (remaining > 0) {
        await sleep(remaining);
      }
    }
    
    this.lastSentTime.set(userId, Date.now());
  }

  /**
   * Clears throttle data for a user
   * @param {string} userId - User ID
   */
  clearUser(userId) {
    this.lastSentTime.delete(userId);
  }

  /**
   * Clears all throttle data
   */
  clearAll() {
    this.lastSentTime.clear();
  }
}

/**
 * Channel-specific throttling manager
 */
export class ChannelThrottle {
  constructor() {
    this.channelThrottles = new Map(); // channelId -> { limiter, perMemberThrottle }
  }

  /**
   * Gets or creates throttle for a channel
   * @param {string} channelId - Channel ID
   * @param {Object} config - Channel throttle configuration
   * @returns {Object} Throttle objects
   */
  getChannelThrottle(channelId, config = {}) {
    if (!this.channelThrottles.has(channelId)) {
      const limiter = new RateLimiter({
        minDelayMs: config.throttleDelayMs || 1000,
        maxDelayMs: config.throttleDelayMs ? config.throttleDelayMs * 2 : 2000,
        tokensPerInterval: config.tokensPerInterval || 20,
        interval: 60000
      });
      
      const perMemberThrottle = new PerMemberThrottle(
        config.throttlePerMemberMs || 500
      );
      
      this.channelThrottles.set(channelId, { limiter, perMemberThrottle });
    }
    
    return this.channelThrottles.get(channelId);
  }

  /**
   * Waits before sending a message through a channel
   * @param {string} channelId - Channel ID
   * @param {string} userId - Target user ID
   * @param {Object} config - Channel configuration
   * @returns {Promise<void>}
   */
  async waitForChannel(channelId, userId, config = {}) {
    const throttle = this.getChannelThrottle(channelId, config);
    
    // Wait for rate limiter token
    await throttle.limiter.waitForToken();
    
    // Wait for per-member throttle
    await throttle.perMemberThrottle.waitForUser(userId);
  }

  /**
   * Stops all channel throttles
   */
  stopAll() {
    for (const [channelId, { limiter }] of this.channelThrottles) {
      limiter.stop();
    }
    this.channelThrottles.clear();
  }
}

/**
 * Retry with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Function result
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 60000,
    onRetry = null
  } = options;

  let lastError;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries) {
        const delay = calculateExponentialBackoff(i, baseDelay, maxDelay);
        
        if (onRetry) {
          onRetry(i + 1, delay, error);
        }
        
        log.debug('[Retry] Backing off', { 
          attempt: i + 1, 
          maxRetries, 
          delay,
          error: error.message 
        });
        
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Global throttle manager singleton
 */
class ThrottleManager {
  constructor() {
    this.channelThrottle = new ChannelThrottle();
    this.globalLimiter = new RateLimiter({
      minDelayMs: 800,
      maxDelayMs: 2000,
      tokensPerInterval: 30,
      interval: 60000
    });
  }

  /**
   * Waits before sending a message
   * @param {string} channelId - Channel ID
   * @param {string} userId - Target user ID
   * @param {Object} config - Channel configuration
   * @returns {Promise<void>}
   */
  async waitBeforeSend(channelId, userId, config = {}) {
    // Global rate limit
    await this.globalLimiter.waitForToken();
    
    // Channel-specific throttle
    if (channelId) {
      await this.channelThrottle.waitForChannel(channelId, userId, config);
    }
  }

  /**
   * Stops all throttles
   */
  stopAll() {
    this.globalLimiter.stop();
    this.channelThrottle.stopAll();
  }
}

// Export singleton instance
export const throttleManager = new ThrottleManager();

export default {
  sleep,
  calculateExponentialBackoff,
  RateLimiter,
  PerMemberThrottle,
  ChannelThrottle,
  retryWithBackoff,
  throttleManager
};
