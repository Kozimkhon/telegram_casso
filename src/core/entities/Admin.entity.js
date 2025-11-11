/**
 * @fileoverview Admin Entity
 * Domain entity representing an admin user
 * @module core/entities/Admin
 */

import BaseEntity from '../base/BaseEntity.js';
import { AdminRole } from '../../shared/constants/index.js';

/**
 * Admin Entity
 * Represents an admin user with role
 * 
 * @class Admin
 * @extends BaseEntity
 */
class Admin extends BaseEntity {
  /**
   * User ID (Telegram user ID)
   * @type {string}
   */
  userId;

  /**
   * First name
   * @type {string}
   */
  firstName;

  /**
   * Last name
   * @type {string|null}
   */
  lastName;

  /**
   * Username
   * @type {string|null}
   */
  username;

  /**
   * Phone number
   * @type {string|null}
   */
  phone;

  /**
   * Admin role
   * @type {string}
   */
  role;

  /**
   * Active flag
   * @type {boolean}
   */
  isActive;

  /**
   * Creates an Admin entity
   * @param {Object} data - Admin data
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.userId = data.userId;
    this.firstName = data.firstName;
    this.lastName = data.lastName || null;
    this.username = data.username || null;
    this.phone = data.phone || null;
    this.role = data.role || AdminRole.ADMIN;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validates admin data
   * @param {Object} data - Admin data
   * @throws {Error} If validation fails
   */
  validate(data) {
    if (!data.userId) {
      throw new Error('User ID is required');
    }

    if (!data.firstName) {
      throw new Error('First name is required');
    }

    if (data.role && !Object.values(AdminRole).includes(data.role)) {
      throw new Error(`Invalid role. Must be one of: ${Object.values(AdminRole).join(', ')}`);
    }
  }

  /**
   * Activates admin
   * @returns {Admin} This admin (for chaining)
   */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Deactivates admin
   * @returns {Admin} This admin (for chaining)
   */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Changes role
   * @param {string} role - New role
   * @returns {Admin} This admin (for chaining)
   */
  changeRole(role) {
    if (!Object.values(AdminRole).includes(role)) {
      throw new Error('Invalid role');
    }
    this.role = role;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Checks if admin is super admin
   * @returns {boolean} True if super admin
   */
  isSuperAdmin() {
    return this.role === AdminRole.SUPER_ADMIN;
  }

  /**
   * Checks if admin is moderator
   * @returns {boolean} True if moderator
   */
  isModerator() {
    return this.role === AdminRole.MODERATOR;
  }

  /**
   * Gets full name
   * @returns {string} Full name
   */
  getFullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }

  /**
   * Converts entity to plain object for database
   * @returns {Object} Plain object
   */
  toObject() {
    return {
      user_id: this.userId,
      first_name: this.firstName,
      last_name: this.lastName,
      username: this.username,
      phone: this.phone,
      role: this.role,
      is_active: this.isActive ? 1 : 0,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  /**
   * Creates entity from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Admin} Admin entity
   */
  static fromDatabaseRow(row) {
    return new Admin({
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      phone: row.phone,
      role: row.role,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
    });
  }
  static toDatabaseRow(admin) {
    return {
      user_id: admin.userId,
      first_name: admin.firstName,
      last_name: admin.lastName,
      username: admin.username,
      phone: admin.phone||"",
      role: admin.role,
      is_active: admin.isActive ? 1 : 0,
      created_at: admin.createdAt,
      updated_at: admin.updatedAt
    };
  }
}

export default Admin;
