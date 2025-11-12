/**
 * @fileoverview Message Repository Implementation
 * Handles message data persistence using TypeORM
 * @module data/repositories/MessageRepository
 */

import IMessageRepository from '../../core/interfaces/IMessageRepository.js';
import Message from '../../core/entities/Message.entity.js';
import RepositoryFactory from './RepositoryFactory.js';

class MessageRepository extends IMessageRepository {
  #ormRepository;

  constructor() {
    super();
    this.#ormRepository = RepositoryFactory.getMessageRepository();
  }

  #toDomainEntity(ormEntity) {
    if (!ormEntity) return null;
    
    return Message.fromDatabaseRow({
      id: ormEntity.id,
      message_id: ormEntity.messageId,
      forwarded_message_id: ormEntity.forwardedMessageId,
      status: ormEntity.status,
      error_message: ormEntity.errorMessage,
      retry_count: ormEntity.retryCount,
      grouped_id: ormEntity.groupedId,
      is_grouped: ormEntity.isGrouped,
      channel_id: ormEntity.channelId,
      user_id: ormEntity.userId,
      created_at: ormEntity.createdAt,
      updated_at: ormEntity.updatedAt
    });
  }

  async findById(id) {
    const entity = await this.#ormRepository.findById(id);
    return this.#toDomainEntity(entity);
  }

  async findAll(filters = {}) {
    let entities = await this.#ormRepository.findAll();

    if (filters.status) {
      entities = entities.filter(e => e.status === filters.status);
    }
    if (filters.channelId) {
      entities = entities.filter(e => e.channelId === filters.channelId);
    }
    if (filters.limit) {
      entities = entities.slice(0, filters.limit);
    }

    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async findByChannel(channelId) {
    const entities = await this.#ormRepository.findByChannel(channelId);
    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async create(message) {
    const data = message.toObject();
    
    const created = await this.#ormRepository.create({
      messageId: data.message_id,
      forwardedMessageId: data.forwarded_message_id,
      status: data.status,
      errorMessage: data.error_message,
      retryCount: data.retry_count,
      groupedId: data.grouped_id,
      isGrouped: data.is_grouped,
      channelId: data.channel_id,
      userId: data.user_id
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.forwarded_message_id !== undefined) ormUpdates.forwardedMessageId = updates.forwarded_message_id;
    if (updates.status) ormUpdates.status = updates.status;
    if (updates.error_message !== undefined) ormUpdates.errorMessage = updates.error_message;
    if (updates.retry_count !== undefined) ormUpdates.retryCount = updates.retry_count;

    const updated = await this.#ormRepository.update(id, ormUpdates);
    return this.#toDomainEntity(updated);
  }

  async delete(id) {
    return await this.#ormRepository.delete(id);
  }

  async exists(id) {
    const message = await this.findById(id);
    return message !== null;
  }

  async count(filters = {}) {
    const messages = await this.findAll(filters);
    return messages.length;
  }

  async markAsSent(id) {
    await this.#ormRepository.markAsSent(id);
    return await this.findById(id);
  }

  async markAsFailed(id, errorMessage) {
    await this.#ormRepository.markAsFailed(id, errorMessage);
    return await this.findById(id);
  }

  async getForwardingStatistics(filters = {}) {
    const messages = await this.findAll(filters);
    
    const sent = messages.filter(m => m.status === 'sent');
    const failed = messages.filter(m => m.status === 'failed');
    const pending = messages.filter(m => m.status === 'pending');

    return {
      total: messages.length,
      sent: sent.length,
      failed: failed.length,
      pending: pending.length,
      successRate: messages.length > 0 
        ? ((sent.length / messages.length) * 100).toFixed(2) + '%' 
        : '0%'
    };
  }

  /**
   * Finds messages by grouped ID
   * @param {string} groupedId - Grouped message ID
   * @param {string} userId - User ID
   * @returns {Promise<Message[]>} Domain message entities
   */
  async findByGroupedId(groupedId, userId) {
    const entities = await this.#ormRepository.findByGroupedId(groupedId, userId);
    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  /**
   * Finds old grouped messages for deletion
   * @param {number} daysOld - Days old threshold
   * @returns {Promise<Map>} Map of key -> domain message entities
   */
  async findOldGroupedMessages(daysOld = 7) {
    const groupedMessages = await this.#ormRepository.findOldGroupedMessages(daysOld);
    
    // Convert ORM entities to domain entities
    const domainGroupedMessages = new Map();
    for (const [key, ormMessages] of groupedMessages.entries()) {
      const domainMessages = ormMessages.map(e => this.#toDomainEntity(e)).filter(Boolean);
      domainGroupedMessages.set(key, domainMessages);
    }
    
    return domainGroupedMessages;
  }

  /**
   * Finds all forwarded message copies for a channel message
   * Used to delete forwarded copies when original is deleted
   * @param {string} channelId - Channel ID
   * @param {string} messageId - Original message ID
   * @returns {Promise<Message[]>} Forwarded message copies
   */
  async findByForwardedMessageId(channelId, messageId) {
    // Find messages from this channel with this message ID
    const entities = await this.#ormRepository.findByChannel(channelId);
    const filtered = entities.filter(e => e.messageId == messageId);
    return filtered.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  /**
   * Marks message as deleted in database
   * Updates status to 'deleted' and clears forwarded message ID
   * @param {string} userId - User ID
   * @param {string} forwardedMessageId - Forwarded message ID to delete
   * @returns {Promise<void>}
   */
  async markAsDeleted(userId, forwardedMessageId) {
    await this.#ormRepository.markAsDeleted(userId, forwardedMessageId);
  }
}

export default MessageRepository;