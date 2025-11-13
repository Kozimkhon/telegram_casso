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
   * @param {string} adminId - Admin user ID
   * @returns {Promise<Object>} Result
   */
  async execute(adminId) {
    // Find session
    const session = await this.#sessionRepository.findByAdminId(adminId);
    if (!session) {
      throw new Error(`Session not found: ${adminId}`);
    }

    // Find associated channels
    const channels = await this.#channelRepository.findByAdminSession(adminId);

    // Unlink channels
    for (const channel of channels) {
      channel.linkToSession(adminId);
      await this.#channelRepository.update(channel.channelId, {
        admin_id: adminId
      });
    }

    // Delete session
    const deleted = await this.#sessionRepository.delete(adminId);
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
