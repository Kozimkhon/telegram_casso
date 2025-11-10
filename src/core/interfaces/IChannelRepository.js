/**
 * @fileoverview Channel Repository Interface
 * Contract for channel repository implementations
 * @module core/interfaces/IChannelRepository
 */

import IRepository from './IRepository.js';

/**
 * Channel Repository Interface
 * Defines channel-specific operations
 * 
 * @interface IChannelRepository
 * @extends IRepository
 */
class IChannelRepository extends IRepository {
  /**
   * Finds channels by admin session
   * @abstract
   * @param {string} phone - Admin session phone
   * @returns {Promise<Array>} Channels
   */
  async findByAdminSession(phone) {
    throw new Error('findByAdminSession() must be implemented');
  }

  /**
   * Finds enabled channels
   * @abstract
   * @returns {Promise<Array>} Enabled channels
   */
  async findEnabled() {
    throw new Error('findEnabled() must be implemented');
  }

  /**
   * Toggles channel forwarding
   * @abstract
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Updated channel
   */
  async toggleForwarding(channelId) {
    throw new Error('toggleForwarding() must be implemented');
  }

  /**
   * Links channel to session
   * @abstract
   * @param {string} channelId - Channel ID
   * @param {string} phone - Session phone
   * @returns {Promise<Object>} Updated channel
   */
  async linkToSession(channelId, phone) {
    throw new Error('linkToSession() must be implemented');
  }

  /**
   * Gets channel statistics
   * @abstract
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    throw new Error('getStatistics() must be implemented');
  }
}

export default IChannelRepository;
