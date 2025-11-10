/**
 * @fileoverview Message Forwarding Service
 * Handles complex message forwarding business logic
 * @module domain/services/ForwardingService
 */

import { TelegramLimits, ForwardingStatus } from '../../shared/constants/index.js';

/**
 * Forwarding Service
 * Orchestrates message forwarding logic
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
   * Throttle service
   * @private
   */
  #throttleService;

  /**
   * State manager
   * @private
   */
  #stateManager;

  /**
   * Creates forwarding service
   * @param {UserRepository} userRepository - User repository
   * @param {MessageRepository} messageRepository - Message repository
   * @param {ThrottleService} throttleService - Throttle service
   * @param {StateManager} stateManager - State manager
   */
  constructor(userRepository, messageRepository, throttleService, stateManager) {
    this.#userRepository = userRepository;
    this.#messageRepository = messageRepository;
    this.#throttleService = throttleService;
    this.#stateManager = stateManager;
  }

  /**
   * Forwards message to channel users
   * @param {string} channelId - Channel ID
   * @param {Object} message - Message to forward
   * @param {Function} forwarder - Forwarding function
   * @returns {Promise<Object>} Forward results
   */
  async forwardToChannelUsers(channelId, message, forwarder) {
    // Get channel users
    const users = await this.#userRepository.findByChannel(channelId);

    if (users.length === 0) {
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
      // Check throttle
      const canForward = await this.#throttleService.canForward();
      if (!canForward) {
        results.push({
          userId: user.userId,
          status: ForwardingStatus.SKIPPED,
          error: 'Rate limit exceeded'
        });
        skipped++;
        continue;
      }

      try {
        // Forward message
        const result = await forwarder(user.userId, message);
        
        // Log success
        await this.#messageRepository.create({
          channelId,
          messageId: message.id,
          userId: user.userId,
          forwardedMessageId: result.id,
          status: ForwardingStatus.SUCCESS,
          sessionPhone: result.sessionPhone
        });

        results.push({
          userId: user.userId,
          status: ForwardingStatus.SUCCESS,
          forwardedMessageId: result.id
        });
        successful++;

        // Update throttle
        await this.#throttleService.recordForwarding();

      } catch (error) {
        // Log failure
        await this.#messageRepository.create({
          channelId,
          messageId: message.id,
          userId: user.userId,
          status: ForwardingStatus.FAILED,
          errorMessage: error.message,
          sessionPhone: error.sessionPhone
        });

        results.push({
          userId: user.userId,
          status: ForwardingStatus.FAILED,
          error: error.message
        });
        failed++;

        // Handle flood wait
        if (error.isFloodWait) {
          await this.handleFloodWait(error.sessionPhone, error.seconds);
        }
      }
    }

    return {
      total: users.length,
      successful,
      failed,
      skipped,
      results
    };
  }

  /**
   * Handles flood wait error
   * @param {string} sessionPhone - Session phone
   * @param {number} seconds - Seconds to wait
   * @returns {Promise<void>}
   */
  async handleFloodWait(sessionPhone, seconds) {
    this.#stateManager.emit('session:flood-wait', {
      phone: sessionPhone,
      seconds,
      pausedUntil: new Date(Date.now() + seconds * 1000).toISOString()
    });
  }

  /**
   * Forwards message to single user
   * @param {string} userId - User ID
   * @param {Object} message - Message to forward
   * @param {Function} forwarder - Forwarding function
   * @returns {Promise<Object>} Forward result
   */
  async forwardToUser(userId, message, forwarder) {
    const canForward = await this.#throttleService.canForward();
    if (!canForward) {
      throw new Error('Rate limit exceeded');
    }

    const result = await forwarder(userId, message);
    await this.#throttleService.recordForwarding();

    return result;
  }

  /**
   * Deletes forwarded messages
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Original message ID
   * @param {Function} deleter - Deletion function
   * @returns {Promise<Object>} Deletion results
   */
  async deleteForwardedMessages(channelId, messageId, deleter) {
    // Find forwarded messages
    const messages = await this.#messageRepository.findByForwardedMessageId(
      channelId,
      messageId
    );

    const results = [];
    let deleted = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        await deleter(msg.userId, msg.forwardedMessageId);
        await this.#messageRepository.markAsDeleted(msg.userId, msg.forwardedMessageId);
        
        results.push({
          userId: msg.userId,
          success: true
        });
        deleted++;
      } catch (error) {
        results.push({
          userId: msg.userId,
          success: false,
          error: error.message
        });
        failed++;
      }
    }

    return {
      total: messages.length,
      deleted,
      failed,
      results
    };
  }
}

export default ForwardingService;
