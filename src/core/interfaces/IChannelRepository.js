/**
 * Channel Repository Interface
 * Defines contract for channel data operations
 * 
 * @module core/interfaces/IChannelRepository
 */

import { IRepository } from './IRepository.js';

/**
 * @interface IChannelRepository
 * @extends {IRepository}
 * @description Repository interface for Channel entity operations
 */
export class IChannelRepository extends IRepository {
  /**
   * Finds channels by admin session phone
   * @param {string} phone - Admin session phone
   * @returns {Promise<Array<Channel>>} Array of channels
   * @abstract
   */
  async findByAdminSession(phone) {
    throw new Error('Method findByAdminSession() must be implemented');
  }

  /**
   * Finds enabled channels only
   * @returns {Promise<Array<Channel>>} Array of enabled channels
   * @abstract
   */
  async findEnabled() {
    throw new Error('Method findEnabled() must be implemented');
  }

  /**
   * Toggles channel forwarding status
   * @param {string} channelId - Channel ID
   * @returns {Promise<Channel>} Updated channel
   * @abstract
   */
  async toggleForwarding(channelId) {
    throw new Error('Method toggleForwarding() must be implemented');
  }

  /**
   * Links channel to admin session
   * @param {string} channelId - Channel ID
   * @param {string} phone - Admin session phone
   * @returns {Promise<Channel>} Updated channel
   * @abstract
   */
  async linkToSession(channelId, phone) {
    throw new Error('Method linkToSession() must be implemented');
  }

  /**
   * Updates throttle settings for a channel
   * @param {string} channelId - Channel ID
   * @param {Object} settings - Throttle settings
   * @returns {Promise<Channel>} Updated channel
   * @abstract
   */
  async updateThrottleSettings(channelId, settings) {
    throw new Error('Method updateThrottleSettings() must be implemented');
  }

  /**
   * Gets channel statistics
   * @returns {Promise<Object>} Channel statistics
   * @abstract
   */
  async getStatistics() {
    throw new Error('Method getStatistics() must be implemented');
  }
}

export default IChannelRepository;
