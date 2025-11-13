/**
 * @fileoverview Message Repository Interface
 * Contract for message repository implementations
 * @module core/interfaces/IMessageRepository
 */

import IRepository from './IRepository.js';

/**
 * Message Repository Interface
 * Defines message-specific operations
 * 
 * @interface IMessageRepository
 * @extends IRepository
 */
class IMessageRepository extends IRepository {
  /**
   * Finds messages by channel
   * @abstract
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array>} Messages
   */
  async findByChannel(channelId) {
    throw new Error('findByChannel() must be implemented');
  }

  /**
   * Finds messages by status
   * @abstract
   * @param {string} status - Message status
   * @returns {Promise<Array>} Messages
   */
  async findByStatus(status) {
    throw new Error('findByStatus() must be implemented');
  }

  /**
   * Finds old messages
   * @abstract
   * @param {number} hoursOld - Hours old
   * @returns {Promise<Array>} Old messages
   */
  async findOldMessages(hoursOld) {
    throw new Error('findOldMessages() must be implemented');
  }

  /**
   * Gets forwarding statistics
   * @abstract
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Object>} Statistics
   */
  async getForwardingStatistics(filters = {}) {
    throw new Error('getForwardingStatistics() must be implemented');
  }

  /**
   * Cleans up old logs
   * @abstract
   * @param {number} daysToKeep - Days to keep
   * @returns {Promise<number>} Number of deleted records
   */
  async cleanupOldLogs(daysToKeep) {
    throw new Error('cleanupOldLogs() must be implemented');
  }

  /**
   * Marks message as deleted
   * @abstract
   * @param {string} userId - User ID
   * @param {string} forwardedMessageId - Forwarded message ID
   * @returns {Promise<void>}
   */
  async markAsDeleted(userId, forwardedMessageId) {
    throw new Error('markAsDeleted() must be implemented');
  }
}

export default IMessageRepository;
