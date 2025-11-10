/**
 * Manage Channel Use Case
 * Handles channel management operations
 * 
 * @module core/use-cases/ManageChannelUseCase
 */

import { BaseUseCase } from './BaseUseCase.js';
import { Channel } from '../entities/Channel.js';
import AppState from '../state/AppState.js';

/**
 * @typedef {Object} AddChannelRequest
 * @property {string} channelId - Channel ID
 * @property {string} title - Channel title
 * @property {string} [adminSessionPhone] - Admin session phone
 * @property {boolean} [forwardEnabled] - Forward enabled status
 */

/**
 * @typedef {Object} UpdateChannelRequest
 * @property {string} channelId - Channel ID
 * @property {Object} updates - Updates to apply
 */

/**
 * @class ManageChannelUseCase
 * @extends {BaseUseCase}
 * @description Use case for managing channels (add, update, remove, toggle)
 */
export class ManageChannelUseCase extends BaseUseCase {
  /**
   * Creates a new ManageChannelUseCase
   * @param {IChannelRepository} channelRepository - Channel repository
   * @param {Object} logger - Logger instance
   */
  constructor(channelRepository, logger) {
    super(logger);
    this.channelRepository = channelRepository;
    this.appState = AppState;
  }

  /**
   * Adds a new channel
   * @param {AddChannelRequest} request - Add channel request
   * @returns {Promise<Channel>} Created channel
   */
  async addChannel(request) {
    try {
      this.validate(request);
      this.log('Adding new channel', { channelId: request.channelId });

      // Check if channel already exists
      const exists = await this.channelRepository.exists(request.channelId);
      if (exists) {
        throw new Error(`Channel already exists: ${request.channelId}`);
      }

      // Create channel
      const channel = await this.channelRepository.create({
        channelId: request.channelId,
        title: request.title,
        adminSessionPhone: request.adminSessionPhone,
        forwardEnabled: request.forwardEnabled !== undefined ? request.forwardEnabled : true
      });

      // Update app state
      this.appState.setChannel(channel.channelId, channel.toObject());

      this.log('Channel added successfully', { channelId: channel.channelId });
      return channel;

    } catch (error) {
      this.logError('Failed to add channel', error, { request });
      throw error;
    }
  }

  /**
   * Updates an existing channel
   * @param {UpdateChannelRequest} request - Update channel request
   * @returns {Promise<Channel>} Updated channel
   */
  async updateChannel(request) {
    try {
      this.validate(request);
      this.log('Updating channel', { channelId: request.channelId });

      const channel = await this.channelRepository.update(
        request.channelId,
        request.updates
      );

      // Update app state
      this.appState.setChannel(channel.channelId, channel.toObject());

      this.log('Channel updated successfully', { channelId: channel.channelId });
      return channel;

    } catch (error) {
      this.logError('Failed to update channel', error, { request });
      throw error;
    }
  }

  /**
   * Removes a channel
   * @param {string} channelId - Channel ID to remove
   * @returns {Promise<boolean>} True if removed
   */
  async removeChannel(channelId) {
    try {
      this.log('Removing channel', { channelId });

      const deleted = await this.channelRepository.delete(channelId);
      
      if (deleted) {
        // Remove from app state
        this.appState.removeChannel(channelId);
        this.log('Channel removed successfully', { channelId });
      }

      return deleted;

    } catch (error) {
      this.logError('Failed to remove channel', error, { channelId });
      throw error;
    }
  }

  /**
   * Toggles channel forwarding status
   * @param {string} channelId - Channel ID
   * @returns {Promise<Channel>} Updated channel
   */
  async toggleForwarding(channelId) {
    try {
      this.log('Toggling channel forwarding', { channelId });

      const channel = await this.channelRepository.toggleForwarding(channelId);

      // Update app state
      this.appState.toggleChannelForwarding(channelId);

      this.log('Channel forwarding toggled', { 
        channelId, 
        enabled: channel.forwardEnabled 
      });

      return channel;

    } catch (error) {
      this.logError('Failed to toggle forwarding', error, { channelId });
      throw error;
    }
  }

  /**
   * Gets a channel by ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Channel|null>} Channel or null
   */
  async getChannel(channelId) {
    try {
      return await this.channelRepository.findById(channelId);
    } catch (error) {
      this.logError('Failed to get channel', error, { channelId });
      throw error;
    }
  }

  /**
   * Gets all channels
   * @param {Object} [options] - Query options
   * @param {boolean} [options.onlyEnabled] - Only enabled channels
   * @returns {Promise<Array<Channel>>} Array of channels
   */
  async getAllChannels(options = {}) {
    try {
      const filter = options.onlyEnabled ? { enabled: true } : {};
      return await this.channelRepository.findAll(filter);
    } catch (error) {
      this.logError('Failed to get channels', error, { options });
      throw error;
    }
  }

  /**
   * Gets channels by admin session
   * @param {string} phone - Admin session phone
   * @returns {Promise<Array<Channel>>} Array of channels
   */
  async getChannelsByAdminSession(phone) {
    try {
      return await this.channelRepository.findByAdminSession(phone);
    } catch (error) {
      this.logError('Failed to get channels by admin session', error, { phone });
      throw error;
    }
  }

  /**
   * Links channel to admin session
   * @param {string} channelId - Channel ID
   * @param {string} phone - Admin session phone
   * @returns {Promise<Channel>} Updated channel
   */
  async linkChannelToSession(channelId, phone) {
    try {
      this.log('Linking channel to session', { channelId, phone });

      const channel = await this.channelRepository.linkToSession(channelId, phone);

      // Update app state
      this.appState.setChannel(channel.channelId, channel.toObject());

      this.log('Channel linked to session', { channelId, phone });
      return channel;

    } catch (error) {
      this.logError('Failed to link channel to session', error, { channelId, phone });
      throw error;
    }
  }

  /**
   * Gets channel statistics
   * @returns {Promise<Object>} Channel statistics
   */
  async getStatistics() {
    try {
      return await this.channelRepository.getStatistics();
    } catch (error) {
      this.logError('Failed to get channel statistics', error);
      throw error;
    }
  }

  /**
   * Not used - kept for BaseUseCase compatibility
   * @private
   */
  async execute(request) {
    throw new Error('Use specific methods instead of execute()');
  }
}

export default ManageChannelUseCase;
