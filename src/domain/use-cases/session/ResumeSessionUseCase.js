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
   * @param {string} phone - Phone number
   * @returns {Promise<Object>} Result
   */
  async execute(phone) {
    // Find session
    const session = await this.#sessionRepository.findByPhone(phone);
    if (!session) {
      throw new Error(`Session not found: ${phone}`);
    }

    // Check if can resume
    if (!session.isPaused()) {
      return {
        success: false,
        message: 'Session is not paused',
        session
      };
    }

    if (!session.isReadyToResume()) {
      const remainingSeconds = Math.ceil(
        (new Date(session.pausedUntil) - new Date()) / 1000
      );
      return {
        success: false,
        message: `Session cannot be resumed yet. Wait ${remainingSeconds}s`,
        session,
        remainingSeconds
      };
    }

    // Resume session
    session.resume();

    // Update repository
    const updated = await this.#sessionRepository.update(phone, {
      status: session.status,
      paused_reason: null,
      paused_until: null,
      updated_at: session.updatedAt
    });

    // Update state
    this.#stateManager.updateSession(phone, {
      status: updated.status,
      pausedReason: null,
      pausedUntil: null
    });

    return {
      success: true,
      session: updated,
      message: 'Session resumed successfully'
    };
  }
}

export default ResumeSessionUseCase;
