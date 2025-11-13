/**
 * @fileoverview Session Repository Implementation
 * Handles session data persistence using TypeORM
 * @module data/repositories/SessionRepository
 */

import ISessionRepository from '../../core/interfaces/ISessionRepository.js';
import Session from '../../../core/entities/domain/Session.entity.js';
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
      admin_id: ormEntity.adminId,
      session_string: ormEntity.sessionString,
      status: ormEntity.status,
      auto_paused: ormEntity.autoPaused,
      pause_reason: ormEntity.pauseReason,
      flood_wait_until: ormEntity.floodWaitUntil,
      last_error: ormEntity.lastError,
      last_active: ormEntity.lastActive,
      created_at: ormEntity.createdAt,
      updated_at: ormEntity.updatedAt
    });
  }

  async findById(id) {
    const entity = await this.#ormRepository.findById(id);
    return this.#toDomainEntity(entity);
  }

  async findByAdminId(adminId) {
    const entity = await this.#ormRepository.findByAdminId(adminId);
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
      adminId: data.admin_id,
      sessionString: data.session_string,
      status: data.status,
      autoPaused: Boolean(data.auto_paused),
      pauseReason: data.pause_reason
    });

    return this.#toDomainEntity(created);
  }

  async update(id, updates) {
    const ormUpdates = {};
    
    if (updates.admin_id) ormUpdates.adminId = updates.admin_id;
    if (updates.session_string) ormUpdates.sessionString = updates.session_string;
    if (updates.status) ormUpdates.status = updates.status;
    if (updates.auto_paused !== undefined) ormUpdates.autoPaused = Boolean(updates.auto_paused);
    if (updates.pause_reason !== undefined) ormUpdates.pauseReason = updates.pause_reason;
    if (updates.flood_wait_until !== undefined) ormUpdates.floodWaitUntil = updates.flood_wait_until;
    if (updates.last_error !== undefined) ormUpdates.lastError = updates.last_error;
    if (updates.last_active) ormUpdates.lastActive = updates.last_active;

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
    const session = await this.findById(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    
    await this.#ormRepository.pause(session.adminId);
    return await this.findById(id);
  }

  async resume(id) {
    const session = await this.findById(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    
    await this.#ormRepository.resume(session.adminId);
    return await this.findById(id);
  }

  async setFloodWait(adminId, seconds) {
    const session = await this.findByAdminId(adminId);
    if (!session) throw new Error(`Session not found for admin: ${adminId}`);
    
    await this.#ormRepository.setFloodWait(adminId, seconds);
    return await this.findByAdminId(adminId);
  }

  async updateActivity(adminId) {
    const session = await this.findByAdminId(adminId);
    if (!session) throw new Error(`Session not found for admin: ${adminId}`);
    
    await this.#ormRepository.updateActivity(adminId);
    return await this.findByAdminId(adminId);
  }

  async getStatistics() {
    const all = await this.findAll();
    const active = await this.findActive();
    const paused = all.filter(s => s.isPaused());
    const error = all.filter(s => s.hasError());

    return {
      total: all.length,
      active: active.length,
      paused: paused.length,
      error: error.length
    };
  }
}

export default SessionRepository;