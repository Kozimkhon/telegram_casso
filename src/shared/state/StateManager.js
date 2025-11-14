/**
 * @fileoverview Global State Manager - Singleton with EventEmitter
 * Centralized state management for entire application
 * Handles runtime state for sessions, channels, users, and bots
 * @module shared/state/StateManager
 */

import { EventEmitter } from 'events';

/**
 * @typedef {Object} SessionState
 * @property {string} phone - Phone number
 * @property {string} userId - Telegram user ID
 * @property {string} status - Session status (active/paused/error)
 * @property {boolean} isRunning - Is bot running
 * @property {boolean} isPaused - Is bot paused
 * @property {string|null} pauseReason - Reason for pause
 * @property {number} connectedChannels - Number of connected channels
 * @property {Date} lastActive - Last activity timestamp
 */

/**
 * @typedef {Object} ChannelState
 * @property {string} channelId - Channel ID
 * @property {string} title - Channel title
 * @property {boolean} forwardEnabled - Forwarding enabled
 * @property {string|null} adminId - Admin user ID
 * @property {number} memberCount - Number of members
 */

/**
 * Global State Manager Singleton
 * Manages application-wide state with event-driven updates
 * 
 * @class StateManager
 * @extends EventEmitter
 * 
 * @example
 * const stateManager = StateManager.getInstance();
 * 
 * // Subscribe to events
 * stateManager.on('session:added', (session) => {
 *   console.log('New session:', session.phone);
 * });
 * 
 * // Update state
 * stateManager.addSession({
 *   phone: '+1234567890',
 *   userId: '123456',
 *   status: 'active'
 * });
 * 
 * // Get state
 * const sessions = stateManager.getAllSessions();
 */
class StateManager extends EventEmitter {
  /**
   * Singleton instance
   * @private
   * @static
   */
  static #instance = null;

  /**
   * Container instance
   * @private
   * @type {Object|null}
   */
  #container = null;

