/**
 * @fileoverview Remove Admin Use Case
 * Handles admin deletion business logic
 * @module domain/use-cases/admin/RemoveAdminUseCase
 */

/**
 * Remove Admin Use Case
 * 
 * @class RemoveAdminUseCase
 */
class RemoveAdminUseCase {
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
   * @param {string} telegramUserId - Telegram user ID
   * @returns {Promise<Object>} Result
   */
  async execute(telegramUserId) {
    // Find admin
    const admin = await this.#adminRepository.findByUserId(telegramUserId);
    if (!admin) {
      throw new Error(`Admin not found for user: ${telegramUserId}`);
    }

    // Prevent removing last super admin
    if (admin.isSuperAdmin()) {
      const firstSuperAdmin = await this.#adminRepository.getFirstSuperAdmin();
      if (firstSuperAdmin && firstSuperAdmin.id === admin.id) {
        const allSuperAdmins = await this.#adminRepository.findByRole('super_admin');
        if (allSuperAdmins.length === 1) {
          throw new Error('Cannot remove the last super admin');
        }
      }
    }

    // Delete admin
    const deleted = await this.#adminRepository.delete(admin.id);
    if (!deleted) {
      throw new Error('Failed to delete admin');
    }

    return {
      success: true,
      message: 'Admin removed successfully'
    };
  }
}

export default RemoveAdminUseCase;
