/**
 * @fileoverview Get Forwarding Statistics Use Case
 * Retrieves message forwarding statistics
 * @module domain/use-cases/message/GetForwardingStatsUseCase
 */

/**
 * Get Forwarding Statistics Use Case
 * 
 * @class GetForwardingStatsUseCase
 */
class GetForwardingStatsUseCase {
  /**
   * Message repository
   * @private
   */
  #messageRepository;

  /**
   * Creates use case
   * @param {MessageRepository} messageRepository - Message repository
   */
  constructor(messageRepository) {
    this.#messageRepository = messageRepository;
  }

  /**
   * Executes use case
   * @param {Object} filters - Filters
   * @returns {Promise<Object>} Statistics
   */
  async execute(filters = {}) {
    const stats = await this.#messageRepository.getForwardingStatistics(filters);
    
    return {
      success: true,
      statistics: stats,
      filters: filters
    };
  }

  /**
   * Gets statistics by channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Statistics
   */
  async getByChannel(channelId) {
    return await this.execute({ channelId });
  }

  /**
   * Gets statistics by date range
   * @param {string} fromDate - From date
   * @param {string} toDate - To date
   * @returns {Promise<Object>} Statistics
   */
  async getByDateRange(fromDate, toDate) {
    return await this.execute({ fromDate, toDate });
  }
}

export default GetForwardingStatsUseCase;
