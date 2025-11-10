/**
 * Channel Repository Implementation
 * Implements channel data access using SQLite
 * 
 * @module data/repositories/ChannelRepository
 */

import { IChannelRepository } from '../../core/interfaces/IChannelRepository.js';
import { Channel } from '../../core/entities/Channel.js';
import { Tables } from '../../shared/constants/index.js';

/**
 * @class ChannelRepository
 * @extends {IChannelRepository}
 * @description Repository implementation for Channel entity
 * Handles all database operations for channels
 */
export class ChannelRepository extends IChannelRepository {
  /**
   * Creates a new ChannelRepository
   * @param {SQLiteDataSource} dataSource - Database data source
   */
  constructor(dataSource) {
    super();
    this.dataSource = dataSource;
    this.tableName = Tables.CHANNELS;
  }

  /**
   * Finds a channel by ID
   * @param {string} id - Channel ID
   * @returns {Promise<Channel|null>} Channel or null
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE channel_id = ?`;
    const row = await this.dataSource.getOne(sql, [id]);
    return row ? Channel.fromDatabaseRow(row) : null;
  }

  /**
   * Finds all channels with optional filtering
   * @param {Object} [filter] - Filter options
   * @param {boolean} [filter.enabled] - Filter by enabled status
   * @returns {Promise<Array<Channel>>} Array of channels
   */
  async findAll(filter = {}) {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params = [];

    if (filter.enabled !== undefined) {
      sql += ' WHERE forward_enabled = ?';
      params.push(filter.enabled ? 1 : 0);
    }

    sql += ' ORDER BY title ASC';

    const rows = await this.dataSource.getAll(sql, params);
    return Channel.fromDatabaseRows(rows);
  }

  /**
   * Finds enabled channels only
   * @returns {Promise<Array<Channel>>} Array of enabled channels
   */
  async findEnabled() {
    return this.findAll({ enabled: true });
  }

  /**
   * Finds channels by admin session phone
   * @param {string} phone - Admin session phone
   * @returns {Promise<Array<Channel>>} Array of channels
   */
  async findByAdminSession(phone) {
    const sql = `SELECT * FROM ${this.tableName} WHERE admin_session_phone = ? ORDER BY title ASC`;
    const rows = await this.dataSource.getAll(sql, [phone]);
    return Channel.fromDatabaseRows(rows);
  }

  /**
   * Creates a new channel
   * @param {Object} data - Channel data
   * @returns {Promise<Channel>} Created channel
   */
  async create(data) {
    const channel = new Channel(data);
    const obj = channel.toObject();

    const sql = `
      INSERT INTO ${this.tableName} 
      (channel_id, title, forward_enabled, admin_session_phone, 
       throttle_delay_ms, throttle_per_member_ms, min_delay_ms, max_delay_ms,
       schedule_enabled, schedule_config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    await this.dataSource.run(sql, [
      obj.channelId,
      obj.title,
      obj.forwardEnabled ? 1 : 0,
      obj.adminSessionPhone,
      obj.throttleDelayMs,
      obj.throttlePerMemberMs,
      obj.minDelayMs,
      obj.maxDelayMs,
      obj.scheduleEnabled ? 1 : 0,
      obj.scheduleConfig
    ]);

    return this.findById(obj.channelId);
  }

  /**
   * Updates an existing channel
   * @param {string} id - Channel ID
   * @param {Object} data - Update data
   * @returns {Promise<Channel>} Updated channel
   */
  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Channel not found: ${id}`);
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.forwardEnabled !== undefined) {
      updates.push('forward_enabled = ?');
      params.push(data.forwardEnabled ? 1 : 0);
    }
    if (data.adminSessionPhone !== undefined) {
      updates.push('admin_session_phone = ?');
      params.push(data.adminSessionPhone);
    }
    if (data.throttleDelayMs !== undefined) {
      updates.push('throttle_delay_ms = ?');
      params.push(data.throttleDelayMs);
    }
    if (data.throttlePerMemberMs !== undefined) {
      updates.push('throttle_per_member_ms = ?');
      params.push(data.throttlePerMemberMs);
    }
    if (data.minDelayMs !== undefined) {
      updates.push('min_delay_ms = ?');
      params.push(data.minDelayMs);
    }
    if (data.maxDelayMs !== undefined) {
      updates.push('max_delay_ms = ?');
      params.push(data.maxDelayMs);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE channel_id = ?`;
    await this.dataSource.run(sql, params);

    return this.findById(id);
  }

  /**
   * Deletes a channel
   * @param {string} id - Channel ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE channel_id = ?`;
    const result = await this.dataSource.run(sql, [id]);
    return result.changes > 0;
  }

  /**
   * Checks if channel exists
   * @param {string} id - Channel ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const sql = `SELECT 1 FROM ${this.tableName} WHERE channel_id = ? LIMIT 1`;
    const row = await this.dataSource.getOne(sql, [id]);
    return row !== null;
  }

  /**
   * Counts channels with optional filtering
   * @param {Object} [filter] - Filter options
   * @returns {Promise<number>} Count of channels
   */
  async count(filter = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];

    if (filter.enabled !== undefined) {
      sql += ' WHERE forward_enabled = ?';
      params.push(filter.enabled ? 1 : 0);
    }

    const row = await this.dataSource.getOne(sql, params);
    return row?.count || 0;
  }

  /**
   * Toggles channel forwarding status
   * @param {string} channelId - Channel ID
   * @returns {Promise<Channel>} Updated channel
   */
  async toggleForwarding(channelId) {
    const channel = await this.findById(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    channel.toggleForwarding();
    return this.update(channelId, { forwardEnabled: channel.forwardEnabled });
  }

  /**
   * Links channel to admin session
   * @param {string} channelId - Channel ID
   * @param {string} phone - Admin session phone
   * @returns {Promise<Channel>} Updated channel
   */
  async linkToSession(channelId, phone) {
    return this.update(channelId, { adminSessionPhone: phone });
  }

  /**
   * Updates throttle settings for a channel
   * @param {string} channelId - Channel ID
   * @param {Object} settings - Throttle settings
   * @returns {Promise<Channel>} Updated channel
   */
  async updateThrottleSettings(channelId, settings) {
    return this.update(channelId, settings);
  }

  /**
   * Gets channel statistics
   * @returns {Promise<Object>} Channel statistics
   */
  async getStatistics() {
    const total = await this.count();
    const enabled = await this.count({ enabled: true });

    return {
      total,
      enabled,
      disabled: total - enabled
    };
  }
}

export default ChannelRepository;
