/**
 * @fileoverview ChannelLog Domain Entity
 * Domain entity representing a Telegram channel admin log event
 * @module core/entities/domain/ChannelLog
 */

import BaseEntity from '../../base/BaseEntity.js';

/**
 * ChannelLog Entity
 * Represents an admin log event from a Telegram channel
 * 
 * @class ChannelLog
 * @extends BaseEntity
 */
class ChannelLog extends BaseEntity {
  /**
   * Log event ID (from Telegram)
   * @type {string}
   */
  id;

  /**
   * Channel database ID
   * @type {number}
   */
  channelId;

  /**
   * Event date (Unix timestamp)
   * @type {number}
   */
  date;

  /**
   * User ID who performed the action
   * @type {string}
   */
  userId;

  /**
   * Action details (JSON object)
   * @type {Object}
   */
  action;

  /**
   * When this log was stored in our database
   * @type {Date}
   */
  createdAt;

  /**
   * Creates a ChannelLog entity
   * @param {Object} data - ChannelLog data
   * @param {string} data.id - Log event ID
   * @param {number} data.channelId - Channel database ID
   * @param {number} data.date - Event date (Unix timestamp)
   * @param {string} data.userId - User ID
   * @param {Object} data.action - Action details
   * @param {Date} [data.createdAt] - Created timestamp
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.id = data.id;
    this.channelId = data.channelId;
    this.date = data.date;
    this.userId = data.userId;
    this.action = data.action;
    this.createdAt = data.createdAt || new Date();
  }

  /**
   * Validates channel log data
   * @param {Object} data - ChannelLog data
   * @throws {Error} If validation fails
   */
  validate(data) {
    if (!data.id) {
      throw new Error('Log event ID is required');
    }

    if (!data.channelId || typeof data.channelId !== 'number') {
      throw new Error('Channel ID is required and must be a number');
    }

    if (!data.date || typeof data.date !== 'number') {
      throw new Error('Event date is required and must be a Unix timestamp');
    }

    if (!data.userId) {
      throw new Error('User ID is required');
    }

    if (!data.action || typeof data.action !== 'object') {
      throw new Error('Action is required and must be an object');
    }
  }

  /**
   * Gets the action type
   * @returns {string} Action type name
   */
  getActionType() {
    return this.action?._?.split('.').pop() || 'Unknown';
  }

  /**
   * Checks if this is a participant join event
   * @returns {boolean} True if join event
   */
  isParticipantJoin() {
    return this.getActionType() === 'ChannelAdminLogEventActionParticipantJoin';
  }

  /**
   * Checks if this is a participant leave event
   * @returns {boolean} True if leave event
   */
  isParticipantLeave() {
    return this.getActionType() === 'ChannelAdminLogEventActionParticipantLeave';
  }

  /**
   * Checks if this is a participant invite event
   * @returns {boolean} True if invite event
   */
  isParticipantInvite() {
    return this.getActionType() === 'ChannelAdminLogEventActionParticipantInvite';
  }

  /**
   * Gets event date as JavaScript Date
   * @returns {Date} Event date
   */
  getEventDate() {
    return new Date(this.date * 1000);
  }

  /**
   * Converts entity to plain object for database
   * @returns {Object} Plain object
   */
  toObject() {
    return {
      id: this.id,
      channel_id: this.channelId,
      date: this.date,
      user_id: this.userId,
      action: JSON.stringify(this.action),
      created_at: this.createdAt.toISOString(),
    };
  }

  /**
   * Creates entity from database row
   * @static
   * @param {Object} row - Database row
   * @returns {ChannelLog} ChannelLog entity
   */
  static fromDatabaseRow(row) {
    return new ChannelLog({
      id: row.id?.toString() || row.id,
      channelId: row.channel_id || row.channelId,
      date: row.date,
      userId: row.user_id?.toString() || row.userId,
      action: typeof row.action === 'string' ? JSON.parse(row.action) : row.action,
      createdAt: row.created_at || row.createdAt ? new Date(row.created_at || row.createdAt) : new Date(),
    });
  }

  /**
   * Creates entity from Telegram log event
   * @static
   * @param {Object} telegramEvent - Telegram admin log event
   * @param {number} channelDbId - Channel database ID
   * @returns {ChannelLog} ChannelLog entity
   */
  static fromTelegramEvent(telegramEvent, channelDbId) {
    return new ChannelLog({
      id: telegramEvent.id.toString(),
      channelId: channelDbId,
      date: telegramEvent.date,
      userId: telegramEvent.userId.toString(),
      action: {
        _: telegramEvent.action.className || telegramEvent.action.constructor.name,
        ...telegramEvent.action,
      },
    });
  }
}

export default ChannelLog;
