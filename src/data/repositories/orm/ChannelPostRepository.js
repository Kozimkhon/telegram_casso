/**
 * @fileoverview ChannelPost ORM Repository
 * TypeORM repository for ChannelPost entity operations
 * @module repositories/orm/ChannelPostRepository
 */

import { Between, In } from 'typeorm';
import BaseRepository from './BaseRepository.js';
import { AppDataSource } from '../../../config/database.js';
import { ChannelPostEntity } from '../../../core/entities/orm/index.js';

/**
 * ChannelPost ORM Repository
 *
 * @class ChannelPostRepository
 * @extends BaseRepository
 */
class ChannelPostRepository extends BaseRepository {
  constructor() {
    const repository = AppDataSource.getRepository(ChannelPostEntity);
    super(repository, 'ChannelPost');
  }

  /**
   * Saves a new post (ignored if the same channel/message already exists)
   * @param {Object} post - Post data
   * @returns {Promise<void>}
   */
  async savePost(post) {
    try {
      await this.repository
        .createQueryBuilder()
        .insert()
        .into('ChannelPost')
        .values(post)
        .orIgnore()
        .execute();
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to save post - ${error.message}`);
    }
  }

  /**
   * Updates post text on edit. edited_at is set only if text actually changed.
   * @param {string} channelId - Telegram channel ID
   * @param {number} messageId - Telegram message ID
   * @param {string|null} text - New text
   * @param {number} editedAt - Unix timestamp
   * @returns {Promise<boolean>} True if text changed
   */
  async updateText(channelId, messageId, text, editedAt) {
    try {
      const post = await this.repository.findOne({ where: { channelId, messageId } });

      if (!post || (post.text || '') === (text || '')) {
        return false;
      }

      await this.repository.update({ id: post.id }, { text, editedAt });
      return true;
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to update post text - ${error.message}`);
    }
  }

  /**
   * Marks posts as deleted
   * @param {string} channelId - Telegram channel ID
   * @param {number[]} messageIds - Telegram message IDs
   * @param {number} deletedAt - Unix timestamp
   * @returns {Promise<void>}
   */
  async markDeleted(channelId, messageIds, deletedAt) {
    try {
      if (!messageIds || messageIds.length === 0) return;

      await this.repository.update(
        { channelId, messageId: In(messageIds) },
        { deletedAt }
      );
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to mark posts deleted - ${error.message}`);
    }
  }

  /**
   * Finds posts of channels in period [from, to)
   * @param {string[]} channelIds - Telegram channel IDs
   * @param {number} from - Unix timestamp (inclusive)
   * @param {number} to - Unix timestamp (exclusive)
   * @returns {Promise<Object[]>} Posts ordered by channel and date
   */
  async findByChannelsAndPeriod(channelIds, from, to) {
    try {
      if (!channelIds || channelIds.length === 0) return [];

      return await this.repository.find({
        where: {
          channelId: In(channelIds),
          postedAt: Between(from, to - 1),
        },
        order: { channelId: 'ASC', postedAt: 'ASC', messageId: 'ASC' },
      });
    } catch (error) {
      throw new Error(`${this.entityName}: Failed to find posts - ${error.message}`);
    }
  }
}

export default ChannelPostRepository;
