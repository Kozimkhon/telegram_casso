/**
 * Session Repository Implementation
 * Implements session data access using SQLite
 * 
 * @module data/repositories/SessionRepository
 */

import { ISessionRepository } from '../../core/interfaces/ISessionRepository.js';
import { Session } from '../../core/entities/Session.js';
import { Tables, SessionStatus } from '../../shared/constants/index.js';

/**
 * @class SessionRepository
 * @extends {ISessionRepository}
 * @description Repository implementation for Session entity
 * Handles all database operations for sessions
 */
export class SessionRepository extends ISessionRepository {
  /**
   * Creates a new SessionRepository
   * @param {SQLiteDataSource} dataSource - Database data source
   */
  constructor(dataSource) {
    super();
    this.dataSource = dataSource;
    this.tableName = Tables.SESSIONS;
  }

  /**
   * Finds a session by phone (ID)
   * @param {string} phone - Session phone number
   * @returns {Promise<Session|null>} Session or null
   */
  async findById(phone) {
    const sql = `SELECT * FROM ${this.tableName} WHERE phone = ?`;
    const row = await this.dataSource.getOne(sql, [phone]);
    return row ? Session.fromDatabaseRow(row) : null;
  }

  /**
   * Finds all sessions with optional filtering
   * @param {Object} [filter] - Filter options
   * @param {string} [filter.status] - Filter by status
   * @returns {Promise<Array<Session>>} Array of sessions
   */
  async findAll(filter = {}) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];

    if (filter.status) {
      sql += ' WHERE status = ?';
      params.push(filter.status);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await this.dataSource.getAll(sql, params);
    return Session.fromDatabaseRows(rows);
  }

  /**
   * Finds sessions by status
   * @param {string} status - Session status
   * @returns {Promise<Array<Session>>} Array of sessions
   */
  async findByStatus(status) {
    return this.findAll({ status });
  }

  /**
   * Finds active sessions
   * @returns {Promise<Array<Session>>} Array of active sessions
   */
  async findActive() {
    return this.findByStatus(SessionStatus.ACTIVE);
  }

  /**
   * Creates a new session
   * @param {Object} data - Session data
   * @returns {Promise<Session>} Created session
   */
  async create(data) {
    const session = new Session(data);
    const obj = session.toObject();

    const sql = `
      INSERT INTO ${this.tableName}
      (phone, user_id, session_string, status, first_name, last_name, username,
       auto_paused, pause_reason, flood_wait_until, last_error, last_active,
       created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await this.dataSource.run(sql, [
      obj.phone,
      obj.userId,
      obj.sessionString,
      obj.status,
      obj.firstName,
      obj.lastName,
      obj.username,
      obj.autoPaused ? 1 : 0,
      obj.pauseReason,
      obj.floodWaitUntil ? obj.floodWaitUntil.toISOString() : null,
      obj.lastError,
      obj.lastActive ? obj.lastActive.toISOString() : null
    ]);

    return this.findById(obj.phone);
  }

  /**
   * Updates an existing session
   * @param {string} phone - Session phone
   * @param {Object} data - Update data
   * @returns {Promise<Session>} Updated session
   */
  async update(phone, data) {
    const existing = await this.findById(phone);
    if (!existing) {
      throw new Error(`Session not found: ${phone}`);
    }

    const updates = [];
    const params = [];

    if (data.userId !== undefined) {
      updates.push('user_id = ?');
      params.push(data.userId);
    }
    if (data.sessionString !== undefined) {
      updates.push('session_string = ?');
      params.push(data.sessionString);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.firstName !== undefined) {
      updates.push('first_name = ?');
      params.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updates.push('last_name = ?');
      params.push(data.lastName);
    }
    if (data.username !== undefined) {
      updates.push('username = ?');
      params.push(data.username);
    }
    if (data.autoPaused !== undefined) {
      updates.push('auto_paused = ?');
      params.push(data.autoPaused ? 1 : 0);
    }
    if (data.pauseReason !== undefined) {
      updates.push('pause_reason = ?');
      params.push(data.pauseReason);
    }
    if (data.floodWaitUntil !== undefined) {
      updates.push('flood_wait_until = ?');
      params.push(data.floodWaitUntil ? data.floodWaitUntil.toISOString() : null);
    }
    if (data.lastError !== undefined) {
      updates.push('last_error = ?');
      params.push(data.lastError);
    }
    if (data.lastActive !== undefined) {
      updates.push('last_active = ?');
      params.push(data.lastActive ? data.lastActive.toISOString() : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(phone);

    const sql = `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE phone = ?`;
    await this.dataSource.run(sql, params);

    return this.findById(phone);
  }

  /**
   * Deletes a session
   * @param {string} phone - Session phone
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(phone) {
    const sql = `DELETE FROM ${this.tableName} WHERE phone = ?`;
    const result = await this.dataSource.run(sql, [phone]);
    return result.changes > 0;
  }

  /**
   * Checks if session exists
   * @param {string} phone - Session phone
   * @returns {Promise<boolean>} True if exists
   */
  async exists(phone) {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE phone = ? LIMIT 1`;
    const row = await this.dataSource.getOne(sql, [phone]);
    return row !== null;
  }

  /**
   * Counts sessions with optional filtering
   * @param {Object} [filter] - Filter options
   * @returns {Promise<number>} Count of sessions
   */
  async count(filter = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];

    if (filter.status) {
      sql += ' WHERE status = ?';
      params.push(filter.status);
    }

    const row = await this.dataSource.getOne(sql, params);
    return row?.count || 0;
  }

  /**
   * Updates session status
   * @param {string} phone - Session phone
   * @param {string} status - New status
   * @returns {Promise<Session>} Updated session
   */
  async updateStatus(phone, status) {
    return this.update(phone, { status });
  }

  /**
   * Updates session activity timestamp
   * @param {string} phone - Session phone
   * @returns {Promise<Session>} Updated session
   */
  async updateActivity(phone) {
    return this.update(phone, { lastActive: new Date() });
  }

  /**
   * Sets flood wait for session
   * @param {string} phone - Session phone
   * @param {number} seconds - Seconds to wait
   * @returns {Promise<Session>} Updated session
   */
  async setFloodWait(phone, seconds) {
    const floodWaitUntil = new Date(Date.now() + seconds * 1000);
    return this.update(phone, {
      floodWaitUntil,
      status: SessionStatus.PAUSED,
      autoPaused: true,
      pauseReason: `Flood wait: ${seconds}s`
    });
  }

  /**
   * Clears flood wait for session
   * @param {string} phone - Session phone
   * @returns {Promise<Session>} Updated session
   */
  async clearFloodWait(phone) {
    const session = await this.findById(phone);
    if (!session) {
      throw new Error(`Session not found: ${phone}`);
    }

    const updates = {
      floodWaitUntil: null
    };

    // If session was auto-paused, activate it
    if (session.autoPaused) {
      updates.status = SessionStatus.ACTIVE;
      updates.autoPaused = false;
      updates.pauseReason = null;
    }

    return this.update(phone, updates);
  }

  /**
   * Saves or updates session string
   * @param {string} phone - Session phone
   * @param {string} sessionString - Session string
   * @returns {Promise<Session>} Updated session
   */
  async saveSessionString(phone, sessionString) {
    return this.update(phone, { sessionString });
  }
}

export default SessionRepository;
