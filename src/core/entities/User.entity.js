/**
 * @fileoverview User Entity
 * Domain entity representing a Telegram user
 * @module core/entities/User
 */

import BaseEntity from '../base/BaseEntity.js';

/**
 * User Entity
 * Represents a Telegram user (recipient)
 * 
 * @class User
 * @extends BaseEntity
 */
class User extends BaseEntity {
  /**
   * Database ID
   * @type {number|null}
   */
  id;

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
   * Is bot flag
   * @type {boolean}
   */
  isBot;

  /**
   * Is premium flag
   * @type {boolean}
   */
  isPremium;

  /**
   * Is active flag
   * @type {boolean}
   */
  isActive;

  /**
   * Creates a User entity
   * @param {Object} data - User data
   */
  constructor(data) {
    super();
    this.validate(data);
    
    this.id = data.id || null;
    this.userId = data.userId;
    this.firstName = data.firstName;
    this.lastName = data.lastName || null;
    this.username = data.username || null;
    this.phone = data.phone || null;
    this.isBot = data.isBot || false;
    this.isPremium = data.isPremium || false;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Validates user data
   * @param {Object} data - User data
   * @throws {Error} If validation fails
   */
  validate(data) {
    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('User ID is required and must be a string');
    }

    if (!data.firstName || typeof data.firstName !== 'string') {
      throw new Error('First name is required and must be a string');
    }

    if (data.firstName.length > 100) {
      throw new Error('First name must not exceed 100 characters');
    }

    if (data.lastName && typeof data.lastName !== 'string') {
      throw new Error('Last name must be a string');
    }

    if (data.lastName && data.lastName.length > 100) {
      throw new Error('Last name must not exceed 100 characters');
    }

    if (data.username && typeof data.username !== 'string') {
      throw new Error('Username must be a string');
    }

    if (data.username && data.username.length > 50) {
      throw new Error('Username must not exceed 50 characters');
    }

    if (data.phone && typeof data.phone !== 'string') {
      throw new Error('Phone must be a string');
    }
  }

  /**
   * Updates first name
   * @param {string} firstName - New first name
   * @returns {User} This user (for chaining)
   */
  updateFirstName(firstName) {
    if (!firstName || typeof firstName !== 'string') {
      throw new Error('First name is required');
    }
    this.firstName = firstName;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Updates last name
   * @param {string|null} lastName - New last name
   * @returns {User} This user (for chaining)
   */
  updateLastName(lastName) {
    this.lastName = lastName;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Updates username
   * @param {string|null} username - New username
   * @returns {User} This user (for chaining)
   */
  updateUsername(username) {
    this.username = username;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Updates phone
   * @param {string|null} phone - New phone
   * @returns {User} This user (for chaining)
   */
  updatePhone(phone) {
    this.phone = phone;
    this.updatedAt = new Date();
    return this;
  }

  /**
   * Gets full name
   * @returns {string} Full name
   */
  getFullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ');
  }

  /**
   * Gets display name (username or full name)
   * @returns {string} Display name
   */
  getDisplayName() {
    return this.username ? `@${this.username}` : this.getFullName();
  }

  /**
   * Checks if user has username
   * @returns {boolean} True if has username
   */
  hasUsername() {
    return this.username !== null && this.username !== '';
  }

  /**
   * Checks if user has phone
   * @returns {boolean} True if has phone
   */
  hasPhone() {
    return this.phone !== null && this.phone !== '';
  }

  /**
   * Converts entity to plain object for database
   * @returns {Object} Plain object
   */
  toObject() {
    return {
      id: this.id,
      user_id: this.userId,
      first_name: this.firstName,
      last_name: this.lastName,
      username: this.username,
      phone: this.phone,
      is_bot: this.isBot ? 1 : 0,
      is_premium: this.isPremium ? 1 : 0,
      is_active: this.isActive ? 1 : 0,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
    };
  }

  /**
   * Creates entity from database row
   * @static
   * @param {Object} row - Database row
   * @returns {User} User entity
   */
  static fromDatabaseRow(row) {
    return new User({
      id: row.id,
      userId: row.user_id || row.userId,
      firstName: row.first_name || row.firstName,
      lastName: row.last_name || row.lastName,
      username: row.username,
      phone: row.phone,
      isBot: Boolean(row.is_bot || row.isBot),
      isPremium: Boolean(row.is_premium || row.isPremium),
      isActive: row.is_active !== undefined ? Boolean(row.is_active) : (row.isActive !== undefined ? Boolean(row.isActive) : true),
      createdAt: row.created_at || row.createdAt ? new Date(row.created_at || row.createdAt) : new Date(),
      updatedAt: row.updated_at || row.updatedAt ? new Date(row.updated_at || row.updatedAt) : new Date()
    });
  }

  /**
   * Creates entity from Telegram entity
   * @static
   * @param {Object} telegramEntity - Telegram user entity
   * @returns {User} User entity
   */
  static fromTelegramEntity(telegramEntity) {
    return new User({
      userId: telegramEntity.id?.toString() || telegramEntity.userId,
      firstName: telegramEntity.firstName || telegramEntity.first_name || 'Unknown',
      lastName: telegramEntity.lastName || telegramEntity.last_name || null,
      username: telegramEntity.username || null,
      phone: telegramEntity.phone || null
    });
  }
}

export default User;
