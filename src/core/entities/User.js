/**
 * User Entity
 * Represents a Telegram user with business logic and validation
 * 
 * @module core/entities/User
 */

import { ValidationRules } from '../../shared/constants/index.js';

/**
 * @class User
 * @description Domain entity representing a Telegram user (message recipient)
 * Encapsulates user data with validation
 */
export class User {
  /**
   * Creates a new User instance
   * @param {Object} data - User data
   * @param {string} data.userId - Telegram user ID
   * @param {string} [data.firstName] - First name
   * @param {string} [data.lastName] - Last name
   * @param {string} [data.username] - Username
   * @param {string} [data.phone] - Phone number
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
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  /**
   * Validates user data
   * @param {Object} data - Data to validate
   * @throws {Error} If validation fails
   * @private
   */
  validate(data) {
    const errors = [];

    // Validate user ID
    if (!data.userId || typeof data.userId !== 'string') {
      errors.push('User ID is required and must be a string');
    }

    // Validate username if provided
    if (data.username && data.username.length > ValidationRules.MAX_USERNAME_LENGTH) {
      errors.push(`Username must be ${ValidationRules.MAX_USERNAME_LENGTH} characters or less`);
    }

    // Validate phone if provided
    if (data.phone) {
      if (data.phone.length < ValidationRules.MIN_PHONE_LENGTH || 
          data.phone.length > ValidationRules.MAX_PHONE_LENGTH) {
        errors.push(`Phone must be between ${ValidationRules.MIN_PHONE_LENGTH} and ${ValidationRules.MAX_PHONE_LENGTH} characters`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`User validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Gets the full name of the user
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
   * Checks if user has username
   * @returns {boolean} True if has username
   */
  hasUsername() {
    return Boolean(this.username);
  }

  /**
   * Checks if user has phone
   * @returns {boolean} True if has phone
   */
  hasPhone() {
    return Boolean(this.phone);
  }

  /**
   * Updates user information
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.firstName] - First name
   * @param {string} [updates.lastName] - Last name
   * @param {string} [updates.username] - Username
   * @param {string} [updates.phone] - Phone
   * @returns {User} This user for chaining
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Creates a User instance from database row
   * @static
   * @param {Object} row - Database row
   * @returns {User} User instance
   */
  static fromDatabaseRow(row) {
    return new User({
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      username: row.username,
      phone: row.phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  /**
   * Creates User instances from multiple database rows
   * @static
   * @param {Array<Object>} rows - Database rows
   * @returns {Array<User>} Array of User instances
   */
  static fromDatabaseRows(rows) {
    return rows.map(row => User.fromDatabaseRow(row));
  }

  /**
   * Creates a User from Telegram entity
   * @static
   * @param {Object} entity - Telegram entity
   * @returns {User} User instance
   */
  static fromTelegramEntity(entity) {
    return new User({
      userId: entity.id?.toString() || entity.userId,
      firstName: entity.firstName,
      lastName: entity.lastName,
      username: entity.username,
      phone: entity.phone
    });
  }
}

export default User;
