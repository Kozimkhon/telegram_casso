/**
 * @fileoverview Remove Channel Use Case
 * Handles channel deletion business logic
 * @module domain/use-cases/channel/RemoveChannelUseCase
 */

/**
 * Remove Channel Use Case
 * 
 * @class RemoveChannelUseCase
 */
class RemoveChannelUseCase {
  /**
   * Channel repository
   * @private
   */
  #channelRepository;

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
   * @param {ChannelRepository} channelRepository - Channel repository
   * @param {UserRepository} userRepository - User repository
   * @param {StateManager} stateManager - State manager
   */
  constructor(channelRepository, userRepository, stateManager) {
    this.#channelRepository = channelRepository;
    this.#userRepository = userRepository;
    this.#stateManager = stateManager;
  }

  /**
   * Executes use case
   * @param {string} channelId - Channel ID (Telegram channel ID)
   * @returns {Promise<Object>} Result
   */
  async execute(channelId) {
    // Find channel by Telegram channel ID
    const channel = await this.#channelRepository.findByChannelId(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Clear channel members (use Telegram channel ID)
    const clearedCount = await this.#userRepository.clearChannelMembers(channelId);

    // Delete channel (use database ID)
    const deleted = await this.#channelRepository.delete(channel.id);
    if (!deleted) {
      throw new Error('Failed to delete channel');
    }

    // Update state (use Telegram channel ID)
    this.#stateManager.removeChannel(channelId);

    return {
      success: true,
      message: 'Channel removed successfully',
      clearedMembers: clearedCount
    };
  }
}

export default RemoveChannelUseCase;
