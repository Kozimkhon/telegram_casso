/**
 * @fileoverview Throttle Service
 * Handles rate limiting for message forwarding
 * @module domain/services/ThrottleService
 */

import { TelegramLimits } from '../../shared/constants/index.js';

/**
 * Throttle Service
 * Manages rate limiting
 * 
 * @class ThrottleService
 */
class ThrottleService {
  /**
   * Forwarding timestamps
   * @private
   */
  #timestamps = [];

  /**
   * Time window in milliseconds
   * @private
   */
  #timeWindow;

  /**
   * Max messages per window
   * @private
   */
  #maxMessages;

  /**
   * Creates throttle service
   * @param {Object} options - Options
   */
  constructor(options = {}) {
    this.#timeWindow = options.timeWindow || TelegramLimits.RATE_LIMIT_WINDOW_MS;
    this.#maxMessages = options.maxMessages || TelegramLimits.MAX_MESSAGES_PER_WINDOW;
  }

  /**
   * Checks if can forward
   * @returns {Promise<boolean>} True if can forward
   */
  async canForward() {
    this.#cleanOldTimestamps();
    return this.#timestamps.length < this.#maxMessages;
  }

  /**
   * Records forwarding attempt
   * @returns {Promise<void>}
   */
  async recordForwarding() {
    this.#timestamps.push(Date.now());
  }

  /**
   * Cleans old timestamps
   * @private
   */
  #cleanOldTimestamps() {
    const cutoff = Date.now() - this.#timeWindow;
    this.#timestamps = this.#timestamps.filter(ts => ts > cutoff);
  }

  /**
   * Gets current rate
   * @returns {number} Messages per minute
   */
  getCurrentRate() {
    this.#cleanOldTimestamps();
    const windowInMinutes = this.#timeWindow / 60000;
    return (this.#timestamps.length / windowInMinutes).toFixed(2);
  }

  /**
   * Gets remaining capacity
   * @returns {number} Remaining messages
   */
  getRemainingCapacity() {
    this.#cleanOldTimestamps();
    return Math.max(0, this.#maxMessages - this.#timestamps.length);
  }

  /**
   * Resets throttle
   * @returns {void}
   */
  reset() {
    this.#timestamps = [];
  }

  /**
   * Gets statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    this.#cleanOldTimestamps();
    
    return {
      currentCount: this.#timestamps.length,
      maxMessages: this.#maxMessages,
      remainingCapacity: this.getRemainingCapacity(),
      currentRate: this.getCurrentRate(),
      timeWindowMs: this.#timeWindow
    };
  }
}

export default ThrottleService;
