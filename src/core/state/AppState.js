/**
 * Global Application State Manager (Singleton)
 * Centralized state management for the entire application
 * Follows the Singleton pattern and provides event-driven updates
 * 
 * @module core/state/AppState
 */

import { EventEmitter } from 'events';
import { AppEvents, SessionStatus } from '../../shared/constants/index.js';

/**
 * @class AppState
 * @extends EventEmitter
 * @description Singleton class managing global application state
 * Provides centralized access to sessions, channels, config, and bot instances
 */
class AppState extends EventEmitter {
  /**
   * @private
   * @static
   * @type {AppState|null}
   */
  static #instance = null;

  /**
   * Private constructor to enforce singleton pattern
   * @private
   */
  constructor() {
    if (AppState.#instance) {
      throw new Error('AppState is a singleton. Use AppState.getInstance() instead.');
    }

    super();
    
    /**
     * Application running state
     * @private
     * @type {boolean}
     */
    this.#isRunning = false;

    /**
     * Application shutting down state
     * @private
     * @type {boolean}
     */
    this.#isShuttingDown = false;

    /**
     * Active sessions map (phone -> session data)
     * @private
     * @type {Map<string, Object>}
     */
    this.#sessions = new Map();

    /**
     * Active channels map (channelId -> channel data)
     * @private
     * @type {Map<string, Object>}
     */
    this.#channels = new Map();

    /**
     * Active admin users map (userId -> admin data)
     * @private
     * @type {Map<string, Object>}
     */
    this.#admins = new Map();

    /**
     * Application configuration
     * @private
     * @type {Object|null}
     */
    this.#config = null;

    /**
     * UserBot manager instance
     * @private
     * @type {Object|null}
     */
    this.#userBotManager = null;

    /**
     * AdminBot instance
     * @private
     * @type {Object|null}
     */
    this.#adminBot = null;

    /**
     * Application start time
     * @private
     * @type {Date|null}
     */
    this.#startTime = null;

    /**
     * Metrics data
     * @private
     * @type {Object}
     */
    this.#metrics = {
      totalMessagesSent: 0,
      totalMessagesFailed: 0,
      totalFloodErrors: 0,
      totalSpamWarnings: 0
    };

