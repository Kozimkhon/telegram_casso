/**
 * @fileoverview ChannelLog Domain Repository
 * Domain layer repository for ChannelLog entity operations
 * @module data/repositories/domain/ChannelLogRepository
 */

import { ChannelLog } from '../../../core/entities/index.js';
import RepositoryFactory from './RepositoryFactory.js';

/**
 * ChannelLog Domain Repository
 * Wraps ORM repository and works with domain entities
 */
class ChannelLogRepository {
  #ormRepository;

  constructor() {
    this.#ormRepository = RepositoryFactory.getChannelLogRepository();
  }

  /**
   * Converts ORM entity to Domain entity
   * @private
   * @param {Object} ormEntity - ORM entity
   * @returns {ChannelLog|null} Domain entity
   */
  #toDomainEntity(ormEntity) {
    if (!ormEntity) return null;
    
    return ChannelLog.fromDatabaseRow({
      id: ormEntity.id,
      channel_id: ormEntity.channelId,
      date: ormEntity.date,
      user_id: ormEntity.userId,
      action: typeof ormEntity.action === 'string' ? JSON.parse(ormEntity.action) : ormEntity.action,
      created_at: ormEntity.createdAt,
    });
  }

  /**
   * Converts Domain entity to ORM format
   * @private
   * @param {ChannelLog} domainEntity - Domain entity
   * @returns {Object} ORM format object
   */
  #toOrmFormat(domainEntity) {
    const data = domainEntity.toObject();
    return {
      id: data.id,
      channelId: data.channel_id,
      date: data.date,
      userId: data.user_id,
      action: data.action,
      createdAt: data.created_at,
    };
  }

  /**
   * Gets the last log ID for a channel
   * @param {number} channelId - Channel database ID
   * @returns {Promise<bigint|null>} Last log event ID or null
   */
  async getLastLogId(channelId) {
    return await this.#ormRepository.getLastLogId(channelId);
  }

  /**
   * Saves channel logs in bulk
   * Takes domain entities, converts to ORM format
   * @param {Array<ChannelLog>} logs - Array of domain log entities
   * @returns {Promise<number>} Number of logs saved
   */
  async bulkSave(logs) {
    if (!logs || logs.length === 0) {
      return 0;
    }

    // Convert domain entities to ORM format
    const ormLogs = logs.map(log => this.#toOrmFormat(log));
    
    return await this.#ormRepository.bulkSave(ormLogs);
  }

  /**
   * Gets logs for a channel within date range
   * @param {number} channelId - Channel database ID
   * @param {number} fromDate - Unix timestamp start
   * @param {number} toDate - Unix timestamp end
   * @returns {Promise<Array<ChannelLog>>} Domain log entities
   */
  async getLogsByDateRange(channelId, fromDate, toDate) {
    const ormLogs = await this.#ormRepository.getLogsByDateRange(channelId, fromDate, toDate);
    return ormLogs.map(log => this.#toDomainEntity(log)).filter(Boolean);
  }

  /**
   * Gets statistics for specific action types
   * @param {number} channelId - Channel database ID
   * @param {Array<string>} actionTypes - Action type names to filter
   * @param {number} fromDate - Unix timestamp start
   * @param {number} toDate - Unix timestamp end
   * @returns {Promise<Object>} Statistics by action type
   */
  async getActionStatistics(channelId, actionTypes, fromDate, toDate) {
    return await this.#ormRepository.getActionStatistics(channelId, actionTypes, fromDate, toDate);
  }

  /**
   * Counts total logs for a channel
   * @param {number} channelId - Channel database ID
   * @returns {Promise<number>} Total log count
   */
  async countByChannel(channelId) {
    return await this.#ormRepository.countByChannel(channelId);
  }

  /**
   * Finds logs by user ID
   * @param {string} userId - User ID
   * @param {Object} [options] - Query options
   * @returns {Promise<Array<ChannelLog>>} Domain log entities
   */
  async findByUserId(userId, options = {}) {
    const ormLogs = await this.#ormRepository.findByUserId(userId, options);
    return ormLogs.map(log => this.#toDomainEntity(log)).filter(Boolean);
  }

  /**
   * Finds logs by action type
   * @param {number} channelId - Channel database ID
   * @param {string} actionType - Action type name
   * @param {Object} [options] - Query options
   * @returns {Promise<Array<ChannelLog>>} Domain log entities
   */
  async findByActionType(channelId, actionType, options = {}) {
    const ormLogs = await this.#ormRepository.findByActionType(channelId, actionType, options);
    return ormLogs.map(log => this.#toDomainEntity(log)).filter(Boolean);
  }

  /**
   * Deletes old logs (cleanup)
   * @param {number} olderThanDays - Delete logs older than this many days
   * @returns {Promise<number>} Number of logs deleted
   */
  async deleteOldLogs(olderThanDays) {
    return await this.#ormRepository.deleteOldLogs(olderThanDays);
  }
}

export default ChannelLogRepository;
