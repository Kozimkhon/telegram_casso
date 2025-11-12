/**
 * @fileoverview Message Forwarding Service - Domain Service
 * 
 * Orchestrates message forwarding business logic with rate limiting.
 * Coordinates repositories, throttle service, and state management
 * for reliable message distribution.
 * 
 * @module domain/services/ForwardingService
 */

import { ForwardingStatus } from '../../shared/constants/index.js';
import { log } from '../../shared/logger.js';

/**
 * Forwarding Service - Domain Service
 * 
 * Handles message forwarding orchestration with:
 * - Rate limiting per user
 * - Grouped message handling
 * - Error recovery
 * - Flood wait management
 * - Comprehensive logging
 * 
 * Responsibilities:
 * - Forward messages to channel users
 * - Forward messages to individual users
 * - Delete forwarded messages
 * - Handle rate limit errors
 * - Manage flood wait situations
 * 
 * @class ForwardingService
 */
class ForwardingService {
  /**
   * User repository
   * @private
   */
  #userRepository;

  /**
   * Message repository
   * @private
   */
  #messageRepository;

  /**
   * Throttle service (NEW: token bucket with per-user throttling)
   * @private
   */
  #throttleService;

  /**
   * State manager
   * @private
   */
  #stateManager;

  /**
   * Logger instance
   * @private
   */
  #logger;

  /**
   * Creates forwarding service instance
   * 
   * @param {Object} config - Configuration object
   * @param {UserRepository} config.userRepository - User data access
   * @param {MessageRepository} config.messageRepository - Message data access
   * @param {ThrottleService} config.throttleService - Rate limiting (NEW API)
   * @param {StateManager} config.stateManager - State management
   * @param {Object} config.logger - Logger instance (default: log)
   */
  constructor(config = {}) {
    this.#userRepository = config.userRepository;
    this.#messageRepository = config.messageRepository;
    this.#throttleService = config.throttleService;
    this.#stateManager = config.stateManager;
    this.#logger = config.logger || log;

    this.#logger.debug('[ForwardingService] Initialized');
  }

