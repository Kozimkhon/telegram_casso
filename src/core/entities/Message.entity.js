/**
 * @fileoverview Message Entity
 * Domain entity representing a forwarded message
 * @module core/entities/Message
 */

import BaseEntity from '../base/BaseEntity.js';
import { ForwardingStatus } from '../../shared/constants/index.js';

/**
 * Message Entity
 * Represents a forwarded message with tracking
 * 
 * @class Message
 * @extends BaseEntity
 */
class Message extends BaseEntity {
  /**
   * Message log ID
   * @type {number|null}
   */
  id;

  /**
   * Channel ID
   * @type {string}
   */
  channelId;

  /**
   * Original message ID
   * @type {string}
   */
  messageId;

  /**
   * User ID (recipient)
   * @type {string}
   */
  userId;

  /**
   * Forwarded message ID
   * @type {string|null}
   */
  forwardedMessageId;

  /**
   * Status
   * @type {string}
   */
  status;

  /**
   * Error message
   * @type {string|null}
   */
  errorMessage;

  /**
   * Session phone
   * @type {string|null}
   */
  sessionPhone;

  /**
   * Retry count
   * @type {number}
   */
  retryCount;

  /**
   * Creates a Message entity
   * @param {Object} data - Message data
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.id = data.id || null;
    this.channelId = data.channelId;
    this.messageId = data.messageId;
    this.userId = data.userId;
    this.forwardedMessageId = data.forwardedMessageId || null;
    this.status = data.status || ForwardingStatus.PENDING;
    this.errorMessage = data.errorMessage || null;
    this.sessionPhone = data.sessionPhone || null;
    this.retryCount = data.retryCount || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validates message data
   * @param {Object} data - Message data
   * @throws {Error} If validation fails
   */
  validate(data) {
    if (!data.channelId) {
      throw new Error('Channel ID is required');
    }

    if (!data.messageId) {
      throw new Error('Message ID is required');
    }

    if (!data.userId) {
      throw new Error('User ID is required');
    }

    if (data.status && !Object.values(ForwardingStatus).includes(data.status)) {
      throw new Error(`Invalid status. Must be one of: ${Object.values(ForwardingStatus).join(', ')}`);
    }
  }

  /**
   * Marks message as success
   * @param {string} forwardedMessageId - Forwarded message ID
   * @returns {Message} This message (for chaining)
   */
  markSuccess(forwardedMessageId) {
    this.status = ForwardingStatus.SUCCESS;
    this.forwardedMessageId = forwardedMessageId;
    this.errorMessage = null;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Marks message as failed
   * @param {string} error - Error message
   * @returns {Message} This message (for chaining)
   */
  markFailed(error) {
    this.status = ForwardingStatus.FAILED;
    this.errorMessage = error;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Marks message as skipped
   * @param {string} reason - Skip reason
   * @returns {Message} This message (for chaining)
   */
  markSkipped(reason) {
    this.status = ForwardingStatus.SKIPPED;
    this.errorMessage = reason;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Increments retry count
   * @returns {Message} This message (for chaining)
   */
  incrementRetry() {
    this.retryCount += 1;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Marks message as deleted
   * @returns {Message} This message (for chaining)
   */
  markDeleted() {
    this.forwardedMessageId = null;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Checks if message was successful
   * @returns {boolean} True if successful
   */
  isSuccessful() {
    return this.status === ForwardingStatus.SUCCESS;
  }

  /**
   * Checks if message failed
   * @returns {boolean} True if failed
   */
  isFailed() {
    return this.status === ForwardingStatus.FAILED;
  }

  /**
   * Checks if message was skipped
   * @returns {boolean} True if skipped
   */
  isSkipped() {
    return this.status === ForwardingStatus.SKIPPED;
  }

  /**
   * Converts entity to plain object for database
   * @returns {Object} Plain object
   */
  toObject() {
    return {
      id: this.id,
      channel_id: this.channelId,
      message_id: this.messageId,
      user_id: this.userId,
      forwarded_message_id: this.forwardedMessageId,
      status: this.status,
      error_message: this.errorMessage,
      session_phone: this.sessionPhone,
      retry_count: this.retryCount,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
    };
  }

  /**
   * Creates entity from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Message} Message entity
   */
  static fromDatabaseRow(row) {
    return new Message({
      id: row.id,
      channelId: row.channel_id,
      messageId: row.message_id,
      userId: row.user_id,
      forwardedMessageId: row.forwarded_message_id,
      status: row.status,
      errorMessage: row.error_message,
      sessionPhone: row.session_phone,
      retryCount: row.retry_count || 0,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
    });
  }
}

export default Message;
