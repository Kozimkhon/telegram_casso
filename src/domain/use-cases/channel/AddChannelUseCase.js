/**
 * @fileoverview Add Channel Use Case
 * Handles channel creation business logic
 * @module domain/use-cases/channel/AddChannelUseCase
 */

import Channel from '../../../core/entities/Channel.entity.js';

/**
 * Add Channel Use Case
 * 
 * @class AddChannelUseCase
 */
class AddChannelUseCase {
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
   * @param {Object} data - Channel data
   * @returns {Promise<Object>} Result
   */
  async execute(data) {
    // Validate input
    if (!data.channelId) {
      throw new Error('Channel ID is required');
    }
    if (!data.title) {
      throw new Error('Channel title is required');
    }

    // Check if channel exists
    const existing = await this.#channelRepository.findById(data.channelId);
    if (existing) {
      throw new Error(`Channel already exists: ${data.channelId}`);
    }

    // Validate session if provided
    if (data.adminId) {
      const session = await this.#sessionRepository.findByAdminId(data.adminId);
      if (!session) {
        throw new Error(`Session not found for admin: ${data.adminId}`);
      }
      if (session.status !== 'active') {
        throw new Error(`Session is not active: ${data.adminId}`);
      }
    }

    // Create channel entity
    const channel = new Channel({
      channelId: data.channelId,
      title: data.title,
      memberCount: data.memberCount || 0,
      forwardEnabled: data.forwardEnabled !== false,
      adminId: data.adminId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Persist channel
    const created = await this.#channelRepository.create(channel);

    // Update state
    this.#stateManager.addChannel({
      channelId: created.channelId,
      title: created.title,
      memberCount: created.memberCount,
      forwardEnabled: created.forwardEnabled,
      adminId: created.adminId
    });

    return {
      success: true,
      channel: created,
      message: 'Channel added successfully'
    };
  }
}

export default AddChannelUseCase;
