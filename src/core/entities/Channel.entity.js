/**
 * @fileoverview Channel Entity
 * Domain entity representing a Telegram channel
 * @module core/entities/Channel
 */

import BaseEntity from '../base/BaseEntity.js';

/**
 * Channel Entity
 * Represents a Telegram channel with forwarding capabilities
 * 
 * @class Channel
 * @extends BaseEntity
 */
class Channel extends BaseEntity {
  /**
   * Channel ID (Telegram channel ID)
   * @type {string}
   */
  channelId;

  /**
   * Channel title
   * @type {string}
   */
  title;

  /**
   * Forward enabled flag
   * @type {boolean}
   */
  forwardEnabled;

  /**
   * Admin session phone number
   * @type {string|null}
   */
  adminSessionPhone;

  /**
   * Member count
   * @type {number}
   */
  memberCount;

  /**
   * Creates a Channel entity
   * @param {Object} data - Channel data
   * @param {string} data.channelId - Channel ID
   * @param {string} data.title - Channel title
   * @param {boolean} [data.forwardEnabled=true] - Forward enabled
   * @param {string} [data.adminSessionPhone] - Admin session phone
   * @param {number} [data.memberCount=0] - Member count
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.channelId = data.channelId;
    this.title = data.title;
    this.forwardEnabled = data.forwardEnabled !== undefined ? data.forwardEnabled : true;
    this.adminSessionPhone = data.adminSessionPhone || null;
    this.memberCount = data.memberCount || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validates channel data
   * @param {Object} data - Channel data
   * @throws {Error} If validation fails
   */
  validate(data) {
    if (!data.channelId || typeof data.channelId !== 'string') {
      throw new Error('Channel ID is required and must be a string');
    }

    if (!data.title || typeof data.title !== 'string') {
      throw new Error('Channel title is required and must be a string');
    }

    if (data.title.length > 200) {
      throw new Error('Channel title must not exceed 200 characters');
    }

    if (data.forwardEnabled !== undefined && typeof data.forwardEnabled !== 'boolean') {
      throw new Error('forwardEnabled must be a boolean');
    }

    if (data.adminSessionPhone && typeof data.adminSessionPhone !== 'string') {
      throw new Error('adminSessionPhone must be a string');
    }
  }

  /**
   * Enables message forwarding
   * @returns {Channel} This channel (for chaining)
   */
  enableForwarding() {
    this.forwardEnabled = true;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Disables message forwarding
   * @returns {Channel} This channel (for chaining)
   */
  disableForwarding() {
    this.forwardEnabled = false;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Toggles forwarding status
   * @returns {Channel} This channel (for chaining)
   */
  toggleForwarding() {
    this.forwardEnabled = !this.forwardEnabled;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Links channel to admin session
   * @param {string} phone - Phone number
   * @returns {Channel} This channel (for chaining)
   */
  linkToSession(phone) {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Phone number is required');
    }
    this.adminSessionPhone = phone;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Updates channel title
   * @param {string} title - New title
   * @returns {Channel} This channel (for chaining)
   */
  updateTitle(title) {
    if (!title || typeof title !== 'string') {
      throw new Error('Title is required');
    }
    if (title.length > 200) {
      throw new Error('Title must not exceed 200 characters');
    }
    this.title = title;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Updates member count
   * @param {number} count - Member count
   * @returns {Channel} This channel (for chaining)
   */
  updateMemberCount(count) {
    if (typeof count !== 'number' || count < 0) {
      throw new Error('Member count must be a positive number');
    }
    this.memberCount = count;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Checks if forwarding is enabled
   * @returns {boolean} True if enabled
   */
  isForwardingEnabled() {
    return this.forwardEnabled === true;
  }

  /**
   * Checks if channel has admin session
   * @returns {boolean} True if has admin session
   */
  hasAdminSession() {
    return this.adminSessionPhone !== null;
  }

  /**
   * Converts entity to plain object for database
   * @returns {Object} Plain object
   */
  toObject() {
    return {
      channel_id: this.channelId,
      title: this.title,
      forward_enabled: this.forwardEnabled ? 1 : 0,
      admin_session_phone: this.adminSessionPhone,
      member_count: this.memberCount,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
    };
  }

  /**
   * Creates entity from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Channel} Channel entity
   */
  static fromDatabaseRow(row) {
    return new Channel({
      channelId: row.channel_id,
      title: row.title,
      forwardEnabled: Boolean(row.forward_enabled),
      adminSessionPhone: row.admin_session_phone || null,
      memberCount: row.member_count || 0,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
    });
  }

  /**
   * Creates entity from Telegram entity
   * @static
   * @param {Object} telegramEntity - Telegram channel entity
   * @returns {Channel} Channel entity
   */
  static fromTelegramEntity(telegramEntity) {
    return new Channel({
      channelId: telegramEntity.id?.toString() || telegramEntity.channelId,
      title: telegramEntity.title || 'Unknown Channel',
      forwardEnabled: true,
      memberCount: telegramEntity.participantsCount || 0
    });
  }
}

export default Channel;
