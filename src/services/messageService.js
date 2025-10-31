/**
 * Message service module - responsible for message forwarding and logging
 * Handles message distribution logic and tracks forwarding results
 */

import { runQuery, getAllQuery, getQuery } from '../db/db.js';
import { log } from '../utils/logger.js';
import { handleDatabaseError, withRetry } from '../utils/errorHandler.js';
import { sanitizeText, chunkArray, createRateLimiter } from '../utils/helpers.js';
import { isChannelEnabled } from './channelService.js';
import { getAllUsers } from './userService.js';

// Rate limiter: max 20 messages per minute to avoid hitting Telegram limits
const messageLimiter = createRateLimiter(20, 60000);

/**
 * Logs a message forwarding attempt
 * @param {string} channelId - Source channel ID
 * @param {string} messageId - Original message ID
 * @param {string} userId - Target user ID
 * @param {string} status - Status (success, failed, skipped)
 * @param {string} errorMessage - Error message if failed
 * @returns {Promise<void>}
 */
export async function logMessageForward(channelId, messageId, userId, status, errorMessage = null) {
  try {
    log.dbOperation('INSERT', 'message_logs', { channelId, messageId, userId, status });

    await runQuery(
      `INSERT INTO message_logs 
       (channel_id, message_id, user_id, status, error_message) 
       VALUES (?, ?, ?, ?, ?)`,
      [channelId, messageId, userId, status, errorMessage]
    );

    log.messageForward(channelId, userId, status, { messageId, errorMessage });
  } catch (error) {
    // Don't throw here to avoid disrupting message forwarding
    log.error('Failed to log message forward attempt', {
      channelId,
      messageId,
      userId,
      status,
      error: error.message
    });
  }
}

/**
 * Gets message forwarding statistics
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Forwarding statistics
 */
export async function getForwardingStats(options = {}) {
  try {
    const {
      channelId = null,
      fromDate = null,
      toDate = null,
      limit = 100
    } = options;

    log.dbOperation('SELECT', 'message_logs', { operation: 'stats', options });

    let whereClause = '';
    const params = [];

    if (channelId) {
      whereClause += ' WHERE channel_id = ?';
      params.push(channelId);
    }

    if (fromDate) {
      whereClause += whereClause ? ' AND' : ' WHERE';
      whereClause += ' created_at >= ?';
      params.push(fromDate);
    }

    if (toDate) {
      whereClause += whereClause ? ' AND' : ' WHERE';
      whereClause += ' created_at <= ?';
      params.push(toDate);
    }

    const [totalLogs, successLogs, failedLogs] = await Promise.all([
      getQuery(`SELECT COUNT(*) as count FROM message_logs${whereClause}`, params),
      getQuery(`SELECT COUNT(*) as count FROM message_logs${whereClause}${whereClause ? ' AND' : ' WHERE'} status = 'success'`, [...params]),
      getQuery(`SELECT COUNT(*) as count FROM message_logs${whereClause}${whereClause ? ' AND' : ' WHERE'} status = 'failed'`, [...params])
    ]);

    const stats = {
      total: totalLogs?.count || 0,
      successful: successLogs?.count || 0,
      failed: failedLogs?.count || 0,
      successRate: totalLogs?.count > 0 ? (successLogs?.count / totalLogs?.count * 100).toFixed(2) : 0
    };

    log.debug('Forwarding statistics retrieved', { stats, options });
    return stats;
  } catch (error) {
    throw handleDatabaseError(error, 'getForwardingStats');
  }
}

/**
 * Gets recent message forwarding logs
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of log entries
 */
export async function getRecentForwardingLogs(options = {}) {
  try {
    const {
      limit = 50,
      status = null,
      channelId = null
    } = options;

    log.dbOperation('SELECT', 'message_logs', { operation: 'recent', options });

    let whereClause = '';
    const params = [];

    if (status) {
      whereClause += ' WHERE status = ?';
      params.push(status);
    }

    if (channelId) {
      whereClause += whereClause ? ' AND' : ' WHERE';
      whereClause += ' channel_id = ?';
      params.push(channelId);
    }

    params.push(limit);

    const logs = await getAllQuery(
      `SELECT * FROM message_logs${whereClause} 
       ORDER BY created_at DESC LIMIT ?`,
      params
    );

    log.debug(`Retrieved ${logs.length} recent forwarding logs`, options);
    return logs;
  } catch (error) {
    throw handleDatabaseError(error, 'getRecentForwardingLogs');
  }
}

/**
 * Processes a message for forwarding to all users
 * @param {Object} message - Message object from Telegram
 * @param {string} channelId - Source channel ID
 * @param {Function} forwardFunction - Function to send message to user
 * @returns {Promise<Object>} Forwarding results
 */
