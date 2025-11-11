/**
 * @fileoverview Channel Repository Implementation
 * Handles channel data persistence using TypeORM
 * @module data/repositories/ChannelRepository
 */

import IChannelRepository from '../../core/interfaces/IChannelRepository.js';
import Channel from '../../core/entities/Channel.entity.js';
import RepositoryFactory from './RepositoryFactory.js';

class ChannelRepository extends IChannelRepository {
  #ormRepository;

  constructor() {
    super();
    this.#ormRepository = RepositoryFactory.getChannelRepository();
  }

  #toDomainEntity(ormEntity) {
    if (!ormEntity) return null;
    
    return Channel.fromDatabaseRow({
      channel_id: ormEntity.channelId,
      title: ormEntity.title,
      username: ormEntity.username,
      member_count: ormEntity.memberCount,
      forward_enabled: ormEntity.forwardEnabled,
      admin_session_phone: ormEntity.adminSessionPhone,
      created_at: ormEntity.createdAt,
      updated_at: ormEntity.updatedAt
    });
  }

  async findById(id) {
    const entity = await this.#ormRepository.findById(id);
    return this.#toDomainEntity(entity);
  }

  async findByChannelId(channelId) {
    const entity = await this.#ormRepository.findByChannelId(channelId);
    return this.#toDomainEntity(entity);
  }

  async findAll(filters = {}) {
    let entities;
    
    if (filters.enabled) {
      entities = await this.#ormRepository.findByForwardingEnabled(true);
    } else {
      entities = await this.#ormRepository.findAll();
    }

    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async create(channel) {
    const data = channel.toObject();
    
    const created = await this.#ormRepository.create({
      channelId: data.channel_id,
      title: data.title,
      username: data.username,
      memberCount: data.member_count,
      forwardEnabled: Boolean(data.forward_enabled),
      adminSessionPhone: data.admin_session_phone
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.title) ormUpdates.title = updates.title;
    if (updates.username !== undefined) ormUpdates.username = updates.username;
    if (updates.member_count !== undefined) ormUpdates.memberCount = updates.member_count;
    if (updates.forward_enabled !== undefined) ormUpdates.forwardEnabled = Boolean(updates.forward_enabled);
    if (updates.admin_session_phone !== undefined) ormUpdates.adminSessionPhone = updates.admin_session_phone;

    const updated = await this.#ormRepository.update(id, ormUpdates);
    return this.#toDomainEntity(updated);
  }

  async delete(id) {
    return await this.#ormRepository.delete(id);
  }

  async exists(id) {
    const channel = await this.findById(id);
    return channel !== null;
  }

  async count(filters = {}) {
    const channels = await this.findAll(filters);
    return channels.length;
  }

  async findEnabled() {
    return await this.findAll({ enabled: true });
  }

  async toggleForwarding(channelId) {
    const channel = await this.findByChannelId(channelId);
    if (!channel) throw new Error(`Channel not found: ${channelId}`);
    
    await this.#ormRepository.toggleForwarding(channelId);
    return await this.findById(channel.id);
  }

  async getStatistics() {
    const all = await this.findAll();
    const enabled = await this.findEnabled();
    const totalMembers = all.reduce((sum, ch) => sum + (ch.memberCount || 0), 0);

    return {
      total: all.length,
      enabled: enabled.length,
      disabled: all.length - enabled.length,
      totalMembers
    };
  }
}

export default ChannelRepository;