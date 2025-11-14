/**
 * @fileoverview ChannelLog ORM Repository
 * TypeORM repository for ChannelLog entity operations
 * @module repositories/orm/ChannelLogRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { ChannelLogEntity } from '../../../core/entities/orm/index.js';
import { Between } from 'typeorm';

/**
 * ChannelLog ORM Repository
 * Handles TypeORM database operations for ChannelLog entity
 * 
 * @class ChannelLogRepository
 * @extends BaseRepository
 */
class ChannelLogRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(ChannelLogEntity);
    super(repository, 'ChannelLog');
  }

  /**
   * Gets the last log ID for a channel
   * @param {number} channelId - Channel database ID
   * @returns {Promise<bigint|null>} Last log event ID or null
   */
  async getLastLogId(channelId) {
    try {
      const lastLog = await this.repository.findOne({
        where: { channelId },
        order: { id: 'DESC' },
        select: ['id'],
      });

      return lastLog ? BigInt(lastLog.id) : null;
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to get last log ID - ${error.message}`);
    }
  }

  /**
   * Saves channel logs in bulk
   * @param {Array<Object>} logs - Array of log entries
   * @returns {Promise<number>} Number of logs saved
   */
  async bulkSave(logs) {
    try {
      if (!logs || logs.length === 0) {
        return 0;
      }

      // Use insert with orIgnore to handle duplicates
      await this.repository
        .createQueryBuilder()
        .insert()
        .into('ChannelLog')
        .values(logs)
        .orIgnore()
        .execute();

      return logs.length;
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to bulk save logs - ${error.message}`);
    }
  }

  /**
   * Gets logs for a channel within date range
   * @param {number} channelId - Channel database ID
   * @param {number} fromDate - Unix timestamp start
   * @param {number} toDate - Unix timestamp end
   * @returns {Promise<Array>} Channel logs
   */
  async getLogsByDateRange(channelId, fromDate, toDate) {
    try {
      return await this.repository.find({
        where: {
          channelId,
          date: Between(fromDate, toDate),
        },
        order: { date: 'DESC' },
      });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to get logs by date range - ${error.message}`);
    }
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
    try {
      const logs = await this.repository.find({
        where: {
          channelId,
          date: Between(fromDate, toDate),
        },
      });

      // Group by action type
      const stats = {};
      actionTypes.forEach(type => stats[type] = 0);

      logs.forEach(log => {
        const actionType = log.action?._?.split('.').pop();
        if (actionTypes.includes(actionType)) {
          stats[actionType]++;
        }
      });

      return stats;
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to get action statistics - ${error.message}`);
    }
  }

  /**
   * Counts total logs for a channel
   * @param {number} channelId - Channel database ID
   * @returns {Promise<number>} Total log count
   */
  async countByChannel(channelId) {
    try {
      return await this.count({ channelId });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to count logs - ${error.message}`);
    }
  }

  /**
   * Finds logs by user ID
   * @param {string} userId - User ID
   * @param {Object} [options] - Query options
   * @returns {Promise<Array>} User's logs
   */
  async findByUserId(userId, options = {}) {
    try {
      return await this.repository.find({
        where: { userId },
        order: { date: 'DESC' },
        ...options,
      });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to find logs by user ID - ${error.message}`);
    }
  }

  /**
   * Finds logs by action type
   * @param {number} channelId - Channel database ID
   * @param {string} actionType - Action type name
   * @param {Object} [options] - Query options
   * @returns {Promise<Array>} Logs of specified action type
   */
  async findByActionType(channelId, actionType, options = {}) {
    try {
      const logs = await this.repository.find({
        where: { channelId },
        order: { date: 'DESC' },
        ...options,
      });

      // Filter by action type (action is stored as JSON)
      return logs.filter(log => {
        const logActionType = log.action?._?.split('.').pop();
        return logActionType === actionType;
      });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to find logs by action type - ${error.message}`);
    }
  }

  /**
   * Deletes old logs (cleanup)
   * @param {number} olderThanDays - Delete logs older than this many days
   * @returns {Promise<number>} Number of logs deleted
   */
  async deleteOldLogs(olderThanDays) {
    try {
      const cutoffDate = Math.floor(Date.now() / 1000) - (olderThanDays * 24 * 60 * 60);
      
      const result = await this.repository
        .createQueryBuilder()
        .delete()
        .where('date < :cutoffDate', { cutoffDate })
        .execute();

      return result.affected || 0;
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to delete old logs - ${error.message}`);
    }
  }
}

export default ChannelLogRepository;
