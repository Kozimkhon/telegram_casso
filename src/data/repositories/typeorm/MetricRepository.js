/**
 * @fileoverview Metric Repository
 * Repository for Metric entity operations
 * @module repositories/typeorm/MetricRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { MetricEntity } from '../../../core/entities/db/index.js';

/**
 * Metric Repository
 * Handles database operations for Metric entity
 * 
 * @class MetricRepository
 * @extends BaseRepository
 */
class MetricRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(MetricEntity);
    super(repository, 'Metric');
  }

  /**
   * Finds metrics by session
   * @param {string} sessionPhone - Session phone
   * @returns {Promise<Object[]>} Session metrics
   */
  async findBySession(sessionPhone) {
    return await this.findMany({ sessionPhone });
  }

  /**
   * Finds metrics by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object[]>} Channel metrics
   */
  async findByChannel(channelId) {
    return await this.findMany({ channelId });
  }

  /**
   * Finds metrics by user
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} User metrics
   */
  async findByUser(userId) {
    return await this.findMany({ userId });
  }

  /**
   * Finds metric for session/channel/user combination
   * @param {string} sessionPhone - Session phone
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Metric or null
   */
  async findByComposite(sessionPhone, channelId, userId) {
    return await this.findOne({ sessionPhone, channelId, userId });
  }

  /**
   * Increments messages sent
   * @param {string} sessionPhone - Session phone
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async incrementMessagesSent(sessionPhone, channelId, userId) {
    const metric = await this.findByComposite(sessionPhone, channelId, userId);
    
    if (metric) {
      await this.repository.increment(
        { sessionPhone, channelId, userId },
        'messagesSent',
        1
      );
      await this.repository.update(
        { sessionPhone, channelId, userId },
        {
          lastMessageAt: new Date(),
          lastActivity: new Date(),
          updatedAt: new Date(),
        }
      );
    } else {
      await this.create({
        sessionPhone,
        channelId,
        userId,
        messagesSent: 1,
        lastMessageAt: new Date(),
        lastActivity: new Date(),
      });
    }
  }

  /**
   * Increments messages failed
   * @param {string} sessionPhone - Session phone
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async incrementMessagesFailed(sessionPhone, channelId, userId) {
    const metric = await this.findByComposite(sessionPhone, channelId, userId);
    
    if (metric) {
      await this.repository.increment(
        { sessionPhone, channelId, userId },
        'messagesFailed',
        1
      );
      await this.repository.update(
        { sessionPhone, channelId, userId },
        {
          lastActivity: new Date(),
          updatedAt: new Date(),
        }
      );
    } else {
      await this.create({
        sessionPhone,
        channelId,
        userId,
        messagesFailed: 1,
        lastActivity: new Date(),
      });
    }
  }

  /**
   * Increments flood errors
   * @param {string} sessionPhone - Session phone
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async incrementFloodErrors(sessionPhone, channelId, userId) {
    const metric = await this.findByComposite(sessionPhone, channelId, userId);
    
    if (metric) {
      await this.repository.increment(
        { sessionPhone, channelId, userId },
        'floodErrors',
        1
      );
      await this.repository.update(
        { sessionPhone, channelId, userId },
        {
          lastFloodAt: new Date(),
          lastActivity: new Date(),
          updatedAt: new Date(),
        }
      );
    } else {
      await this.create({
        sessionPhone,
        channelId,
        userId,
        floodErrors: 1,
        lastFloodAt: new Date(),
        lastActivity: new Date(),
      });
    }
  }

  /**
   * Gets aggregated statistics
   * @returns {Promise<Object>} Aggregated statistics
   */
  async getAggregatedStatistics() {
    const result = await this.repository
      .createQueryBuilder('metric')
      .select('SUM(metric.messages_sent)', 'totalSent')
      .addSelect('SUM(metric.messages_failed)', 'totalFailed')
      .addSelect('SUM(metric.flood_errors)', 'totalFloodErrors')
      .addSelect('SUM(metric.spam_warnings)', 'totalSpamWarnings')
      .getRawOne();

    return {
      totalSent: parseInt(result.totalSent || 0),
      totalFailed: parseInt(result.totalFailed || 0),
      totalFloodErrors: parseInt(result.totalFloodErrors || 0),
      totalSpamWarnings: parseInt(result.totalSpamWarnings || 0),
    };
  }

  /**
   * Gets statistics by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Channel statistics
   */
  async getChannelStatistics(channelId) {
    const result = await this.repository
      .createQueryBuilder('metric')
      .select('SUM(metric.messages_sent)', 'totalSent')
      .addSelect('SUM(metric.messages_failed)', 'totalFailed')
      .addSelect('SUM(metric.flood_errors)', 'totalFloodErrors')
      .where('metric.channel_id = :channelId', { channelId })
      .getRawOne();

    return {
      totalSent: parseInt(result.totalSent || 0),
      totalFailed: parseInt(result.totalFailed || 0),
      totalFloodErrors: parseInt(result.totalFloodErrors || 0),
    };
  }

  /**
   * Gets statistics by session
   * @param {string} sessionPhone - Session phone
   * @returns {Promise<Object>} Session statistics
   */
  async getSessionStatistics(sessionPhone) {
    const result = await this.repository
      .createQueryBuilder('metric')
      .select('SUM(metric.messages_sent)', 'totalSent')
      .addSelect('SUM(metric.messages_failed)', 'totalFailed')
      .addSelect('SUM(metric.flood_errors)', 'totalFloodErrors')
      .where('metric.session_phone = :sessionPhone', { sessionPhone })
      .getRawOne();

    return {
      totalSent: parseInt(result.totalSent || 0),
      totalFailed: parseInt(result.totalFailed || 0),
      totalFloodErrors: parseInt(result.totalFloodErrors || 0),
    };
  }
}

export default MetricRepository;
