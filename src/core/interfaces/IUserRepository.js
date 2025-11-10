/**
 * User Repository Interface
 * Defines contract for user data operations
 * 
 * @module core/interfaces/IUserRepository
 */

import { IRepository } from './IRepository.js';

/**
 * @interface IUserRepository
 * @extends {IRepository}
 * @description Repository interface for User entity operations
 */
export class IUserRepository extends IRepository {
  /**
   * Finds users by channel ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array<User>>} Array of users
   * @abstract
   */
  async findByChannel(channelId) {
    throw new Error('Method findByChannel() must be implemented');
  }

  /**
   * Bulk creates or updates users
   * @param {Array<Object>} users - Array of user data
   * @returns {Promise<Array<User>>} Array of created/updated users
   * @abstract
   */
  async bulkCreateOrUpdate(users) {
    throw new Error('Method bulkCreateOrUpdate() must be implemented');
  }

  /**
   * Links users to a channel (channel members)
   * @param {string} channelId - Channel ID
   * @param {Array<string>} userIds - Array of user IDs
   * @returns {Promise<number>} Number of users linked
   * @abstract
   */
  async linkToChannel(channelId, userIds) {
    throw new Error('Method linkToChannel() must be implemented');
  }

  /**
   * Removes user from channel
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if removed
   * @abstract
   */
  async unlinkFromChannel(channelId, userId) {
    throw new Error('Method unlinkFromChannel() must be implemented');
  }

  /**
   * Finds users by username
   * @param {string} username - Username to search
   * @returns {Promise<Array<User>>} Array of matching users
   * @abstract
   */
  async findByUsername(username) {
    throw new Error('Method findByUsername() must be implemented');
  }
}

export default IUserRepository;
