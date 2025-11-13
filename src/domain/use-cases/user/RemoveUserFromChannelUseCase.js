/**
 * @fileoverview Remove User From Channel Use Case
 * Handles user-channel disassociation business logic
 * @module domain/use-cases/user/RemoveUserFromChannelUseCase
 */

/**
 * Remove User From Channel Use Case
 * 
 * @class RemoveUserFromChannelUseCase
 */
class RemoveUserFromChannelUseCase {
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

    // Remove from channel (use Telegram channel ID)
    const removed = await this.#userRepository.removeFromChannel(channelId, userId);

    if (!removed) {
      return {
        success: false,
        message: 'User not found in channel'
      };
    }

    return {
      success: true,
      message: 'User removed from channel successfully'
    };
  }
}

export default RemoveUserFromChannelUseCase;
