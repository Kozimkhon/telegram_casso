/**
 * @fileoverview Check Admin Access Use Case
 * Validates admin authentication and authorization
 * @module domain/use-cases/admin/CheckAdminAccessUseCase
 */

/**
 * Check Admin Access Use Case
 * 
 * @class CheckAdminAccessUseCase
 */
class CheckAdminAccessUseCase {
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
    const isAdmin = await this.#adminRepository.isAdmin(telegramUserId);
    const isSuperAdmin = await this.#adminRepository.isSuperAdmin(telegramUserId);

    return {
      success: true,
      isAdmin,
      isSuperAdmin,
      hasAccess: isAdmin
    };
  }

  /**
   * Requires admin access
   * @param {string} telegramUserId - Telegram user ID
   * @returns {Promise<Object>} Admin info
   * @throws {Error} If not admin
   */
  async requireAdmin(telegramUserId) {
    const admin = await this.#adminRepository.findByUserId(telegramUserId);
    
    if (!admin || !admin.isActive) {
      throw new Error('Access denied: User is not an admin');
    }

    return {
      success: true,
      admin: {
        id: admin.id,
        telegramUserId: admin.telegramUserId,
        role: admin.role,
        isSuperAdmin: admin.isSuperAdmin()
      }
    };
  }

  /**
   * Requires super admin access
   * @param {string} telegramUserId - Telegram user ID
   * @returns {Promise<Object>} Admin info
   * @throws {Error} If not super admin
   */
  async requireSuperAdmin(telegramUserId) {
    const result = await this.requireAdmin(telegramUserId);
    
    if (!result.admin.isSuperAdmin) {
      throw new Error('Access denied: Super admin privileges required');
    }

    return result;
  }
}

export default CheckAdminAccessUseCase;
