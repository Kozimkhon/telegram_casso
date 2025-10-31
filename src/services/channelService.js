/**
 * Channel service module - responsible for channel-related business logic
 * Handles channel management, settings, and database operations
 */

import { runQuery, getAllQuery, getQuery } from '../db/db.js';
import { log } from '../utils/logger.js';
import { handleDatabaseError } from '../utils/errorHandler.js';
import { extractChannelInfo, isValidChannelId, sanitizeText } from '../utils/helpers.js';

/**
 * Adds a new channel to the database
 * @param {Object} channelData - Channel information
 * @returns {Promise<Object>} Added channel data
 */
export async function addChannel(channelData) {
  try {
    const channelInfo = extractChannelInfo(channelData);
    
    if (!isValidChannelId(channelInfo.channelId)) {
      throw new Error(`Invalid channel ID: ${channelInfo.channelId}`);
    }

    log.dbOperation('INSERT', 'channels', { channelId: channelInfo.channelId });

    const result = await runQuery(
      `INSERT OR REPLACE INTO channels 
       (channel_id, title, forward_enabled, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [channelInfo.channelId, channelInfo.title, true]
    );

    const addedChannel = await getChannelById(channelInfo.channelId);
    
    log.info('Channel added successfully', {
      channelId: channelInfo.channelId,
      title: channelInfo.title
    });

    return addedChannel;
  } catch (error) {
    throw handleDatabaseError(error, 'addChannel');
  }
}

/**
 * Gets a channel by its ID
 * @param {string} channelId - Channel ID
 * @returns {Promise<Object|null>} Channel data or null if not found
 */
export async function getChannelById(channelId) {
  try {
    if (!isValidChannelId(channelId)) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }

    log.dbOperation('SELECT', 'channels', { channelId });

    const channel = await getQuery(
      'SELECT * FROM channels WHERE channel_id = ?',
      [channelId]
    );

    return channel || null;
  } catch (error) {
    throw handleDatabaseError(error, 'getChannelById');
  }
}

/**
 * Gets all channels from the database
 * @param {boolean} onlyEnabled - If true, returns only enabled channels
 * @returns {Promise<Array>} Array of channel objects
 */
export async function getAllChannels(onlyEnabled = false) {
  try {
    log.dbOperation('SELECT', 'channels', { onlyEnabled });

    const query = onlyEnabled 
      ? 'SELECT * FROM channels WHERE forward_enabled = 1 ORDER BY title ASC'
      : 'SELECT * FROM channels ORDER BY title ASC';

    const channels = await getAllQuery(query);
    
    log.debug(`Retrieved ${channels.length} channels`, { onlyEnabled });
    return channels;
  } catch (error) {
    throw handleDatabaseError(error, 'getAllChannels');
  }
}

/**
 * Updates channel settings
 * @param {string} channelId - Channel ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated channel data
 */
export async function updateChannel(channelId, updates) {
  try {
    if (!isValidChannelId(channelId)) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }

    // Validate and sanitize updates
    const allowedFields = ['title', 'forward_enabled'];
    const validUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'title') {
          validUpdates[key] = sanitizeText(value, 200);
        } else if (key === 'forward_enabled') {
          validUpdates[key] = Boolean(value);
        } else {
          validUpdates[key] = value;
        }
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }

    log.dbOperation('UPDATE', 'channels', { channelId, updates: validUpdates });

    // Build dynamic update query
    const setClause = Object.keys(validUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(validUpdates), channelId];

    await runQuery(
      `UPDATE channels SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE channel_id = ?`,
      values
    );

    const updatedChannel = await getChannelById(channelId);
    
    log.info('Channel updated successfully', {
      channelId,
      updates: validUpdates
    });

    return updatedChannel;
  } catch (error) {
    throw handleDatabaseError(error, 'updateChannel');
  }
}

/**
 * Toggles the forward_enabled status of a channel
 * @param {string} channelId - Channel ID
 * @returns {Promise<Object>} Updated channel data
 */
export async function toggleChannelForwarding(channelId) {
  try {
    const channel = await getChannelById(channelId);
    
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const newStatus = !channel.forward_enabled;
    const updatedChannel = await updateChannel(channelId, { forward_enabled: newStatus });

    log.info('Channel forwarding toggled', {
      channelId,
      previousStatus: channel.forward_enabled,
      newStatus
    });

    return updatedChannel;
  } catch (error) {
    throw handleDatabaseError(error, 'toggleChannelForwarding');
  }
}

/**
 * Removes a channel from the database
 * @param {string} channelId - Channel ID
 * @returns {Promise<boolean>} True if channel was removed
 */
export async function removeChannel(channelId) {
  try {
    if (!isValidChannelId(channelId)) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }

    log.dbOperation('DELETE', 'channels', { channelId });

    const result = await runQuery(
      'DELETE FROM channels WHERE channel_id = ?',
      [channelId]
    );

    const removed = result.changes > 0;
    
    if (removed) {
      log.info('Channel removed successfully', { channelId });
    } else {
      log.warn('Channel not found for removal', { channelId });
    }

    return removed;
  } catch (error) {
    throw handleDatabaseError(error, 'removeChannel');
  }
}

/**
 * Checks if a channel exists and is enabled for forwarding
 * @param {string} channelId - Channel ID
 * @returns {Promise<boolean>} True if channel exists and is enabled
 */
export async function isChannelEnabled(channelId) {
  try {
    const channel = await getChannelById(channelId);
    return channel && channel.forward_enabled;
  } catch (error) {
    log.error('Error checking channel status', { channelId, error: error.message });
    return false;
  }
}

/**
 * Gets statistics about channels
 * @returns {Promise<Object>} Channel statistics
 */
export async function getChannelStats() {
  try {
    log.dbOperation('SELECT', 'channels', { operation: 'stats' });

    const [totalChannels, enabledChannels] = await Promise.all([
      getQuery('SELECT COUNT(*) as count FROM channels'),
      getQuery('SELECT COUNT(*) as count FROM channels WHERE forward_enabled = 1')
    ]);

    const stats = {
      total: totalChannels?.count || 0,
      enabled: enabledChannels?.count || 0,
      disabled: (totalChannels?.count || 0) - (enabledChannels?.count || 0)
    };

    log.debug('Channel statistics retrieved', stats);
    return stats;
  } catch (error) {
    throw handleDatabaseError(error, 'getChannelStats');
  }
}

/**
 * Bulk updates multiple channels
 * @param {Array} channelUpdates - Array of {channelId, updates} objects
 * @returns {Promise<Array>} Array of update results
 */
export async function bulkUpdateChannels(channelUpdates) {
  try {
    log.info('Starting bulk channel update', { count: channelUpdates.length });

    const results = [];
    
    for (const { channelId, updates } of channelUpdates) {
      try {
        const result = await updateChannel(channelId, updates);
        results.push({ channelId, success: true, data: result });
      } catch (error) {
        log.error('Failed to update channel in bulk operation', {
          channelId,
          error: error.message
        });
        results.push({ channelId, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    log.info('Bulk channel update completed', {
      total: channelUpdates.length,
      successful: successCount,
      failed: channelUpdates.length - successCount
    });

    return results;
  } catch (error) {
    throw handleDatabaseError(error, 'bulkUpdateChannels');
  }
}

export default {
  addChannel,
  getChannelById,
  getAllChannels,
  updateChannel,
  toggleChannelForwarding,
  removeChannel,
  isChannelEnabled,
  getChannelStats,
  bulkUpdateChannels
};