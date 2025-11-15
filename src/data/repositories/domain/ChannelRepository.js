/**
 * @fileoverview Channel Repository Implementation
 * Handles channel data persistence using TypeORM
 * @module data/repositories/ChannelRepository
 */

import { Channel } from '../../../core/entities/index.js';
import { IChannelRepository } from '../../../core/interfaces/index.js';
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
      id: ormEntity.id,
      channel_id: ormEntity.channelId,
      access_hash: ormEntity.accessHash,
      title: ormEntity.title,
      username: ormEntity.username,
      member_count: ormEntity.memberCount,
      forward_enabled: ormEntity.forwardEnabled,
      throttle_delay_ms: ormEntity.throttleDelayMs,
      throttle_per_member_ms: ormEntity.throttlePerMemberMs,
      min_delay_ms: ormEntity.minDelayMs,
      max_delay_ms: ormEntity.maxDelayMs,
      schedule_enabled: ormEntity.scheduleEnabled,
      schedule_config: ormEntity.scheduleConfig,
      admin_id : ormEntity.adminId,
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
      entities = await this.#ormRepository.findWithForwardingEnabled();
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
      throttleDelayMs: data.throttle_delay_ms,
      throttlePerMemberMs: data.throttle_per_member_ms,
      minDelayMs: data.min_delay_ms,
      maxDelayMs: data.max_delay_ms,
      scheduleEnabled: Boolean(data.schedule_enabled),
      scheduleConfig: data.schedule_config,
      adminId: data.admin_id,
      accessHash: data.access_hash
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.title) ormUpdates.title = updates.title;
    if (updates.username !== undefined) ormUpdates.username = updates.username;
    if (updates.member_count !== undefined) ormUpdates.memberCount = updates.member_count;
    if (updates.forward_enabled !== undefined) ormUpdates.forwardEnabled = Boolean(updates.forward_enabled);
    if (updates.throttle_delay_ms !== undefined) ormUpdates.throttleDelayMs = updates.throttle_delay_ms;
    if (updates.throttle_per_member_ms !== undefined) ormUpdates.throttlePerMemberMs = updates.throttle_per_member_ms;
    if (updates.min_delay_ms !== undefined) ormUpdates.minDelayMs = updates.min_delay_ms;
    if (updates.max_delay_ms !== undefined) ormUpdates.maxDelayMs = updates.max_delay_ms;
    if (updates.schedule_enabled !== undefined) ormUpdates.scheduleEnabled = Boolean(updates.schedule_enabled);
    if (updates.schedule_config !== undefined) ormUpdates.scheduleConfig = updates.schedule_config;
    if (updates.admin_id !== undefined) ormUpdates.adminId = updates.admin_id;
    if (updates.access_hash !== undefined) ormUpdates.accessHash = updates.access_hash;

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
  async findByAdminSession(adminId) {
    const entities = await this.#ormRepository.findByAdmin(adminId);
    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  /**
   * Finds all channels by admin ID
   * @param {string} adminUserId - Admin user ID
   * @returns {Promise<Array>} Channels
   */
  async findByAdminId(adminUserId) {
    return await this.findByAdminSession(adminUserId);
  }
}

export default ChannelRepository;