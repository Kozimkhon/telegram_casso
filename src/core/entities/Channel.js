/**
 * Channel Entity
 * Represents a Telegram channel with business logic and validation
 * 
 * @module core/entities/Channel
 */

import { ValidationRules } from '../../shared/constants/index.js';

/**
 * @class Channel
 * @description Domain entity representing a Telegram channel
 * Encapsulates channel data with validation and business rules
 */
export class Channel {
  /**
   * Creates a new Channel instance
   * @param {Object} data - Channel data
   * @param {string} data.channelId - Unique channel identifier
   * @param {string} data.title - Channel title
   * @param {boolean} [data.forwardEnabled=true] - Whether forwarding is enabled
   * @param {string} [data.adminSessionPhone] - Admin session phone
   * @param {number} [data.throttleDelayMs=1000] - Throttle delay
   * @param {number} [data.throttlePerMemberMs=500] - Per-member throttle
   * @param {number} [data.minDelayMs=2000] - Minimum delay
   * @param {number} [data.maxDelayMs=5000] - Maximum delay
   * @param {boolean} [data.scheduleEnabled=false] - Schedule enabled
   * @param {string} [data.scheduleConfig] - Schedule config JSON
   * @param {Date} [data.createdAt] - Creation date
   * @param {Date} [data.updatedAt] - Update date
   * @throws {Error} If validation fails
   */
  constructor(data) {
    this.validate(data);

    this.channelId = data.channelId;
    this.title = data.title;
    this.forwardEnabled = data.forwardEnabled !== undefined ? data.forwardEnabled : true;
    this.adminSessionPhone = data.adminSessionPhone || null;
    this.throttleDelayMs = data.throttleDelayMs || 1000;
    this.throttlePerMemberMs = data.throttlePerMemberMs || 500;
    this.minDelayMs = data.minDelayMs || 2000;
    this.maxDelayMs = data.maxDelayMs || 5000;
    this.scheduleEnabled = data.scheduleEnabled || false;
    this.scheduleConfig = data.scheduleConfig || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validates channel data
   * @param {Object} data - Data to validate
   * @throws {Error} If validation fails
   * @private
   */
  validate(data) {
    const errors = [];

    // Validate channel ID
    if (!data.channelId || typeof data.channelId !== 'string') {
      errors.push('Channel ID is required and must be a string');
    } else if (!ValidationRules.CHANNEL_ID_PATTERN.test(data.channelId)) {
      errors.push('Channel ID must match pattern: numeric or negative numeric');
    }

    // Validate title
    if (!data.title || typeof data.title !== 'string') {
      errors.push('Title is required and must be a string');
    } else if (data.title.length > ValidationRules.MAX_TITLE_LENGTH) {
      errors.push(`Title must be ${ValidationRules.MAX_TITLE_LENGTH} characters or less`);
    }

    // Validate throttle values
    if (data.throttleDelayMs !== undefined && (typeof data.throttleDelayMs !== 'number' || data.throttleDelayMs < 0)) {
      errors.push('Throttle delay must be a non-negative number');
    }

    if (data.throttlePerMemberMs !== undefined && (typeof data.throttlePerMemberMs !== 'number' || data.throttlePerMemberMs < 0)) {
      errors.push('Per-member throttle must be a non-negative number');
    }

    // Validate delay ranges
    if (data.minDelayMs !== undefined && data.maxDelayMs !== undefined) {
      if (data.minDelayMs > data.maxDelayMs) {
        errors.push('Minimum delay cannot be greater than maximum delay');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Channel validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Enables message forwarding for this channel
   * @returns {Channel} This channel for chaining
   */
  enableForwarding() {
    this.forwardEnabled = true;
    this.touch();
    return this;
  }

  /**
   * Disables message forwarding for this channel
   * @returns {Channel} This channel for chaining
   */
  disableForwarding() {
    this.forwardEnabled = false;
    this.touch();
    return this;
  }

  /**
   * Toggles message forwarding status
   * @returns {boolean} New forwarding status
   */
  toggleForwarding() {
    this.forwardEnabled = !this.forwardEnabled;
    this.touch();
    return this.forwardEnabled;
  }

  /**
   * Updates channel title
   * @param {string} newTitle - New title
   * @throws {Error} If title is invalid
   * @returns {Channel} This channel for chaining
   */
  updateTitle(newTitle) {
    if (!newTitle || typeof newTitle !== 'string') {
      throw new Error('Title must be a non-empty string');
    }
    if (newTitle.length > ValidationRules.MAX_TITLE_LENGTH) {
      throw new Error(`Title must be ${ValidationRules.MAX_TITLE_LENGTH} characters or less`);
    }
    this.title = newTitle;
    this.touch();
    return this;
  }

  /**
   * Links this channel to an admin session
   * @param {string} phone - Admin session phone number
   * @returns {Channel} This channel for chaining
   */
  linkToSession(phone) {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Phone must be a non-empty string');
    }
    this.adminSessionPhone = phone;
    this.touch();
    return this;
  }

  /**
   * Unlinks this channel from admin session
   * @returns {Channel} This channel for chaining
   */
  unlinkFromSession() {
    this.adminSessionPhone = null;
    this.touch();
    return this;
  }

  /**
   * Checks if channel is managed by a specific session
   * @param {string} phone - Session phone to check
   * @returns {boolean} True if managed by this session
   */
  isManagedBy(phone) {
    return this.adminSessionPhone === phone;
  }

  /**
   * Updates throttle settings
   * @param {Object} settings - Throttle settings
   * @param {number} [settings.throttleDelayMs] - Throttle delay
   * @param {number} [settings.throttlePerMemberMs] - Per-member throttle
   * @param {number} [settings.minDelayMs] - Minimum delay
   * @param {number} [settings.maxDelayMs] - Maximum delay
   * @returns {Channel} This channel for chaining
   */
  updateThrottleSettings(settings) {
    if (settings.throttleDelayMs !== undefined) {
      this.throttleDelayMs = settings.throttleDelayMs;
    }
    if (settings.throttlePerMemberMs !== undefined) {
      this.throttlePerMemberMs = settings.throttlePerMemberMs;
    }
    if (settings.minDelayMs !== undefined) {
      this.minDelayMs = settings.minDelayMs;
    }
    if (settings.maxDelayMs !== undefined) {
      this.maxDelayMs = settings.maxDelayMs;
    }
    this.touch();
    return this;
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
      title: this.title,
      forwardEnabled: this.forwardEnabled,
      adminSessionPhone: this.adminSessionPhone,
      throttleDelayMs: this.throttleDelayMs,
      throttlePerMemberMs: this.throttlePerMemberMs,
      minDelayMs: this.minDelayMs,
      maxDelayMs: this.maxDelayMs,
      scheduleEnabled: this.scheduleEnabled,
      scheduleConfig: this.scheduleConfig,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Creates a Channel instance from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Channel} Channel instance
   */
  static fromDatabaseRow(row) {
    return new Channel({
      channelId: row.channel_id,
      title: row.title,
      forwardEnabled: Boolean(row.forward_enabled),
      adminSessionPhone: row.admin_session_phone,
      throttleDelayMs: row.throttle_delay_ms,
      throttlePerMemberMs: row.throttle_per_member_ms,
      minDelayMs: row.min_delay_ms,
      maxDelayMs: row.max_delay_ms,
      scheduleEnabled: Boolean(row.schedule_enabled),
      scheduleConfig: row.schedule_config,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
    });
  }

  /**
   * Creates Channel instances from multiple database rows
   * @static
   * @param {Array<Object>} rows - Database rows
   * @returns {Array<Channel>} Array of Channel instances
   */
  static fromDatabaseRows(rows) {
    return rows.map(row => Channel.fromDatabaseRow(row));
  }
}

export default Channel;
