/**
 * Type definitions using JSDoc for better IDE support
 * @module shared/types
 */

/**
 * @typedef {Object} ChannelData
 * @property {string} channelId - Unique channel identifier
 * @property {string} title - Channel title/name
 * @property {boolean} forwardEnabled - Whether forwarding is enabled
 * @property {string} [adminSessionPhone] - Phone of admin session managing this channel
 * @property {number} [throttleDelayMs] - Throttle delay in milliseconds
 * @property {number} [throttlePerMemberMs] - Per-member throttle delay
 * @property {number} [minDelayMs] - Minimum delay between messages
 * @property {number} [maxDelayMs] - Maximum delay between messages
 * @property {boolean} [scheduleEnabled] - Whether scheduling is enabled
 * @property {string} [scheduleConfig] - Schedule configuration JSON
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} UserData
 * @property {string} userId - Unique user identifier
 * @property {string} [firstName] - User's first name
 * @property {string} [lastName] - User's last name
 * @property {string} [username] - Telegram username
 * @property {string} [phone] - Phone number
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} SessionData
 * @property {string} phone - Phone number (unique identifier)
 * @property {string} [userId] - Telegram user ID
 * @property {string} [sessionString] - Session string for authentication
 * @property {string} status - Session status (active/paused/error)
 * @property {string} [firstName] - User's first name
 * @property {string} [lastName] - User's last name
 * @property {string} [username] - Telegram username
 * @property {boolean} [autoPaused] - Whether session was auto-paused
 * @property {string} [pauseReason] - Reason for pause
 * @property {Date} [floodWaitUntil] - Flood wait expiry time
 * @property {string} [lastError] - Last error message
 * @property {Date} [lastActive] - Last activity timestamp
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} AdminData
 * @property {string} userId - Telegram user ID
 * @property {string} [firstName] - First name
 * @property {string} [lastName] - Last name
 * @property {string} [username] - Telegram username
 * @property {string} role - User role (admin/super_admin)
 * @property {boolean} isActive - Whether admin is active
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} MessageData
 * @property {string} channelId - Source channel ID
 * @property {string} messageId - Original message ID
 * @property {string} userId - Recipient user ID
 * @property {string} [sessionPhone] - Session phone that forwarded the message
 * @property {string} [forwardedMessageId] - ID of forwarded message
 * @property {string} status - Message status (pending/sent/failed)
 * @property {string} [errorMessage] - Error message if failed
 * @property {number} retryCount - Number of retry attempts
 * @property {Date} [createdAt] - Creation timestamp
 * @property {Date} [updatedAt] - Last update timestamp
 */

/**
 * @typedef {Object} MetricsData
 * @property {string} [sessionPhone] - Session phone
 * @property {string} [channelId] - Channel ID
 * @property {string} [userId] - User ID
 * @property {number} messagesSent - Count of sent messages
 * @property {number} messagesFailed - Count of failed messages
 * @property {number} floodErrors - Count of flood errors
 * @property {number} spamWarnings - Count of spam warnings
 * @property {Date} [lastMessageAt] - Last message timestamp
 * @property {Date} [lastFloodAt] - Last flood error timestamp
 * @property {Date} [lastActivity] - Last activity timestamp
 */

/**
 * @typedef {Object} AppStateData
 * @property {boolean} isRunning - Whether app is running
 * @property {Map<string, Object>} sessions - Active sessions map
 * @property {Map<string, Object>} channels - Active channels map
 * @property {Object} config - Application configuration
 * @property {Object} [userBotManager] - UserBot manager instance
 * @property {Object} [adminBot] - AdminBot instance
 */

/**
 * @typedef {Object} ForwardingResult
 * @property {boolean} success - Whether forwarding succeeded
 * @property {string} userId - Target user ID
 * @property {string} [forwardedMessageId] - Forwarded message ID if successful
 * @property {string} [error] - Error message if failed
 * @property {number} retryCount - Number of retry attempts
 */

/**
 * @typedef {Object} RepositoryResult
 * @property {boolean} success - Whether operation succeeded
 * @property {*} [data] - Result data if successful
 * @property {string} [error] - Error message if failed
 * @property {string} [errorType] - Type of error
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of validation error messages
 */

/**
 * @typedef {Object} PaginationOptions
 * @property {number} page - Page number (1-indexed)
 * @property {number} limit - Items per page
 * @property {string} [sortBy] - Field to sort by
 * @property {string} [sortOrder] - Sort order (asc/desc)
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {Array} items - Array of items
 * @property {number} total - Total count
 * @property {number} page - Current page
 * @property {number} totalPages - Total pages
 * @property {boolean} hasNext - Whether there's a next page
 * @property {boolean} hasPrev - Whether there's a previous page
 */

export {};
