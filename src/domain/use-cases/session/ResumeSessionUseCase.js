/**
 * @fileoverview Resume Session Use Case
 * Handles session resuming business logic
 * @module domain/use-cases/session/ResumeSessionUseCase
 */

/**
 * Resume Session Use Case
 * 
 * @class ResumeSessionUseCase
 */
class ResumeSessionUseCase {
  /**
   * Session repository
   * @private
   */
  #sessionRepository;

  /**
   * State manager
   * @private
   */
  #stateManager;

  /**
   * Creates use case
   * @param {SessionRepository} sessionRepository - Session repository
   * @param {StateManager} stateManager - State manager
   */
  constructor(sessionRepository, stateManager) {
    this.#sessionRepository = sessionRepository;
    this.#stateManager = stateManager;
  }

  /**
   * Executes use case
   * @param {string} adminId - Admin ID
   * @returns {Promise<Object>} Result
   */
  async execute(adminId) {
    // Find session by admin ID
    const session = await this.#sessionRepository.findByAdminId(adminId);
    if (!session) {
      throw new Error(`Session not found for admin: ${adminId}`);
    }

    // Check if can resume
    if (!session.isPaused?.()) {
      return {
        success: false,
        message: 'Session is not paused',
        session
      };
    }

    if (!session.isReadyToResume?.()) {
      const remainingSeconds = Math.ceil(
        (new Date(session.floodWaitUntil) - new Date()) / 1000
      );
      return {
        success: false,
        message: `Session cannot be resumed yet. Wait ${remainingSeconds}s`,
        session,
        remainingSeconds
      };
    }

    // Resume session
    session.resume?.();

    // Update repository
    const updated = await this.#sessionRepository.update(session.id, {
      status: session.status,
      pauseReason: null,
      floodWaitUntil: null,
      updatedAt: session.updatedAt
    });

    // Update state
    this.#stateManager.updateSession(adminId, {
      status: updated.status,
      pauseReason: null,
      floodWaitUntil: null
    });

    return {
      success: true,
      session: updated,
      message: 'Session resumed successfully'
    };
  }
}

export default ResumeSessionUseCase;
