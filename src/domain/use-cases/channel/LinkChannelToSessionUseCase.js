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
   * @param {string|null} sessionAdminId - Session admin ID (null to unlink)
   * @returns {Promise<Object>} Result
   */
  async execute(channelId, sessionAdminId) {
    // Find channel
    const channel = await this.#channelRepository.findById(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Validate session if provided
    if (sessionAdminId) {
      const session = await this.#sessionRepository.findByAdminId(sessionAdminId);
      if (!session) {
        throw new Error(`Session not found for admin: ${sessionAdminId}`);
      }
      if (session.status !== 'active') {
        throw new Error(`Session is not active: ${sessionAdminId}`);
      }
    }

    // Update channel entity - channel now links to admin (not session directly)
    // Channel.adminId will be set to the admin that owns the session
    channel.linkToAdmin(sessionAdminId);

    // Update repository
    const updated = await this.#channelRepository.update(channelId, {
      admin_id: sessionAdminId,
      updated_at: channel.updatedAt
    });

    // Update state
    this.#stateManager.updateChannel(channelId, {
      adminId: updated.adminId
    });

    return {
      success: true,
      channel: updated,
      message: sessionAdminId 
        ? `Channel linked to admin ${sessionAdminId}` 
        : 'Channel unlinked from admin'
    };
  }
}

export default LinkChannelToSessionUseCase;
