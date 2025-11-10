/**
 * @fileoverview Message Repository Implementation
 * Handles message log data persistence
 * @module data/repositories/MessageRepository
 */

import IMessageRepository from '../../core/interfaces/IMessageRepository.js';
import Message from '../../core/entities/Message.entity.js';
import { ForwardingStatus } from '../../shared/constants/index.js';

/**
 * Message Repository
 * Implements message data access operations
 * 
 * @class MessageRepository
 * @implements {IMessageRepository}
 */
class MessageRepository extends IMessageRepository {
  /**
   * Data source
   * @private
   */
  #dataSource;

  /**
   * Creates message repository
   * @param {SQLiteDataSource} dataSource - Data source
   */
  constructor(dataSource) {
    super();
    this.#dataSource = dataSource;
  }

  /**
   * Finds message by ID
   * @param {string} id - Message log ID
   * @returns {Promise<Message|null>} Message or null
   */
  async findById(id) {
    const row = await this.#dataSource.getOne(
      'SELECT * FROM message_logs WHERE id = ?',
      [id]
    );
    return row ? Message.fromDatabaseRow(row) : null;
  }

  /**
   * Finds all messages
   * @param {Object} filters - Filters
   * @returns {Promise<Array<Message>>} Messages
   */
  async findAll(filters = {}) {
    const { limit = 100, status, channelId } = filters;
    
    let query = 'SELECT * FROM message_logs';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (channelId) {
      conditions.push('channel_id = ?');
      params.push(channelId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await this.#dataSource.getMany(query, params);
    return rows.map(row => Message.fromDatabaseRow(row));
  }

  /**
   * Creates new message log
   * @param {Message} message - Message entity
   * @returns {Promise<Message>} Created message
   */
  async create(message) {
    const data = message.toObject();

    const result = await this.#dataSource.execute(
      `INSERT INTO message_logs 
       (channel_id, message_id, user_id, forwarded_message_id, status, 
        error_message, session_phone, retry_count, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.channel_id,
        data.message_id,
        data.user_id,
        data.forwarded_message_id,
        data.status,
        data.error_message,
        data.session_phone,
        data.retry_count,
        data.created_at,
        data.updated_at
      ]
    );

    return await this.findById(result.lastID);
  }

  /**
   * Updates message
   * @param {string} id - Message ID
   * @param {Object} updates - Updates
   * @returns {Promise<Message>} Updated message
   */
  async update(id, updates) {
    const message = await this.findById(id);
    if (!message) {
      throw new Error(`Message not found: ${id}`);
    }

    // Apply updates
    if (updates.status === ForwardingStatus.SUCCESS && updates.forwardedMessageId) {
      message.markSuccess(updates.forwardedMessageId);
    } else if (updates.status === ForwardingStatus.FAILED && updates.errorMessage) {
      message.markFailed(updates.errorMessage);
    } else if (updates.status === ForwardingStatus.SKIPPED && updates.errorMessage) {
      message.markSkipped(updates.errorMessage);
    }

    const data = message.toObject();

    await this.#dataSource.execute(
      `UPDATE message_logs 
       SET forwarded_message_id = ?, status = ?, error_message = ?, 
           retry_count = ?, updated_at = ? 
       WHERE id = ?`,
      [
        data.forwarded_message_id,
        data.status,
        data.error_message,
        data.retry_count,
        data.updated_at,
        id
      ]
    );

    return await this.findById(id);
  }

  /**
   * Deletes message
   * @param {string} id - Message ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const result = await this.#dataSource.execute(
      'DELETE FROM message_logs WHERE id = ?',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Checks if message exists
   * @param {string} id - Message ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const message = await this.findById(id);
    return message !== null;
  }

  /**
   * Counts messages
   * @param {Object} filters - Filters
   * @returns {Promise<number>} Count
   */
  async count(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM message_logs';
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.channelId) {
      conditions.push('channel_id = ?');
      params.push(filters.channelId);
    }

    if (filters.fromDate) {
      conditions.push('created_at >= ?');
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      conditions.push('created_at <= ?');
      params.push(filters.toDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.#dataSource.getOne(query, params);
    return result?.count || 0;
  }

  /**
   * Finds messages by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array<Message>>} Messages
   */
  async findByChannel(channelId) {
    return await this.findAll({ channelId });
  }

  /**
   * Finds messages by status
   * @param {string} status - Message status
   * @returns {Promise<Array<Message>>} Messages
   */
  async findByStatus(status) {
    return await this.findAll({ status });
  }

  /**
   * Finds old messages
   * @param {number} hoursOld - Hours old
   * @returns {Promise<Array<Message>>} Old messages
   */
  async findOldMessages(hoursOld) {
    const rows = await this.#dataSource.getMany(
      `SELECT * FROM message_logs 
       WHERE status = ? 
       AND forwarded_message_id IS NOT NULL
       AND created_at < datetime('now', '-${hoursOld} hours')
       ORDER BY created_at ASC`,
      [ForwardingStatus.SUCCESS]
    );
    return rows.map(row => Message.fromDatabaseRow(row));
  }

  /**
   * Gets forwarding statistics
   * @param {Object} filters - Filters
   * @returns {Promise<Object>} Statistics
   */
  async getForwardingStatistics(filters = {}) {
    const [total, successful, failed, skipped] = await Promise.all([
      this.count(filters),
      this.count({ ...filters, status: ForwardingStatus.SUCCESS }),
      this.count({ ...filters, status: ForwardingStatus.FAILED }),
      this.count({ ...filters, status: ForwardingStatus.SKIPPED })
    ]);

    return {
      total,
      successful,
      failed,
      skipped,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : '0.00'
    };
  }

  /**
   * Cleans up old logs
   * @param {number} daysToKeep - Days to keep
   * @returns {Promise<number>} Number of deleted records
   */
  async cleanupOldLogs(daysToKeep) {
    const result = await this.#dataSource.execute(
      `DELETE FROM message_logs 
       WHERE created_at < datetime('now', '-${daysToKeep} days')`
    );
    return result.changes;
  }

  /**
   * Marks message as deleted
   * @param {string} userId - User ID
   * @param {string} forwardedMessageId - Forwarded message ID
   * @returns {Promise<void>}
   */
  async markAsDeleted(userId, forwardedMessageId) {
    await this.#dataSource.execute(
      `UPDATE message_logs 
       SET forwarded_message_id = NULL, updated_at = datetime('now') 
       WHERE user_id = ? AND forwarded_message_id = ?`,
      [userId, forwardedMessageId]
    );
  }

  /**
   * Finds messages by forwarded message ID
   * @param {string} channelId - Channel ID
   * @param {string} forwardedMessageId - Forwarded message ID
   * @returns {Promise<Array<Message>>} Messages
   */
  async findByForwardedMessageId(channelId, forwardedMessageId) {
    const rows = await this.#dataSource.getMany(
      `SELECT * FROM message_logs 
       WHERE channel_id = ? AND forwarded_message_id = ? AND status = ?`,
      [channelId, forwardedMessageId, ForwardingStatus.SUCCESS]
    );
    return rows.map(row => Message.fromDatabaseRow(row));
  }
}

export default MessageRepository;
