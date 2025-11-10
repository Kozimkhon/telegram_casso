/**
 * @fileoverview Session Repository Implementation
 * Handles session data persistence
 * @module data/repositories/SessionRepository
 */

import ISessionRepository from '../../core/interfaces/ISessionRepository.js';
import Session from '../../core/entities/Session.entity.js';
import { SessionStatus } from '../../shared/constants/index.js';

/**
 * Session Repository
 * Implements session data access operations
 * 
 * @class SessionRepository
 * @implements {ISessionRepository}
 */
class SessionRepository extends ISessionRepository {
  /**
   * Data source
   * @private
   */
  #dataSource;

  /**
   * Creates session repository
   * @param {SQLiteDataSource} dataSource - Data source
   */
  constructor(dataSource) {
    super();
    this.#dataSource = dataSource;
  }

  /**
   * Finds session by ID (phone)
   * @param {string} id - Phone number
   * @returns {Promise<Session|null>} Session or null
   */
  async findById(id) {
    return await this.findByPhone(id);
  }

  /**
   * Finds session by phone
   * @param {string} phone - Phone number
   * @returns {Promise<Session|null>} Session or null
   */
  async findByPhone(phone) {
    const row = await this.#dataSource.getOne(
      'SELECT * FROM sessions WHERE phone = ?',
      [phone]
    );
    return row ? Session.fromDatabaseRow(row) : null;
  }

  /**
   * Finds all sessions
   * @param {Object} filters - Filters
   * @param {string} [filters.status] - Filter by status
   * @returns {Promise<Array<Session>>} Sessions
   */
  async findAll(filters = {}) {
    let query = 'SELECT * FROM sessions';
    const params = [];

    if (filters.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = await this.#dataSource.getMany(query, params);
    return rows.map(row => Session.fromDatabaseRow(row));
  }

  /**
   * Creates new session
   * @param {Session} session - Session entity
   * @returns {Promise<Session>} Created session
   */
  async create(session) {
    const data = session.toObject();

    // Check if session exists
    const existing = await this.findByPhone(session.phone);
    
    if (existing) {
      // Update existing
      return await this.update(session.phone, data);
    }

    await this.#dataSource.execute(
      `INSERT INTO sessions 
       (phone, user_id, session_string, status, first_name, last_name, username, 
        auto_paused, pause_reason, flood_wait_until, last_error, last_active, 
        created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.phone,
        data.user_id,
        data.session_string,
        data.status,
        data.first_name,
        data.last_name,
        data.username,
        data.auto_paused,
        data.pause_reason,
        data.flood_wait_until,
        data.last_error,
        data.last_active,
        data.created_at,
        data.updated_at
      ]
    );

    return await this.findByPhone(session.phone);
  }

  /**
   * Updates session
   * @param {string} id - Phone number
   * @param {Object} updates - Updates
   * @returns {Promise<Session>} Updated session
   */
  async update(id, updates) {
    const session = await this.findByPhone(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    // Apply updates to entity
    if (updates.status) {
      if (updates.status === SessionStatus.ACTIVE) {
        session.activate();
      } else if (updates.status === SessionStatus.PAUSED) {
        session.pause(updates.pause_reason || 'Manual pause');
      } else if (updates.status === SessionStatus.ERROR) {
        session.markError(updates.last_error || 'Unknown error');
      }
    }

    if (updates.session_string) session.sessionString = updates.session_string;
    if (updates.first_name) session.firstName = updates.first_name;
    if (updates.last_name) session.lastName = updates.last_name;
    if (updates.username) session.username = updates.username;

    const data = session.toObject();

    await this.#dataSource.execute(
      `UPDATE sessions 
       SET user_id = ?, session_string = ?, status = ?, first_name = ?, 
           last_name = ?, username = ?, auto_paused = ?, pause_reason = ?, 
           flood_wait_until = ?, last_error = ?, last_active = ?, updated_at = ? 
       WHERE phone = ?`,
      [
        data.user_id,
        data.session_string,
        data.status,
        data.first_name,
        data.last_name,
        data.username,
        data.auto_paused,
        data.pause_reason,
        data.flood_wait_until,
        data.last_error,
        data.last_active,
        data.updated_at,
        id
      ]
    );

    return await this.findByPhone(id);
  }

  /**
   * Deletes session
   * @param {string} id - Phone number
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const result = await this.#dataSource.execute(
      'DELETE FROM sessions WHERE phone = ?',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Checks if session exists
   * @param {string} id - Phone number
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const session = await this.findByPhone(id);
    return session !== null;
  }

  /**
   * Counts sessions
   * @param {Object} filters - Filters
   * @returns {Promise<number>} Count
   */
  async count(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM sessions';
    const params = [];

    if (filters.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }

    const result = await this.#dataSource.getOne(query, params);
    return result?.count || 0;
  }

  /**
   * Finds sessions by status
   * @param {string} status - Session status
   * @returns {Promise<Array<Session>>} Sessions
   */
  async findByStatus(status) {
    return await this.findAll({ status });
  }

  /**
   * Finds sessions ready to resume
   * @returns {Promise<Array<Session>>} Sessions ready to resume
   */
  async findReadyToResume() {
    const rows = await this.#dataSource.getMany(
      `SELECT * FROM sessions 
       WHERE status = ? 
       AND auto_paused = 1 
       AND flood_wait_until IS NOT NULL 
       AND flood_wait_until < datetime('now')`,
      [SessionStatus.PAUSED]
    );
    return rows.map(row => Session.fromDatabaseRow(row));
  }

  /**
   * Updates session activity
   * @param {string} phone - Phone number
   * @returns {Promise<void>}
   */
  async updateActivity(phone) {
    await this.#dataSource.execute(
      `UPDATE sessions 
       SET last_active = datetime('now'), updated_at = datetime('now') 
       WHERE phone = ?`,
      [phone]
    );
  }

  /**
   * Gets session statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const [total, active, paused, error] = await Promise.all([
      this.count(),
      this.count({ status: SessionStatus.ACTIVE }),
      this.count({ status: SessionStatus.PAUSED }),
      this.count({ status: SessionStatus.ERROR })
    ]);

    return {
      total,
      active,
      paused,
      error,
      inactive: total - active - paused - error
    };
  }
}

export default SessionRepository;
