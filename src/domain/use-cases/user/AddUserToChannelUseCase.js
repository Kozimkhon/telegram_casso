/**
 * @fileoverview Add User To Channel Use Case
 * Handles user-channel association business logic
 * @module domain/use-cases/user/AddUserToChannelUseCase
 */

/**
 * Add User To Channel Use Case
 * 
 * @class AddUserToChannelUseCase
 */
class AddUserToChannelUseCase {
  /**
   * User repository
   * @private
   */
  #userRepository;

  /**
   * Channel repository
   * @private
   */
  #channelRepository;

  /**
   * Creates use case
   * @param {UserRepository} userRepository - User repository
   * @param {ChannelRepository} channelRepository - Channel repository
   */
  constructor(userRepository, channelRepository) {
    this.#userRepository = userRepository;
    this.#channelRepository = channelRepository;
  }

  /**
   * Executes use case
   * @param {string} channelId - Channel ID (Telegram channel ID)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result
   */
  async execute(channelId, userId) {
    // Validate channel by Telegram channel ID
    const channel = await this.#channelRepository.findByChannelId(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Validate user
    const user = await this.#userRepository.findById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Add to channel (use Telegram channel ID)
    await this.#userRepository.addToChannel(channelId, userId);

    return {
      success: true,
      message: 'User added to channel successfully'
    };
  }

  /**
   * Bulk adds users to channel
   * @param {string} channelId - Channel ID
   * @param {Array<string>} userIds - User IDs
   * @returns {Promise<Object>} Result
   */
  async bulkExecute(channelId, userIds) {
    // Validate channel
    const channel = await this.#channelRepository.findByChannelId(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Bulk add
    const results = await this.#userRepository.bulkAddToChannel(channelId, userIds);

    return {
      success: true,
      total: userIds.length,
      added: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
  }
}

export default AddUserToChannelUseCase;
