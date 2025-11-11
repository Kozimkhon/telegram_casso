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
   * Database ID
   * @type {number|null}
   */
  id;

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
   * Channel username
   * @type {string|null}
   */
  username;

  /**
   * Member count
   * @type {number}
   */
  memberCount;

  /**
   * Forward enabled flag
   * @type {boolean}
   */
  forwardEnabled;

  /**
   * Throttle delay (ms)
   * @type {number}
   */
  throttleDelayMs;

  /**
   * Throttle per member delay (ms)
   * @type {number}
   */
  throttlePerMemberMs;

  /**
   * Minimum delay (ms)
   * @type {number}
   */
  minDelayMs;

  /**
   * Maximum delay (ms)
   * @type {number}
   */
  maxDelayMs;

  /**
   * Schedule enabled flag
   * @type {boolean}
   */
  scheduleEnabled;

  /**
   * Schedule config (JSON string)
   * @type {string|null}
   */
  scheduleConfig;

  /**
   * Admin session phone number
   * @type {string|null}
   */
  adminSessionPhone;

  /**
   * Admin user ID
   * @type {string|null}
   */
  adminUserId;

  /**
   * Creates a Channel entity
   * @param {Object} data - Channel data
   * @param {string} data.channelId - Channel ID
   * @param {string} data.title - Channel title
   * @param {string} [data.username] - Channel username
   * @param {number} [data.memberCount=0] - Member count
   * @param {boolean} [data.forwardEnabled=true] - Forward enabled
   * @param {number} [data.throttleDelayMs=1000] - Throttle delay
   * @param {number} [data.throttlePerMemberMs=500] - Throttle per member
   * @param {number} [data.minDelayMs=2000] - Min delay
   * @param {number} [data.maxDelayMs=5000] - Max delay
   * @param {boolean} [data.scheduleEnabled=false] - Schedule enabled
   * @param {string} [data.scheduleConfig] - Schedule config
   * @param {string} [data.adminSessionPhone] - Admin session phone
   * @param {string} [data.adminUserId] - Admin user ID
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.id = data.id || null;
    this.channelId = data.channelId;
    this.title = data.title;
    this.username = data.username || null;
    this.memberCount = data.memberCount || 0;
    this.forwardEnabled = data.forwardEnabled !== undefined ? data.forwardEnabled : true;
    this.throttleDelayMs = data.throttleDelayMs || 1000;
    this.throttlePerMemberMs = data.throttlePerMemberMs || 500;
    this.minDelayMs = data.minDelayMs || 2000;
    this.maxDelayMs = data.maxDelayMs || 5000;
    this.scheduleEnabled = data.scheduleEnabled || false;
    this.scheduleConfig = data.scheduleConfig || null;
    this.adminSessionPhone = data.adminSessionPhone || null;
    this.adminUserId = data.adminUserId || null;
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
      id: this.id,
      channel_id: this.channelId,
      title: this.title,
      username: this.username,
      member_count: this.memberCount,
      forward_enabled: this.forwardEnabled ? 1 : 0,
      throttle_delay_ms: this.throttleDelayMs,
      throttle_per_member_ms: this.throttlePerMemberMs,
      min_delay_ms: this.minDelayMs,
      max_delay_ms: this.maxDelayMs,
      schedule_enabled: this.scheduleEnabled ? 1 : 0,
      schedule_config: this.scheduleConfig,
      admin_session_phone: this.adminSessionPhone,
      admin_user_id: this.adminUserId,
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
      id: row.id,
      channelId: row.channel_id || row.channelId,
      title: row.title,
      username: row.username || null,
      memberCount: row.member_count || row.memberCount || 0,
      forwardEnabled: Boolean(row.forward_enabled || row.forwardEnabled),
      throttleDelayMs: row.throttle_delay_ms || row.throttleDelayMs || 1000,
      throttlePerMemberMs: row.throttle_per_member_ms || row.throttlePerMemberMs || 500,
      minDelayMs: row.min_delay_ms || row.minDelayMs || 2000,
      maxDelayMs: row.max_delay_ms || row.maxDelayMs || 5000,
      scheduleEnabled: Boolean(row.schedule_enabled || row.scheduleEnabled),
      scheduleConfig: row.schedule_config || row.scheduleConfig || null,
      adminSessionPhone: row.admin_session_phone || row.adminSessionPhone || null,
      adminUserId: row.admin_user_id || row.adminUserId || null,
      createdAt: row.created_at || row.createdAt ? new Date(row.created_at || row.createdAt) : new Date(),
      updatedAt: row.updated_at || row.updatedAt ? new Date(row.updated_at || row.updatedAt) : new Date()
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
