/**
 * Metrics Service - tracks statistics for sessions, channels, and users
 */

import { runQuery, getAllQuery, getQuery } from '../db/db.js';
import { log } from '../utils/logger.js';
import { handleDatabaseError } from '../utils/errorHandler.js';

/**
 * Records a message sent event
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
export async function recordMessageSent(data) {
  const { sessionPhone, channelId, userId, success = true } = data;

  try {
    // Check if metric exists
    const existing = await getQuery(
      'SELECT * FROM metrics WHERE session_phone = ? AND channel_id = ? AND user_id = ?',
      [sessionPhone, channelId, userId]
    );

    if (existing) {
      // Update existing metric
      const updateFields = success 
        ? 'messages_sent = messages_sent + 1, last_message_at = CURRENT_TIMESTAMP'
        : 'messages_failed = messages_failed + 1';

      await runQuery(
        `UPDATE metrics SET 
          ${updateFields},
          last_activity = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE session_phone = ? AND channel_id = ? AND user_id = ?`,
        [sessionPhone, channelId, userId]
      );
    } else {
      // Insert new metric
      const messagesField = success ? 'messages_sent' : 'messages_failed';
      await runQuery(
        `INSERT INTO metrics 
        (session_phone, channel_id, user_id, ${messagesField}, last_activity, last_message_at)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [sessionPhone, channelId, userId]
      );
    }

    log.debug('[Metrics] Recorded message', { sessionPhone, channelId, userId, success });
  } catch (error) {
    log.error('[Metrics] Failed to record message', { error: error.message });
  }
}

/**
 * Records a flood error
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
export async function recordFloodError(data) {
  const { sessionPhone, channelId, userId = null } = data;

  try {
    // Get or create metric
    const existing = await getQuery(
      'SELECT * FROM metrics WHERE session_phone = ? AND channel_id = ? AND (user_id = ? OR user_id IS NULL)',
      [sessionPhone, channelId, userId]
    );

    if (existing) {
      await runQuery(
        `UPDATE metrics SET 
          flood_errors = flood_errors + 1,
          last_flood_at = CURRENT_TIMESTAMP,
          last_activity = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE session_phone = ? AND channel_id = ? AND (user_id = ? OR user_id IS NULL)`,
        [sessionPhone, channelId, userId]
      );
    } else {
      await runQuery(
        `INSERT INTO metrics 
        (session_phone, channel_id, user_id, flood_errors, last_flood_at, last_activity)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [sessionPhone, channelId, userId]
      );
    }

    log.warn('[Metrics] Recorded flood error', { sessionPhone, channelId, userId });
  } catch (error) {
    log.error('[Metrics] Failed to record flood error', { error: error.message });
  }
}

/**
 * Records a spam warning
 * @param {Object} data - Event data
 * @returns {Promise<void>}
 */
