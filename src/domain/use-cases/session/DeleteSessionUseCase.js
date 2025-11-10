/**
 * @fileoverview Delete Session Use Case
 * Handles session deletion business logic
 * @module domain/use-cases/session/DeleteSessionUseCase
 */

/**
 * Delete Session Use Case
 * 
 * @class DeleteSessionUseCase
 */
class DeleteSessionUseCase {
  /**
   * Session repository
   * @private
   */
  #sessionRepository;

  /**
   * Channel repository
   * @private
   */
  #channelRepository;

  /**
   * State manager
   * @private
   */
  #stateManager;

  /**
   * Creates use case
   * @param {SessionRepository} sessionRepository - Session repository
   * @param {ChannelRepository} channelRepository - Channel repository
   * @param {StateManager} stateManager - State manager
   */
  constructor(sessionRepository, channelRepository, stateManager) {
    this.#sessionRepository = sessionRepository;
    this.#channelRepository = channelRepository;
    this.#stateManager = stateManager;
  }

  /**
   * Executes use case
   * @param {string} phone - Phone number
   * @returns {Promise<Object>} Result
   */
  async execute(phone) {
    // Find session
    const session = await this.#sessionRepository.findByPhone(phone);
    if (!session) {
      throw new Error(`Session not found: ${phone}`);
    }

    // Find associated channels
    const channels = await this.#channelRepository.findByAdminSession(phone);

    // Unlink channels
    for (const channel of channels) {
      channel.linkToSession(null);
      await this.#channelRepository.update(channel.channelId, {
        admin_session_phone: null
      });
    }

    // Delete session
    const deleted = await this.#sessionRepository.delete(phone);
    if (!deleted) {
      throw new Error('Failed to delete session');
    }

    // Update state
    this.#stateManager.removeSession(phone);

    return {
      success: true,
      message: 'Session deleted successfully',
      unlinkedChannels: channels.length
    };
  }
}

export default DeleteSessionUseCase;
