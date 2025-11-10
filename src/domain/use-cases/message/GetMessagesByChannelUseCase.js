/**
 * @fileoverview Get Messages By Channel Use Case
 * Retrieves messages for a specific channel
 * @module domain/use-cases/message/GetMessagesByChannelUseCase
 */

/**
 * Get Messages By Channel Use Case
 * 
 * @class GetMessagesByChannelUseCase
 */
class GetMessagesByChannelUseCase {
  /**
   * Message repository
   * @private
   */
  #messageRepository;

  /**
   * Channel repository
   * @private
   */
  #channelRepository;

  /**
   * Creates use case
   * @param {MessageRepository} messageRepository - Message repository
   * @param {ChannelRepository} channelRepository - Channel repository
   */
  constructor(messageRepository, channelRepository) {
    this.#messageRepository = messageRepository;
    this.#channelRepository = channelRepository;
  }

  /**
   * Executes use case
   * @param {string} channelId - Channel ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} Result
   */
  async execute(channelId, options = {}) {
    // Validate channel
    const channel = await this.#channelRepository.findById(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Get messages
    const messages = await this.#messageRepository.findByChannel(channelId);

    return {
      success: true,
      channelId: channelId,
      channelTitle: channel.title,
      total: messages.length,
      messages: messages
    };
  }
}

export default GetMessagesByChannelUseCase;
