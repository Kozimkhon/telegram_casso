/**
 * @fileoverview Toggle Channel Forwarding Use Case
 * Handles channel forwarding toggle business logic
 * @module domain/use-cases/channel/ToggleChannelForwardingUseCase
 */

/**
 * Toggle Channel Forwarding Use Case
 * 
 * @class ToggleChannelForwardingUseCase
 */
class ToggleChannelForwardingUseCase {
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
   * @param {ChannelRepository} channelRepository - Channel repository
   * @param {StateManager} stateManager - State manager
   */
  constructor(channelRepository, stateManager) {
    this.#channelRepository = channelRepository;
    this.#stateManager = stateManager;
  }

  /**
   * Executes use case
   * @param {string} channelId - Channel ID (Telegram channel ID, not database ID)
   * @param {boolean} enabled - Enable/disable
   * @returns {Promise<Object>} Result
   */
  async execute(channelId, enabled = null) {
    // Find channel by Telegram channel ID
    const channel = await this.#channelRepository.findByChannelId(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    // Determine new state
    const newState = enabled !== null ? enabled : !channel.forwardEnabled;

    // Update channel entity
    if (newState) {
      channel.enableForwarding();
    } else {
      channel.disableForwarding();
    }

    // Update repository (use database ID for update)
    const updated = await this.#channelRepository.update(channel.id, {
      forward_enabled: channel.forwardEnabled,
      updated_at: channel.updatedAt
    });

    // Update state (use Telegram channel ID)
    this.#stateManager.toggleChannelForwarding(channelId, updated.forwardEnabled);

    return {
      success: true,
      channel: updated,
      message: `Forwarding ${updated.forwardEnabled ? 'enabled' : 'disabled'} for channel`
    };
  }
}

export default ToggleChannelForwardingUseCase;
