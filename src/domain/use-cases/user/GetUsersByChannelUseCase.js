/**
 * @fileoverview Get Users By Channel Use Case
 * Retrieves users for a specific channel
 * @module domain/use-cases/user/GetUsersByChannelUseCase
 */

/**
 * Get Users By Channel Use Case
 * 
 * @class GetUsersByChannelUseCase
 */
class GetUsersByChannelUseCase {
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
   * @returns {Promise<Object>} Result
   */
  async execute(channelId) {
    // Validate channel by Telegram channel ID
    const channel = await this.#channelRepository.findByChannelId(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Get users (use Telegram channel ID)
    const users = await this.#userRepository.findByChannel(channelId);

    return {
      success: true,
      channelId: channelId,
      channelTitle: channel.title,
      total: users.length,
      users: users.map(u => ({
        userId: u.userId,
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        fullName: u.getFullName(),
        hasUsername: u.hasUsername()
      }))
    };
  }
}

export default GetUsersByChannelUseCase;