  /**
   * Forwards message to channel users
   * 
   * Applies rate limiting per user and handles grouped messages.
   * Blocks until rate limit allows forwarding to each user.
   * 
   * @async
   * @param {string} channelId - Channel identifier
   * @param {Object} message - Message to forward
   * @param {Function} forwarder - Forwarding function (userId, message) -> result
   * @returns {Promise<Object>} Forward results
   * @throws {Error} If repository operation fails
   */
  async forwardToChannelUsers(channelId, message, forwarder) {
    this.#logger.debug('[ForwardingService] Starting batch forwarding', {
      channelId,
      messageId: message.id
    });

    // Get channel users
    const users = await this.#userRepository.findByChannel(channelId);

    if (users.length === 0) {
      this.#logger.info('[ForwardingService] No users for channel', { channelId });
      return {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        results: []
      };
    }

    // Process forwarding
    const results = [];
    let successful = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {
      try {
        this.#logger.debug('[ForwardingService] Waiting for throttle', {
          channelId,
          userId: user.userId,
          remaining: users.length - users.indexOf(user)
        });

        // Wait for throttle permission (blocks until allowed)
        // NEW: Uses token bucket + per-user throttling
        await this.#throttleService.waitForThrottle(user.userId);

        this.#logger.debug('[ForwardingService] Throttle granted, forwarding', {
          channelId,
          userId: user.userId
        });

        // Forward message (now guaranteed by throttle)
        const result = await forwarder(user.userId, message);
        
        // Log success - handle grouped messages (albums)
        if (result.count && result.count > 1 && result.groupedId) {
          // Grouped message (album) - multiple messages in one group
          // Log with grouped tracking for later batch deletion
          
          await this.#messageRepository.create({
            channelId,
            messageId: message.id.toString(),
            userId: user.userId,
            forwardedMessageId: result.id?.toString(),
            groupedId: result.groupedId,
            isGrouped: true,
            status: ForwardingStatus.SUCCESS,
            sessionPhone: result.adminId
          });

          this.#logger.debug('[ForwardingService] Forwarded grouped message', {
            channelId,
            userId: user.userId,
            count: result.count,
            groupedId: result.groupedId
          });
        } else {
          // Single message (non-grouped)
          await this.#messageRepository.create({
            channelId,
            messageId: message.id.toString(),
            userId: user.userId,
            forwardedMessageId: result.id?.toString(),
            groupedId: null,
            isGrouped: false,
            status: ForwardingStatus.SUCCESS,
            sessionPhone: result.adminId
          });

          this.#logger.debug('[ForwardingService] Forwarded single message', {
            channelId,
            userId: user.userId,
            forwardedId: result.id
          });
        }

        results.push({
          userId: user.userId,
          status: ForwardingStatus.SUCCESS,
          forwardedMessageId: result.id
        });
        successful++;

      } catch (error) {
        this.#logger.error('[ForwardingService] Forwarding failed', {
          channelId,
          userId: user.userId,
          error: error.message
        });

        // Log failure
        await this.#messageRepository.create({
          channelId,
          messageId: message.id.toString(),
          userId: user.userId,
          status: ForwardingStatus.FAILED,
          errorMessage: error.message,
          sessionPhone: error.adminId
        });

        results.push({
          userId: user.userId,
          status: ForwardingStatus.FAILED,
          error: error.message
        });
        failed++;

        // Handle flood wait (Telegram rate limit)
        if (error.isFloodWait) {
          this.#logger.warn('[ForwardingService] Flood wait encountered', {
            sessionPhone: error.adminId,
            seconds: error.seconds
          });
          await this.handleFloodWait(error.adminId, error.seconds);
        }
      }
    }

    const summary = { total: users.length, successful, failed, skipped, results };
    this.#logger.info('[ForwardingService] Batch forwarding completed', summary);

    return summary;
  }

  /**
   * Handles Telegram flood wait error
   * 
   * Emits event to pause session and triggers exponential backoff retry.
   * 
   * @async
   * @param {string} sessionPhone - Session phone number
   * @param {number} seconds - Seconds to wait before retry
   * @returns {Promise<void>}
   */
  async handleFloodWait(sessionPhone, seconds) {
    const pausedUntil = new Date(Date.now() + seconds * 1000).toISOString();
    
    this.#logger.warn('[ForwardingService] Flood wait triggered', {
      sessionPhone,
      seconds,
      pausedUntil
    });

    // Emit event to pause this session
    this.#stateManager.emit('session:flood-wait', {
      phone: sessionPhone,
      seconds,
      pausedUntil
    });
  }

  /**
   * Forwards message to single user
   * 
   * Applies per-user rate limiting and retries with exponential backoff.
   * 
   * @async
   * @param {string} userId - User identifier
   * @param {Object} message - Message to forward
   * @param {Function} forwarder - Forwarding function (userId, message) -> result
   * @returns {Promise<Object>} Forward result
   * @throws {Error} If forwarding fails after retries
   */
  async forwardToUser(userId, message, forwarder) {
    this.#logger.debug('[ForwardingService] Forwarding to single user', {
      userId,
      messageId: message.id
    });

    // Wait for rate limit permission (NEW: blocks until allowed, per-user throttling)
    await this.#throttleService.waitForThrottle(userId);

    // Retry with exponential backoff if forwarding fails
    const result = await this.#throttleService.retryWithBackoff(
      async () => forwarder(userId, message),
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000
      }
    );

    this.#logger.debug('[ForwardingService] Single user forwarding succeeded', {
      userId,
      forwardedId: result.id
    });

    return result;
  }

  /**
   * Deletes forwarded messages
   * 
   * Batch deletes all forwarded copies of a message with per-user throttling.
   * 
   * @async
   * @param {string} channelId - Channel identifier
   * @param {string} messageId - Original message ID
   * @param {Function} deleter - Deletion function (userId, forwardedId) -> void
   * @returns {Promise<Object>} Deletion results
   */
  async deleteForwardedMessages(channelId, messageId, deleter) {
    this.#logger.debug('[ForwardingService] Deleting forwarded messages', {
      channelId,
      messageId
    });

    // Find all forwarded copies
    const messages = await this.#messageRepository.findByForwardedMessageId(
      channelId,
      messageId
    );

    if (messages.length === 0) {
      this.#logger.debug('[ForwardingService] No forwarded messages to delete', {
        channelId,
        messageId
      });
      return {
        total: 0,
        deleted: 0,
        failed: 0,
        results: []
      };
    }

    const results = [];
    let deleted = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        // Wait for throttle before deleting (per-user)
        await this.#throttleService.waitForThrottle(msg.userId);

        this.#logger.debug('[ForwardingService] Deleting message copy', {
          userId: msg.userId,
          forwardedId: msg.forwardedMessageId
        });

        // Delete the message
        await deleter(msg.userId, msg.forwardedMessageId);

        // Mark as deleted in database
        await this.#messageRepository.markAsDeleted(
          msg.userId,
          msg.forwardedMessageId
        );
        
        results.push({
          userId: msg.userId,
          success: true
        });
        deleted++;

      } catch (error) {
        this.#logger.error('[ForwardingService] Failed to delete message', {
          userId: msg.userId,
          forwardedId: msg.forwardedMessageId,
          error: error.message
        });

        results.push({
          userId: msg.userId,
          success: false,
          error: error.message
        });
        failed++;
      }
    }

    const summary = { total: messages.length, deleted, failed, results };
    this.#logger.info('[ForwardingService] Deletion completed', summary);

    return summary;
  }

  /**
   * Gets throttle statistics for monitoring
   * @returns {Object} Throttle statistics
   */
  getThrottleStatus() {
    return this.#throttleService.getStatistics();
  }

  /**
   * Clears per-user throttle (e.g., when user changes preferences)
   * @param {string} userId - User identifier
   */
  clearUserThrottle(userId) {
    this.#logger.info('[ForwardingService] Clearing user throttle', { userId });
    this.#throttleService.clearUserThrottle(userId);
  }

  /**
   * Resets all throttle state
   * @param {boolean} [resetUsers=true] - Also reset per-user throttling
   */
  resetThrottle(resetUsers = true) {
    this.#logger.info('[ForwardingService] Resetting throttle', { resetUsers });
    this.#throttleService.reset(resetUsers);
  }
}

export default ForwardingService;
