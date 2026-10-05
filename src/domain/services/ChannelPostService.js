/**
 * @fileoverview Channel Post Service
 * Stores channel posts for reports (save on new, update on edit, mark on delete)
 * @module domain/services/ChannelPostService
 */

import { log } from '../../shared/logger.js';

/**
 * Detects media type of Telegram message
 * @param {Object} message - GramJS message
 * @returns {string|null} Media type or null for text-only posts
 */
export function detectMediaType(message) {
  const media = message?.media;
  if (!media) return null;

  switch (media.className) {
    case 'MessageMediaPhoto':
      return 'photo';
    case 'MessageMediaDocument': {
      const mimeType = media.document?.mimeType || '';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
      return 'document';
    }
    case 'MessageMediaWebPage':
      return 'link';
    case 'MessageMediaPoll':
      return 'poll';
    default:
      return media.className || 'other';
  }
}

/**
 * Channel Post Service
 */
class ChannelPostService {
  #channelPostRepository;
  #logger;

  /**
   * @param {Object} dependencies
   * @param {ChannelPostRepository} dependencies.channelPostRepository
   * @param {Object} [dependencies.logger]
   */
  constructor({ channelPostRepository, logger = log }) {
    this.#channelPostRepository = channelPostRepository;
    this.#logger = logger;
  }

  /**
   * Saves new channel post
   * @param {string} channelId - Telegram channel ID (-100...)
   * @param {Object} message - GramJS message
   * @returns {Promise<void>}
   */
  async savePost(channelId, message) {
    // Service messages (pin, photo/title change, ...) are not posts
    if (message?.className === 'MessageService') {
      return;
    }

    await this.#channelPostRepository.savePost({
      channelId,
      messageId: message.id,
      groupedId: message.groupedId?.toString() || null,
      text: message.message || null,
      mediaType: detectMediaType(message),
      postedAt: message.date || Math.floor(Date.now() / 1000),
    });

    this.#logger.debug('Channel post saved', { channelId, messageId: message.id });
  }

  /**
   * Updates post text after edit
   * @param {string} channelId - Telegram channel ID
   * @param {Object} message - Edited GramJS message
   * @returns {Promise<boolean>} True if text changed
   */
  async updatePost(channelId, message) {
    const editedAt = message.editDate || Math.floor(Date.now() / 1000);
    return await this.#channelPostRepository.updateText(
      channelId,
      message.id,
      message.message || null,
      editedAt
    );
  }

  /**
   * Marks posts as deleted
   * @param {string} channelId - Telegram channel ID
   * @param {number[]} messageIds - Deleted message IDs
   * @returns {Promise<void>}
   */
  async markDeleted(channelId, messageIds) {
    await this.#channelPostRepository.markDeleted(
      channelId,
      messageIds,
      Math.floor(Date.now() / 1000)
    );
  }
}

export default ChannelPostService;
