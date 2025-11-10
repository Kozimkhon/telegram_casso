/**
 * Application-wide constants
 * @module shared/constants
 */

/**
 * Session status constants
 * @readonly
 * @enum {string}
 */
export const SessionStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
  AUTHENTICATING: 'authenticating',
  DISCONNECTED: 'disconnected'
};

/**
 * Message forwarding status
 * @readonly
 * @enum {string}
 */
export const MessageStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  RETRYING: 'retrying',
  DELETED: 'deleted'
};

/**
 * User role constants
 * @readonly
 * @enum {string}
 */
export const UserRole = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  USER: 'user'
};

/**
 * Error types for better error handling
 * @readonly
 * @enum {string}
 */
export const ErrorType = {
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  DATABASE: 'DATABASE_ERROR',
  TELEGRAM: 'TELEGRAM_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  NETWORK: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  PERMISSION: 'PERMISSION_ERROR'
};

/**
 * Rate limiting constants
 * @readonly
 */
export const RateLimits = {
  DEFAULT_DELAY_MS: 1000,
  PER_MEMBER_DELAY_MS: 500,
  MIN_DELAY_MS: 2000,
  MAX_DELAY_MS: 5000,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000,
  FLOOD_WAIT_BUFFER_SEC: 10
};

/**
 * Database table names
 * @readonly
 */
export const Tables = {
  ADMINS: 'admins',
  CHANNELS: 'channels',
  USERS: 'users',
  SESSIONS: 'sessions',
  METRICS: 'metrics',
  SETTINGS: 'settings',
  MESSAGE_LOGS: 'message_logs',
  CHANNEL_MEMBERS: 'channel_members'
};

/**
 * Application events for event-driven architecture
 * @readonly
 * @enum {string}
 */
export const AppEvents = {
  // Session events
  SESSION_CREATED: 'session:created',
  SESSION_AUTHENTICATED: 'session:authenticated',
  SESSION_PAUSED: 'session:paused',
  SESSION_RESUMED: 'session:resumed',
  SESSION_ERROR: 'session:error',
  SESSION_DELETED: 'session:deleted',
  
  // Channel events
  CHANNEL_ADDED: 'channel:added',
  CHANNEL_REMOVED: 'channel:removed',
  CHANNEL_UPDATED: 'channel:updated',
  CHANNEL_FORWARDING_TOGGLED: 'channel:forwarding_toggled',
  
  // Message events
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_FORWARDED: 'message:forwarded',
  MESSAGE_FAILED: 'message:failed',
  MESSAGE_DELETED: 'message:deleted',
  
  // Application events
  APP_STARTED: 'app:started',
  APP_STOPPING: 'app:stopping',
  APP_STOPPED: 'app:stopped',
  APP_ERROR: 'app:error'
};

/**
 * Validation rules
 * @readonly
 */
export const ValidationRules = {
  MAX_TITLE_LENGTH: 200,
  MAX_USERNAME_LENGTH: 32,
  MAX_PHONE_LENGTH: 20,
  MIN_PHONE_LENGTH: 10,
  MAX_MESSAGE_LENGTH: 4096,
  CHANNEL_ID_PATTERN: /^-?\d+$/
};

export default {
  SessionStatus,
  MessageStatus,
  UserRole,
  ErrorType,
  RateLimits,
  Tables,
  AppEvents,
  ValidationRules
};
