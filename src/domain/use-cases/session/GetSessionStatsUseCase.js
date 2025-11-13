/**
 * @fileoverview Get Session Statistics Use Case
 * Retrieves session statistics
 * @module domain/use-cases/session/GetSessionStatsUseCase
 */

/**
 * Get Session Statistics Use Case
 * 
 * @class GetSessionStatsUseCase
 */
class GetSessionStatsUseCase {
  /**
   * Session repository
   * @private
   */
  #sessionRepository;

  /**
   * Creates use case
   * @param {SessionRepository} sessionRepository - Session repository
   */
  constructor(sessionRepository) {
    this.#sessionRepository = sessionRepository;
  }

  /**
   * Executes use case
   * @returns {Promise<Object>} Statistics
   */
  async execute() {
    const stats = await this.#sessionRepository.getStatistics();
    
    return {
      success: true,
      statistics: stats
    };
  }

  /**
   * Gets session details
   * @param {string} adminId - Admin ID
   * @returns {Promise<Object>} Session details
   */
  async getSessionDetails(adminId) {
    const session = await this.#sessionRepository.findByAdminId(adminId);
    if (!session) {
      throw new Error(`Session not found for admin: ${adminId}`);
    }

    return {
      success: true,
      session: {
        adminId: session.adminId,
        status: session.status,
        autoPaused: session.autoPaused,
        lastActive: session.lastActive,
        pauseReason: session.pauseReason,
        floodWaitUntil: session.floodWaitUntil,
        lastError: session.lastError,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        isPaused: session.isPaused?.(),
        isReadyToResume: session.isReadyToResume?.()
      }
    };
  }
}

export default GetSessionStatsUseCase;
