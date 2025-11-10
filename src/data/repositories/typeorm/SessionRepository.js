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
   * Finds session by phone
   * @param {string} phone - Phone number
   * @returns {Promise<Object|null>} Session or null
   */
  async findByPhone(phone) {
    return await this.findOne({ phone });
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
   * Finds sessions by admin
   * @param {string} adminUserId - Admin user ID
   * @returns {Promise<Object[]>} Admin's sessions
   */
  async findByAdmin(adminUserId) {
    return await this.findMany({ adminUserId });
  }

  /**
   * Finds session with admin
   * @param {string} phone - Session phone
   * @returns {Promise<Object|null>} Session with admin
   */
  async findWithAdmin(phone) {
    return await this.findOne(
      { phone },
      {
        relations: ['admin'],
      }
    );
  }

  /**
   * Finds session with channels
   * @param {string} phone - Session phone
   * @returns {Promise<Object|null>} Session with channels
   */
  async findWithChannels(phone) {
    return await this.findOne(
      { phone },
      {
        relations: ['channels'],
      }
    );
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
   * @param {string} phone - Session phone
   * @returns {Promise<void>}
   */
  async updateActivity(phone) {
    await this.repository.update(
      { phone },
      {
        lastActive: new Date(),
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Sets flood wait for session
   * @param {string} phone - Session phone
   * @param {number} seconds - Flood wait seconds
   * @returns {Promise<void>}
   */
  async setFloodWait(phone, seconds) {
    const floodWaitUntil = new Date(Date.now() + seconds * 1000);
    await this.repository.update(
      { phone },
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
   * @param {string} phone - Session phone
   * @param {string} reason - Pause reason
   * @returns {Promise<void>}
   */
  async pause(phone, reason = 'Manual pause') {
    await this.repository.update(
      { phone },
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
   * @param {string} phone - Session phone
   * @returns {Promise<void>}
   */
  async resume(phone) {
    await this.repository.update(
      { phone },
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
