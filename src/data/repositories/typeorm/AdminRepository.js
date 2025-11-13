/**
 * @fileoverview Admin Repository
 * Repository for Admin entity operations
 * @module repositories/typeorm/AdminRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { AdminEntity } from '../../../core/entities/db/index.js';

/**
 * Admin Repository
 * Handles database operations for Admin entity
 * 
 * @class AdminRepository
 * @extends BaseRepository
 */
class AdminRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(AdminEntity);
    super(repository, 'Admin');
  }

  /**
   * Finds admin by user ID
   * @param {string} userId - Telegram user ID
   * @returns {Promise<Object|null>} Admin or null
   */
  async findByUserId(userId) {
    return await this.findOne({ userId });
  }

  /**
   * Finds admin by phone
   * @param {string} phone - Phone number
   * @returns {Promise<Object|null>} Admin or null
   */
  async findByPhone(phone) {
    return await this.findOne({ phone });
  }

  /**
   * Finds all active admins
   * @returns {Promise<Object[]>} Active admins
   */
  async findAllActive() {
    return await this.findMany({ isActive: true });
  }

  /**
   * Finds admins by role
   * @param {string} role - Admin role
   * @returns {Promise<Object[]>} Admins with role
   */
  async findByRole(role) {
    return await this.findMany({ role });
  }

  /**
   * Finds admin with sessions
   * @param {string} userId - Admin user ID
   * @returns {Promise<Object|null>} Admin with sessions
   */
  async findWithSessions(userId) {
    return await this.findOne(
      { userId },
      {
        relations: ['sessions'],
      }
    );
  }

  /**
   * Finds admin with channels
   * @param {string} userId - Admin user ID
   * @returns {Promise<Object|null>} Admin with channels
   */
  async findWithChannels(userId) {
    return await this.findOne(
      { userId },
      {
        relations: ['channels'],
      }
    );
  }

  /**
   * Finds admin with all relationships
   * @param {string} userId - Admin user ID
   * @returns {Promise<Object|null>} Admin with all relations
   */
  async findWithRelations(userId) {
    return await this.findOne(
      { userId },
      {
        relations: ['sessions', 'channels'],
      }
    );
  }

  /**
   * Activates admin
   * @param {string} userId - Admin user ID
   * @returns {Promise<Object|null>} Updated admin
   */
  async activate(userId) {
    return await this.repository.save({
      userId,
      isActive: true,
      updatedAt: new Date(),
    });
  }

  /**
   * Deactivates admin
   * @param {string} userId - Admin user ID
   * @returns {Promise<Object|null>} Updated admin
   */
  async deactivate(userId) {
    return await this.repository.save({
      userId,
      isActive: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Updates admin role
   * @param {string} userId - Admin user ID
   * @param {string} role - New role
   * @returns {Promise<Object|null>} Updated admin
   */
  async updateRole(userId, role) {
    return await this.repository.save({
      userId,
      role,
      updatedAt: new Date(),
    });
  }
}

export default AdminRepository;
