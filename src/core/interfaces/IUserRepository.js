/**
 * @fileoverview User Repository Interface
 * Contract for user repository implementations
 * @module core/interfaces/IUserRepository
 */

import IRepository from './IRepository.js';

/**
 * User Repository Interface
 * Defines user-specific operations
 * 
 * @interface IUserRepository
 * @extends IRepository
 */
class IUserRepository extends IRepository {
  /**
   * Finds users by channel
   * @abstract
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array>} Users
   */
  async findByChannel(channelId) {
    throw new Error('findByChannel() must be implemented');
  }

  /**
   * Finds users by username
   * @abstract
   * @param {string} username - Username
   * @returns {Promise<Array>} Users
   */
  async findByUsername(username) {
    throw new Error('findByUsername() must be implemented');
  }

  /**
   * Adds user to channel
   * @abstract
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if added
   */
  async addToChannel(channelId, userId) {
    throw new Error('addToChannel() must be implemented');
  }

  /**
   * Removes user from channel
   * @abstract
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if removed
   */
  async removeFromChannel(channelId, userId) {
    throw new Error('removeFromChannel() must be implemented');
  }

  /**
   * Clears channel members
   * @abstract
   * @param {string} channelId - Channel ID
   * @returns {Promise<number>} Number of removed users
   */
  async clearChannelMembers(channelId) {
    throw new Error('clearChannelMembers() must be implemented');
  }

  /**
   * Bulk adds users
   * @abstract
   * @param {Array} users - Users to add
   * @returns {Promise<Array>} Results
   */
  async bulkCreate(users) {
    throw new Error('bulkCreate() must be implemented');
  }

  /**
   * Gets user statistics
   * @abstract
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    throw new Error('getStatistics() must be implemented');
  }
}

export default IUserRepository;
