/**
 * @fileoverview Update Admin Use Case
 * Use case for updating admin information
 * @module core/use-cases/admin/UpdateAdmin
 */

import { createChildLogger } from '../../../shared/logger.js';
import { DatabaseError } from '../../../shared/errorHandler.js';

/**
 * Update Admin Use Case
 * Updates admin information (e.g., phone number during session registration)
 * 
 * @class UpdateAdminUseCase
 */
class UpdateAdminUseCase {
  /**
   * Admin repository
   * @private
   */
  #adminRepository;

  /**
   * Logger
   * @private
   */
  #logger;

  /**
   * Creates UpdateAdminUseCase
   * @param {Object} dependencies - Dependencies
   * @param {Object} dependencies.adminRepository - Admin repository
   */
  constructor({ adminRepository }) {
    this.#adminRepository = adminRepository;
    this.#logger = createChildLogger({ component: 'UpdateAdminUseCase' });
  }

  /**
   * Executes the use case
   * @param {string} userId - Admin's Telegram user ID
   * @param {Object} updates - Fields to update
   * @param {string} [updates.phone] - Phone number
   * @param {string} [updates.firstName] - First name
   * @param {string} [updates.lastName] - Last name
   * @param {string} [updates.username] - Username
   * @param {boolean} [updates.isActive] - Active status
   * @returns {Promise<Object>} Updated admin
   * @throws {DatabaseError} If update fails
   */
  async execute(userId, updates) {
    try {
      this.#logger.debug('Updating admin', { userId, updates });

      // Validate userId
      if (!userId) {
        throw new Error('userId is required');
      }

      // Validate updates object
      if (!updates || typeof updates !== 'object') {
        throw new Error('updates must be an object');
      }

      // Filter out undefined values
      const filteredUpdates = Object.entries(updates)
        .filter(([_, value]) => value !== undefined)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});

      // Check if there are any updates
      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid updates provided');
      }

      // Update admin
      const admin = await this.#adminRepository.updateWithUserId(userId, filteredUpdates);

      if (!admin) {
        throw new Error(`Admin not found: ${userId}`);
      }

      this.#logger.info('Admin updated successfully', { userId });
      return admin;
    } catch (error) {
      this.#logger.error('Failed to update admin', { userId, error });
      throw new DatabaseError(`Failed to update admin: ${error.message}`);
    }
  }
}

export default UpdateAdminUseCase;
