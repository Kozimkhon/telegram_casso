/**
 * @fileoverview Create Session Use Case
 * Handles session creation business logic
 * @module domain/use-cases/session/CreateSessionUseCase
 */

import { ValidationRules } from '../../../shared/constants/index.js';
import Session from '../../../core/entities/Session.entity.js';

/**
 * Create Session Use Case
 * 
 * @class CreateSessionUseCase
 */
class CreateSessionUseCase {
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
   * @param {Object} data - Session data
   * @returns {Promise<Object>} Result
   */
  async execute(data) {
    
    // Create session entity
    const session = new Session({
      adminId:data.adminId,
      sessionString: data.sessionString || null,
      status: data.status || 'active',
      lastActive: new Date(),
      autoPaused: false,
      pauseReason: null,
      floodWaitUntil: null,
      lastError: null,
      lastActive: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Persist session
    const created = await this.#sessionRepository.create(session);

    // Update state
    this.#stateManager.addSession({
      phone: created.phone,
      status: created.status,
      isActive: created.isActive,
      lastActive: created.lastActive
    });

    return {
      success: true,
      session: created,
      message: 'Session created successfully'
    };
  }
}

export default CreateSessionUseCase;
