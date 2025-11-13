/**
 * @fileoverview Admin Repository Implementation
 * Handles admin user data persistence using TypeORM
 * @module data/repositories/AdminRepository
 */

import { IAdminRepository } from '../../../core/interfaces/index.js';
import { Admin } from '../../../core/entities/index.js';
import { AdminRole } from '../../../shared/constants/index.js';
import RepositoryFactory from './RepositoryFactory.js';

/**
 * Admin Repository
 * Implements admin data access operations using TypeORM
 * 
 * @class AdminRepository
 * @implements {IAdminRepository}
 */
class AdminRepository extends IAdminRepository {
  /**
   * TypeORM repository
   * @private
   */
  #ormRepository;

  /**
   * Creates admin repository
   */
  constructor() {
    super();
    this.#ormRepository = RepositoryFactory.getAdminRepository();
  }

  /**
   * Converts TypeORM entity to domain entity
   * @param {Object} ormEntity - TypeORM entity
   * @returns {Admin} Domain entity
   * @private
   */
  #toDomainEntity(ormEntity) {
    if (!ormEntity) return null;
    
    return Admin.fromDatabaseRow({
      id: ormEntity.id,
      user_id: ormEntity.userId,
      first_name: ormEntity.firstName,
      last_name: ormEntity.lastName,
      username: ormEntity.username,
      phone: ormEntity.phone,
      role: ormEntity.role,
      is_active: ormEntity.isActive,
      created_at: ormEntity.createdAt,
      updated_at: ormEntity.updatedAt
    });
  }

  /**
   * Finds admin by ID
   * @param {string} id - Admin ID
   * @returns {Promise<Admin|null>} Admin or null
   */
  async findById(id) {
    const entity = await this.#ormRepository.findById(id);
    return this.#toDomainEntity(entity);
  }

  /**
   * Finds all admins
   * @param {Object} filters - Filters
   * @returns {Promise<Array<Admin>>} Admins
   */
  async findAll(filters = {}) {
    let entities;
    
    if (filters.active === true) {
      entities = await this.#ormRepository.findAllActive();
    } else if (filters.role) {
      entities = await this.#ormRepository.findByRole(filters.role);
    } else {
      entities = await this.#ormRepository.findAll();
    }

    return entities.map(e => this.#toDomainEntity(e)).filter(Boolean);
  }

  /**
   * Creates new admin
   * @param {Admin} admin - Admin entity
   * @returns {Promise<Admin>} Created admin
   */
  async create(admin) {
    const data = Admin.toDatabaseRow(admin);
    
    // Convert snake_case to camelCase for TypeORM
    const ormData = {
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      username: data.username,
      phone: data.phone,
      role: data.role,
      isActive: Boolean(data.is_active)
    };
    
    const created = await this.#ormRepository.create(ormData);

    return this.#toDomainEntity(created);
  }

  /**
   * Updates admin
   * @param {string} id - Admin ID
   * @param {Object} updates - Updates
   * @returns {Promise<Admin>} Updated admin
   */
  async update(id, updates) {
    const admin = await this.findById(id);
    if (!admin) {
      throw new Error(`Admin not found: ${id}`);
    }

    // Apply updates
    if (updates.role) {
      admin.changeRole(updates.role);
    }
    if (updates.is_active !== undefined) {
      updates.is_active ? admin.activate() : admin.deactivate();
    }

    const data = admin.toObject();
    
    const updated = await this.#ormRepository.update(id, {
      role: data.role,
      isActive: data.is_active
    });

    return this.#toDomainEntity(updated);
  }
/**
   * Updates admin with userId
   * @param {string} userId - User ID
   * @param {Object} updates - Updates
   * @returns {Promise<Admin>} Updated admin
   */
  async updateWithUserId(userId, updates) {
    const admin = await this.findByUserId(userId);
    if (!admin) {
      throw new Error(`Admin not found: ${userId}`);
    }

    // Apply updates
    if (updates.role) {
      admin.changeRole(updates.role);
    }
    if (updates.is_active !== undefined) {
      updates.is_active ? admin.activate() : admin.deactivate();
    }

    const data = admin.toObject();
    
    const updated = await this.#ormRepository.update(admin.id, {
      role: data.role,
      isActive: data.is_active
    });

    return this.#toDomainEntity(updated);
  }
  /**
   * Deletes admin
   * @param {string} id - Admin ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    return await this.#ormRepository.delete(id);
  }

  /**
   * Checks if admin exists
   * @param {string} id - Admin ID
   * @returns {Promise<boolean>} True if exists
   */
  async exists(id) {
    const admin = await this.findById(id);
    return admin !== null;
  }

  /**
   * Counts admins
   * @param {Object} filters - Filters
   * @returns {Promise<number>} Count
   */
  async count(filters = {}) {
    const admins = await this.findAll(filters);
    return admins.length;
  }

  /**
   * Finds admin by Telegram user ID
   * @param {string} telegramUserId - Telegram user ID
   * @returns {Promise<Admin|null>} Admin or null
   */
  async findByUserId(telegramUserId) {
    const entity = await this.#ormRepository.findByUserId(telegramUserId);
    return this.#toDomainEntity(entity);
  }

  /**
   * Finds active admins
   * @returns {Promise<Array<Admin>>} Active admins
   */
  async findActive() {
    return await this.findAll({ active: true });
  }

  /**
   * Finds admins by role
   * @param {string} role - Admin role
   * @returns {Promise<Array<Admin>>} Admins
   */
  async findByRole(role) {
    return await this.findAll({ role });
  }

  /**
   * Checks if user is admin
   * @param {string} telegramUserId - Telegram user ID
   * @returns {Promise<boolean>} True if admin
   */
  async isAdmin(telegramUserId) {
    const admin = await this.findByUserId(telegramUserId);
    return admin !== null && admin.isActive;
  }

  /**
   * Checks if user is super admin
   * @param {string} telegramUserId - Telegram user ID
   * @returns {Promise<boolean>} True if super admin
   */
  async isSuperAdmin(telegramUserId) {
    const admin = await this.findByUserId(telegramUserId);
    return admin !== null && admin.isActive && admin.isSuperAdmin();
  }

  /**
   * Activates admin
   * @param {string} id - Admin ID
   * @returns {Promise<Admin>} Updated admin
   */
  async activate(id) {
    await this.#ormRepository.activate(id);
    return await this.findById(id);
  }

  /**
   * Deactivates admin
   * @param {string} id - Admin ID
   * @returns {Promise<Admin>} Updated admin
   */
  async deactivate(id) {
    await this.#ormRepository.deactivate(id);
    return await this.findById(id);
  }

  /**
   * Gets first super admin
   * @returns {Promise<Admin|null>} Super admin or null
   */
  async getFirstSuperAdmin() {
    const entities = await this.#ormRepository.findByRole(AdminRole.SUPER_ADMIN);
    const activeEntities = entities.filter(e => e.isActive);
    
    if (activeEntities.length === 0) return null;
    
    // Sort by createdAt and get first
    activeEntities.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return this.#toDomainEntity(activeEntities[0]);
  }

  /**
   * Gets admin statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const [total, active, superAdmins, regularAdmins] = await Promise.all([
      this.count(),
      this.count({ active: true }),
      this.count({ role: AdminRole.SUPER_ADMIN }),
      this.count({ role: AdminRole.ADMIN })
    ]);

    return {
      total,
      active,
      inactive: total - active,
      superAdmins,
      regularAdmins
    };
  }
}

export default AdminRepository;
