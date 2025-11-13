/**
 * @fileoverview Get Channel Statistics Use Case
 * Retrieves channel statistics
 * @module domain/use-cases/channel/GetChannelStatsUseCase
 */

/**
 * Get Channel Statistics Use Case
 * 
 * @class GetChannelStatsUseCase
 */
class GetChannelStatsUseCase {
  /**
   * Channel repository
   * @private
   */
  #channelRepository;

  /**
   * Creates use case
   * @param {ChannelRepository} channelRepository - Channel repository
   */
  constructor(channelRepository) {
    this.#channelRepository = channelRepository;
  }

  /**
   * Executes use case
   * @returns {Promise<Object>} Statistics
   */
  async execute() {
    const stats = await this.#channelRepository.getStatistics();
    
    return {
      success: true,
      statistics: stats
    };
  }

  /**
   * Gets channel details
   * @param {string} channelId - Channel ID (Telegram channel ID)
   * @returns {Promise<Object>} Channel details
   */
  async getChannelDetails(channelId) {
    const channel = await this.#channelRepository.findByChannelId(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    return {
      success: true,
      channel: {
        channelId: channel.channelId,
        title: channel.title,
        memberCount: channel.memberCount,
        forwardEnabled: channel.forwardEnabled,
        adminSessionPhone: channel.adminSessionPhone,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt
      }
    };
  }
}

export default GetChannelStatsUseCase;
