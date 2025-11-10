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
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Result
   */
  async execute(channelId) {
    // Find channel
    const channel = await this.#channelRepository.findById(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Clear channel members
    const clearedCount = await this.#userRepository.clearChannelMembers(channelId);

    // Delete channel
    const deleted = await this.#channelRepository.delete(channelId);
    if (!deleted) {
      throw new Error('Failed to delete channel');
    }

    // Update state
    this.#stateManager.removeChannel(channelId);

    return {
      success: true,
      message: 'Channel removed successfully',
      clearedMembers: clearedCount
    };
  }
}

export default RemoveChannelUseCase;
