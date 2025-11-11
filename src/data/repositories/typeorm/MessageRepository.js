/**
 * @fileoverview Message Repository
 * Repository for Message entity operations
 * @module repositories/typeorm/MessageRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { MessageEntity } from '../../../core/entities/db/index.js';

/**
 * Message Repository
 * Handles database operations for Message entity
 * 
 * @class MessageRepository
 * @extends BaseRepository
 */
class MessageRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(MessageEntity);
    super(repository, 'Message');
  }

  /**
   * Finds messages by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object[]>} Channel messages
   */
  async findByChannel(channelId) {
    return await this.findMany({ channelId });
  }

  /**
   * Finds messages by user
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} User messages
   */
  async findByUser(userId) {
    return await this.findMany({ userId });
  }

  /**
   * Finds messages by status
   * @param {string} status - Message status
   * @returns {Promise<Object[]>} Messages with status
   */
  async findByStatus(status) {
    return await this.findMany({ status });
  }

  /**
   * Finds pending messages
   * @returns {Promise<Object[]>} Pending messages
   */
  async findPending() {
    return await this.findMany({ status: 'pending' });
  }

  /**
   * Finds failed messages
   * @returns {Promise<Object[]>} Failed messages
   */
  async findFailed() {
    return await this.findMany({ status: 'failed' });
  }

  /**
   * Finds old messages for deletion
   * @param {number} daysOld - Days old
   * @returns {Promise<Object[]>} Old messages
   */
  async findOldMessages(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.repository
      .createQueryBuilder('message')
      .where('message.status = :status', { status: 'sent' })
      .andWhere('message.created_at <= :cutoffDate', { cutoffDate })
      .getMany();
  }

  /**
   * Marks message as sent
   * @param {number} id - Message ID
   * @param {string} forwardedMessageId - Forwarded message ID
   * @returns {Promise<void>}
   */
  async markAsSent(id, forwardedMessageId) {
    await this.repository.update(id, {
      status: 'sent',
      forwardedMessageId,
      updatedAt: new Date(),
    });
  }

  /**
   * Marks message as failed
   * @param {number} id - Message ID
   * @param {string} errorMessage - Error message
   * @returns {Promise<void>}
   */
  async markAsFailed(id, errorMessage) {
    const message = await this.findById(id);
    if (!message) return;

    await this.repository.update(id, {
      status: 'failed',
      errorMessage,
      retryCount: message.retryCount + 1,
      updatedAt: new Date(),
    });
  }

  /**
   * Marks message as deleted
   * @param {string} userId - User ID
   * @param {string} forwardedMessageId - Forwarded message ID
   * @returns {Promise<void>}
   */
  async markAsDeleted(userId, forwardedMessageId) {
    await this.repository.update(
      { userId, forwardedMessageId },
      {
        status: 'deleted',
        updatedAt: new Date(),
      }
    );
  }

  /**
   * Gets message statistics
   * @returns {Promise<Object>} Message statistics
   */
  async getStatistics() {
    const result = await this.repository
      .createQueryBuilder('message')
      .select('message.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('message.status')
      .getRawMany();

    const stats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      deleted: 0,
    };

    result.forEach(row => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    return stats;
  }

  /**
   * Gets statistics by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Channel statistics
   */
  async getChannelStatistics(channelId) {
    const result = await this.repository
      .createQueryBuilder('message')
      .select('message.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('message.channel_id = :channelId', { channelId })
      .groupBy('message.status')
      .getRawMany();

    const stats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      deleted: 0,
    };

    result.forEach(row => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    return stats;
  }
}

export default MessageRepository;
