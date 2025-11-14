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
import Message from '../../core/entities/domain/Message.entity.js';

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
          if(result.result){
            for(const res of result.result){
              const messageEntity = new Message({
                channelId,
                messageId: res.fwdFrom.channelPost.toString(),
                userId: user.userId,
                forwardedMessageId: res.id?.toString(),
                groupedId: res.groupedId?.toString(),
                isGrouped: true,
                status: ForwardingStatus.SUCCESS
              });
              await this.#messageRepository.create(messageEntity);

              this.#logger.debug('[ForwardingService] Forwarded grouped message item', {
                channelId,
                userId: user.userId,
                forwardedId: res.id,
                groupedId: result.groupedId
              });
            }
          }else{
             const messageEntity = new Message({
            channelId,
            messageId: message.id.toString(),
            userId: user.userId,
            forwardedMessageId: result.id?.toString(),
            groupedId: result.groupedId,
            isGrouped: true,
            status: ForwardingStatus.SUCCESS
          });

          await this.#messageRepository.create(messageEntity);

          this.#logger.debug('[ForwardingService] Forwarded grouped message', {
            channelId,
            userId: user.userId,
            count: result.count,
            groupedId: result.groupedId
          });
          }
         
        } else {
          // Single message (non-grouped)
          const messageEntity = new Message({
            channelId,
            messageId: message.id.toString(),
            userId: user.userId,
            forwardedMessageId: result.id?.toString(),
            groupedId: null,
            isGrouped: false,
            status: ForwardingStatus.SUCCESS
          });

          await this.#messageRepository.create(messageEntity);

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
        const failedMessageEntity = new Message({
          channelId,
          messageId: message.id.toString(),
          userId: user.userId,
          status: ForwardingStatus.FAILED,
          errorMessage: error.message
        });

        await this.#messageRepository.create(failedMessageEntity);

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
   * Edits forwarded messages for users
   * 
   * When a channel message is edited, this method finds all forwarded copies
   * and edits them in users' private chats.
   * 
   * @async
   * @param {string} channelId - Channel identifier
   * @param {number} messageId - Original message ID from channel
   * @param {Function} editor - Edit function (userId, forwardedId) -> void
   * @returns {Promise<Object>} Edit results
   */
  async editForwardedMessages(channelId, messageId, editor) {
    try {
      this.#logger.debug('[ForwardingService] Starting edit forwarded messages', {
        channelId,
        messageId
      });

      // Find all forwarded messages for this channel message
      const forwardedMessages = await this.#messageRepository.findByChannelAndOriginalId(
        channelId,
        messageId
      );

      if (!forwardedMessages || forwardedMessages.length === 0) {
        this.#logger.debug('[ForwardingService] No forwarded messages found to edit', {
          channelId,
          messageId
        });
        return {
          success: true,
          editedCount: 0,
          errorCount: 0,
          errors: []
        };
      }

      this.#logger.info('[ForwardingService] Editing forwarded messages', {
        channelId,
        messageId,
        forwardedCount: forwardedMessages.length
      });

      const results = {
        editedCount: 0,
        errorCount: 0,
        errors: []
      };

      // Edit each forwarded message
      for (const fwdMsg of forwardedMessages) {
        try {
          // Apply rate limiting
          await this.#throttleService.acquireToken();

          // Add per-user delay
          await this.#throttleService.delayForUser();

          // Edit message via provided editor function
          await editor(fwdMsg.userId, fwdMsg.forwardedMessageId);

          results.editedCount++;

          this.#logger.debug('[ForwardingService] Edited forwarded message', {
            userId: fwdMsg.userId,
            forwardedMessageId: fwdMsg.forwardedMessageId
          });

        } catch (error) {
          results.errorCount++;
          results.errors.push({
            userId: fwdMsg.userId,
            forwardedMessageId: fwdMsg.forwardedMessageId,
            error: error.message
          });

          this.#logger.error('[ForwardingService] Failed to edit forwarded message', {
            userId: fwdMsg.userId,
            forwardedMessageId: fwdMsg.forwardedMessageId,
            error: error.message
          });

          // Handle flood wait
          if (error.isFloodWait) {
            this.#logger.warn('[ForwardingService] Flood wait during edit', {
              seconds: error.seconds,
              userId: fwdMsg.userId
            });
            // Continue with other users
          }
        }
      }

      this.#logger.info('[ForwardingService] Completed editing forwarded messages', {
        channelId,
        messageId,
        ...results
      });

      return {
        success: results.errorCount === 0,
        ...results
      };

    } catch (error) {
      this.#logger.error('[ForwardingService] Error in editForwardedMessages', {
        channelId,
        messageId,
        error: error.message
      });
      throw error;
    }
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
  async deleteForwardedMessages(channelId, messageIds, deleter) {
    this.#logger.debug('[ForwardingService] Deleting forwarded messages', {
      channelId,
      messageIds
    });

    // Find all forwarded copies
    const messages = await this.#messageRepository.findByForwardedMessageId(
      channelId,
      messageIds
    ) || [];

    this.#logger.info('[ForwardingService] Found forwarded message copies', {
      channelId,
      messageIds,
      count: messages.length,
      messages: messages.map(m => ({ userId: m.userId, forwardedId: m.forwardedMessageId }))
    });

    if (messages.length === 0) {
      this.#logger.debug('[ForwardingService] No forwarded messages to delete', {
        channelId,
        messageIds
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

    // Group forwarded IDs per user for throttle-respectful deletion
    const groupedIds = messages.reduce((acc, msg) => {
      if (!acc[msg.userId]) {
        acc[msg.userId] = [];
      }
      acc[msg.userId].push(msg.forwardedMessageId);
      return acc;
    }, {});

    for (const userId of Object.keys(groupedIds)) {
      const forwardedIds = groupedIds[userId];

      try {
        await this.#throttleService.waitForThrottle(userId);
        await deleter(userId, forwardedIds);

        for (const forwardedId of forwardedIds) {
          await this.#messageRepository.markAsDeleted(userId, forwardedId);
        }

        results.push({
          userId,
          success: true
        });
        deleted += forwardedIds.length;
      } catch (error) {
        this.#logger.error('[ForwardingService] Failed to delete message', {
          userId,
          forwardedIds,
          error: error.message
        });

        results.push({
          userId,
          success: false,
          error: error.message
        });
        failed += forwardedIds.length;
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
