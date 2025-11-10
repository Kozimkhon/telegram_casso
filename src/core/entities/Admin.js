/**
 * Admin Entity
 * Represents an admin user with permissions
 * 
 * @module core/entities/Admin
 */

import { UserRole, ValidationRules } from '../../shared/constants/index.js';

/**
 * @class Admin
 * @description Domain entity representing an admin user
 * Encapsulates admin data with role-based permissions
 */
export class Admin {
  /**
   * Creates a new Admin instance
   * @param {Object} data - Admin data
   * @param {string} data.userId - Telegram user ID
   * @param {string} [data.firstName] - First name
   * @param {string} [data.lastName] - Last name
   * @param {string} [data.username] - Username
   * @param {string} [data.phone] - Phone number
   * @param {string} [data.role] - Admin role
   * @param {boolean} [data.isActive] - Active status
   * @param {Date} [data.createdAt] - Creation date
   * @param {Date} [data.updatedAt] - Update date
   * @throws {Error} If validation fails
   */
  constructor(data) {
    this.validate(data);

    this.userId = data.userId;
    this.firstName = data.firstName || null;
    this.lastName = data.lastName || null;
    this.username = data.username || null;
    this.phone = data.phone || null;
    this.role = data.role || UserRole.ADMIN;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  /**
   * Validates admin data
   * @param {Object} data - Data to validate
   * @throws {Error} If validation fails
   * @private
   */
  validate(data) {
    const errors = [];

    if (!data.userId || typeof data.userId !== 'string') {
      errors.push('User ID is required and must be a string');
    }

    if (data.role && !Object.values(UserRole).includes(data.role)) {
      errors.push(`Invalid role. Must be one of: ${Object.values(UserRole).join(', ')}`);
    }

    if (data.username && data.username.length > ValidationRules.MAX_USERNAME_LENGTH) {
      errors.push(`Username must be ${ValidationRules.MAX_USERNAME_LENGTH} characters or less`);
    }

    if (errors.length > 0) {
      throw new Error(`Admin validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Gets the full name of the admin
   * @returns {string} Full name or user ID if name not available
   */
  getFullName() {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    if (this.firstName) {
      return this.firstName;
    }
    if (this.lastName) {
      return this.lastName;
    }
    return this.userId;
  }

  /**
   * Gets display name (username or full name)
   * @returns {string} Display name
   */
  getDisplayName() {
    if (this.username) {
      return `@${this.username}`;
    }
    return this.getFullName();
  }

  /**
   * Checks if admin is super admin
   * @returns {boolean} True if super admin
   */
  isSuperAdmin() {
    return this.role === UserRole.SUPER_ADMIN;
  }

  /**
   * Checks if admin is regular admin
   * @returns {boolean} True if regular admin
   */
  isRegularAdmin() {
    return this.role === UserRole.ADMIN;
  }

  /**
   * Checks if admin can perform action
   * @param {string} action - Action to check
   * @returns {boolean} True if can perform action
   */
  canPerform(action) {
    if (!this.isActive) return false;

    // Super admin can do everything
    if (this.isSuperAdmin()) return true;

    // Define permissions for regular admins
    const adminPermissions = [
      'view_channels',
      'view_sessions',
      'manage_own_channels',
      'view_users',
      'view_stats'
    ];

    const superAdminPermissions = [
      'add_admin',
      'remove_admin',
      'manage_all_channels',
      'manage_all_sessions',
      'delete_sessions',
      'system_settings'
    ];

    if (this.isRegularAdmin()) {
      return adminPermissions.includes(action);
    }

    return false;
  }

  /**
   * Activates the admin
   * @returns {Admin} This admin for chaining
   */
  activate() {
    this.isActive = true;
    this.touch();
    return this;
  }

  /**
   * Deactivates the admin
   * @returns {Admin} This admin for chaining
   */
  deactivate() {
    this.isActive = false;
    this.touch();
    return this;
  }

  /**
   * Promotes admin to super admin
   * @returns {Admin} This admin for chaining
   */
  promoteToSuperAdmin() {
    this.role = UserRole.SUPER_ADMIN;
    this.touch();
    return this;
  }

  /**
   * Demotes admin to regular admin
   * @returns {Admin} This admin for chaining
   */
  demoteToAdmin() {
    this.role = UserRole.ADMIN;
    this.touch();
    return this;
  }

  /**
   * Updates admin information
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.firstName] - First name
   * @param {string} [updates.lastName] - Last name
   * @param {string} [updates.username] - Username
   * @param {string} [updates.phone] - Phone
   * @returns {Admin} This admin for chaining
   */
  update(updates) {
    if (updates.firstName !== undefined) this.firstName = updates.firstName;
    if (updates.lastName !== undefined) this.lastName = updates.lastName;
    if (updates.username !== undefined) this.username = updates.username;
    if (updates.phone !== undefined) this.phone = updates.phone;
    this.touch();
    return this;
  }

  /**
   * Updates the updatedAt timestamp
   * @private
   */
  touch() {
    this.updatedAt = new Date();
  }

  /**
   * Converts entity to plain object for database storage
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      userId: this.userId,
      firstName: this.firstName,
      lastName: this.lastName,
      username: this.username,
      phone: this.phone,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Creates an Admin instance from database row
   * @static
   * @param {Object} row - Database row
   * @returns {Admin} Admin instance
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
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  /**
   * Creates Admin instances from multiple database rows
   * @static
   * @param {Array<Object>} rows - Database rows
   * @returns {Array<Admin>} Array of Admin instances
   */
  static fromDatabaseRows(rows) {
    return rows.map(row => Admin.fromDatabaseRow(row));
  }
}

export default Admin;
