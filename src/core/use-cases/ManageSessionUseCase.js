/**
 * Manage Session Use Case
 * Handles session management operations
 * 
 * @module core/use-cases/ManageSessionUseCase
 */

import { BaseUseCase } from './BaseUseCase.js';
import { Session } from '../entities/Session.js';
import { SessionStatus } from '../../shared/constants/index.js';
import AppState from '../state/AppState.js';

/**
 * @typedef {Object} CreateSessionRequest
 * @property {string} phone - Phone number
 * @property {string} [userId] - User ID
 * @property {string} [sessionString] - Session string
 * @property {Object} [userInfo] - User information
 */

/**
 * @class ManageSessionUseCase
 * @extends {BaseUseCase}
 * @description Use case for managing sessions (create, update, pause, resume, delete)
 */
export class ManageSessionUseCase extends BaseUseCase {
  /**
   * Creates a new ManageSessionUseCase
   * @param {ISessionRepository} sessionRepository - Session repository
   * @param {Object} logger - Logger instance
   */
  constructor(sessionRepository, logger) {
    super(logger);
    this.sessionRepository = sessionRepository;
    this.appState = AppState;
  }

  /**
   * Creates a new session
   * @param {CreateSessionRequest} request - Create session request
   * @returns {Promise<Session>} Created session
   */
  async createSession(request) {
    try {
      this.validate(request);
      this.log('Creating new session', { phone: request.phone });

      // Check if session already exists
      const exists = await this.sessionRepository.exists(request.phone);
      if (exists) {
        throw new Error(`Session already exists: ${request.phone}`);
      }

      // Create session
      const session = await this.sessionRepository.create({
        phone: request.phone,
        userId: request.userId,
        sessionString: request.sessionString,
        status: SessionStatus.ACTIVE,
        firstName: request.userInfo?.firstName,
        lastName: request.userInfo?.lastName,
        username: request.userInfo?.username
      });

      // Update app state
      this.appState.setSession(session.phone, session.toObject());

      this.log('Session created successfully', { phone: session.phone });
      return session;

    } catch (error) {
      this.logError('Failed to create session', error, { request });
      throw error;
    }
  }

  /**
   * Updates an existing session
   * @param {string} phone - Session phone
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Session>} Updated session
   */
  async updateSession(phone, updates) {
    try {
      this.log('Updating session', { phone });

      const session = await this.sessionRepository.update(phone, updates);

      // Update app state
      this.appState.setSession(session.phone, session.toObject());

      this.log('Session updated successfully', { phone });
      return session;

    } catch (error) {
      this.logError('Failed to update session', error, { phone, updates });
      throw error;
    }
  }

  /**
   * Pauses a session
   * @param {string} phone - Session phone
   * @param {string} [reason] - Pause reason
   * @param {boolean} [auto=false] - Whether auto-paused
   * @returns {Promise<Session>} Updated session
   */
  async pauseSession(phone, reason = null, auto = false) {
    try {
      this.log('Pausing session', { phone, reason, auto });

      const session = await this.sessionRepository.updateStatus(
        phone,
        SessionStatus.PAUSED
      );

      await this.sessionRepository.update(phone, {
        pauseReason: reason,
        autoPaused: auto
      });

      // Update app state
      this.appState.updateSessionStatus(phone, SessionStatus.PAUSED);

      this.log('Session paused successfully', { phone });
      return session;

    } catch (error) {
      this.logError('Failed to pause session', error, { phone });
      throw error;
    }
  }

  /**
   * Resumes a paused session
   * @param {string} phone - Session phone
   * @returns {Promise<Session>} Updated session
   */
  async resumeSession(phone) {
    try {
      this.log('Resuming session', { phone });

      const session = await this.sessionRepository.update(phone, {
        status: SessionStatus.ACTIVE,
        pauseReason: null,
        autoPaused: false,
        lastError: null
      });

      // Update app state
      this.appState.updateSessionStatus(phone, SessionStatus.ACTIVE);

      this.log('Session resumed successfully', { phone });
      return session;

    } catch (error) {
      this.logError('Failed to resume session', error, { phone });
      throw error;
    }
  }

