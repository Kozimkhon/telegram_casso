/**
 * @fileoverview Admin Repository Implementation
 * Handles admin user data persistence
 * @module data/repositories/AdminRepository
 */

import IAdminRepository from '../../core/interfaces/IAdminRepository.js';
import Admin from '../../core/entities/Admin.entity.js';
import { AdminRole } from '../../shared/constants/index.js';

/**
 * Admin Repository
 * Implements admin data access operations
 * 
 * @class AdminRepository
 * @implements {IAdminRepository}
 */
class AdminRepository extends IAdminRepository {
  /**
   * Data source
   * @private
   */
  #dataSource;

  /**
   * Creates admin repository
   * @param {SQLiteDataSource} dataSource - Data source
   */
  constructor(dataSource) {
    super();
    this.#dataSource = dataSource;
  }

  /**
   * Finds admin by ID
   * @param {string} id - Admin ID
   * @returns {Promise<Admin|null>} Admin or null
   */
  async findById(id) {
    const row = await this.#dataSource.getOne(
      'SELECT * FROM admins WHERE id = ?',
      [id]
    );
    return row ? Admin.fromDatabaseRow(row) : null;
  }

  /**
   * Finds all admins
   * @param {Object} filters - Filters
   * @returns {Promise<Array<Admin>>} Admins
   */
  async findAll(filters = {}) {
    const { active, role } = filters;
    
    let query = 'SELECT * FROM admins';
    const params = [];
    const conditions = [];

    if (active !== undefined) {
      conditions.push('is_active = ?');
      params.push(active ? 1 : 0);
    }

    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at ASC';

    const rows = await this.#dataSource.getMany(query, params);
    return rows.map(row => Admin.fromDatabaseRow(row));
  }

  /**
   * Creates new admin
   * @param {Admin} admin - Admin entity
   * @returns {Promise<Admin>} Created admin
   */
  async create(admin) {
    const data = admin.toObject();

    const result = await this.#dataSource.execute(
      `INSERT INTO admins 
       (telegram_user_id, role, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.telegram_user_id,
        data.role,
        data.is_active,
        data.created_at,
        data.updated_at
      ]
    );

    return await this.findById(result.lastID);
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

    await this.#dataSource.execute(
      `UPDATE admins 
       SET role = ?, is_active = ?, updated_at = ? 
       WHERE id = ?`,
      [data.role, data.is_active, data.updated_at, id]
    );

    return await this.findById(id);
  }

  /**
   * Deletes admin
   * @param {string} id - Admin ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(id) {
    const result = await this.#dataSource.execute(
      'DELETE FROM admins WHERE id = ?',
      [id]
    );
    return result.changes > 0;
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
    let query = 'SELECT COUNT(*) as count FROM admins';
    const params = [];
    const conditions = [];

    if (filters.active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.active ? 1 : 0);
    }

    if (filters.role) {
      conditions.push('role = ?');
      params.push(filters.role);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await this.#dataSource.getOne(query, params);
    return result?.count || 0;
  }

  /**
   * Finds admin by Telegram user ID
   * @param {string} telegramUserId - Telegram user ID
   * @returns {Promise<Admin|null>} Admin or null
   */
  async findByUserId(telegramUserId) {
    const row = await this.#dataSource.getOne(
      'SELECT * FROM admins WHERE telegram_user_id = ?',
      [telegramUserId]
    );
    return row ? Admin.fromDatabaseRow(row) : null;
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
    return await this.update(id, { is_active: true });
  }

  /**
   * Deactivates admin
   * @param {string} id - Admin ID
   * @returns {Promise<Admin>} Updated admin
   */
  async deactivate(id) {
    return await this.update(id, { is_active: false });
  }

  /**
   * Gets first super admin
   * @returns {Promise<Admin|null>} Super admin or null
   */
  async getFirstSuperAdmin() {
    const row = await this.#dataSource.getOne(
      'SELECT * FROM admins WHERE role = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1',
      [AdminRole.SUPER_ADMIN]
    );
    return row ? Admin.fromDatabaseRow(row) : null;
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
