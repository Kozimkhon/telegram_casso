/**
 * @fileoverview Application Constants
 * Central location for all application-wide constants
 * @module shared/constants
 */

/**
 * Session status enum
 * @readonly
 * @enum {string}
 */
export const SessionStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
  INACTIVE: 'inactive'
};

/**
 * Message forwarding status
 * @readonly
 * @enum {string}
 */
export const ForwardingStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  PENDING: 'pending'
};

/**
 * Admin roles
 * @readonly
 * @enum {string}
 */
export const AdminRole = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MODERATOR: 'moderator'
};

/**
 * State Manager Events
 * @readonly
 * @enum {string}
 */
export const StateEvents = {
  // Session events
  SESSION_ADDED: 'session:added',
  SESSION_UPDATED: 'session:updated',
  SESSION_REMOVED: 'session:removed',
  SESSION_STATUS_CHANGED: 'session:status_changed',
  
  // Channel events
  CHANNEL_ADDED: 'channel:added',
  CHANNEL_UPDATED: 'channel:updated',
  CHANNEL_REMOVED: 'channel:removed',
  CHANNEL_FORWARDING_TOGGLED: 'channel:forwarding_toggled',
  
  // User events
  USER_ADDED: 'user:added',
  USER_UPDATED: 'user:updated',
  USER_REMOVED: 'user:removed',
  
  // Bot events
  BOT_REGISTERED: 'bot:registered',
  BOT_UNREGISTERED: 'bot:unregistered',
  
  // System events
  STATE_CLEARED: 'state:cleared'
};

/**
 * Validation rules
 * @readonly
 */
export const ValidationRules = {
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 20,
  USERNAME_MAX_LENGTH: 50,
  NAME_MAX_LENGTH: 100,
  TITLE_MAX_LENGTH: 200,
  ERROR_MESSAGE_MAX_LENGTH: 500
};

/**
 * Telegram API limits
 * @readonly
 */
export const TelegramLimits = {
  MAX_MESSAGE_LENGTH: 4096,
  MAX_CAPTION_LENGTH: 1024,
  DEFAULT_FLOOD_WAIT: 60,
  MIN_DELAY_BETWEEN_MESSAGES: 1000,
  MAX_RETRIES: 3
};

/**
 * Default configuration values
 * @readonly
 */
export const Defaults = {
  PAGE_SIZE: 10,
  LOG_RETENTION_DAYS: 30,
  MESSAGE_AGE_HOURS: 24,
  SYNC_INTERVAL_MINUTES: 2,
  DELETE_INTERVAL_HOURS: 1
};

export default {
  SessionStatus,
  ForwardingStatus,
  AdminRole,
  StateEvents,
  ValidationRules,
  TelegramLimits,
  Defaults
};
