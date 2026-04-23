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

    // Stop UserBot if running
    const botInstance = this.#stateManager.getBot(adminId);
    if (botInstance) {
      try {
        await botInstance.stop();
      } catch (e) {
        // ignore stop errors
      }
      this.#stateManager.unregisterBot(adminId);
    }

    // Find associated channels and unlink them
    const channels = await this.#channelRepository.findByAdminSession(adminId);
    for (const channel of channels) {
      await this.#channelRepository.update(channel.channelId, {
        admin_id: null
      });
    }

    // Delete session by primary key
    const deleted = await this.#sessionRepository.delete(session.id);
    if (!deleted) {
      throw new Error('Failed to delete session');
    }

    return {
      success: true,
      message: 'Session deleted successfully',
      unlinkedChannels: channels.length
    };
  }
}

export default DeleteSessionUseCase;
