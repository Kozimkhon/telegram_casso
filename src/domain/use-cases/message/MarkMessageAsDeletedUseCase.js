/**
 * @fileoverview Mark Message As Deleted Use Case
 * Handles message deletion marking business logic
 * @module domain/use-cases/message/MarkMessageAsDeletedUseCase
 */

/**
 * Mark Message As Deleted Use Case
 * 
 * @class MarkMessageAsDeletedUseCase
 */
class MarkMessageAsDeletedUseCase {
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
   * @param {string} userId - User ID
   * @param {string} forwardedMessageId - Forwarded message ID
   * @returns {Promise<Object>} Result
   */
  async execute(userId, forwardedMessageId) {
    // Validate input
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!forwardedMessageId) {
      throw new Error('Forwarded message ID is required');
    }

    // Mark as deleted
    await this.#messageRepository.markAsDeleted(userId, forwardedMessageId);

    return {
      success: true,
      message: 'Message marked as deleted'
    };
  }
}

export default MarkMessageAsDeletedUseCase;
