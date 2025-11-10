/**
 * @fileoverview Channel Repository
 * Repository for Channel entity operations
 * @module repositories/typeorm/ChannelRepository
 */

import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { ChannelEntity } from '../../../core/entities/db/index.js';

/**
 * Channel Repository
 * Handles database operations for Channel entity
 * 
 * @class ChannelRepository
 * @extends BaseRepository
 */
class ChannelRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(ChannelEntity);
    super(repository, 'Channel');
  }

  /**
   * Finds channel by channel ID
   * @param {string} channelId - Telegram channel ID
   * @returns {Promise<Object|null>} Channel or null
   */
  async findByChannelId(channelId) {
    return await this.findOne({ channelId });
  }

  /**
   * Finds channels by session
   * @param {string} sessionPhone - Session phone
   * @returns {Promise<Object[]>} Session's channels
   */
  async findBySession(sessionPhone) {
    return await this.findMany({ sessionPhone });
  }

  /**
   * Finds channels by admin
   * @param {string} adminUserId - Admin user ID
   * @returns {Promise<Object[]>} Admin's channels
   */
  async findByAdmin(adminUserId) {
    return await this.findMany({ adminUserId });
  }

  /**
   * Finds all channels with forwarding enabled
   * @returns {Promise<Object[]>} Channels with forwarding enabled
   */
  async findWithForwardingEnabled() {
    return await this.findMany({ forwardEnabled: true });
  }

  /**
   * Finds channel with users (members)
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Channel with users
   */
  async findWithUsers(channelId) {
    return await this.findOne(
      { channelId },
      {
        relations: ['users'],
      }
    );
  }

  /**
   * Finds channel with session
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Channel with session
   */
  async findWithSession(channelId) {
    return await this.findOne(
      { channelId },
      {
        relations: ['session'],
      }
    );
  }

  /**
   * Finds channel with admin
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Channel with admin
   */
  async findWithAdmin(channelId) {
    return await this.findOne(
      { channelId },
      {
        relations: ['admin'],
      }
    );
  }

  /**
   * Finds channel with all relationships
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Channel with all relations
   */
  async findWithRelations(channelId) {
    return await this.findOne(
      { channelId },
      {
        relations: ['admin', 'session', 'users', 'messages', 'metrics'],
      }
    );
  }

  /**
   * Toggles forwarding for channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Updated channel
   */
  async toggleForwarding(channelId) {
    const channel = await this.findByChannelId(channelId);
    if (!channel) return null;

    return await this.repository.save({
      ...channel,
      forwardEnabled: !channel.forwardEnabled,
      updatedAt: new Date(),
    });
  }

  /**
   * Updates channel throttle settings
   * @param {string} channelId - Channel ID
   * @param {Object} throttleSettings - Throttle settings
   * @returns {Promise<Object|null>} Updated channel
   */
  async updateThrottleSettings(channelId, throttleSettings) {
    const channel = await this.findByChannelId(channelId);
    if (!channel) return null;

    return await this.repository.save({
      ...channel,
      ...throttleSettings,
      updatedAt: new Date(),
    });
  }

  /**
   * Adds user to channel
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async addUser(channelId, userId) {
    await this.repository
      .createQueryBuilder()
      .relation(ChannelEntity, 'users')
      .of(channelId)
      .add(userId);
  }

  /**
   * Removes user from channel
   * @param {string} channelId - Channel ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async removeUser(channelId, userId) {
    await this.repository
      .createQueryBuilder()
      .relation(ChannelEntity, 'users')
      .of(channelId)
      .remove(userId);
  }

  /**
   * Gets channel member count
   * @param {string} channelId - Channel ID
   * @returns {Promise<number>} Member count
   */
  async getMemberCount(channelId) {
    const channel = await this.findWithUsers(channelId);
    return channel?.users?.length || 0;
  }
}

export default ChannelRepository;
