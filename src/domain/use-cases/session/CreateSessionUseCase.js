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
    // Validate input
    if (!data.phone) {
      throw new Error('Phone number is required');
    }

    // Validate phone format
    const phoneRegex = new RegExp(ValidationRules.PHONE_REGEX);
    if (!phoneRegex.test(data.phone)) {
      throw new Error('Invalid phone number format');
    }

    // Check if session already exists
    const existing = await this.#sessionRepository.findByPhone(data.phone);
    if (existing) {
      throw new Error(`Session already exists for phone: ${data.phone}`);
    }

    // Create session entity
    const session = new Session({
      phone: data.phone,
      sessionString: data.sessionString || null,
      status: data.status || 'active',
      isActive: true,
      lastActive: new Date().toISOString(),
      messagesSent: 0,
      errorsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
