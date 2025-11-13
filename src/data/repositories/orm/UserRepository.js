/**
 * @fileoverview User Repository
 * Repository for User entity operations
 * @module repositories/typeorm/UserRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { UserEntity } from '../../../core/entities/orm/index.js';

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
      // Get channel repository
      const channelRepo = AppDataSource.getRepository('Channel');
      const userRepo = this.repository;
      
      // Find channel and user
      const channel = await channelRepo.findOne({ 
        where: { channelId },
        relations: ['users']
      });
      
      const user = await userRepo.findOne({ 
        where: { userId } 
      });
      
      if (!channel || !user) {
        console.error('Channel or user not found:', { channelId, userId });
        return false;
      }
      
      // Check if user already in channel
      const existingUser = channel.users?.find(u => u.userId === userId);
      if (existingUser) {
        return true; // Already added
      }
      
      // Add user to channel
      if (!channel.users) {
        channel.users = [];
      }
      channel.users.push(user);
      
      await channelRepo.save(channel);
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
    try {
      const channelRepo = AppDataSource.getRepository('Channel');
      const userRepo = this.repository;
      
      // Find channel
      const channel = await channelRepo.findOne({ 
        where: { channelId },
        relations: ['users']
      });
      
      if (!channel) {
        console.error('Channel not found:', channelId);
        return userIds.map(userId => ({ userId, success: false, error: 'Channel not found' }));
      }
      
      // Find all users that exist in database
      const users = await userRepo
        .createQueryBuilder('user')
        .where('user.userId IN (:...userIds)', { userIds })
        .getMany();
      
      // Get set of existing user IDs from the loaded channel relations
      // This is safe because we loaded the users in the findOne query
      const existingUserIds = new Set(channel.users?.map(u => u.userId) || []);
      
      const results = [];
      const newUsers = [];
      
      // Separate new users from existing ones
      for (const userId of userIds) {
        const user = users.find(u => u.userId === userId);
        
        if (!user) {
          // User doesn't exist in database
          results.push({
            userId,
            success: false,
            error: 'User not found'
          });
        } else if (existingUserIds.has(userId)) {
          // User already in channel
          results.push({
            userId,
            success: true,
            status: 'already_member'
          });
        } else {
          // New user to add
          newUsers.push(user);
          results.push({
            userId,
            success: true,
            status: 'added'
          });
        }
      }
      
      // Add new users to channel
      if (newUsers.length > 0) {
        try {
          // Initialize users array if needed
          if (!channel.users) {
            channel.users = [];
          }
          
          // Add the new users to the channel's users array
          channel.users.push(...newUsers);
          
          // Save the channel with the new users
          // TypeORM will handle updating the many-to-many join table
          await channelRepo.save(channel);
          
          console.log(`Successfully added ${newUsers.length} users to channel ${channelId}`);
        } catch (saveError) {
          console.error('Error saving channel with new users:', saveError.message);
          
          // If saving fails, mark newly added users as failed
          for (const user of newUsers) {
            const result = results.find(r => r.userId === user.userId);
            if (result) {
              result.success = false;
              result.error = saveError.message;
            }
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error bulk adding users to channel:', error);
      return userIds.map(userId => ({ 
        userId, 
        success: false,
        error: error.message 
      }));
    }
  }

  /**
   * Removes all users from channel (clears channel_members)
   * @param {string} channelId - Channel ID
   * @returns {Promise<number>} Number of associations removed
   */
  async clearChannelMembers(channelId) {
    try {
      const channelRepo = AppDataSource.getRepository('Channel');
      
      const channel = await channelRepo.findOne({ 
        where: { channelId },
        relations: ['users']
      });
      
      if (!channel) {
        return 0;
      }
      
      const count = channel.users?.length || 0;
      channel.users = [];
      await channelRepo.save(channel);
      
      return count;
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
