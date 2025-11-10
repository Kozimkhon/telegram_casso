/**
 * @fileoverview Find Old Messages Use Case
 * Retrieves old forwarded messages for cleanup
 * @module domain/use-cases/message/FindOldMessagesUseCase
 */

/**
 * Find Old Messages Use Case
 * 
 * @class FindOldMessagesUseCase
 */
class FindOldMessagesUseCase {
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
   * @param {number} hoursOld - Hours old
   * @returns {Promise<Object>} Result
   */
  async execute(hoursOld = 24) {
    if (hoursOld < 1) {
      throw new Error('Hours old must be at least 1');
    }

    const messages = await this.#messageRepository.findOldMessages(hoursOld);

    return {
      success: true,
      hoursOld,
      total: messages.length,
      messages: messages
    };
  }
}

export default FindOldMessagesUseCase;
