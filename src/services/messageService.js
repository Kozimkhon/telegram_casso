/**
 * Message service module - responsible for message forwarding and logging
 * Handles message distribution logic and tracks forwarding results
 */

import { runQuery, getAllQuery, getQuery } from '../db/db.js';
import { log } from '../utils/logger.js';
import { handleDatabaseError, withRetry, isFloodWaitError, isSpamWarning } from '../utils/errorHandler.js';
import { sanitizeText, chunkArray } from '../utils/helpers.js';
import { isChannelEnabled } from './channelService.js';
import { getAllUsers, getUsersByChannel } from './userService.js';
import { recordMessageSent, recordFloodError, recordSpamWarning } from './metricsService.js';
import { throttleManager, retryWithBackoff } from '../utils/throttle.js';
import { getAllAdmins } from './adminService.js';
import { config } from '../config/index.js';

/**
 * Logs a message forwarding attempt with session tracking
 * @param {string} channelId - Source channel ID
 * @param {string} messageId - Original message ID
 * @param {string} userId - Target user ID
 * @param {string} forwardedMessageId - ID of the forwarded message (for deletion)
 * @param {string} status - Status (success, failed, skipped)
 * @param {string} errorMessage - Error message if failed
 * @param {string} sessionPhone - Phone number of session used
 * @param {number} retryCount - Number of retries
 * @returns {Promise<void>}
 */
