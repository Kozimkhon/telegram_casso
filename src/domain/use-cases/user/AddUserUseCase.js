/**
 * @fileoverview Add User Use Case
 * Handles user creation business logic
 * @module domain/use-cases/user/AddUserUseCase
 */

import User from '../../../core/entities/User.entity.js';

/**
 * Add User Use Case
 * 
 * @class AddUserUseCase
 */
class AddUserUseCase {
  /**
   * User repository
   * @private
   */
  #userRepository;

  /**
   * State manager
   * @private
   */
  #stateManager;

  /**
   * Creates use case
   * @param {UserRepository} userRepository - User repository
   * @param {StateManager} stateManager - State manager
   */
  constructor(userRepository, stateManager) {
    this.#userRepository = userRepository;
    this.#stateManager = stateManager;
  }

  /**
   * Executes use case
   * @param {Object} data - User data
   * @returns {Promise<Object>} Result
   */
  async execute(data) {
    // Validate input
    if (!data.userId) {
      throw new Error('User ID is required');
    }
    if (!data.firstName) {
      throw new Error('First name is required');
    }

    // Check if user exists
    const existing = await this.#userRepository.findById(data.userId);
    if (existing) {
      // Update existing user
      return await this.updateExistingUser(existing, data);
    }

    // Create user entity
    const user = new User({
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName || null,
      username: data.username || null,
      phone: data.phone || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Persist user
    const created = await this.#userRepository.create(user);

    // Update state
    this.#stateManager.addUser({
      userId: created.userId,
      firstName: created.firstName,
      lastName: created.lastName,
      username: created.username
    });

    return {
      success: true,
      user: created,
      message: 'User added successfully'
    };
  }

  /**
   * Updates existing user
   * @private
   * @param {User} existing - Existing user
   * @param {Object} data - New data
   * @returns {Promise<Object>} Result
   */
  async updateExistingUser(existing, data) {
    const updates = {};

    if (data.firstName && data.firstName !== existing.firstName) {
      updates.first_name = data.firstName;
    }
    if (data.lastName !== undefined && data.lastName !== existing.lastName) {
      updates.last_name = data.lastName;
    }
    if (data.username !== undefined && data.username !== existing.username) {
      updates.username = data.username;
    }
    if (data.phone !== undefined && data.phone !== existing.phone) {
      updates.phone = data.phone;
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: true,
        user: existing,
        message: 'User already exists (no changes)'
      };
    }

    const updated = await this.#userRepository.update(existing.userId, updates);

    this.#stateManager.updateUser(updated.userId, {
      firstName: updated.firstName,
      lastName: updated.lastName,
      username: updated.username
    });

    return {
      success: true,
      user: updated,
      message: 'User updated successfully'
    };
  }
}

export default AddUserUseCase;
