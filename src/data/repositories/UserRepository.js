/**
 * @fileoverview User Repository Implementation
 * Handles user data persistence
 * @module data/repositories/UserRepository
 */

import IUserRepository from '../../core/interfaces/IUserRepository.js';
import User from '../../core/entities/User.entity.js';

/**
 * User Repository
 * Implements user data access operations
 * 
 * @class UserRepository
 * @implements {IUserRepository}
 */
class UserRepository extends IUserRepository {
  /**
   * Data source
   * @private
   */
  #dataSource;

  /**
   * Creates user repository
   * @param {SQLiteDataSource} dataSource - Data source
   */
  constructor(dataSource) {
    super();
    this.#dataSource = dataSource;
  }

  /**
   * Finds user by ID
   * @param {string} id - User ID
   * @returns {Promise<User|null>} User or null
   */
  async findById(id) {
    const row = await this.#dataSource.getOne(
      'SELECT * FROM users WHERE user_id = ?',
      [id]
    );
    return row ? User.fromDatabaseRow(row) : null;
  }

  /**
   * Finds all users
   * @param {Object} filters - Filters
   * @returns {Promise<Array<User>>} Users
   */
  async findAll(filters = {}) {
    const { limit, offset, orderBy = 'first_name ASC' } = filters;
    
    let query = `SELECT * FROM users ORDER BY ${orderBy}`;
    const params = [];

    if (limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset || 0);
    }

    const rows = await this.#dataSource.getMany(query, params);
    return rows.map(row => User.fromDatabaseRow(row));
  }

  /**
   * Creates new user
   * @param {User} user - User entity
   * @returns {Promise<User>} Created user
   */
  async create(user) {
    const data = user.toObject();

    await this.#dataSource.execute(
      `INSERT OR REPLACE INTO users 
       (user_id, first_name, last_name, username, phone, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.first_name,
        data.last_name,
        data.username,
        data.phone,
        data.created_at,
        data.updated_at
      ]
    );

    return await this.findById(user.userId);
  }

  /**
   * Updates user
   * @param {string} id - User ID
   * @param {Object} updates - Updates
   * @returns {Promise<User>} Updated user
   */
  async update(id, updates) {
    const user = await this.findById(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    // Apply updates to entity
    if (updates.first_name) user.updateFirstName(updates.first_name);
    if (updates.last_name !== undefined) user.updateLastName(updates.last_name);
    if (updates.username !== undefined) user.updateUsername(updates.username);
    if (updates.phone !== undefined) user.updatePhone(updates.phone);

    const data = user.toObject();

    await this.#dataSource.execute(
      `UPDATE users 
       SET first_name = ?, last_name = ?, username = ?, phone = ?, updated_at = ? 
       WHERE user_id = ?`,
      [
        data.first_name,
        data.last_name,
        data.username,
        data.phone,
        data.updated_at,
        id
      ]
    );

    return await this.findById(id);
  }

  /**
   * Deletes user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const result = await this.#dataSource.execute(
      'DELETE FROM users WHERE user_id = ?',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Checks if user exists
   * @param {string} id - User ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const user = await this.findById(id);
    return user !== null;
  }

  /**
   * Counts users
   * @param {Object} filters - Filters
   * @returns {Promise<number>} Count
   */
  async count(filters = {}) {
    const result = await this.#dataSource.getOne(
      'SELECT COUNT(*) as count FROM users'
    );
    return result?.count || 0;
  }

  /**
   * Finds users by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array<User>>} Users
   */
  async findByChannel(channelId) {
    const rows = await this.#dataSource.getMany(
      `SELECT u.* FROM users u
       INNER JOIN channel_members cm ON u.user_id = cm.user_id
       WHERE cm.channel_id = ?
       ORDER BY u.first_name ASC`,
      [channelId]
    );
    return rows.map(row => User.fromDatabaseRow(row));
  }

  /**
   * Finds users by username
   * @param {string} username - Username
   * @returns {Promise<Array<User>>} Users
   */
  async findByUsername(username) {
    const rows = await this.#dataSource.getMany(
      'SELECT * FROM users WHERE username LIKE ? ORDER BY first_name ASC',
      [`%${username}%`]
    );
    return rows.map(row => User.fromDatabaseRow(row));
  }

  /**
   * Adds user to channel
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if added
   */
  async addToChannel(channelId, userId) {
    await this.#dataSource.execute(
      `INSERT OR REPLACE INTO channel_members 
       (channel_id, user_id, updated_at) 
       VALUES (?, ?, datetime('now'))`,
      [channelId, userId]
    );
    return true;
  }

  /**
   * Removes user from channel
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if removed
   */
  async removeFromChannel(channelId, userId) {
    const result = await this.#dataSource.execute(
      'DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );
    return result.changes > 0;
  }

  /**
   * Clears channel members
   * @param {string} channelId - Channel ID
   * @returns {Promise<number>} Number of removed users
   */
  async clearChannelMembers(channelId) {
    const result = await this.#dataSource.execute(
      'DELETE FROM channel_members WHERE channel_id = ?',
      [channelId]
    );
    return result.changes;
  }

  /**
   * Bulk adds users
   * @param {Array<User>} users - Users to add
   * @returns {Promise<Array>} Results
   */
  async bulkCreate(users) {
    const results = [];
    
    for (const user of users) {
      try {
        const created = await this.create(user);
        results.push({ success: true, userId: user.userId, data: created });
      } catch (error) {
        results.push({ success: false, userId: user.userId, error: error.message });
      }
    }

    return results;
  }

  /**
   * Bulk adds users to channel
   * @param {string} channelId - Channel ID
   * @param {Array<string>} userIds - User IDs
   * @returns {Promise<Array>} Results
   */
  async bulkAddToChannel(channelId, userIds) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        await this.addToChannel(channelId, userId);
        results.push({ success: true, userId });
      } catch (error) {
        results.push({ success: false, userId, error: error.message });
      }
    }

    return results;
  }

  /**
   * Gets user statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const [total, withUsername, withPhone] = await Promise.all([
      this.count(),
      this.#dataSource.getOne('SELECT COUNT(*) as count FROM users WHERE username IS NOT NULL'),
      this.#dataSource.getOne('SELECT COUNT(*) as count FROM users WHERE phone IS NOT NULL')
    ]);

    return {
      total,
      withUsername: withUsername?.count || 0,
      withPhone: withPhone?.count || 0,
      withoutUsername: total - (withUsername?.count || 0),
      withoutPhone: total - (withPhone?.count || 0)
    };
  }

  /**
   * Gets recent users
   * @param {number} days - Number of days
   * @returns {Promise<Array<User>>} Recent users
   */
  async getRecentUsers(days = 7) {
    const rows = await this.#dataSource.getMany(
      `SELECT * FROM users 
       WHERE created_at >= datetime('now', '-${days} days') 
       ORDER BY created_at DESC`
    );
    return rows.map(row => User.fromDatabaseRow(row));
  }
}

export default UserRepository;
