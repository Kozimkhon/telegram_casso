/**
 * @fileoverview Session Repository
 * Repository for Session entity operations
 * @module repositories/typeorm/SessionRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { SessionEntity } from '../../../core/entities/db/index.js';

/**
 * Session Repository
 * Handles database operations for Session entity
 * 
 * @class SessionRepository
 * @extends BaseRepository
 */
class SessionRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(SessionEntity);
    super(repository, 'Session');
  }
  /**
   * Finds session by admin ID
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object|null>} Session or null
   */
  async findByAdminId(adminId) {
    return await this.findOne({ adminId });
  }

  /**
   * Finds all active sessions
   * @returns {Promise<Object[]>} Active sessions
   */
  async findAllActive() {
    return await this.findMany({ status: 'active' });
  }

  /**
   * Finds sessions by status
   * @param {string} status - Session status
   * @returns {Promise<Object[]>} Sessions with status
   */
  async findByStatus(status) {
    return await this.findMany({ status });
  }

  /**
   * Finds sessions by admin (for backwards compatibility if needed)
   * @param {string} adminUserId - Admin user ID
   * @returns {Promise<Object[]>} Admin's sessions (typically just one)
   */
  async findByAdmin(adminUserId) {
    return await this.findMany({ adminId: adminUserId });
  }

  /**
   * Finds sessions ready to resume
   * @returns {Promise<Object[]>} Sessions ready to resume
   */
  async findReadyToResume() {
    return await this.repository
      .createQueryBuilder('session')
      .where('session.status = :status', { status: 'paused' })
      .andWhere('session.auto_paused = :autoPaused', { autoPaused: true })
      .andWhere('(session.flood_wait_until IS NULL OR session.flood_wait_until <= :now)', {
        now: new Date(),
      })
      .getMany();
  }

  /**
   * Updates session activity
   * @param {string} adminId - Admin user ID
   * @returns {Promise<void>}
   */
  async updateActivity(adminId) {
    await this.repository.update(
      { adminId },
      {
        lastActive: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Sets flood wait for session
   * @param {string} adminId - Admin user ID
   * @param {number} seconds - Flood wait seconds
   * @returns {Promise<void>}
   */
  async setFloodWait(adminId, seconds) {
    const floodWaitUntil = new Date(Date.now() + seconds * 1000);
    await this.repository.update(
      { adminId },
      {
        status: 'paused',
        autoPaused: true,
        pauseReason: `FloodWait: ${seconds}s`,
        floodWaitUntil,
        lastError: `FloodWait: ${seconds}s`,
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Pauses session
   * @param {string} adminId - Admin user ID
   * @param {string} reason - Pause reason
   * @returns {Promise<void>}
   */
  async pause(adminId, reason = 'Manual pause') {
    await this.repository.update(
      { adminId },
      {
        status: 'paused',
        pauseReason: reason,
        autoPaused: false,
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Resumes session
   * @param {string} adminId - Admin user ID
   * @returns {Promise<void>}
   */
  async resume(adminId) {
    await this.repository.update(
      { adminId },
      {
        status: 'active',
        pauseReason: null,
        autoPaused: false,
        floodWaitUntil: null,
        lastError: null,
        lastActive: new Date(),
        updatedAt: new Date(),
      }
    );
  }
}

export default SessionRepository;
