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
   * @param {string} phone - Phone number
   * @returns {Promise<Object>} Session details
   */
  async getSessionDetails(phone) {
    const session = await this.#sessionRepository.findByPhone(phone);
    if (!session) {
      throw new Error(`Session not found: ${phone}`);
    }

    return {
      success: true,
      session: {
        phone: session.phone,
        status: session.status,
        isActive: session.isActive,
        lastActive: session.lastActive,
        messagesSent: session.messagesSent,
        errorsCount: session.errorsCount,
        pausedReason: session.pausedReason,
        pausedUntil: session.pausedUntil,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        isPaused: session.isPaused(),
        isReadyToResume: session.isReadyToResume()
      }
    };
  }
}

export default GetSessionStatsUseCase;
