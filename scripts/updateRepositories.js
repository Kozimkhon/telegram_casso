#!/usr/bin/env node
/**
 * Script to update all repositories to use TypeORM
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoDir = path.join(__dirname, '..', 'src', 'data', 'repositories');

// Templates for each repository type
const templates = {
  SessionRepository: `/**
 * @fileoverview Session Repository Implementation
 * Handles session data persistence using TypeORM
 * @module data/repositories/SessionRepository
 */

import ISessionRepository from '../../core/interfaces/ISessionRepository.js';
import Session from '../../core/entities/Session.entity.js';
import RepositoryFactory from '../../repositories/RepositoryFactory.js';

class SessionRepository extends ISessionRepository {
  #ormRepository;

  constructor() {
    super();
    this.#ormRepository = RepositoryFactory.getSessionRepository();
  }

  #toDomainEntity(ormEntity) {
    if (!ormEntity) return null;
    
    return Session.fromDatabaseRow({
      id: ormEntity.id,
      phone: ormEntity.phone,
      session_string: ormEntity.sessionString,
      is_paused: ormEntity.isPaused,
      status: ormEntity.status,
      flood_wait_until: ormEntity.floodWaitUntil,
      last_activity: ormEntity.lastActivity,
      admin_id: ormEntity.adminId,
      created_at: ormEntity.createdAt,
      updated_at: ormEntity.updatedAt
    });
  }

  async findById(id) {
    const entity = await this.#ormRepository.findById(id);
    return this.#toDomainEntity(entity);
  }

  async findByPhone(phone) {
    const entity = await this.#ormRepository.findByPhone(phone);
    return this.#toDomainEntity(entity);
  }

  async findAll(filters = {}) {
    let entities;
    
    if (filters.active) {
      entities = await this.#ormRepository.findAllActive();
    } else if (filters.status) {
      entities = await this.#ormRepository.findByStatus(filters.status);
    } else {
      entities = await this.#ormRepository.findAll();
    }

    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async create(session) {
    const data = session.toObject();
    
    const created = await this.#ormRepository.create({
      phone: data.phone,
      sessionString: data.session_string,
      isPaused: data.is_paused,
      status: data.status,
      adminId: data.admin_id
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.session_string) ormUpdates.sessionString = updates.session_string;
    if (updates.is_paused !== undefined) ormUpdates.isPaused = updates.is_paused;
    if (updates.status) ormUpdates.status = updates.status;
    if (updates.flood_wait_until) ormUpdates.floodWaitUntil = updates.flood_wait_until;
    if (updates.last_activity) ormUpdates.lastActivity = updates.last_activity;

    const updated = await this.#ormRepository.update(id, ormUpdates);
    return this.#toDomainEntity(updated);
  }

  async delete(id) {
    return await this.#ormRepository.delete(id);
  }

  async exists(id) {
    const session = await this.findById(id);
    return session !== null;
  }

  async count(filters = {}) {
    const sessions = await this.findAll(filters);
    return sessions.length;
  }

  async findByStatus(status) {
    return await this.findAll({ status });
  }

  async findActive() {
    return await this.findAll({ active: true });
  }

  async findReadyToResume() {
    const entities = await this.#ormRepository.findReadyToResume();
    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async pause(id) {
    await this.#ormRepository.pause(id);
    return await this.findById(id);
  }

  async resume(id) {
    await this.#ormRepository.resume(id);
    return await this.findById(id);
  }

  async setFloodWait(phone, seconds) {
    const session = await this.findByPhone(phone);
    if (!session) throw new Error(\`Session not found: \${phone}\`);
    
    await this.#ormRepository.setFloodWait(phone, seconds);
    return await this.findById(session.id);
  }

  async updateActivity(phone) {
    const session = await this.findByPhone(phone);
    if (!session) throw new Error(\`Session not found: \${phone}\`);
    
    await this.#ormRepository.updateActivity(phone);
    return await this.findById(session.id);
  }

  async getStatistics() {
    const all = await this.findAll();
    const active = await this.findActive();
    const paused = all.filter(s => s.isPaused);
    const floodWait = all.filter(s => s.isInFloodWait());

    return {
      total: all.length,
      active: active.length,
      paused: paused.length,
      floodWait: floodWait.length
    };
  }
}

export default SessionRepository;`,

  ChannelRepository: `/**
 * @fileoverview Channel Repository Implementation
 * Handles channel data persistence using TypeORM
 * @module data/repositories/ChannelRepository
 */

import IChannelRepository from '../../core/interfaces/IChannelRepository.js';
import Channel from '../../core/entities/Channel.entity.js';
import RepositoryFactory from '../../repositories/RepositoryFactory.js';

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
      forwardEnabled: data.forward_enabled,
      adminSessionPhone: data.admin_session_phone
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.title) ormUpdates.title = updates.title;
    if (updates.username) ormUpdates.username = updates.username;
    if (updates.member_count !== undefined) ormUpdates.memberCount = updates.member_count;
    if (updates.forward_enabled !== undefined) ormUpdates.forwardEnabled = updates.forward_enabled;
    if (updates.admin_session_phone) ormUpdates.adminSessionPhone = updates.admin_session_phone;

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
    if (!channel) throw new Error(\`Channel not found: \${channelId}\`);
    
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

export default ChannelRepository;`,

  UserRepository: `/**
 * @fileoverview User Repository Implementation
 * Handles user data persistence using TypeORM
 * @module data/repositories/UserRepository
 */

import IUserRepository from '../../core/interfaces/IUserRepository.js';
import User from '../../core/entities/User.entity.js';
import RepositoryFactory from '../../repositories/RepositoryFactory.js';

class UserRepository extends IUserRepository {
  #ormRepository;

  constructor() {
    super();
    this.#ormRepository = RepositoryFactory.getUserRepository();
  }

  #toDomainEntity(ormEntity) {
    if (!ormEntity) return null;
    
    return User.fromDatabaseRow({
      id: ormEntity.id,
      user_id: ormEntity.userId,
      first_name: ormEntity.firstName,
      last_name: ormEntity.lastName,
      username: ormEntity.username,
      phone: ormEntity.phone,
      is_bot: ormEntity.isBot,
      is_premium: ormEntity.isPremium,
      created_at: ormEntity.createdAt,
      updated_at: ormEntity.updatedAt
    });
  }

  async findById(id) {
    const entity = await this.#ormRepository.findById(id);
    return this.#toDomainEntity(entity);
  }

  async findByUserId(userId) {
    const entity = await this.#ormRepository.findByUserId(userId);
    return this.#toDomainEntity(entity);
  }

  async findAll(filters = {}) {
    let entities;
    
    if (filters.active) {
      entities = await this.#ormRepository.findAllActive();
    } else {
      entities = await this.#ormRepository.findAll();
    }

    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async create(user) {
    const data = user.toObject();
    
    const created = await this.#ormRepository.create({
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username,
      phone: data.phone,
      isBot: data.is_bot,
      isPremium: data.is_premium
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.first_name) ormUpdates.firstName = updates.first_name;
    if (updates.last_name) ormUpdates.lastName = updates.last_name;
    if (updates.username) ormUpdates.username = updates.username;
    if (updates.phone) ormUpdates.phone = updates.phone;
    if (updates.is_premium !== undefined) ormUpdates.isPremium = updates.is_premium;

    const updated = await this.#ormRepository.update(id, ormUpdates);
    return this.#toDomainEntity(updated);
  }

  async delete(id) {
    return await this.#ormRepository.delete(id);
  }

  async exists(id) {
    const user = await this.findById(id);
    return user !== null;
  }

  async count(filters = {}) {
    const users = await this.findAll(filters);
    return users.length;
  }

  async bulkCreate(usersData) {
    const results = { added: 0, updated: 0, errors: [] };

    for (const userData of usersData) {
      try {
        const existing = await this.findByUserId(userData.userId);
        
        if (existing) {
          await this.update(existing.id, {
            first_name: userData.firstName,
            last_name: userData.lastName,
            username: userData.username,
            phone: userData.phone
          });
          results.updated++;
        } else {
          await this.#ormRepository.create(userData);
          results.added++;
        }
      } catch (error) {
        results.errors.push({ userId: userData.userId, error: error.message });
      }
    }

    return results;
  }

  async search(searchTerm) {
    const entities = await this.#ormRepository.search(searchTerm);
    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async getStatistics() {
    const all = await this.findAll();
    const withUsername = all.filter(u => u.username);
    const premium = all.filter(u => u.isPremium);
    const bots = all.filter(u => u.isBot);

    return {
      total: all.length,
      withUsername: withUsername.length,
      premium: premium.length,
      bots: bots.length
    };
  }
}

export default UserRepository;`,

  MessageRepository: `/**
 * @fileoverview Message Repository Implementation
 * Handles message data persistence using TypeORM
 * @module data/repositories/MessageRepository
 */

import IMessageRepository from '../../core/interfaces/IMessageRepository.js';
import Message from '../../core/entities/Message.entity.js';
import RepositoryFactory from '../../repositories/RepositoryFactory.js';

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
      channel_id: ormEntity.channelId,
      user_id: ormEntity.userId,
      text: ormEntity.text,
      status: ormEntity.status,
      error_message: ormEntity.errorMessage,
      retry_count: ormEntity.retryCount,
      sent_at: ormEntity.sentAt,
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
      channelId: data.channel_id,
      userId: data.user_id,
      text: data.text,
      status: data.status
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.status) ormUpdates.status = updates.status;
    if (updates.error_message) ormUpdates.errorMessage = updates.error_message;
    if (updates.retry_count !== undefined) ormUpdates.retryCount = updates.retry_count;
    if (updates.sent_at) ormUpdates.sentAt = updates.sent_at;

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
}

export default MessageRepository;`
};

async function updateRepository(filename) {
  const repoName = filename.replace('.js', '');
  
  if (!templates[repoName]) {
    console.log(`⏭️  Skipping ${repoName} (no template)`);
    return;
  }

  const filePath = path.join(repoDir, filename);
  
  try {
    await fs.writeFile(filePath, templates[repoName], 'utf8');
    console.log(`✅ Updated ${repoName}`);
  } catch (error) {
    console.error(`❌ Failed to update ${repoName}:`, error.message);
  }
}

async function main() {
  console.log('🔄 Updating repositories to use TypeORM...\n');

  const files = await fs.readdir(repoDir);
  const repoFiles = files.filter(f => f.endsWith('Repository.js') && f !== 'AdminRepository.js');

  for (const file of repoFiles) {
    await updateRepository(file);
  }

  console.log('\n✅ All repositories updated!');
}

main().catch(console.error);
