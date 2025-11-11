/**
 * @fileoverview Session Entity
 * Domain entity representing a UserBot session
 * @module core/entities/Session
 */

import BaseEntity from '../base/BaseEntity.js';
import { SessionStatus } from '../../shared/constants/index.js';

/**
 * Session Entity
 * Represents a UserBot session with status tracking
 * 
 * @class Session
 * @extends BaseEntity
 */
class Session extends BaseEntity {
  /**
   * Database ID
   * @type {number|null}
   */
  id;

  /**
   * Admin ID (foreign key to Admin entity, unique one-to-one)
   * @type {string}
   */
  adminId;

  /**
   * Session string (encrypted)
   * @type {string}
   */
  sessionString;

  /**
   * Session status
   * @type {string}
   */
  status;

  /**
   * Auto-paused flag
   * @type {boolean}
   */
  autoPaused;

  /**
   * Pause reason
   * @type {string|null}
   */
  pauseReason;

  /**
   * Flood wait until timestamp
   * @type {Date|null}
   */
  floodWaitUntil;

  /**
   * Last error message
   * @type {string|null}
   */
  lastError;

  /**
   * Last active timestamp
   * @type {Date}
   */
  lastActive;

  /**
   * Creates a Session entity
   * @param {Object} data - Session data
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.id = data.id || null;
    this.adminId = data.adminId;
    this.sessionString = data.sessionString || '';
    this.status = data.status || SessionStatus.ACTIVE;
    this.autoPaused = data.autoPaused || false;
    this.pauseReason = data.pauseReason || null;
    this.floodWaitUntil = data.floodWaitUntil ? new Date(data.floodWaitUntil) : null;
    this.lastError = data.lastError || null;
    this.lastActive = data.lastActive ? new Date(data.lastActive) : new Date();
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validates session data
   * @param {Object} data - Session data
   * @throws {Error} If validation fails
   */
  validate(data) {
    if (!data.adminId || typeof data.adminId !== 'string') {
      throw new Error('Admin ID is required and must be a string');
    }

    if (data.status && !Object.values(SessionStatus).includes(data.status)) {
      throw new Error(`Invalid status. Must be one of: ${Object.values(SessionStatus).join(', ')}`);
    }
  }

  /**
   * Pauses the session
   * @param {string} reason - Pause reason
   * @returns {Session} This session (for chaining)
   */
  pause(reason = 'Manual pause') {
    this.status = SessionStatus.PAUSED;
    this.pauseReason = reason;
    this.autoPaused = false;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Auto-pauses the session (by system)
   * @param {string} reason - Pause reason
   * @param {Date} [floodWaitUntil] - Flood wait expiration
   * @returns {Session} This session (for chaining)
   */
  autoPause(reason, floodWaitUntil = null) {
    this.status = SessionStatus.PAUSED;
    this.pauseReason = reason;
    this.autoPaused = true;
    this.floodWaitUntil = floodWaitUntil;
    this.lastError = reason;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Resumes the session
   * @returns {Session} This session (for chaining)
   */
  resume() {
    this.status = SessionStatus.ACTIVE;
    this.pauseReason = null;
    this.autoPaused = false;
    this.floodWaitUntil = null;
    this.lastError = null;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Marks session as error
   * @param {string} error - Error message
   * @returns {Session} This session (for chaining)
   */
  markError(error) {
    this.status = SessionStatus.ERROR;
    this.lastError = error;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Activates the session
   * @returns {Session} This session (for chaining)
   */
  activate() {
    this.status = SessionStatus.ACTIVE;
    this.lastActive = new Date();
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Updates activity timestamp
   * @returns {Session} This session (for chaining)
   */
  updateActivity() {
    this.lastActive = new Date();
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Sets flood wait
   * @param {number} seconds - Flood wait seconds
   * @returns {Session} This session (for chaining)
   */
  setFloodWait(seconds) {
    const waitUntil = new Date(Date.now() + seconds * 1000);
    this.autoPause(`FloodWait: ${seconds}s`, waitUntil);
    return this;
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
   * @returns {boolean} True if error
   */
  hasError() {
    return this.status === SessionStatus.ERROR;
  }

  /**
   * Checks if flood wait has expired
   * @returns {boolean} True if expired or no flood wait
   */
  isFloodWaitExpired() {
    if (!this.floodWaitUntil) return true;
    return new Date() >= this.floodWaitUntil;
  }

  /**
   * Checks if ready to resume
   * @returns {boolean} True if ready
   */
  isReadyToResume() {
    return this.isPaused() && this.autoPaused && this.isFloodWaitExpired();
  }

  /**
   * Converts entity to plain object for database
   * @returns {Object} Plain object
   */
  toObject() {
    return {
      id: this.id,
      admin_id: this.adminId,
      session_string: this.sessionString,
      status: this.status,
      auto_paused: this.autoPaused ? 1 : 0,
      pause_reason: this.pauseReason,
      flood_wait_until: this.floodWaitUntil ? this.floodWaitUntil.toISOString() : null,
      last_error: this.lastError,
      last_active: this.lastActive.toISOString(),
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
    };
  }

  /**
   * Creates entity from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Session} Session entity
   */
  static fromDatabaseRow(row) {
    return new Session({
      id: row.id,
      adminId: row.admin_id || row.adminId,
      sessionString: row.session_string || row.sessionString,
      status: row.status,
      autoPaused: Boolean(row.auto_paused || row.autoPaused),
      pauseReason: row.pause_reason || row.pauseReason,
      floodWaitUntil: row.flood_wait_until || row.floodWaitUntil,
      lastError: row.last_error || row.lastError,
      lastActive: row.last_active || row.lastActive,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt
    });
  }
}

export default Session;
