/**
 * @fileoverview Log Message Use Case
 * Handles message forwarding logging business logic
 * @module domain/use-cases/message/LogMessageUseCase
 */

import Message from '../../../core/entities/domain/Message.entity.js';
import { ForwardingStatus } from '../../../shared/constants/index.js';

/**
 * Log Message Use Case
 * 
 * @class LogMessageUseCase
 */
class LogMessageUseCase {
  /**
   * Message repository
   * @private
   */
  #messageRepository;

  /**
   * Creates use case
   * @param {MessageRepository} messageRepository - Message repository
   */
  constructor(messageRepository) {
    this.#messageRepository = messageRepository;
  }

  /**
   * Executes use case
   * @param {Object} data - Message data
   * @returns {Promise<Object>} Result
   */
  async execute(data) {
    // Validate input
    if (!data.channelId) {
      throw new Error('Channel ID is required');
    }
    if (!data.messageId) {
      throw new Error('Message ID is required');
    }
    if (!data.userId) {
      throw new Error('User ID is required');
    }

    // Create message entity
    const message = new Message({
      channelId: data.channelId,
      messageId: data.messageId,
      userId: data.userId,
      forwardedMessageId: data.forwardedMessageId || null,
      status: data.status || ForwardingStatus.SUCCESS,
      errorMessage: data.errorMessage || null,
      sessionPhone: data.sessionPhone || null,
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Persist message
    const created = await this.#messageRepository.create(message);

    return {
      success: true,
      message: created
    };
  }
}

export default LogMessageUseCase;
