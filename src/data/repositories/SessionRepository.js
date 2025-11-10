/**
 * @fileoverview Session Repository Implementation
 * Handles session data persistence using TypeORM
 * @module data/repositories/SessionRepository
 */

import ISessionRepository from '../../core/interfaces/ISessionRepository.js';
import Session from '../../core/entities/Session.entity.js';
import RepositoryFactory from './RepositoryFactory.js';

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
    if (!session) throw new Error(`Session not found: ${phone}`);
    
    await this.#ormRepository.setFloodWait(phone, seconds);
    return await this.findById(session.id);
  }

  async updateActivity(phone) {
    const session = await this.findByPhone(phone);
    if (!session) throw new Error(`Session not found: ${phone}`);
    
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

export default SessionRepository;