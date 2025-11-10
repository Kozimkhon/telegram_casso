/**
 * @fileoverview Add Admin Use Case
 * Handles admin creation business logic
 * @module domain/use-cases/admin/AddAdminUseCase
 */

import Admin from '../../../core/entities/Admin.entity.js';
import { AdminRole } from '../../../shared/constants/index.js';

/**
 * Add Admin Use Case
 * 
 * @class AddAdminUseCase
 */
class AddAdminUseCase {
  /**
   * Admin repository
   * @private
   */
  #adminRepository;

  /**
   * Creates use case
   * @param {AdminRepository} adminRepository - Admin repository
   */
  constructor(adminRepository) {
    this.#adminRepository = adminRepository;
  }

  /**
   * Executes use case
   * @param {Object} data - Admin data
   * @returns {Promise<Object>} Result
   */
  async execute(data) {
    // Validate input
    if (!data.telegramUserId) {
      throw new Error('Telegram user ID is required');
    }

    // Check if admin already exists
    const existing = await this.#adminRepository.findByUserId(data.telegramUserId);
    if (existing) {
      throw new Error(`Admin already exists for user: ${data.telegramUserId}`);
    }

    // Create admin entity
    const admin = new Admin({
      telegramUserId: data.telegramUserId,
      role: data.role || AdminRole.ADMIN,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Persist admin
    const created = await this.#adminRepository.create(admin);

    return {
      success: true,
      admin: created,
      message: 'Admin added successfully'
    };
  }
}

export default AddAdminUseCase;
