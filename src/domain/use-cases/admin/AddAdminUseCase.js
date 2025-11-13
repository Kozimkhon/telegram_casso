/**
 * @fileoverview Add Admin Use Case
 * Handles admin creation business logic
 * @module domain/use-cases/admin/AddAdminUseCase
 */

import Admin from '../../../core/entities/domain/Admin.entity.js';
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
   * @param {Admin} data - Admin data
   * @returns {Promise<Object>} Result
   */
  async execute(data) {
    // Validate input
    if (!data.userId) {
      throw new Error('Telegram user ID is required');
    }

    // Check if admin already exists
    const existing = await this.#adminRepository.findByUserId(data.userId);
    if (existing) {
      throw new Error(`Admin already exists for user: ${data.userId}`);
    }

    // Create admin entity
    const admin = new Admin({
      userId: data.userId,
      username: data.username || null,
      firstName: data.firstName || '',
      lastName: data.lastName || null,
      phone: data.phone || null,
      role: data.role || AdminRole.ADMIN,
      isActive: data.isActive === true || data.isActive === undefined ? true : false,
      createdAt: new Date(),
      updatedAt: new Date()
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
