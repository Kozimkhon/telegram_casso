/**
 * @fileoverview Message Entity
 * Domain entity representing a forwarded message
 * @module core/entities/Message
 */

import BaseEntity from '../../base/BaseEntity.js';
import { ForwardingStatus } from '../../../shared/constants/index.js';

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
   * Message ID (original from channel)
   * @type {string}
   */
  messageId;

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
   * Retry count
   * @type {number}
   */
  retryCount;

  /**
   * Grouped ID (for albums/media groups)
   * @type {string|null}
   */
  groupedId;

  /**
   * Is grouped message flag
   * @type {boolean}
   */
  isGrouped;

  /**
   * Channel ID (foreign key)
   * @type {string}
   */
  channelId;

  /**
   * User ID (recipient, foreign key)
   * @type {string}
   */
  userId;

  /**
   * Creates a Message entity
   * @param {Object} data - Message data
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.id = data.id || null;
    this.messageId = data.messageId;
    this.forwardedMessageId = data.forwardedMessageId || null;
    this.status = data.status || ForwardingStatus.PENDING;
    this.errorMessage = data.errorMessage || null;
    this.retryCount = data.retryCount || 0;
    this.groupedId = data.groupedId || null;
    this.isGrouped = data.isGrouped || false;
    this.channelId = data.channelId;
    this.userId = data.userId;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validates message data
   * @param {Object} data - Message data
   * @throws {Error} If validation fails
   */
  validate(data) {
    if (!data.messageId) {
      throw new Error('Message ID is required');
    }

    if (!data.channelId) {
      throw new Error('Channel ID is required');
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
   * Checks if message is part of a group (album)
   * @returns {boolean} True if grouped
   */
  isGroupedMessage() {
    return this.isGrouped && this.groupedId !== null;
  }

  /**
   * Converts entity to plain object for database
   * @returns {Object} Plain object
   */
  toObject() {
    return {
      id: this.id,
      message_id: this.messageId,
      forwarded_message_id: this.forwardedMessageId,
      status: this.status,
      error_message: this.errorMessage,
      retry_count: this.retryCount,
      grouped_id: this.groupedId,
      is_grouped: this.isGrouped,
      channel_id: this.channelId,
      user_id: this.userId,
      created_at: this.createdAt instanceof Date ? this.createdAt.toISOString() : this.createdAt,
      updated_at: this.updatedAt instanceof Date ? this.updatedAt.toISOString() : this.updatedAt
    };
  }

  /**
   * Creates entity from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Message} Message entity
   */
  static fromDatabaseRow(row) {
    // Ensure valid status or use default
    const validStatuses = Object.values(ForwardingStatus);
    const status = validStatuses.includes(row.status) 
      ? row.status 
      : ForwardingStatus.PENDING;
    
    return new Message({
      id: row.id,
      messageId: row.message_id || row.messageId,
      forwardedMessageId: row.forwarded_message_id || row.forwardedMessageId,
      status: status,
      errorMessage: row.error_message || row.errorMessage,
      retryCount: row.retry_count || row.retryCount || 0,
      groupedId: row.grouped_id || row.groupedId || null,
      isGrouped: row.is_grouped || row.isGrouped || false,
      channelId: row.channel_id || row.channelId,
      userId: row.user_id || row.userId,
      createdAt: row.created_at || row.createdAt ? new Date(row.created_at || row.createdAt) : new Date(),
      updatedAt: row.updated_at || row.updatedAt ? new Date(row.updated_at || row.updatedAt) : new Date()
    });
  }
}

export default Message;
