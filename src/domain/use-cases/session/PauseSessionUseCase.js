/**
 * @fileoverview Pause Session Use Case
 * Handles session pausing business logic
 * @module domain/use-cases/session/PauseSessionUseCase
 */

/**
 * Pause Session Use Case
 * 
 * @class PauseSessionUseCase
 */
class PauseSessionUseCase {
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
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async execute(phone, options = {}) {
    const { reason, autoPause = false, floodWaitSeconds = null } = options;

    // Find session
    const session = await this.#sessionRepository.findByPhone(phone);
    if (!session) {
      throw new Error(`Session not found: ${phone}`);
    }

    // Check if already paused
    if (session.isPaused()) {
      return {
        success: false,
        message: 'Session already paused',
        session
      };
    }

    // Apply pause logic
    if (autoPause && floodWaitSeconds) {
      session.autoPause(floodWaitSeconds, reason);
    } else {
      session.pause(reason);
    }

    // Update repository
    const updated = await this.#sessionRepository.update(phone, {
      status: session.status,
      pausedReason: session.pausedReason,
      pausedUntil: session.pausedUntil,
      updated_at: session.updatedAt
    });

    // Update state
    this.#stateManager.updateSession(phone, {
      status: updated.status,
      pausedReason: updated.pausedReason,
      pausedUntil: updated.pausedUntil
    });

    return {
      success: true,
      session: updated,
      message: autoPause ? 'Session auto-paused due to flood wait' : 'Session paused successfully'
    };
  }
}

export default PauseSessionUseCase;