  /**
   * Deletes a session
   * @param {string} phone - Session phone
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteSession(phone) {
    try {
      this.log('Deleting session', { phone });

      const deleted = await this.sessionRepository.delete(phone);
      
      if (deleted) {
        // Remove from app state
        this.appState.removeSession(phone);
        this.log('Session deleted successfully', { phone });
      }

      return deleted;

    } catch (error) {
      this.logError('Failed to delete session', error, { phone });
      throw error;
    }
  }

  /**
   * Sets flood wait for session
   * @param {string} phone - Session phone
   * @param {number} seconds - Seconds to wait
   * @returns {Promise<Session>} Updated session
   */
  async setFloodWait(phone, seconds) {
    try {
      this.log('Setting flood wait for session', { phone, seconds });

      const session = await this.sessionRepository.setFloodWait(phone, seconds);

      // Update app state
      this.appState.updateSessionStatus(phone, SessionStatus.PAUSED);

      this.log('Flood wait set for session', { phone, seconds });
      return session;

    } catch (error) {
      this.logError('Failed to set flood wait', error, { phone, seconds });
      throw error;
    }
  }

  /**
   * Clears flood wait for session
   * @param {string} phone - Session phone
   * @returns {Promise<Session>} Updated session
   */
  async clearFloodWait(phone) {
    try {
      this.log('Clearing flood wait for session', { phone });

      const session = await this.sessionRepository.clearFloodWait(phone);

      // Update app state if session is now active
      if (session.isActive()) {
        this.appState.updateSessionStatus(phone, SessionStatus.ACTIVE);
      }

      this.log('Flood wait cleared for session', { phone });
      return session;

    } catch (error) {
      this.logError('Failed to clear flood wait', error, { phone });
      throw error;
    }
  }

  /**
   * Updates session activity timestamp
   * @param {string} phone - Session phone
   * @returns {Promise<Session>} Updated session
   */
  async updateActivity(phone) {
    try {
      const session = await this.sessionRepository.updateActivity(phone);
      this.appState.setSession(session.phone, session.toObject());
      return session;
    } catch (error) {
      this.logError('Failed to update session activity', error, { phone });
      throw error;
    }
  }

  /**
   * Saves session string
   * @param {string} phone - Session phone
   * @param {string} sessionString - Session string to save
   * @returns {Promise<Session>} Updated session
   */
  async saveSessionString(phone, sessionString) {
    try {
      this.log('Saving session string', { phone });

      const session = await this.sessionRepository.saveSessionString(phone, sessionString);

      // Update app state
      this.appState.setSession(session.phone, session.toObject());

      this.log('Session string saved successfully', { phone });
      return session;

    } catch (error) {
      this.logError('Failed to save session string', error, { phone });
      throw error;
    }
  }

  /**
   * Gets a session by phone
   * @param {string} phone - Session phone
   * @returns {Promise<Session|null>} Session or null
   */
  async getSession(phone) {
    try {
      return await this.sessionRepository.findById(phone);
    } catch (error) {
      this.logError('Failed to get session', error, { phone });
      throw error;
    }
  }

  /**
   * Gets all sessions
   * @param {Object} [options] - Query options
   * @param {string} [options.status] - Filter by status
   * @returns {Promise<Array<Session>>} Array of sessions
   */
  async getAllSessions(options = {}) {
    try {
      const filter = options.status ? { status: options.status } : {};
      return await this.sessionRepository.findAll(filter);
    } catch (error) {
      this.logError('Failed to get sessions', error, { options });
      throw error;
    }
  }

  /**
   * Gets active sessions
   * @returns {Promise<Array<Session>>} Array of active sessions
   */
  async getActiveSessions() {
    try {
      return await this.sessionRepository.findActive();
    } catch (error) {
      this.logError('Failed to get active sessions', error);
      throw error;
    }
  }

  /**
   * Gets session statistics
   * @returns {Promise<Object>} Session statistics
   */
  async getStatistics() {
    try {
      const total = await this.sessionRepository.count();
      const active = await this.sessionRepository.count({ status: SessionStatus.ACTIVE });
      const paused = await this.sessionRepository.count({ status: SessionStatus.PAUSED });
      const error = await this.sessionRepository.count({ status: SessionStatus.ERROR });

      return {
        total,
        active,
        paused,
        error
      };
    } catch (error) {
      this.logError('Failed to get session statistics', error);
      throw error;
    }
  }

  /**
   * Not used - kept for BaseUseCase compatibility
   * @private
   */
  async execute(request) {
    throw new Error('Use specific methods instead of execute()');
  }
}

export default ManageSessionUseCase;
