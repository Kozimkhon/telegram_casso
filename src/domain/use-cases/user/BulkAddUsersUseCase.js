/**
 * @fileoverview Bulk Add Users Use Case
 * Handles bulk user creation business logic
 * @module domain/use-cases/user/BulkAddUsersUseCase
 */

import User from '../../../core/entities/User.entity.js';

/**
 * Bulk Add Users Use Case
 * 
 * @class BulkAddUsersUseCase
 */
class BulkAddUsersUseCase {
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
   * @param {Array<Object>} usersData - Array of user data
   * @returns {Promise<Object>} Result
   */
  async execute(usersData) {
    if (!Array.isArray(usersData) || usersData.length === 0) {
      throw new Error('Users data must be a non-empty array');
    }

    // Create user entities
    const users = usersData.map(data => {
      try {
        return new User({
          userId: data.userId,
          firstName: data.firstName,
          lastName: data.lastName || null,
          username: data.username || null,
          phone: data.phone || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        return { error: error.message, data };
      }
    });

    // Filter valid users
    const validUsers = users.filter(u => !(u instanceof Error) && !u.error);
    const invalidUsers = users.filter(u => u.error);

    // Bulk create
    const results = await this.#userRepository.bulkCreate(validUsers);

    // Update state for successful additions
    results
      .filter(r => r.success)
      .forEach(r => {
        this.#stateManager.addUser({
          userId: r.data.userId,
          firstName: r.data.firstName,
          lastName: r.data.lastName,
          username: r.data.username
        });
      });

    return {
      success: true,
      total: usersData.length,
      added: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length + invalidUsers.length,
      results: results,
      invalidUsers: invalidUsers
    };
  }
}

export default BulkAddUsersUseCase;
