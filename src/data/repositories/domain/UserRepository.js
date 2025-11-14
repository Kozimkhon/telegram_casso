/**
 * @fileoverview User Repository Implementation
 * Handles user data persistence using TypeORM
 * @module data/repositories/UserRepository
 */

import { IUserRepository } from '../../../core/interfaces/index.js';
import { User } from '../../../core/entities/index.js';
import RepositoryFactory from './RepositoryFactory.js';

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
      is_active: ormEntity.isActive,
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
      isPremium: data.is_premium,
      isActive: data.is_active
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.first_name) ormUpdates.firstName = updates.first_name;
    if (updates.last_name !== undefined) ormUpdates.lastName = updates.last_name;
    if (updates.username !== undefined) ormUpdates.username = updates.username;
    if (updates.phone !== undefined) ormUpdates.phone = updates.phone;
    if (updates.is_bot !== undefined) ormUpdates.isBot = updates.is_bot;
    if (updates.is_premium !== undefined) ormUpdates.isPremium = updates.is_premium;
    if (updates.is_active !== undefined) ormUpdates.isActive = updates.is_active;

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
    const results = [];

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
          results.push({
            success: true,
            updated: true,
            data: {
              userId: userData.userId,
              firstName: userData.firstName,
              lastName: userData.lastName,
              username: userData.username
            }
          });
        } else {
          await this.#ormRepository.create(userData);
          results.push({
            success: true,
            updated: false,
            data: {
              userId: userData.userId,
              firstName: userData.firstName,
              lastName: userData.lastName,
              username: userData.username
            }
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          data: { userId: userData.userId }
        });
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
    // REMOVED: premium and bots filters (not part of domain)

    return {
      total: all.length,
      withUsername: withUsername.length
    };
  }

  async addToChannel(channelId, userId) {
    return await this.#ormRepository.addToChannel(channelId, userId);
  }

  async bulkAddToChannel(channelId, userIds) {
    return await this.#ormRepository.bulkAddToChannel(channelId, userIds);
  }

  async clearChannelMembers(channelId) {
    return await this.#ormRepository.clearChannelMembers(channelId);
  }

  async findByChannel(channelId) {
    const entities = await this.#ormRepository.findByChannel(channelId);
    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  async removeFromChannel(channelId, userId) {
    return await this.#ormRepository.removeFromChannel(channelId, userId);
  }
}

export default UserRepository;