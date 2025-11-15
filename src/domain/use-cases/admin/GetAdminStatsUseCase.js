/**
 * @fileoverview Get Admin Statistics Use Case
 * Retrieves admin statistics
 * @module domain/use-cases/admin/GetAdminStatsUseCase
 */

/**
 * Get Admin Statistics Use Case
 * 
 * @class GetAdminStatsUseCase
 */
class GetAdminStatsUseCase {
  /**
   * Admin repository
   * @private
   */
  #adminRepository;

  /**
   * Creates use case
   * @param {Object} dependencies - Dependencies
   * @param {AdminRepository} dependencies.adminRepository - Admin repository
   */
  constructor({ adminRepository }) {
    this.#adminRepository = adminRepository;
  }

  /**
   * Executes use case
   * @returns {Promise<Object>} Statistics
   */
  async execute() {
    const stats = await this.#adminRepository.getStatistics();
    const activeAdmins = await this.#adminRepository.findActive();
    
    return {
      success: true,
      statistics: stats,
      activeAdmins: activeAdmins.map(a => ({
        id: a.id,
        telegramUserId: a.telegramUserId,
        role: a.role,
        createdAt: a.createdAt
      }))
    };
  }
}

export default GetAdminStatsUseCase;
