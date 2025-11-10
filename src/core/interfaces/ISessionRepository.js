/**
 * @fileoverview Session Repository Interface
 * Contract for session repository implementations
 * @module core/interfaces/ISessionRepository
 */

import IRepository from './IRepository.js';

/**
 * Session Repository Interface
 * Defines session-specific operations
 * 
 * @interface ISessionRepository
 * @extends IRepository
 */
class ISessionRepository extends IRepository {
  /**
   * Finds session by phone
   * @abstract
   * @param {string} phone - Phone number
   * @returns {Promise<Object|null>} Session or null
   */
  async findByPhone(phone) {
    throw new Error('findByPhone() must be implemented');
  }

  /**
   * Finds sessions by status
   * @abstract
   * @param {string} status - Session status
   * @returns {Promise<Array>} Sessions
   */
  async findByStatus(status) {
    throw new Error('findByStatus() must be implemented');
  }

  /**
   * Finds sessions ready to resume
   * @abstract
   * @returns {Promise<Array>} Sessions ready to resume
   */
  async findReadyToResume() {
    throw new Error('findReadyToResume() must be implemented');
  }

  /**
   * Updates session activity
   * @abstract
   * @param {string} phone - Phone number
   * @returns {Promise<void>}
   */
  async updateActivity(phone) {
    throw new Error('updateActivity() must be implemented');
  }

  /**
   * Gets session statistics
   * @abstract
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    throw new Error('getStatistics() must be implemented');
  }
}

export default ISessionRepository;
