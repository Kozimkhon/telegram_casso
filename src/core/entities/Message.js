/**
 * Message Entity
 * Represents a forwarded message with status tracking
 * 
 * @module core/entities/Message
 */

import { MessageStatus, RateLimits } from '../../shared/constants/index.js';

/**
 * @class Message
 * @description Domain entity representing a forwarded message
 * Tracks message forwarding status and retry logic
 */
export class Message {
  /**
   * Creates a new Message instance
   * @param {Object} data - Message data
   * @param {string} data.channelId - Source channel ID
   * @param {string} data.messageId - Original message ID
   * @param {string} data.userId - Recipient user ID
   * @param {string} [data.sessionPhone] - Session phone that forwarded
   * @param {string} [data.forwardedMessageId] - Forwarded message ID
   * @param {string} [data.status] - Message status
   * @param {string} [data.errorMessage] - Error message
   * @param {number} [data.retryCount] - Retry count
   * @param {Date} [data.createdAt] - Creation date
   * @param {Date} [data.updatedAt] - Update date
   * @throws {Error} If validation fails
   */
  constructor(data) {
    this.validate(data);

    this.channelId = data.channelId;
    this.messageId = data.messageId;
    this.userId = data.userId;
    this.sessionPhone = data.sessionPhone || null;
    this.forwardedMessageId = data.forwardedMessageId || null;
    this.status = data.status || MessageStatus.PENDING;
    this.errorMessage = data.errorMessage || null;
    this.retryCount = data.retryCount || 0;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  /**
   * Validates message data
   * @param {Object} data - Data to validate
   * @throws {Error} If validation fails
   * @private
   */
  validate(data) {
    const errors = [];

    if (!data.channelId) errors.push('Channel ID is required');
    if (!data.messageId) errors.push('Message ID is required');
    if (!data.userId) errors.push('User ID is required');

    if (data.status && !Object.values(MessageStatus).includes(data.status)) {
      errors.push(`Invalid status. Must be one of: ${Object.values(MessageStatus).join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`Message validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Checks if message is pending
   * @returns {boolean} True if pending
   */
  isPending() {
    return this.status === MessageStatus.PENDING;
  }

  /**
   * Checks if message was sent successfully
   * @returns {boolean} True if sent
   */
  isSent() {
    return this.status === MessageStatus.SENT;
  }

  /**
   * Checks if message failed
   * @returns {boolean} True if failed
   */
  isFailed() {
    return this.status === MessageStatus.FAILED;
  }

  /**
   * Checks if message is being retried
   * @returns {boolean} True if retrying
   */
  isRetrying() {
    return this.status === MessageStatus.RETRYING;
  }

  /**
   * Checks if message can be retried
   * @returns {boolean} True if can retry
   */
  canRetry() {
    return this.retryCount < RateLimits.MAX_RETRY_ATTEMPTS && 
           (this.isFailed() || this.isRetrying());
  }

  /**
   * Marks message as sent
   * @param {string} forwardedMessageId - ID of forwarded message
   * @returns {Message} This message for chaining
   */
  markAsSent(forwardedMessageId) {
    this.status = MessageStatus.SENT;
    this.forwardedMessageId = forwardedMessageId;
    this.errorMessage = null;
    this.touch();
    return this;
  }

  /**
   * Marks message as failed
   * @param {string} error - Error message
   * @returns {Message} This message for chaining
   */
  markAsFailed(error) {
    this.status = MessageStatus.FAILED;
    this.errorMessage = error;
    this.touch();
    return this;
  }

  /**
   * Marks message as retrying
   * @returns {Message} This message for chaining
   */
  markAsRetrying() {
    this.status = MessageStatus.RETRYING;
    this.retryCount++;
    this.touch();
    return this;
  }

  /**
   * Marks message as deleted
   * @returns {Message} This message for chaining
   */
  markAsDeleted() {
    this.status = MessageStatus.DELETED;
    this.touch();
    return this;
  }

  /**
   * Gets message age in hours
   * @returns {number} Age in hours
   */
  getAgeInHours() {
    return (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Checks if message is old enough to delete
   * @param {number} maxAgeHours - Maximum age in hours
   * @returns {boolean} True if should be deleted
   */
  shouldDelete(maxAgeHours) {
    return this.isSent() && this.getAgeInHours() >= maxAgeHours;
  }

  /**
   * Updates the updatedAt timestamp
   * @private
   */
  touch() {
    this.updatedAt = new Date();
  }

  /**
   * Converts entity to plain object for database storage
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      channelId: this.channelId,
      messageId: this.messageId,
      userId: this.userId,
      sessionPhone: this.sessionPhone,
      forwardedMessageId: this.forwardedMessageId,
      status: this.status,
      errorMessage: this.errorMessage,
      retryCount: this.retryCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Creates a Message instance from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Message} Message instance
   */
  static fromDatabaseRow(row) {
    return new Message({
      channelId: row.channel_id,
      messageId: row.message_id,
      userId: row.user_id,
      sessionPhone: row.session_phone,
      forwardedMessageId: row.forwarded_message_id,
      status: row.status,
      errorMessage: row.error_message,
      retryCount: row.retry_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  /**
   * Creates Message instances from multiple database rows
   * @static
   * @param {Array<Object>} rows - Database rows
   * @returns {Array<Message>} Array of Message instances
   */
  static fromDatabaseRows(rows) {
    return rows.map(row => Message.fromDatabaseRow(row));
  }
}

export default Message;