  /**
   * Private constructor (Singleton pattern)
   * @private
   */
  constructor() {
    if (StateManager.#instance) {
      throw new Error('StateManager is a singleton. Use getInstance() instead.');
    }
    
    super();
    
    /**
     * Sessions map: phone -> SessionState
     * @private
     * @type {Map<string, SessionState>}
     */
    this.sessions = new Map();

    /**
     * Channels map: channelId -> ChannelState
     * @private
     * @type {Map<string, ChannelState>}
     */
    this.channels = new Map();

    /**
     * Users map: userId -> UserData
     * @private
     * @type {Map<string, Object>}
     */
    this.users = new Map();

    /**
     * Application metadata
     * @private
     * @type {Object}
     */
    this.metadata = {
      startTime: new Date(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    /**
     * Bot instances registry
     * @private
     * @type {Map<string, Object>}
     */
    this.botInstances = new Map();

    /**
     * Container reference for service access
     * @private
     * @type {Object|null}
     */
    this.#container = null;

    this.setMaxListeners(50); // Increase for multiple subscribers
  }

  /**
   * Gets singleton instance
   * @static
   * @returns {StateManager} StateManager instance
   */
  static getInstance() {
    if (!StateManager.#instance) {
      StateManager.#instance = new StateManager();
    }
    return StateManager.#instance;
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Adds or updates a session
   * @param {SessionState} sessionData - Session data
   * @emits session:added - When new session is added
   * @emits session:updated - When existing session is updated
   */
  addSession(sessionData) {
    const { phone } = sessionData;
    const isNew = !this.sessions.has(phone);

    this.sessions.set(phone, {
      ...sessionData,
      lastUpdated: new Date()
    });

    if (isNew) {
      this.emit('session:added', sessionData);
    } else {
      this.emit('session:updated', sessionData);
    }
  }

  /**
   * Removes a session
   * @param {string} phone - Phone number
   * @emits session:removed - When session is removed
   * @returns {boolean} True if removed
   */
  removeSession(phone) {
    const session = this.sessions.get(phone);
    const removed = this.sessions.delete(phone);
    
    if (removed && session) {
      this.emit('session:removed', session);
    }
    
    return removed;
  }

  /**
   * Gets a session by phone
   * @param {string} phone - Phone number
   * @returns {SessionState|null} Session data or null
   */
  getSession(phone) {
    return this.sessions.get(phone) || null;
  }

  /**
   * Gets all sessions
   * @param {Object} filters - Optional filters
   * @param {string} filters.status - Filter by status
   * @returns {Array<SessionState>} Array of sessions
   */
  getAllSessions(filters = {}) {
    let sessions = Array.from(this.sessions.values());

    if (filters.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }

    return sessions;
  }

  /**
   * Updates session status
   * @param {string} phone - Phone number
   * @param {string} status - New status
   * @param {Object} metadata - Additional metadata
   * @emits session:status_changed - When status changes
   */
  updateSessionStatus(phone, status, metadata = {}) {
    const session = this.sessions.get(phone);
    
    if (!session) {
      return;
    }

    const oldStatus = session.status;
    
    this.sessions.set(phone, {
      ...session,
      status,
      ...metadata,
      lastUpdated: new Date()
    });

    this.emit('session:status_changed', {
      phone,
      oldStatus,
      newStatus: status,
      metadata
    });
  }

  // ==================== CHANNEL MANAGEMENT ====================

  /**
   * Adds or updates a channel
   * @param {ChannelState} channelData - Channel data
   * @emits channel:added - When new channel is added
   * @emits channel:updated - When existing channel is updated
   */
  addChannel(channelData) {
    const { channelId } = channelData;
    const isNew = !this.channels.has(channelId);

    this.channels.set(channelId, {
      ...channelData,
      lastUpdated: new Date()
    });

    if (isNew) {
      this.emit('channel:added', channelData);
    } else {
      this.emit('channel:updated', channelData);
    }
  }

  /**
   * Removes a channel
   * @param {string} channelId - Channel ID
   * @emits channel:removed - When channel is removed
   * @returns {boolean} True if removed
   */
  removeChannel(channelId) {
    const channel = this.channels.get(channelId);
    const removed = this.channels.delete(channelId);
    
    if (removed && channel) {
      this.emit('channel:removed', channel);
    }
    
    return removed;
  }

  /**
   * Gets a channel by ID
   * @param {string} channelId - Channel ID
   * @returns {ChannelState|null} Channel data or null
   */
  getChannel(channelId) {
    return this.channels.get(channelId) || null;
  }

  /**
   * Gets all channels
   * @param {Object} filters - Optional filters
   * @param {boolean} filters.forwardEnabled - Filter by forward enabled
   * @param {string} filters.adminId - Filter by admin ID
   * @returns {Array<ChannelState>} Array of channels
   */
  getAllChannels(filters = {}) {
    let channels = Array.from(this.channels.values());

    if (filters.forwardEnabled !== undefined) {
      channels = channels.filter(c => c.forwardEnabled === filters.forwardEnabled);
    }

    if (filters.adminId) {
      channels = channels.filter(c => c.adminId === filters.adminId);
    }

    return channels;
  }

  /**
   * Toggles channel forwarding
   * @param {string} channelId - Channel ID
   * @emits channel:forwarding_toggled - When forwarding is toggled
   */
  toggleChannelForwarding(channelId) {
    const channel = this.channels.get(channelId);
    
    if (!channel) {
      return;
    }

    const newStatus = !channel.forwardEnabled;
    
    this.channels.set(channelId, {
      ...channel,
      forwardEnabled: newStatus,
      lastUpdated: new Date()
    });

    this.emit('channel:forwarding_toggled', {
      channelId,
      forwardEnabled: newStatus
    });
  }

  // ==================== USER MANAGEMENT ====================

  /**
   * Adds or updates a user
   * @param {Object} userData - User data
   * @emits user:added - When new user is added
   * @emits user:updated - When existing user is updated
   */
  addUser(userData) {
    const { userId } = userData;
    const isNew = !this.users.has(userId);

    this.users.set(userId, {
      ...userData,
      lastUpdated: new Date()
    });

    if (isNew) {
      this.emit('user:added', userData);
    } else {
      this.emit('user:updated', userData);
    }
  }

  /**
   * Removes a user
   * @param {string} userId - User ID
   * @emits user:removed - When user is removed
   * @returns {boolean} True if removed
   */
  removeUser(userId) {
    const user = this.users.get(userId);
    const removed = this.users.delete(userId);
    
    if (removed && user) {
      this.emit('user:removed', user);
    }
    
    return removed;
  }

  /**
   * Gets a user by ID
   * @param {string} userId - User ID
   * @returns {Object|null} User data or null
   */
  getUser(userId) {
    return this.users.get(userId) || null;
  }

  /**
   * Gets all users
   * @returns {Array<Object>} Array of users
   */
  getAllUsers() {
    return Array.from(this.users.values());
  }

  // ==================== BOT INSTANCE MANAGEMENT ====================

  /**
   * Registers a bot instance
   * @param {string} identifier - Bot identifier (phone or bot token)
   * @param {Object} instance - Bot instance
   * @emits bot:registered - When bot is registered
   */
  registerBot(identifier, instance) {
    this.botInstances.set(identifier, instance);
    this.emit('bot:registered', { identifier, instance });
  }

  /**
   * Unregisters a bot instance
   * @param {string} identifier - Bot identifier
   * @emits bot:unregistered - When bot is unregistered
   * @returns {boolean} True if unregistered
   */
  unregisterBot(identifier) {
    const removed = this.botInstances.delete(identifier);
    
    if (removed) {
      this.emit('bot:unregistered', { identifier });
    }
    
    return removed;
  }

  /**
   * Gets a bot instance
   * @param {string} identifier - Bot identifier
   * @returns {Object|null} Bot instance or null
   */
  getBot(identifier) {
    return this.botInstances.get(identifier) || null;
  }

  /**
   * Sets the container reference
   * @param {Object} container - Container instance
   */
  setContainer(container) {
    this.#container = container;
  }

  /**
   * Gets a service from the container
   * @param {string} serviceName - Service name
   * @returns {Object|null} Service instance or null
   */
  getService(serviceName) {
    if (!this.#container) {
      return null;
    }
    
    try {
      return this.#container.resolve(serviceName);
    } catch (error) {
      console.error(`Failed to resolve service: ${serviceName}`, error);
      return null;
    }
  }

  // ==================== STATE QUERIES ====================

  /**
   * Gets complete state snapshot
   * @returns {Object} State snapshot
   */
  getSnapshot() {
    return {
      sessions: {
        total: this.sessions.size,
        active: this.getAllSessions({ status: 'active' }).length,
        paused: this.getAllSessions({ status: 'paused' }).length,
        error: this.getAllSessions({ status: 'error' }).length,
        list: Array.from(this.sessions.values())
      },
      channels: {
        total: this.channels.size,
        enabled: this.getAllChannels({ forwardEnabled: true }).length,
        disabled: this.getAllChannels({ forwardEnabled: false }).length,
        list: Array.from(this.channels.values())
      },
      users: {
        total: this.users.size,
        list: Array.from(this.users.values())
      },
      bots: {
        total: this.botInstances.size,
        identifiers: Array.from(this.botInstances.keys())
      },
      metadata: {
        ...this.metadata,
        uptime: Date.now() - this.metadata.startTime.getTime()
      }
    };
  }

  /**
   * Clears all state (use with caution)
   * @emits state:cleared - When state is cleared
   */
  clear() {
    this.sessions.clear();
    this.channels.clear();
    this.users.clear();
    this.botInstances.clear();
    
    this.emit('state:cleared');
  }

  /**
   * Subscribes to state changes
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    this.on(event, callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }
}

// Export singleton instance
export default StateManager.getInstance();
