/**
 * @fileoverview Admin Repository Interface
 * Contract for admin repository implementations
 * @module core/interfaces/IAdminRepository
 */

import IRepository from './IRepository.js';

/**
 * Admin Repository Interface
 * Defines admin-specific operations
 * 
 * @interface IAdminRepository
 * @extends IRepository
 */
class IAdminRepository extends IRepository {
  /**
   * Finds admin by user ID
   * @abstract
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Admin or null
   */
  async findByUserId(userId) {
    throw new Error('findByUserId() must be implemented');
  }

  /**
   * Finds active admins
   * @abstract
   * @returns {Promise<Array>} Active admins
   */
  async findActive() {
    throw new Error('findActive() must be implemented');
  }

  /**
   * Finds admins by role
   * @abstract
   * @param {string} role - Admin role
   * @returns {Promise<Array>} Admins
   */
  async findByRole(role) {
    throw new Error('findByRole() must be implemented');
  }

  /**
   * Checks if user is admin
   * @abstract
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if admin
   */
  async isAdmin(userId) {
    throw new Error('isAdmin() must be implemented');
  }

  /**
   * Activates admin
   * @abstract
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated admin
   */
  async activate(userId) {
    throw new Error('activate() must be implemented');
  }

  /**
   * Deactivates admin
   * @abstract
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated admin
   */
  async deactivate(userId) {
    throw new Error('deactivate() must be implemented');
  }
}

export default IAdminRepository;
