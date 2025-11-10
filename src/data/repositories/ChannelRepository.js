/**
 * @fileoverview Channel Repository Implementation
 * Handles channel data persistence
 * @module data/repositories/ChannelRepository
 */

import IChannelRepository from '../../core/interfaces/IChannelRepository.js';
import Channel from '../../core/entities/Channel.entity.js';

/**
 * Channel Repository
 * Implements channel data access operations
 * 
 * @class ChannelRepository
 * @implements {IChannelRepository}
 */
class ChannelRepository extends IChannelRepository {
  /**
   * Data source
   * @private
   */
  #dataSource;

  /**
   * Creates channel repository
   * @param {SQLiteDataSource} dataSource - Data source
   */
  constructor(dataSource) {
    super();
    this.#dataSource = dataSource;
  }

  /**
   * Finds channel by ID
   * @param {string} id - Channel ID
   * @returns {Promise<Channel|null>} Channel or null
   */
  async findById(id) {
    const row = await this.#dataSource.getOne(
      'SELECT * FROM channels WHERE channel_id = ?',
      [id]
    );
    return row ? Channel.fromDatabaseRow(row) : null;
  }

  /**
   * Finds all channels
   * @param {Object} filters - Filters
   * @param {boolean} [filters.forwardEnabled] - Filter by forward enabled
   * @param {string} [filters.adminSessionPhone] - Filter by admin session
   * @returns {Promise<Array<Channel>>} Channels
   */
  async findAll(filters = {}) {
    let query = 'SELECT * FROM channels';
    const params = [];
    const conditions = [];

    if (filters.forwardEnabled !== undefined) {
      conditions.push('forward_enabled = ?');
      params.push(filters.forwardEnabled ? 1 : 0);
    }

    if (filters.adminSessionPhone) {
      conditions.push('admin_session_phone = ?');
      params.push(filters.adminSessionPhone);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY title ASC';

    const rows = await this.#dataSource.getMany(query, params);
    return rows.map(row => Channel.fromDatabaseRow(row));
  }

  /**
   * Creates new channel
   * @param {Channel} channel - Channel entity
   * @returns {Promise<Channel>} Created channel
   */
  async create(channel) {
    const data = channel.toObject();
    
    await this.#dataSource.execute(
      `INSERT OR REPLACE INTO channels 
       (channel_id, title, forward_enabled, admin_session_phone, member_count, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.channel_id,
        data.title,
        data.forward_enabled,
        data.admin_session_phone,
        data.member_count,
        data.created_at,
        data.updated_at
      ]
    );

    return await this.findById(channel.channelId);
  }

  /**
   * Updates channel
   * @param {string} id - Channel ID
   * @param {Object} updates - Updates
   * @returns {Promise<Channel>} Updated channel
   */
  async update(id, updates) {
    const channel = await this.findById(id);
    if (!channel) {
      throw new Error(`Channel not found: ${id}`);
    }

    // Apply updates to entity
    if (updates.title) channel.updateTitle(updates.title);
    if (updates.forwardEnabled !== undefined) {
      updates.forwardEnabled ? channel.enableForwarding() : channel.disableForwarding();
    }
    if (updates.adminSessionPhone) channel.linkToSession(updates.adminSessionPhone);
    if (updates.memberCount !== undefined) channel.updateMemberCount(updates.memberCount);

    const data = channel.toObject();

    await this.#dataSource.execute(
      `UPDATE channels 
       SET title = ?, forward_enabled = ?, admin_session_phone = ?, 
           member_count = ?, updated_at = ? 
       WHERE channel_id = ?`,
      [
        data.title,
        data.forward_enabled,
        data.admin_session_phone,
        data.member_count,
        data.updated_at,
        id
      ]
    );

    return await this.findById(id);
  }

  /**
   * Deletes channel
   * @param {string} id - Channel ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const result = await this.#dataSource.execute(
      'DELETE FROM channels WHERE channel_id = ?',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Checks if channel exists
   * @param {string} id - Channel ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const channel = await this.findById(id);
    return channel !== null;
  }

  /**
   * Counts channels
   * @param {Object} filters - Filters
   * @returns {Promise<number>} Count
   */
  async count(filters = {}) {
    let query = 'SELECT COUNT(*) as count FROM channels';
    const params = [];
    const conditions = [];

    if (filters.forwardEnabled !== undefined) {
      conditions.push('forward_enabled = ?');
      params.push(filters.forwardEnabled ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.#dataSource.getOne(query, params);
    return result?.count || 0;
  }

  /**
   * Finds channels by admin session
   * @param {string} phone - Admin session phone
   * @returns {Promise<Array<Channel>>} Channels
   */
  async findByAdminSession(phone) {
    const rows = await this.#dataSource.getMany(
      'SELECT * FROM channels WHERE admin_session_phone = ? ORDER BY created_at DESC',
      [phone]
    );
    return rows.map(row => Channel.fromDatabaseRow(row));
  }

  /**
   * Finds enabled channels
   * @returns {Promise<Array<Channel>>} Enabled channels
   */
  async findEnabled() {
    return await this.findAll({ forwardEnabled: true });
  }

  /**
   * Toggles channel forwarding
   * @param {string} channelId - Channel ID
   * @returns {Promise<Channel>} Updated channel
   */
  async toggleForwarding(channelId) {
    const channel = await this.findById(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    channel.toggleForwarding();
    const data = channel.toObject();

    await this.#dataSource.execute(
      'UPDATE channels SET forward_enabled = ?, updated_at = ? WHERE channel_id = ?',
      [data.forward_enabled, data.updated_at, channelId]
    );

    return await this.findById(channelId);
  }

  /**
   * Links channel to session
   * @param {string} channelId - Channel ID
   * @param {string} phone - Session phone
   * @returns {Promise<Channel>} Updated channel
   */
  async linkToSession(channelId, phone) {
    return await this.update(channelId, { adminSessionPhone: phone });
  }

  /**
   * Gets channel statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const [total, enabled, disabled] = await Promise.all([
      this.count(),
      this.count({ forwardEnabled: true }),
      this.count({ forwardEnabled: false })
    ]);

    return {
      total,
      enabled,
      disabled
    };
  }
}

export default ChannelRepository;
