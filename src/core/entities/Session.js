/**
 * Session Entity
 * Represents a UserBot session with business logic and validation
 * 
 * @module core/entities/Session
 */

import { SessionStatus, ValidationRules } from '../../shared/constants/index.js';

/**
 * @class Session
 * @description Domain entity representing a UserBot session
 * Encapsulates session data with status management and validation
 */
export class Session {
  /**
   * Creates a new Session instance
   * @param {Object} data - Session data
   * @param {string} data.phone - Phone number (unique identifier)
   * @param {string} [data.userId] - Telegram user ID
   * @param {string} [data.sessionString] - Session string
   * @param {string} [data.status] - Session status
   * @param {string} [data.firstName] - First name
   * @param {string} [data.lastName] - Last name
   * @param {string} [data.username] - Username
   * @param {boolean} [data.autoPaused] - Auto-paused flag
   * @param {string} [data.pauseReason] - Pause reason
   * @param {Date} [data.floodWaitUntil] - Flood wait expiry
   * @param {string} [data.lastError] - Last error message
   * @param {Date} [data.lastActive] - Last activity timestamp
   * @param {Date} [data.createdAt] - Creation date
   * @param {Date} [data.updatedAt] - Update date
   * @throws {Error} If validation fails
   */
  constructor(data) {
    this.validate(data);

    this.phone = data.phone;
    this.userId = data.userId || null;
    this.sessionString = data.sessionString || null;
    this.status = data.status || SessionStatus.ACTIVE;
    this.firstName = data.firstName || null;
    this.lastName = data.lastName || null;
    this.username = data.username || null;
    this.autoPaused = data.autoPaused || false;
    this.pauseReason = data.pauseReason || null;
    this.floodWaitUntil = data.floodWaitUntil ? new Date(data.floodWaitUntil) : null;
    this.lastError = data.lastError || null;
    this.lastActive = data.lastActive ? new Date(data.lastActive) : new Date();
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  /**
   * Validates session data
   * @param {Object} data - Data to validate
   * @throws {Error} If validation fails
   * @private
   */
  validate(data) {
    const errors = [];

    // Validate phone
    if (!data.phone || typeof data.phone !== 'string') {
      errors.push('Phone is required and must be a string');
    } else if (data.phone.length < ValidationRules.MIN_PHONE_LENGTH || 
               data.phone.length > ValidationRules.MAX_PHONE_LENGTH) {
      errors.push(`Phone must be between ${ValidationRules.MIN_PHONE_LENGTH} and ${ValidationRules.MAX_PHONE_LENGTH} characters`);
    }

    // Validate status
    if (data.status && !Object.values(SessionStatus).includes(data.status)) {
      errors.push(`Invalid status. Must be one of: ${Object.values(SessionStatus).join(', ')}`);
    }

    // Validate username if provided
    if (data.username && data.username.length > ValidationRules.MAX_USERNAME_LENGTH) {
      errors.push(`Username must be ${ValidationRules.MAX_USERNAME_LENGTH} characters or less`);
    }

    if (errors.length > 0) {
      throw new Error(`Session validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Gets the full name of the user
   * @returns {string} Full name or phone if name not available
   */
  getFullName() {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    if (this.firstName) {
      return this.firstName;
    }
    if (this.lastName) {
      return this.lastName;
    }
    return this.phone;
  }

  /**
   * Gets display name (username or full name)
   * @returns {string} Display name
   */
  getDisplayName() {
    return this.username ? `@${this.username}` : this.getFullName();
  }

  /**
   * Checks if session is active
   * @returns {boolean} True if active
   */
  isActive() {
    return this.status === SessionStatus.ACTIVE;
  }

  /**
   * Checks if session is paused
   * @returns {boolean} True if paused
   */
  isPaused() {
    return this.status === SessionStatus.PAUSED;
  }

  /**
   * Checks if session has error
   * @returns {boolean} True if in error state
   */
  hasError() {
    return this.status === SessionStatus.ERROR;
  }

  /**
   * Checks if session is in flood wait
   * @returns {boolean} True if in flood wait
   */
  isInFloodWait() {
    if (!this.floodWaitUntil) return false;
    return new Date() < this.floodWaitUntil;
  }

  /**
   * Gets remaining flood wait time in seconds
   * @returns {number} Seconds remaining, 0 if not in flood wait
   */
  getFloodWaitRemaining() {
    if (!this.isInFloodWait()) return 0;
    return Math.ceil((this.floodWaitUntil.getTime() - Date.now()) / 1000);
  }

  /**
   * Activates the session
   * @returns {Session} This session for chaining
   */
  activate() {
    this.status = SessionStatus.ACTIVE;
    this.autoPaused = false;
    this.pauseReason = null;
    this.lastError = null;
    this.touch();
    return this;
  }

  /**
   * Pauses the session
   * @param {string} [reason] - Reason for pause
   * @param {boolean} [auto=false] - Whether auto-paused
   * @returns {Session} This session for chaining
   */
  pause(reason = null, auto = false) {
    this.status = SessionStatus.PAUSED;
    this.pauseReason = reason;
    this.autoPaused = auto;
    this.touch();
    return this;
  }

  /**
   * Marks session as error
   * @param {string} error - Error message
   * @returns {Session} This session for chaining
   */
  markError(error) {
    this.status = SessionStatus.ERROR;
    this.lastError = error;
    this.touch();
    return this;
  }

  /**
   * Sets flood wait until timestamp
   * @param {number} seconds - Seconds to wait
   * @returns {Session} This session for chaining
   */
  setFloodWait(seconds) {
    this.floodWaitUntil = new Date(Date.now() + seconds * 1000);
    this.pause(`Flood wait: ${seconds}s`, true);
    return this;
  }

  /**
   * Clears flood wait
   * @returns {Session} This session for chaining
   */
  clearFloodWait() {
    this.floodWaitUntil = null;
    if (this.autoPaused) {
      this.activate();
    }
    return this;
  }

  /**
   * Updates session activity timestamp
   * @returns {Session} This session for chaining
   */
  updateActivity() {
    this.lastActive = new Date();
    this.touch();
    return this;
  }

  /**
   * Updates user information
   * @param {Object} userInfo - User info
   * @param {string} [userInfo.userId] - User ID
   * @param {string} [userInfo.firstName] - First name
   * @param {string} [userInfo.lastName] - Last name
   * @param {string} [userInfo.username] - Username
   * @returns {Session} This session for chaining
   */
  updateUserInfo(userInfo) {
    if (userInfo.userId) this.userId = userInfo.userId;
    if (userInfo.firstName) this.firstName = userInfo.firstName;
    if (userInfo.lastName) this.lastName = userInfo.lastName;
    if (userInfo.username) this.username = userInfo.username;
    this.touch();
    return this;
  }

  /**
   * Checks if session can send messages
   * @returns {boolean} True if can send messages
   */
  canSendMessages() {
    return this.isActive() && !this.isInFloodWait();
  }

  /**
   * Gets session age in days
   * @returns {number} Age in days
   */
  getAgeInDays() {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Gets time since last activity in minutes
   * @returns {number} Minutes since last activity
   */
  getInactiveMinutes() {
    return Math.floor((Date.now() - this.lastActive.getTime()) / (1000 * 60));
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
      phone: this.phone,
      userId: this.userId,
      sessionString: this.sessionString,
      status: this.status,
      firstName: this.firstName,
      lastName: this.lastName,
      username: this.username,
      autoPaused: this.autoPaused,
      pauseReason: this.pauseReason,
      floodWaitUntil: this.floodWaitUntil,
      lastError: this.lastError,
      lastActive: this.lastActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Creates a Session instance from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Session} Session instance
   */
  static fromDatabaseRow(row) {
    return new Session({
      phone: row.phone,
      userId: row.user_id,
      sessionString: row.session_string,
      status: row.status,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      autoPaused: Boolean(row.auto_paused),
      pauseReason: row.pause_reason,
      floodWaitUntil: row.flood_wait_until,
      lastError: row.last_error,
      lastActive: row.last_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  /**
   * Creates Session instances from multiple database rows
   * @static
   * @param {Array<Object>} rows - Database rows
   * @returns {Array<Session>} Array of Session instances
   */
  static fromDatabaseRows(rows) {
    return rows.map(row => Session.fromDatabaseRow(row));
  }
}

export default Session;
