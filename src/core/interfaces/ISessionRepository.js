/**
 * Session Repository Interface
 * Defines contract for session data operations
 * 
 * @module core/interfaces/ISessionRepository
 */

import { IRepository } from './IRepository.js';

/**
 * @interface ISessionRepository
 * @extends {IRepository}
 * @description Repository interface for Session entity operations
 */
export class ISessionRepository extends IRepository {
  /**
   * Finds sessions by status
   * @param {string} status - Session status
   * @returns {Promise<Array<Session>>} Array of sessions
   * @abstract
   */
  async findByStatus(status) {
    throw new Error('Method findByStatus() must be implemented');
  }

  /**
   * Finds active sessions
   * @returns {Promise<Array<Session>>} Array of active sessions
   * @abstract
   */
  async findActive() {
    throw new Error('Method findActive() must be implemented');
  }

  /**
   * Updates session status
   * @param {string} phone - Session phone
   * @param {string} status - New status
   * @returns {Promise<Session>} Updated session
   * @abstract
   */
  async updateStatus(phone, status) {
    throw new Error('Method updateStatus() must be implemented');
  }

  /**
   * Updates session activity timestamp
   * @param {string} phone - Session phone
   * @returns {Promise<Session>} Updated session
   * @abstract
   */
  async updateActivity(phone) {
    throw new Error('Method updateActivity() must be implemented');
  }

  /**
   * Sets flood wait for session
   * @param {string} phone - Session phone
   * @param {number} seconds - Seconds to wait
   * @returns {Promise<Session>} Updated session
   * @abstract
   */
  async setFloodWait(phone, seconds) {
    throw new Error('Method setFloodWait() must be implemented');
  }

  /**
   * Clears flood wait for session
   * @param {string} phone - Session phone
   * @returns {Promise<Session>} Updated session
   * @abstract
   */
  async clearFloodWait(phone) {
    throw new Error('Method clearFloodWait() must be implemented');
  }

  /**
   * Saves or updates session string
   * @param {string} phone - Session phone
   * @param {string} sessionString - Session string
   * @returns {Promise<Session>} Updated session
   * @abstract
   */
  async saveSessionString(phone, sessionString) {
    throw new Error('Method saveSessionString() must be implemented');
  }
}

export default ISessionRepository;
