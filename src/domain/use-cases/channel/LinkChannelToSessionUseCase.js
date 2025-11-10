/**
 * @fileoverview Link Channel To Session Use Case
 * Handles channel-session linking business logic
 * @module domain/use-cases/channel/LinkChannelToSessionUseCase
 */

/**
 * Link Channel To Session Use Case
 * 
 * @class LinkChannelToSessionUseCase
 */
class LinkChannelToSessionUseCase {
  /**
   * Channel repository
   * @private
   */
  #channelRepository;

  /**
   * Session repository
   * @private
   */
  #sessionRepository;

  /**
   * State manager
   * @private
   */
  #stateManager;

  /**
   * Creates use case
   * @param {ChannelRepository} channelRepository - Channel repository
   * @param {SessionRepository} sessionRepository - Session repository
   * @param {StateManager} stateManager - State manager
   */
  constructor(channelRepository, sessionRepository, stateManager) {
    this.#channelRepository = channelRepository;
    this.#sessionRepository = sessionRepository;
    this.#stateManager = stateManager;
  }

  /**
   * Executes use case
   * @param {string} channelId - Channel ID
   * @param {string|null} sessionPhone - Session phone (null to unlink)
   * @returns {Promise<Object>} Result
   */
  async execute(channelId, sessionPhone) {
    // Find channel
    const channel = await this.#channelRepository.findById(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Validate session if provided
    if (sessionPhone) {
      const session = await this.#sessionRepository.findByPhone(sessionPhone);
      if (!session) {
        throw new Error(`Session not found: ${sessionPhone}`);
      }
      if (!session.isActive()) {
        throw new Error(`Session is not active: ${sessionPhone}`);
      }
    }

    // Update channel entity
    channel.linkToSession(sessionPhone);

    // Update repository
    const updated = await this.#channelRepository.update(channelId, {
      admin_session_phone: channel.adminSessionPhone,
      updated_at: channel.updatedAt
    });

    // Update state
    this.#stateManager.updateChannel(channelId, {
      adminSessionPhone: updated.adminSessionPhone
    });

    return {
      success: true,
      channel: updated,
      message: sessionPhone 
        ? `Channel linked to session ${sessionPhone}` 
        : 'Channel unlinked from session'
    };
  }
}

export default LinkChannelToSessionUseCase;