export async function recordSpamWarning(data) {
  const { sessionPhone, channelId, userId = null } = data;

  try {
    const existing = await getQuery(
      'SELECT * FROM metrics WHERE session_phone = ? AND channel_id = ? AND (user_id = ? OR user_id IS NULL)',
      [sessionPhone, channelId, userId]
    );

    if (existing) {
      await runQuery(
        `UPDATE metrics SET 
          spam_warnings = spam_warnings + 1,
          last_activity = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE session_phone = ? AND channel_id = ? AND (user_id = ? OR user_id IS NULL)`,
        [sessionPhone, channelId, userId]
      );
    } else {
      await runQuery(
        `INSERT INTO metrics 
        (session_phone, channel_id, user_id, spam_warnings, last_activity)
        VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [sessionPhone, channelId, userId]
      );
    }

    log.warn('[Metrics] Recorded spam warning', { sessionPhone, channelId, userId });
  } catch (error) {
    log.error('[Metrics] Failed to record spam warning', { error: error.message });
  }
}

/**
 * Gets metrics for a session
 * @param {string} sessionPhone - Session phone number
 * @returns {Promise<Object>} Aggregated metrics
 */
export async function getSessionMetrics(sessionPhone) {
  try {
    const metrics = await getAllQuery(
      'SELECT * FROM metrics WHERE session_phone = ? ORDER BY last_activity DESC',
      [sessionPhone]
    );

    const summary = metrics.reduce((acc, m) => ({
      totalSent: acc.totalSent + (m.messages_sent || 0),
      totalFailed: acc.totalFailed + (m.messages_failed || 0),
      totalFloodErrors: acc.totalFloodErrors + (m.flood_errors || 0),
      totalSpamWarnings: acc.totalSpamWarnings + (m.spam_warnings || 0)
    }), {
      totalSent: 0,
      totalFailed: 0,
      totalFloodErrors: 0,
      totalSpamWarnings: 0
    });

    return {
      sessionPhone,
      summary,
      details: metrics
    };
  } catch (error) {
    throw handleDatabaseError(error, 'getSessionMetrics');
  }
}

/**
 * Gets metrics for a channel
 * @param {string} channelId - Channel ID
 * @returns {Promise<Object>} Aggregated metrics
 */
export async function getChannelMetrics(channelId) {
  try {
    const metrics = await getAllQuery(
      'SELECT * FROM metrics WHERE channel_id = ? ORDER BY last_activity DESC',
      [channelId]
    );

    const summary = metrics.reduce((acc, m) => ({
      totalSent: acc.totalSent + (m.messages_sent || 0),
      totalFailed: acc.totalFailed + (m.messages_failed || 0),
      totalFloodErrors: acc.totalFloodErrors + (m.flood_errors || 0),
      totalSpamWarnings: acc.totalSpamWarnings + (m.spam_warnings || 0)
    }), {
      totalSent: 0,
      totalFailed: 0,
      totalFloodErrors: 0,
      totalSpamWarnings: 0
    });

    return {
      channelId,
      summary,
      details: metrics
    };
  } catch (error) {
    throw handleDatabaseError(error, 'getChannelMetrics');
  }
}

/**
 * Gets overall system metrics
 * @returns {Promise<Object>} System-wide metrics
 */
export async function getSystemMetrics() {
  try {
    const metrics = await getAllQuery('SELECT * FROM metrics', []);

    const summary = metrics.reduce((acc, m) => ({
      totalSent: acc.totalSent + (m.messages_sent || 0),
      totalFailed: acc.totalFailed + (m.messages_failed || 0),
      totalFloodErrors: acc.totalFloodErrors + (m.flood_errors || 0),
      totalSpamWarnings: acc.totalSpamWarnings + (m.spam_warnings || 0)
    }), {
      totalSent: 0,
      totalFailed: 0,
      totalFloodErrors: 0,
      totalSpamWarnings: 0
    });

    // Get unique sessions and channels
    const uniqueSessions = new Set(metrics.map(m => m.session_phone).filter(Boolean));
    const uniqueChannels = new Set(metrics.map(m => m.channel_id).filter(Boolean));

    return {
      summary,
      activeSessions: uniqueSessions.size,
      activeChannels: uniqueChannels.size,
      totalRecords: metrics.length
    };
  } catch (error) {
    throw handleDatabaseError(error, 'getSystemMetrics');
  }
}

/**
 * Cleans up old metrics (older than specified days)
 * @param {number} daysToKeep - Number of days to keep
 * @returns {Promise<number>} Number of deleted records
 */
export async function cleanupOldMetrics(daysToKeep = 90) {
  try {
    const result = await runQuery(
      `DELETE FROM metrics 
      WHERE last_activity < datetime('now', '-' || ? || ' days')`,
      [daysToKeep]
    );

    log.info('[Metrics] Cleaned up old metrics', { 
      daysToKeep, 
      deleted: result.changes 
    });

    return result.changes;
  } catch (error) {
    throw handleDatabaseError(error, 'cleanupOldMetrics');
  }
}

export default {
  recordMessageSent,
  recordFloodError,
  recordSpamWarning,
  getSessionMetrics,
  getChannelMetrics,
  getSystemMetrics,
  cleanupOldMetrics
};