    AppState.#instance = this;
  }

  /**
   * Gets the singleton instance of AppState
   * @static
   * @returns {AppState} The singleton instance
   */
  static getInstance() {
    if (!AppState.#instance) {
      new AppState();
    }
    return AppState.#instance;
  }

  // ==================== Configuration Management ====================

  /**
   * Sets the application configuration
   * @param {Object} config - Configuration object
   * @throws {Error} If config is invalid
   */
  setConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration object');
    }
    this.#config = Object.freeze({ ...config });
  }

  /**
   * Gets the application configuration
   * @returns {Object} Configuration object (read-only)
   */
  getConfig() {
    return this.#config;
  }

  // ==================== Running State Management ====================

  /**
   * Marks the application as started
   * @emits {AppEvents.APP_STARTED}
   */
  start() {
    this.#isRunning = true;
    this.#startTime = new Date();
    this.emit(AppEvents.APP_STARTED, { startTime: this.#startTime });
  }

  /**
   * Marks the application as stopping
   * @emits {AppEvents.APP_STOPPING}
   */
  stop() {
    this.#isShuttingDown = true;
    this.emit(AppEvents.APP_STOPPING);
  }

  /**
   * Marks the application as fully stopped
   * @emits {AppEvents.APP_STOPPED}
   */
  stopped() {
    this.#isRunning = false;
    this.#isShuttingDown = false;
    this.emit(AppEvents.APP_STOPPED);
  }

  /**
   * Checks if application is running
   * @returns {boolean} True if running
   */
  isRunning() {
    return this.#isRunning;
  }

  /**
   * Checks if application is shutting down
   * @returns {boolean} True if shutting down
   */
  isShuttingDown() {
    return this.#isShuttingDown;
  }

  /**
   * Gets application uptime in milliseconds
   * @returns {number} Uptime in ms, or 0 if not started
   */
  getUptime() {
    return this.#startTime ? Date.now() - this.#startTime.getTime() : 0;
  }

  // ==================== Session Management ====================

  /**
   * Adds or updates a session
   * @param {string} phone - Session phone number
   * @param {Object} sessionData - Session data
   * @emits {AppEvents.SESSION_CREATED} When session is new
   */
  setSession(phone, sessionData) {
    if (!phone || typeof phone !== 'string') {
      throw new Error('Invalid session phone');
    }

    const isNew = !this.#sessions.has(phone);
    this.#sessions.set(phone, { ...sessionData, phone });

    if (isNew) {
      this.emit(AppEvents.SESSION_CREATED, { phone, sessionData });
    }
  }

  /**
   * Gets a session by phone
   * @param {string} phone - Session phone number
   * @returns {Object|null} Session data or null
   */
  getSession(phone) {
    return this.#sessions.get(phone) || null;
  }

  /**
   * Gets all sessions
   * @param {string} [status] - Optional status filter
   * @returns {Array<Object>} Array of session objects
   */
  getAllSessions(status = null) {
    const sessions = Array.from(this.#sessions.values());
    return status ? sessions.filter(s => s.status === status) : sessions;
  }

  /**
   * Removes a session
   * @param {string} phone - Session phone number
   * @returns {boolean} True if session was removed
   * @emits {AppEvents.SESSION_DELETED} When session is removed
   */
  removeSession(phone) {
    const deleted = this.#sessions.delete(phone);
    if (deleted) {
      this.emit(AppEvents.SESSION_DELETED, { phone });
    }
    return deleted;
  }

  /**
   * Updates session status
   * @param {string} phone - Session phone number
   * @param {string} status - New status
   * @emits {AppEvents.SESSION_PAUSED|SESSION_RESUMED|SESSION_ERROR}
   */
  updateSessionStatus(phone, status) {
    const session = this.#sessions.get(phone);
    if (session) {
      session.status = status;
      session.updatedAt = new Date();

      // Emit appropriate event
      if (status === SessionStatus.PAUSED) {
        this.emit(AppEvents.SESSION_PAUSED, { phone, session });
      } else if (status === SessionStatus.ACTIVE) {
        this.emit(AppEvents.SESSION_RESUMED, { phone, session });
      } else if (status === SessionStatus.ERROR) {
        this.emit(AppEvents.SESSION_ERROR, { phone, session });
      }
    }
  }

  // ==================== Channel Management ====================

  /**
   * Adds or updates a channel
   * @param {string} channelId - Channel ID
   * @param {Object} channelData - Channel data
   * @emits {AppEvents.CHANNEL_ADDED} When channel is new
   */
  setChannel(channelId, channelData) {
    if (!channelId || typeof channelId !== 'string') {
      throw new Error('Invalid channel ID');
    }

    const isNew = !this.#channels.has(channelId);
    this.#channels.set(channelId, { ...channelData, channelId });

    if (isNew) {
      this.emit(AppEvents.CHANNEL_ADDED, { channelId, channelData });
    }
  }

  /**
   * Gets a channel by ID
   * @param {string} channelId - Channel ID
   * @returns {Object|null} Channel data or null
   */
  getChannel(channelId) {
    return this.#channels.get(channelId) || null;
  }

  /**
   * Gets all channels
   * @param {boolean} [onlyEnabled=false] - Only return enabled channels
   * @returns {Array<Object>} Array of channel objects
   */
  getAllChannels(onlyEnabled = false) {
    const channels = Array.from(this.#channels.values());
    return onlyEnabled ? channels.filter(c => c.forwardEnabled) : channels;
  }

  /**
   * Removes a channel
   * @param {string} channelId - Channel ID
   * @returns {boolean} True if channel was removed
   * @emits {AppEvents.CHANNEL_REMOVED} When channel is removed
   */
  removeChannel(channelId) {
    const deleted = this.#channels.delete(channelId);
    if (deleted) {
      this.emit(AppEvents.CHANNEL_REMOVED, { channelId });
    }
    return deleted;
  }

  /**
   * Toggles channel forwarding status
   * @param {string} channelId - Channel ID
   * @returns {boolean} New forwarding status
   * @emits {AppEvents.CHANNEL_FORWARDING_TOGGLED}
   */
  toggleChannelForwarding(channelId) {
    const channel = this.#channels.get(channelId);
    if (channel) {
      channel.forwardEnabled = !channel.forwardEnabled;
      this.emit(AppEvents.CHANNEL_FORWARDING_TOGGLED, { 
        channelId, 
        enabled: channel.forwardEnabled 
      });
      return channel.forwardEnabled;
    }
    return false;
  }

  // ==================== Admin Management ====================

  /**
   * Adds or updates an admin
   * @param {string} userId - Admin user ID
   * @param {Object} adminData - Admin data
   */
  setAdmin(userId, adminData) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid admin user ID');
    }
    this.#admins.set(userId, { ...adminData, userId });
  }

  /**
   * Gets an admin by user ID
   * @param {string} userId - Admin user ID
   * @returns {Object|null} Admin data or null
   */
  getAdmin(userId) {
    return this.#admins.get(userId) || null;
  }

  /**
   * Checks if user is an admin
   * @param {string} userId - User ID to check
   * @returns {boolean} True if user is admin
   */
  isAdmin(userId) {
    return this.#admins.has(userId);
  }

  /**
   * Gets all admins
   * @returns {Array<Object>} Array of admin objects
   */
  getAllAdmins() {
    return Array.from(this.#admins.values());
  }

  // ==================== Bot Instance Management ====================

  /**
   * Sets the UserBot manager instance
   * @param {Object} manager - UserBot manager
   */
  setUserBotManager(manager) {
    this.#userBotManager = manager;
  }

  /**
   * Gets the UserBot manager instance
   * @returns {Object|null} UserBot manager or null
   */
  getUserBotManager() {
    return this.#userBotManager;
  }

  /**
   * Sets the AdminBot instance
   * @param {Object} bot - AdminBot instance
   */
  setAdminBot(bot) {
    this.#adminBot = bot;
  }

  /**
   * Gets the AdminBot instance
   * @returns {Object|null} AdminBot instance or null
   */
  getAdminBot() {
    return this.#adminBot;
  }

  // ==================== Metrics Management ====================

  /**
   * Increments a metric counter
   * @param {string} metric - Metric name
   * @param {number} [amount=1] - Amount to increment
   */
  incrementMetric(metric, amount = 1) {
    if (this.#metrics.hasOwnProperty(metric)) {
      this.#metrics[metric] += amount;
    }
  }

  /**
   * Gets all metrics
   * @returns {Object} Metrics object (read-only)
   */
  getMetrics() {
    return { ...this.#metrics };
  }

  /**
   * Resets all metrics
   */
  resetMetrics() {
    Object.keys(this.#metrics).forEach(key => {
      this.#metrics[key] = 0;
    });
  }

  // ==================== Status and Diagnostics ====================

  /**
   * Gets complete application state snapshot
   * @returns {Object} State snapshot
   */
  getSnapshot() {
    return {
      isRunning: this.#isRunning,
      isShuttingDown: this.#isShuttingDown,
      uptime: this.getUptime(),
      startTime: this.#startTime,
      sessions: {
        total: this.#sessions.size,
        active: this.getAllSessions(SessionStatus.ACTIVE).length,
        paused: this.getAllSessions(SessionStatus.PAUSED).length,
        error: this.getAllSessions(SessionStatus.ERROR).length
      },
      channels: {
        total: this.#channels.size,
        enabled: this.getAllChannels(true).length
      },
      admins: {
        total: this.#admins.size
      },
      metrics: this.getMetrics(),
      memory: process.memoryUsage(),
      environment: this.#config?.app?.environment || 'unknown'
    };
  }

  /**
   * Clears all state (use with caution)
   * @private
   */
  clearAll() {
    this.#sessions.clear();
    this.#channels.clear();
    this.#admins.clear();
    this.resetMetrics();
    this.removeAllListeners();
  }
}

// Export singleton instance
export default AppState.getInstance();
