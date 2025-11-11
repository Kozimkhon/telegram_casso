/**
 * @fileoverview Get or Create Admin Use Case
 * Gets existing admin or creates a new one if not found
 * @module core/use-cases/admin/GetOrCreateAdmin
 */

import { createChildLogger } from '../../../shared/logger.js';

const logger = createChildLogger({ component: 'GetOrCreateAdminUseCase' });

/**
 * Get or Create Admin Use Case
 * Ensures admin exists in database
 */
export class GetOrCreateAdminUseCase {
  #adminRepository;

  /**
   * Creates GetOrCreateAdminUseCase instance
   * @param {Object} adminRepository - Admin repository
   */
  constructor(adminRepository) {
    this.#adminRepository = adminRepository;
  }

  /**
   * Gets existing admin or creates new one
   * @param {Object} data - Admin data
   * @param {string} data.userId - Telegram user ID
   * @param {string} [data.username] - Telegram username
   * @param {string} [data.firstName] - First name
   * @param {string} [data.lastName] - Last name
   * @param {string} [data.phone] - Phone number
   * @returns {Promise<Object>} Admin entity
   */
  async execute(data) {
    try {
      const { userId, username, firstName, lastName, phone } = data;

      // Try to find existing admin
      let admin = await this.#adminRepository.findByUserId(userId);

      if (admin) {
        logger.info('Admin already exists', { userId });
        
        // Update admin info if provided
        const updates = {};
        if (username !== undefined) updates.username = username;
        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (phone !== undefined) updates.phone = phone;

        if (Object.keys(updates).length > 0) {
          admin = await this.#adminRepository.update(userId, updates);
          logger.info('Admin info updated', { userId, updates });
        }

        return admin;
      }

      // Create new admin
      admin = await this.#adminRepository.create({
        userId,
        username: username || null,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        isActive: true
      });

      logger.info('New admin created', { userId });
      return admin;

    } catch (error) {
      logger.error('Failed to get or create admin', error);
      throw error;
    }
  }
}
