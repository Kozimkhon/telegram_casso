/**
 * @fileoverview Cleanup Old Messages Use Case
 * Handles old message logs cleanup business logic
 * @module domain/use-cases/message/CleanupOldMessagesUseCase
 */

/**
 * Cleanup Old Messages Use Case
 * 
 * @class CleanupOldMessagesUseCase
 */
class CleanupOldMessagesUseCase {
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
   * @param {number} daysToKeep - Days to keep logs
   * @returns {Promise<Object>} Result
   */
  async execute(daysToKeep = 30) {
    if (daysToKeep < 1) {
      throw new Error('Days to keep must be at least 1');
    }

    const deletedCount = await this.#messageRepository.cleanupOldLogs(daysToKeep);

    return {
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} old message logs (older than ${daysToKeep} days)`
    };
  }
}

export default CleanupOldMessagesUseCase;
