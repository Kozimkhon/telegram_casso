/**
 * Admin Service - handles admin user management and validation
 * Provides functions to check admin permissions and manage admin users
 */

import { getDatabase } from '../db/db.js';
import { log } from '../utils/logger.js';

/**
 * Checks if a user is an admin by user ID
 * @param {string|number} userId - Telegram user ID
 * @returns {Promise<Object|null>} Admin record if found and active, null otherwise
 */
export async function isUserAdmin(userId) {
  try {
    const db = getDatabase();
    const userIdStr = userId.toString();
    
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM admins WHERE user_id = ? AND is_active = 1',
        [userIdStr],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    return admin || null;
  } catch (error) {
    log.error('Error checking admin status', { userId, error: error.message });
    return null;
  }
}

/**
 * Adds a new admin user
 * @param {Object} adminData - Admin user data
 * @param {string} adminData.user_id - Telegram user ID
 * @param {string} adminData.first_name - User's first name
 * @param {string} adminData.last_name - User's last name (optional)
 * @param {string} adminData.username - Telegram username (optional)
 * @param {string} adminData.role - Admin role (default: 'admin')
 * @returns {Promise<boolean>} Success status
 */
export async function addAdmin(adminData) {
  try {
    const db = getDatabase();
    const { user_id, first_name, last_name, username, role = 'admin' } = adminData;
    
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO admins (user_id, first_name, last_name, username, role, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [user_id.toString(), first_name, last_name || null, username || null, role],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    log.info('Admin user added successfully', { user_id, first_name, username, role });
    return true;
  } catch (error) {
    log.error('Error adding admin user', { adminData, error: error.message });
    return false;
  }
}

/**
 * Gets all admin users
 * @returns {Promise<Array>} List of admin users
 */
export async function getAllAdmins() {
  try {
    const db = getDatabase();
    
    const admins = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM admins ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    return admins;
  } catch (error) {
    log.error('Error getting admin users', { error: error.message });
    return [];
  }
}

/**
 * Removes an admin user
 * @param {string|number} userId - Telegram user ID
 * @returns {Promise<boolean>} Success status
 */
export async function removeAdmin(userId) {
  try {
    const db = getDatabase();
    const userIdStr = userId.toString();
    
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE admins SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [userIdStr],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    log.info('Admin user removed successfully', { userId });
    return true;
  } catch (error) {
    log.error('Error removing admin user', { userId, error: error.message });
    return false;
  }
}

/**
 * Activates an admin user
 * @param {string|number} userId - Telegram user ID
 * @returns {Promise<boolean>} Success status
 */
export async function activateAdmin(userId) {
  try {
    const db = getDatabase();
    const userIdStr = userId.toString();
    
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE admins SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [userIdStr],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    log.info('Admin user activated successfully', { userId });
    return true;
  } catch (error) {
    log.error('Error activating admin user', { userId, error: error.message });
    return false;
  }
}