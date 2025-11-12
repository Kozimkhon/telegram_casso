/**
 * @fileoverview User Repository
 * Repository for User entity operations
 * @module repositories/typeorm/UserRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { UserEntity } from '../../../core/entities/db/index.js';

/**
 * User Repository
 * Handles database operations for User entity
 * 
 * @class UserRepository
 * @extends BaseRepository
 */
class UserRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(UserEntity);
    super(repository, 'User');
  }

  /**
   * Finds user by user ID
   * @param {string} userId - Telegram user ID
   * @returns {Promise<Object|null>} User or null
   */
  async findByUserId(userId) {
    return await this.findOne({ userId });
  }

  /**
   * Finds user by username
   * @param {string} username - Username
   * @returns {Promise<Object|null>} User or null
   */
  async findByUsername(username) {
    return await this.findOne({ username });
  }

  /**
   * Finds all active users
   * @returns {Promise<Object[]>} Active users
   */
  async findAllActive() {
    return await this.findMany({ isActive: true });
  }

  /**
   * Finds user with channels
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User with channels
   */
  async findWithChannels(userId) {
    return await this.findOne(
      { userId },
      {
        relations: ['channels'],
      }
    );
  }

  /**
   * Finds user with messages
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User with messages
   */
  async findWithMessages(userId) {
    return await this.findOne(
      { userId },
      {
        relations: ['messages'],
      }
    );
  }

  /**
   * Bulk creates users
   * @param {Array} usersData - Array of user data
   * @returns {Promise<Object>} Result with added/updated counts
   */
  async bulkCreate(usersData) {
    let added = 0;
    let updated = 0;

    for (const userData of usersData) {
      const existing = await this.findByUserId(userData.userId);
      
      if (existing) {
        await this.repository.save({
          ...existing,
          ...userData,
          updatedAt: new Date(),
        });
        updated++;
      } else {
        await this.create(userData);
        added++;
      }
    }

    return { added, updated, total: usersData.length };
  }

  /**
   * Activates user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async activate(userId) {
    await this.repository.update(
      { userId },
      {
        isActive: true,
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Deactivates user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async deactivate(userId) {
    await this.repository.update(
      { userId },
      {
        isActive: false,
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Searches users by name or username
   * @param {string} searchTerm - Search term
   * @returns {Promise<Object[]>} Matching users
   */
  async search(searchTerm) {
    return await this.repository
      .createQueryBuilder('user')
      .where('user.first_name LIKE :term', { term: `%${searchTerm}%` })
      .orWhere('user.last_name LIKE :term', { term: `%${searchTerm}%` })
      .orWhere('user.username LIKE :term', { term: `%${searchTerm}%` })
      .getMany();
  }

  /**
   * Adds user to channel (creates channel_members association)
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async addToChannel(channelId, userId) {
    try {
      await this.repository
        .createQueryBuilder()
        .insert()
        .into('channel_members')
        .values({
          channel_id: channelId,
          user_id: userId,
        })
        .orIgnore() // Skip if already exists
        .execute();
      
      return true;
    } catch (error) {
      console.error('Error adding user to channel:', error);
      return false;
    }
  }

  /**
   * Bulk adds users to channel
   * @param {string} channelId - Channel ID
   * @param {string[]} userIds - Array of user IDs
   * @returns {Promise<Object[]>} Results for each user
   */
  async bulkAddToChannel(channelId, userIds) {
    const results = [];
    
    for (const userId of userIds) {
      const success = await this.addToChannel(channelId, userId);
      results.push({
        userId,
        success,
      });
    }
    
    return results;
  }

  /**
   * Removes all users from channel (clears channel_members)
   * @param {string} channelId - Channel ID
   * @returns {Promise<number>} Number of associations removed
   */
  async clearChannelMembers(channelId) {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .delete()
        .from('channel_members')
        .where('channel_id = :channelId', { channelId })
        .execute();
      
      return result.affected || 0;
    } catch (error) {
      console.error('Error clearing channel members:', error);
      return 0;
    }
  }

  /**
   * Gets users by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object[]>} Users in channel
   */
  async findByChannel(channelId) {
    return await this.repository
      .createQueryBuilder('user')
      .innerJoin('channel_members', 'cm', 'cm.user_id = user.user_id')
      .where('cm.channel_id = :channelId', { channelId })
      .getMany();
  }
}

export default UserRepository;
