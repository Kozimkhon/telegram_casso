/**
 * User service module - responsible for user-related business logic
 * Handles user management and database operations
 */

import { runQuery, getAllQuery, getQuery } from '../db/db.js';
import { log } from '../utils/logger.js';
import { handleDatabaseError } from '../utils/errorHandler.js';
import { extractUserInfo, isValidUserId, sanitizeText } from '../utils/helpers.js';

/**
 * Adds a new user to the database
 * @param {Object} userData - User information
 * @returns {Promise<Object>} Added user data
 */
export async function addUser(userData) {
  try {
    // Check if userData is already extracted (has userId property)
    const userInfo = userData.userId ? userData : extractUserInfo(userData);
    
    if (!isValidUserId(userInfo.userId)) {
      throw new Error(`Invalid user ID: ${userInfo.userId}`);
    }

    log.dbOperation('INSERT', 'users', { userId: userInfo.userId });

    const result = await runQuery(
      `INSERT OR REPLACE INTO users 
       (user_id, first_name, last_name, username, phone, updated_at) 
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        userInfo.userId,
        userInfo.firstName,
        userInfo.lastName,
        userInfo.username,
        userInfo.phone
      ]
    );

    const addedUser = await getUserById(userInfo.userId);
    
    log.info('User added successfully', {
      userId: userInfo.userId,
      firstName: userInfo.firstName,
      username: userInfo.username
    });

    return addedUser;
  } catch (error) {
    throw handleDatabaseError(error, 'addUser');
  }
}

/**
 * Gets a user by their ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User data or null if not found
 */
export async function getUserById(userId) {
  try {
    if (!isValidUserId(userId)) {
      throw new Error(`Invalid user ID: ${userId}`);
    }

    log.dbOperation('SELECT', 'users', { userId });

    const user = await getQuery(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );

    return user || null;
  } catch (error) {
    throw handleDatabaseError(error, 'getUserById');
  }
}

/**
 * Gets all users from the database
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of user objects
 */
export async function getAllUsers(options = {}) {
  try {
    const {
      limit = null,
      offset = 0,
      orderBy = 'first_name ASC'
    } = options;

    log.dbOperation('SELECT', 'users', { limit, offset, orderBy });

    let query = `SELECT * FROM users ORDER BY ${orderBy}`;
    const params = [];

    if (limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const users = await getAllQuery(query, params);
    
    log.debug(`Retrieved ${users.length} users`, options);
    return users;
  } catch (error) {
    throw handleDatabaseError(error, 'getAllUsers');
  }
}

/**
 * Gets users by channel ID (channel members only)
 * @param {string} channelId - Channel ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of user objects
 */
export async function getUsersByChannel(channelId, options = {}) {
  try {
    const {
      limit = null,
      offset = 0,
      orderBy = 'u.first_name ASC'
    } = options;

    if (!isValidUserId(channelId)) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }

    log.dbOperation('SELECT', 'users+channel_members', { channelId, limit, offset, orderBy });

    let query = `
      SELECT u.* FROM users u
      INNER JOIN channel_members cm ON u.user_id = cm.user_id
      WHERE cm.channel_id = ?
      ORDER BY ${orderBy}
    `;
    const params = [channelId];

    if (limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const users = await getAllQuery(query, params);
    
    log.debug(`Retrieved ${users.length} users for channel ${channelId}`, options);
    return users;
  } catch (error) {
    throw handleDatabaseError(error, 'getUsersByChannel');
  }
}

/**
 * Adds a user to a channel's member list
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if added successfully
 */
export async function addChannelMember(channelId, userId) {
  try {
    if (!isValidUserId(channelId) || !isValidUserId(userId)) {
      throw new Error(`Invalid channel ID or user ID: ${channelId}, ${userId}`);
    }

    log.dbOperation('INSERT', 'channel_members', { channelId, userId });

    await runQuery(
      `INSERT OR REPLACE INTO channel_members 
       (channel_id, user_id, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [channelId, userId]
    );

    log.debug('User added to channel', { channelId, userId });
    return true;
  } catch (error) {
    throw handleDatabaseError(error, 'addChannelMember');
  }
}

/**
 * Bulk adds users to a channel's member list
 * @param {string} channelId - Channel ID
 * @param {Array} userIds - Array of user IDs
 * @returns {Promise<Array>} Array of operation results
 */
export async function bulkAddChannelMembers(channelId, userIds) {
  try {
    if (!isValidUserId(channelId)) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }

    log.info('Starting bulk channel member addition', { 
      channelId, 
      count: userIds.length 
    });

    const results = [];
    
    for (const userId of userIds) {
      try {
        await addChannelMember(channelId, userId);
        results.push({ userId, success: true });
      } catch (error) {
        log.error('Failed to add user to channel in bulk operation', {
          channelId,
          userId,
          error: error.message
        });
        results.push({ userId, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    log.info('Bulk channel member addition completed', {
      channelId,
      total: userIds.length,
      successful: successCount,
      failed: userIds.length - successCount
    });

    return results;
  } catch (error) {
    throw handleDatabaseError(error, 'bulkAddChannelMembers');
  }
}

/**
 * Removes all members from a channel (for re-sync)
 * @param {string} channelId - Channel ID
 * @returns {Promise<number>} Number of removed members
 */
export async function clearChannelMembers(channelId) {
  try {
    if (!isValidUserId(channelId)) {
      throw new Error(`Invalid channel ID: ${channelId}`);
    }

    log.dbOperation('DELETE', 'channel_members', { channelId });

    const result = await runQuery(
      'DELETE FROM channel_members WHERE channel_id = ?',
      [channelId]
    );

    log.debug('Channel members cleared', { 
      channelId, 
      removedCount: result.changes 
    });

    return result.changes;
  } catch (error) {
    throw handleDatabaseError(error, 'clearChannelMembers');
  }
}

/**
 * Updates user information
 * @param {string} userId - User ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated user data
 */
export async function updateUser(userId, updates) {
  try {
    if (!isValidUserId(userId)) {
      throw new Error(`Invalid user ID: ${userId}`);
    }

    // Validate and sanitize updates
    const allowedFields = ['first_name', 'last_name', 'username', 'phone'];
    const validUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (['first_name', 'last_name', 'username'].includes(key)) {
          validUpdates[key] = value ? sanitizeText(value, 100) : null;
        } else if (key === 'phone') {
          validUpdates[key] = value ? sanitizeText(value, 20) : null;
        } else {
          validUpdates[key] = value;
        }
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }

    log.dbOperation('UPDATE', 'users', { userId, updates: validUpdates });

    // Build dynamic update query
    const setClause = Object.keys(validUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(validUpdates), userId];

    await runQuery(
      `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      values
    );

    const updatedUser = await getUserById(userId);
    
    log.info('User updated successfully', {
      userId,
      updates: validUpdates
    });

    return updatedUser;
  } catch (error) {
    throw handleDatabaseError(error, 'updateUser');
  }
}

/**
 * Removes a user from the database
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if user was removed
 */
export async function removeUser(userId) {
  try {
    if (!isValidUserId(userId)) {
      throw new Error(`Invalid user ID: ${userId}`);
    }

    log.dbOperation('DELETE', 'users', { userId });

    const result = await runQuery(
      'DELETE FROM users WHERE user_id = ?',
      [userId]
    );

    const removed = result.changes > 0;
    
    if (removed) {
      log.info('User removed successfully', { userId });
    } else {
      log.warn('User not found for removal', { userId });
    }

    return removed;
  } catch (error) {
    throw handleDatabaseError(error, 'removeUser');
  }
}

/**
 * Gets users by their username
 * @param {string} username - Username to search for
 * @returns {Promise<Array>} Array of matching users
 */
export async function getUsersByUsername(username) {
  try {
    if (!username || typeof username !== 'string') {
      throw new Error('Invalid username provided');
    }

    const sanitizedUsername = sanitizeText(username, 50);
    
    log.dbOperation('SELECT', 'users', { username: sanitizedUsername });

    const users = await getAllQuery(
      'SELECT * FROM users WHERE username LIKE ? ORDER BY first_name ASC',
      [`%${sanitizedUsername}%`]
    );

    log.debug(`Found ${users.length} users with username containing "${sanitizedUsername}"`);
    return users;
  } catch (error) {
    throw handleDatabaseError(error, 'getUsersByUsername');
  }
}

/**
 * Gets users by their name (first_name or last_name)
 * @param {string} name - Name to search for
 * @returns {Promise<Array>} Array of matching users
 */
export async function getUsersByName(name) {
  try {
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid name provided');
    }

    const sanitizedName = sanitizeText(name, 100);
    
    log.dbOperation('SELECT', 'users', { name: sanitizedName });

    const users = await getAllQuery(
      `SELECT * FROM users 
       WHERE first_name LIKE ? OR last_name LIKE ? 
       ORDER BY first_name ASC`,
      [`%${sanitizedName}%`, `%${sanitizedName}%`]
    );

    log.debug(`Found ${users.length} users with name containing "${sanitizedName}"`);
    return users;
  } catch (error) {
    throw handleDatabaseError(error, 'getUsersByName');
  }
}

/**
 * Gets user statistics
 * @returns {Promise<Object>} User statistics
 */
export async function getUserStats() {
  try {
    log.dbOperation('SELECT', 'users', { operation: 'stats' });

    const [totalUsers, usersWithUsername, usersWithPhone] = await Promise.all([
      getQuery('SELECT COUNT(*) as count FROM users'),
      getQuery('SELECT COUNT(*) as count FROM users WHERE username IS NOT NULL'),
      getQuery('SELECT COUNT(*) as count FROM users WHERE phone IS NOT NULL')
    ]);

    const stats = {
      total: totalUsers?.count || 0,
      withUsername: usersWithUsername?.count || 0,
      withPhone: usersWithPhone?.count || 0,
      withoutUsername: (totalUsers?.count || 0) - (usersWithUsername?.count || 0),
      withoutPhone: (totalUsers?.count || 0) - (usersWithPhone?.count || 0)
    };

    log.debug('User statistics retrieved', stats);
    return stats;
  } catch (error) {
    throw handleDatabaseError(error, 'getUserStats');
  }
}

/**
 * Bulk adds or updates multiple users
 * @param {Array} usersData - Array of user data objects
 * @returns {Promise<Array>} Array of operation results
 */
export async function bulkAddUsers(usersData) {
  try {
    log.info('Starting bulk user addition', { count: usersData.length });

    const results = [];
    
    for (const userData of usersData) {
      try {
        const result = await addUser(userData);
        results.push({ 
          userId: userData.id || userData.user_id, 
          success: true, 
          data: result 
        });
      } catch (error) {
        log.error('Failed to add user in bulk operation', {
          userData,
          error: error.message
        });
        results.push({ 
          userId: userData.id || userData.user_id, 
          success: false, 
          error: error.message 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    log.info('Bulk user addition completed', {
      total: usersData.length,
      successful: successCount,
      failed: usersData.length - successCount
    });

    return results;
  } catch (error) {
    throw handleDatabaseError(error, 'bulkAddUsers');
  }
}

/**
 * Checks if a user exists in the database
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user exists
 */
export async function userExists(userId) {
  try {
    const user = await getUserById(userId);
    return user !== null;
  } catch (error) {
    log.error('Error checking user existence', { userId, error: error.message });
    return false;
  }
}

/**
 * Gets recent users (added in the last N days)
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Array of recent users
 */
export async function getRecentUsers(days = 7) {
  try {
    log.dbOperation('SELECT', 'users', { operation: 'recent', days });

    const users = await getAllQuery(
      `SELECT * FROM users 
       WHERE created_at >= datetime('now', '-${days} days') 
       ORDER BY created_at DESC`,
      []
    );

    log.debug(`Found ${users.length} users created in the last ${days} days`);
    return users;
  } catch (error) {
    throw handleDatabaseError(error, 'getRecentUsers');
  }
}

export default {
  addUser,
  getUserById,
  getAllUsers,
  getUsersByChannel,
  addChannelMember,
  bulkAddChannelMembers,
  clearChannelMembers,
  updateUser,
  removeUser,
  getUsersByUsername,
  getUsersByName,
  getUserStats,
  bulkAddUsers,
  userExists,
  getRecentUsers
};