export async function logMessageForward(channelId, messageId, userId, forwardedMessageId, status, errorMessage = null, sessionPhone = null, retryCount = 0) {
  try {
    log.dbOperation('INSERT', 'message_logs', { channelId, messageId, userId, forwardedMessageId, status, sessionPhone });

    await runQuery(
      `INSERT INTO message_logs 
       (channel_id, message_id, user_id, forwarded_message_id, status, error_message, session_phone, retry_count) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [channelId, messageId, userId, forwardedMessageId, status, errorMessage, sessionPhone, retryCount]
    );

    log.messageForward(channelId, userId, status, { messageId, forwardedMessageId, errorMessage, sessionPhone });
  } catch (error) {
    // Don't throw here to avoid disrupting message forwarding
    log.error('Failed to log message forward attempt', {
      channelId,
      messageId,
      userId,
      forwardedMessageId,
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
export async function processMessageForwarding(message, channelId, forwardFunction = null) {
  try {
    const messageId = message.id?.toString() || 'unknown';
    
    console.log('=== MULTI-SESSION FORWARDING DEBUG ===');
    console.log('Channel ID:', channelId);
    console.log('Message ID:', messageId);
    console.log('Message text:', message.message);
    
    log.info('Processing message for forwarding', {
      channelId,
      messageId,
      messageType: message.className || 'unknown'
    });

    // Check if forwarding is enabled for this channel
    const isEnabled = await isChannelEnabled(channelId);
    console.log('Is channel enabled:', isEnabled);
    
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

    // Get users from the specific channel that sent the message
    const allUsers = await getUsersByChannel(channelId);
    
    // Filter out admin users - admins should not receive forwarded messages
    const admins = await getAllAdmins();
    const adminUserIds = admins.filter(admin => admin.is_active).map(admin => admin.user_id);
    const users = allUsers.filter(user => !adminUserIds.includes(user.user_id));
    
    console.log('Channel members to forward:', users.length);
    console.log('Users:', users.map(u => ({ id: u.user_id, name: u.first_name })));
    
    if (allUsers.length > users.length) {
      console.log(`🚫 Filtered out ${allUsers.length - users.length} admin user(s)`);
      log.debug('Admin users excluded from forwarding', {
        totalUsers: allUsers.length,
        filteredUsers: users.length,
        adminUserIds: adminUserIds
      });
    }
    
    if (users.length === 0) {
      log.warn('No channel members found for message forwarding', { channelId, messageId });
      return {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        message: 'No channel members available for forwarding'
      };
    }

    // Split users into chunks to avoid overwhelming the system
    const userChunks = chunkArray(users, 10);
    let totalSuccessful = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    log.info('Starting message forwarding to channel members', {
      channelId,
      messageId,
      totalChannelMembers: users.length,
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
 * Forwards a message to a single user with multi-session approach
 * @param {Object} message - Message object
 * @param {Object} user - User object
 * @param {string} channelId - Source channel ID
 * @param {string} messageId - Message ID
 * @param {Function} forwardFunction - Function to send message (deprecated)
 * @returns {Promise<Object>} Forward result
 */
async function forwardMessageToUser(message, user, channelId, messageId, forwardFunction) {
  const userId = user.user_id;
  
  try {
    // Get UserBotManager instance for multi-session forwarding
    const { userBotManager } = await import('../bots/userBotManager.js');
    const selectedBot = userBotManager.getRandomActiveBot();
    const sessionPhone = selectedBot?.phone || 'unknown';

    if (!selectedBot) {
      log.warn('No active session available for forwarding', { userId, channelId, messageId });
      await logMessageForward(channelId, messageId, userId, null, 'skipped', 'No active session available');
      return { status: 'skipped', userId, reason: 'No active session available' };
    }

    // Use multi-session forwarding approach
    return await forwardMessageToUserWithSession(
      message, 
      user, 
      channelId, 
      messageId, 
      selectedBot, 
      sessionPhone
    );

  } catch (error) {
    const errorMessage = sanitizeText(error.message, 500);
    
    log.error('Error forwarding to user', {
      userId,
      channelId,
      messageId,
      error: errorMessage
    });

    await logMessageForward(channelId, messageId, userId, null, 'failed', errorMessage);
    return { status: 'failed', userId, error: errorMessage };
  }
}

/**
 * Forwards a message to a user using multi-session approach with proper session tracking
 * @param {Object} message - Message to forward
 * @param {Object} user - Target user
 * @param {string} channelId - Source channel ID
 * @param {string} messageId - Original message ID
 * @param {Object} selectedBot - UserBot instance to use
 * @param {string} sessionPhone - Session phone number for tracking
 * @returns {Promise<Object>} Forward result
 */
async function forwardMessageToUserWithSession(message, user, channelId, messageId, selectedBot, sessionPhone) {
  try {
    const userId = user.user_id;
    let forwardedMessageId = null;
    let status = 'failed';
    let errorMessage = null;

    console.log(`📤 Forwarding via session ${sessionPhone} to user ${user.first_name} (${userId})`);

    try {
      // Try using multi-session approach
      if (selectedBot && typeof selectedBot.forwardMessageToUser === 'function') {
        console.log(`🎯 Using selectedBot.forwardMessageToUser for session ${sessionPhone}`);
        
        // Use queue manager for sequential processing
        try {
          const { queueManager } = await import('../utils/messageQueue.js');
          
          const result = await queueManager.enqueue(
            sessionPhone,
            async () => {
              return await selectedBot.forwardMessageToUser(message, userId);
            },
            { 
              channelId, 
              messageId, 
              userId, 
              sessionPhone 
            }
          );
          
          if (result && result.id) {
            forwardedMessageId = result.id.toString();
            status = 'success';
            console.log(`✅ Message forwarded successfully via session ${sessionPhone}: ${forwardedMessageId}`);
          } else {
            throw new Error('No message ID returned from queue');
          }
        } catch (queueError) {
          console.log(`❌ Queue forwarding failed for session ${sessionPhone}:`, queueError.message);
          throw queueError;
        }
      } else {
        throw new Error(`No valid forwarding method available for session ${sessionPhone}`);
      }

      // Record success metrics
      if (status === 'success') {
        try {
          await recordMessageSent({
            sessionPhone,
            channelId,
            userId,
            success: true
          });
        } catch (metricsError) {
          console.log(`⚠️ Failed to record success metrics:`, metricsError.message);
        }
      }

    } catch (forwardError) {
      console.log(`❌ Forward error for user ${userId} via session ${sessionPhone}:`, forwardError.message);
      status = 'failed';
      errorMessage = forwardError.message;

      // Handle specific Telegram errors for multi-session
      if (forwardError.message?.includes('FLOOD_WAIT')) {
        console.log(`🚫 FloodWait detected for session ${sessionPhone}`);
        
        try {
          const { userBotManager } = await import('../bots/userBotManager.js');
          await userBotManager.handleBotError(sessionPhone, forwardError);
        } catch (managerError) {
          console.log(`⚠️ Failed to handle bot error:`, managerError.message);
        }
      }

      // Record failure metrics
      try {
        await recordMessageSent({
          sessionPhone,
          channelId,
          userId,
          success: false
        });
      } catch (metricsError) {
        console.log(`⚠️ Failed to record failure metrics:`, metricsError.message);
      }
    }

    // Log the forwarding attempt
    await logMessageForward(
      channelId, 
      messageId, 
      userId, 
      forwardedMessageId, 
      status, 
      errorMessage,
      sessionPhone
    );

    return {
      status,
      userId,
      forwardedMessageId,
      error: errorMessage,
      sessionPhone
    };

  } catch (error) {
    console.log(`💥 Unexpected error forwarding to user ${user.user_id}:`, error.message);
    
    // Log the failed attempt
    await logMessageForward(
      channelId, 
      messageId, 
      user.user_id, 
      null, 
      'failed', 
      error.message,
      sessionPhone
    );

    return {
      status: 'failed',
      userId: user.user_id,
      forwardedMessageId: null,
      error: error.message,
      sessionPhone
    };
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

/**
 * Gets old forwarded messages that need to be deleted (older than specified hours)
 * @param {number} hoursOld - Delete messages older than this many hours (default: 24)
 * @returns {Promise<Array>} Array of messages to delete
 */
export async function getOldForwardedMessages(hoursOld = 24) {
  try {
    log.dbOperation('SELECT', 'message_logs', { operation: 'old_messages', hoursOld });

    const messages = await getAllQuery(
      `SELECT user_id, forwarded_message_id, created_at 
       FROM message_logs 
       WHERE status = 'success' 
         AND forwarded_message_id IS NOT NULL
         AND created_at < datetime('now', '-${hoursOld} hours')
       ORDER BY created_at ASC`,
      []
    );

    log.debug(`Found ${messages.length} old forwarded messages to delete`, { hoursOld });
    return messages;
  } catch (error) {
    throw handleDatabaseError(error, 'getOldForwardedMessages');
  }
}

/**
 * Marks a forwarded message as deleted in the database
 * @param {string} userId - User ID
 * @param {string} forwardedMessageId - Forwarded message ID
 * @returns {Promise<void>}
 */
export async function markMessageAsDeleted(userId, forwardedMessageId) {
  try {
    await runQuery(
      `UPDATE message_logs 
       SET forwarded_message_id = NULL, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND forwarded_message_id = ?`,
      [userId, forwardedMessageId]
    );

    log.debug('Marked message as deleted', { userId, forwardedMessageId });
  } catch (error) {
    log.error('Failed to mark message as deleted', {
      userId,
      forwardedMessageId,
      error: error.message
    });
  }
}

/**
 * Forwards a message to a single user with throttling and error handling
 * @param {Object} message - Message to forward
 * @param {string} userId - Target user ID
 * @param {string} channelId - Source channel ID
 * @param {Object} channel - Channel configuration
 * @param {Function} forwardFunction - Function to send the message
 * @param {string} sessionPhone - Phone of session being used
 * @returns {Promise<Object>} Forward result
 */
export async function forwardMessageWithThrottling(message, userId, channelId, channel, forwardFunction, sessionPhone = null) {
  const messageId = message.id?.toString() || 'unknown';
  let retryCount = 0;

  try {
    // Apply throttling before sending
    await throttleManager.waitBeforeSend(channelId, userId, {
      throttleDelayMs: channel?.throttle_delay_ms || 1000,
      throttlePerMemberMs: channel?.throttle_per_member_ms || 500
    });

    // Send with retry and exponential backoff
    const result = await retryWithBackoff(
      async () => await forwardFunction(message, userId),
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        onRetry: (attempt, delay, error) => {
          retryCount = attempt;
          log.warn('Retrying message forward', {
            userId,
            channelId,
            messageId,
            attempt,
            delay,
            error: error.message
          });
        }
      }
    );

    // Log success
    await logMessageForward(
      channelId,
      messageId,
      userId,
      result.id?.toString(),
      'success',
      null,
      sessionPhone,
      retryCount
    );

    // Record metrics
    if (sessionPhone) {
      await recordMessageSent({
        sessionPhone,
        channelId,
        userId,
        success: true
      });
    }

    return { status: 'success', result, retryCount };
  } catch (error) {
    // Check for FloodWait
    const floodWait = isFloodWaitError(error);
    if (floodWait && sessionPhone) {
      await recordFloodError({ sessionPhone, channelId, userId });
    }

    // Check for spam warning
    if (isSpamWarning(error) && sessionPhone) {
      await recordSpamWarning({ sessionPhone, channelId, userId });
    }

    // Log failure
    await logMessageForward(
      channelId,
      messageId,
      userId,
      null,
      'failed',
      error.message,
      sessionPhone,
      retryCount
    );

    // Record metrics
    if (sessionPhone) {
      await recordMessageSent({
        sessionPhone,
        channelId,
        userId,
        success: false
      });
    }

    return { status: 'failed', error: error.message, retryCount };
  }
}

export default {
  logMessageForward,
  getForwardingStats,
  getRecentForwardingLogs,
  processMessageForwarding,
  cleanupMessageLogs,
  getFailedForwards,
  forwardMessageWithThrottling
};