export async function processMessageForwarding(message, channelId, forwardFunction) {
  try {
    const messageId = message.id?.toString() || 'unknown';
    
    log.info('Processing message for forwarding', {
      channelId,
      messageId,
      messageType: message.className || 'unknown'
    });

    // Check if forwarding is enabled for this channel
    const isEnabled = await isChannelEnabled(channelId);
    if (!isEnabled) {
      log.info('Forwarding disabled for channel', { channelId, messageId });
      return {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 1,
        message: 'Forwarding disabled for this channel'
      };
    }

    // Get all users to forward to
    const users = await getAllUsers();
    if (users.length === 0) {
      log.warn('No users found for message forwarding', { channelId, messageId });
      return {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        message: 'No users available for forwarding'
      };
    }

    // Split users into chunks to avoid overwhelming the system
    const userChunks = chunkArray(users, 10);
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    log.info('Starting message forwarding to users', {
      channelId,
      messageId,
      totalUsers: users.length,
      chunks: userChunks.length
    });

    // Process each chunk with delay
    for (let i = 0; i < userChunks.length; i++) {
      const chunk = userChunks[i];
      
      log.debug(`Processing user chunk ${i + 1}/${userChunks.length}`, {
        chunkSize: chunk.length,
        channelId,
        messageId
      });

      // Process users in parallel within the chunk
      const chunkResults = await Promise.allSettled(
        chunk.map(user => forwardMessageToUser(message, user, channelId, messageId, forwardFunction))
      );

      // Count results
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'success') {
            totalSuccessful++;
          } else if (result.value.status === 'failed') {
            totalFailed++;
          } else {
            totalSkipped++;
          }
        } else {
          totalFailed++;
          log.error('Unexpected error in chunk processing', {
            error: result.reason?.message,
            channelId,
            messageId
          });
        }
      }

      // Add delay between chunks to respect rate limits
      if (i < userChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const results = {
      total: users.length,
      successful: totalSuccessful,
      failed: totalFailed,
      skipped: totalSkipped
    };

    log.info('Message forwarding completed', {
      channelId,
      messageId,
      ...results
    });

    return results;
  } catch (error) {
    log.error('Error processing message forwarding', {
      channelId,
      messageId: message.id?.toString(),
      error: error.message
    });
    throw error;
  }
}

/**
 * Forwards a message to a single user with rate limiting and error handling
 * @param {Object} message - Message object
 * @param {Object} user - User object
 * @param {string} channelId - Source channel ID
 * @param {string} messageId - Message ID
 * @param {Function} forwardFunction - Function to send message
 * @returns {Promise<Object>} Forward result
 */
async function forwardMessageToUser(message, user, channelId, messageId, forwardFunction) {
  const userId = user.user_id;
  
  try {
    // Check rate limiting
    if (!messageLimiter(`user_${userId}`)) {
      log.warn('Rate limit exceeded for user', { userId, channelId, messageId });
      await logMessageForward(channelId, messageId, userId, 'skipped', 'Rate limit exceeded');
      return { status: 'skipped', userId, reason: 'Rate limit exceeded' };
    }

    // Attempt to forward message with retry
    const result = await withRetry(
      () => forwardFunction(message, userId),
      {
        maxRetries: 3,
        delay: 1000,
        backoff: 2,
        context: `Forward message to user ${userId}`
      }
    );

    await logMessageForward(channelId, messageId, userId, 'success');
    return { status: 'success', userId, result };

  } catch (error) {
    const errorMessage = sanitizeText(error.message, 500);
    
    // Determine if this is a permanent failure
    const permanentErrors = [
      'USER_DEACTIVATED',
      'BOT_BLOCKED',
      'CHAT_WRITE_FORBIDDEN'
    ];
    
    const isPermanent = permanentErrors.some(errType => 
      error.message?.includes(errType)
    );

    if (isPermanent) {
      log.warn('Permanent error forwarding to user', {
        userId,
        channelId,
        messageId,
        error: errorMessage
      });
    } else {
      log.error('Temporary error forwarding to user', {
        userId,
        channelId,
        messageId,
        error: errorMessage
      });
    }

    await logMessageForward(channelId, messageId, userId, 'failed', errorMessage);
    return { status: 'failed', userId, error: errorMessage, isPermanent };
  }
}

/**
 * Cleans up old message logs to prevent database bloat
 * @param {number} daysToKeep - Number of days of logs to keep
 * @returns {Promise<number>} Number of deleted records
 */
export async function cleanupMessageLogs(daysToKeep = 30) {
  try {
    log.info('Cleaning up old message logs', { daysToKeep });

    const result = await runQuery(
      `DELETE FROM message_logs 
       WHERE created_at < datetime('now', '-${daysToKeep} days')`,
      []
    );

    log.info('Message logs cleanup completed', {
      deletedRecords: result.changes,
      daysToKeep
    });

    return result.changes;
  } catch (error) {
    throw handleDatabaseError(error, 'cleanupMessageLogs');
  }
}

/**
 * Gets failed forwarding attempts for retry
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of failed forwarding attempts
 */
export async function getFailedForwards(options = {}) {
  try {
    const {
      limit = 100,
      excludePermanentErrors = true
    } = options;

    log.dbOperation('SELECT', 'message_logs', { operation: 'failed', options });

    let whereClause = "WHERE status = 'failed'";
    
    if (excludePermanentErrors) {
      const permanentErrors = ['USER_DEACTIVATED', 'BOT_BLOCKED', 'CHAT_WRITE_FORBIDDEN'];
      const excludeClause = permanentErrors
        .map(() => 'error_message NOT LIKE ?')
        .join(' AND ');
      whereClause += ` AND (${excludeClause})`;
    }

    const params = [];
    if (excludePermanentErrors) {
      params.push('%USER_DEACTIVATED%', '%BOT_BLOCKED%', '%CHAT_WRITE_FORBIDDEN%');
    }
    params.push(limit);

    const failedForwards = await getAllQuery(
      `SELECT * FROM message_logs ${whereClause}
       ORDER BY created_at DESC LIMIT ?`,
      params
    );

    log.debug(`Retrieved ${failedForwards.length} failed forwards for retry`, options);
    return failedForwards;
  } catch (error) {
    throw handleDatabaseError(error, 'getFailedForwards');
  }
}

export default {
  logMessageForward,
  getForwardingStats,
  getRecentForwardingLogs,
  processMessageForwarding,
  cleanupMessageLogs,
  getFailedForwards
};