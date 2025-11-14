/**
 * @fileoverview Channel Event Handlers
 * Presentation layer handlers for Telegram channel events
 * Implements Domain-Driven Design principles with event-driven architecture
 * @module presentation/handlers/channelEventHandlers
 */

import { createChildLogger } from '../../shared/logger.js';

/**
 * Channel Event Handlers
 * Handles all Telegram channel-related events with DDD approach
 * 
 * @class ChannelEventHandlers
 */
class ChannelEventHandlers {
  /**
   * Logger instance
   * @private
   */
  #logger;

  /**
   * Use cases (injected dependencies)
   * @private
   */
  #useCases;

  /**
   * Domain services (injected dependencies)
   * @private
   */
  #services;

  /**
   * Connected channels map
   * @private
   */
  #connectedChannels;

  /**
   * Session data
   * @private
   */
  #sessionData;

  /**
   * Telegram client reference
   * @private
   */
  #client;

  /**
   * Grouped messages buffer (for media groups/albums)
   * Key: groupedId, Value: { messages: [], timeout: setTimeout }
   * @private
   */
  #groupedMessagesBuffer = new Map();

  /**
   * Grouped message wait time (ms) - wait for all messages in group
   * @private
   */
  #groupedMessageWaitTime = 1000;

  /**
   * Creates channel event handlers
   * @param {Object} dependencies - Injected dependencies
   */
  constructor(dependencies) {
    this.#useCases = dependencies.useCases;
    this.#services = dependencies.services;
    this.#connectedChannels = dependencies.connectedChannels;
    this.#sessionData = dependencies.sessionData;
    this.#client = dependencies.client;

    this.#logger = createChildLogger({
      component: 'ChannelEventHandlers',
      adminId: this.#sessionData.adminId,
    });
  }

  /**
   * Handles new channel message event
   * @param {Object} event - UpdateNewChannelMessage event
   * @returns {Promise<void>}
   */
  async handleNewChannelMessage(event) {
    try {
      const message = event.message;
      const channelId = message.peerId?.channelId?.toString();

      if (!channelId) {
        this.#logger.debug('No channel ID in new message event');
        return;
      }

      const fullChannelId = `-100${channelId}`;
      const channelInfo = this.#connectedChannels.get(fullChannelId);

      if (!channelInfo) {
        this.#logger.debug('Channel not in connected list', { channelId: fullChannelId });
        return;
      }

      if (!channelInfo.forwardEnabled) {
        this.#logger.debug('Forwarding disabled for channel', { channelId: fullChannelId });
        return;
      }

      // Check if message is part of a grouped message (album/media group)
      const groupedId = message.groupedId?.toString();

      if (groupedId) {
        // Message is part of a group - buffer it
        await this.#handleGroupedMessage(fullChannelId, message, groupedId);
      } else {
        // Single message - forward immediately
        await this.#forwardSingleMessage(fullChannelId, message);
      }

    } catch (error) {
      this.#logger.error('Error handling new channel message', error);
    }
  }

  /**
   * Handles grouped message (media group/album)
   * Buffers messages and forwards them together
   * @private
   * @param {string} channelId - Channel ID
   * @param {Object} message - Message object
   * @param {string} groupedId - Grouped message ID
   * @returns {Promise<void>}
   */
  async #handleGroupedMessage(channelId, message, groupedId) {
    const bufferKey = `${channelId}:${groupedId}`;

    // Get or create buffer for this group
    let groupBuffer = this.#groupedMessagesBuffer.get(bufferKey);

    if (!groupBuffer) {
      groupBuffer = {
        channelId,
        messages: [],
        timeout: null,
      };
      this.#groupedMessagesBuffer.set(bufferKey, groupBuffer);
    }

    // Add message to buffer
    groupBuffer.messages.push(message);

    // Clear existing timeout
    if (groupBuffer.timeout) {
      clearTimeout(groupBuffer.timeout);
    }

    // Set new timeout - forward group after wait time
    groupBuffer.timeout = setTimeout(async () => {
      try {
        await this.#forwardGroupedMessages(bufferKey, groupBuffer);
      } catch (error) {
        this.#logger.error('Error forwarding grouped messages', error);
      } finally {
        // Clean up buffer
        this.#groupedMessagesBuffer.delete(bufferKey);
      }
    }, this.#groupedMessageWaitTime);

    this.#logger.debug('Buffered grouped message', {
      channelId,
      groupedId,
      messageId: message.id,
      bufferSize: groupBuffer.messages.length,
    });
  }

  /**
   * Forwards grouped messages (album) to users
   * @private
   * @param {string} bufferKey - Buffer key
   * @param {Object} groupBuffer - Group buffer object
   * @returns {Promise<void>}
   */
  async #forwardGroupedMessages(bufferKey, groupBuffer) {
    const { channelId, messages } = groupBuffer;

    if (!messages || messages.length === 0) {
      return;
    }

    // Sort messages by ID to maintain order
    messages.sort((a, b) => a.id - b.id);

    this.#logger.info('Forwarding grouped messages', {
      channelId,
      messageCount: messages.length,
      messageIds: messages.map(m => m.id),
    });

    // Get all message IDs
    const messageIds = messages.map(m => m.id);

    // Forward group to channel users using ForwardingService
    await this.#services.forwarding.forwardToChannelUsers(
      channelId,
      messages[0], // Pass first message for metadata (peerId, etc)
      async (userId, msg) => await this.#forwardMessageGroupToUser(userId, msg, messageIds)
    );
  }

  /**
   * Forwards single message to users
   * @private
   * @param {string} channelId - Channel ID
   * @param {Object} message - Message object
   * @returns {Promise<void>}
   */
  async #forwardSingleMessage(channelId, message) {
    this.#logger.info('New channel message received', {
      channelId,
      messageId: message.id,
      hasText: !!message.message,
      hasMedia: !!message.media,
    });

    // Forward to channel users using ForwardingService (Domain Service)
    await this.#services.forwarding.forwardToChannelUsers(
      channelId,
      message,
      async (userId, msg) => await this.#forwardMessageToUser(userId, msg)
    );
  }

  /**
   * Handles channel message edit event
   * @param {Object} event - UpdateEditChannelMessage event
   * @returns {Promise<void>}
   */
  async handleEditChannelMessage(event) {
    try {
      const message = event.message;
      const channelId = message.peerId?.channelId?.toString();

      if (!channelId) return;

      const fullChannelId = `-100${channelId}`;
      const channelInfo = this.#connectedChannels.get(fullChannelId);

      if (!channelInfo) {
        this.#logger.debug('Channel not in connected list', { channelId: fullChannelId });
        return;
      }

      if (!channelInfo.forwardEnabled) {
        this.#logger.debug('Forwarding disabled for channel', { channelId: fullChannelId });
        return;
      }

      this.#logger.info('Channel message edited', {
        channelId: fullChannelId,
        messageId: message.id,
        hasText: !!message.message,
        hasMedia: !!message.media,
      });

      try {
        // Edit forwarded copies using ForwardingService
        await this.#services.forwarding.editForwardedMessages(
          fullChannelId,
          message.id,
          async (userId, forwardedId) => await this.#editMessageForUser(userId, forwardedId, message)
        );

        this.#logger.debug('Successfully edited forwarded messages', {
          channelId: fullChannelId,
          messageId: message.id
        });
      } catch (err) {
        this.#logger.error('Failed to edit forwarded messages', {
          channelId: fullChannelId,
          messageId: message.id,
          error: err.message
        });
      }

    } catch (error) {
      this.#logger.error('Error handling channel message edit', error);
    }
  }

  /**
   * Handles channel message deletion event
   * @param {Object} event - UpdateDeleteChannelMessages event
   * @returns {Promise<void>}
   */
  async handleDeleteChannelMessages(event) {
    try {
      const channelId = event.channelId?.toString();
      const messageIds = event.messages || [];

      if (!channelId) return;

      const fullChannelId = `-100${channelId}`;

      this.#logger.info('Channel messages deleted', {
        channelId: fullChannelId,
        count: messageIds.length,
        messageIds: messageIds.slice(0, 5), // Log first 5 IDs
      });

      try {
        // Delete forwarded copies using ForwardingService
        await this.#services.forwarding.deleteForwardedMessages(
          fullChannelId,
          messageIds,
          async (userId, forwardedIds) => await this.#deleteMessageFromUser(userId, forwardedIds)
        );

        this.#logger.debug('Marked channel message as deleted', {
          channelId: fullChannelId,
          messageIds
        });
      } catch (err) {
        this.#logger.error('Failed to delete forwarded messages', {
          channelId: fullChannelId,
          messageIds,
          error: err.message
        });
      }


    } catch (error) {
      this.#logger.error('Error handling channel message deletion', error);
    }
  }

  /**
   * Forwards message to single user (helper method)
   * @private
   * @param {string} userId - User ID
   * @param {Object} message - Message to forward
   * @returns {Promise<Object>} Forward result
   */
  async #forwardMessageToUser(userId, message) {
    try {
      const userEntity = await this.#client.getEntity(BigInt(userId));

      // Extract channel ID from message peer (format: -100channelId)
      const channelId = `-100${message.peerId.channelId}`;

      const result = await this.#client.forwardMessages(userEntity, {
        messages: [message.id],
        fromPeer: channelId,
      });

      // Debug: Log result structure to understand return format
      this.#logger.debug('[ChannelEventHandlers] ForwardMessages result', {
        resultType: typeof result,
        isArray: Array.isArray(result),
        resultLength: result?.length,
        resultKeys: typeof result === 'object' ? Object.keys(result || {}) : 'not-object',
        result: JSON.stringify(result, null, 2)
      });

      // Extract ID from result (handle both array and object formats)
      let forwardedId;
      if (Array.isArray(result)) {
        if (Array.isArray(result[0])) {
          forwardedId = result[0][0]?.id;
        } else {
          forwardedId = result[0]?.id;
        }
      } else if (result?.id) {
        forwardedId = result.id;
      } else if (result?.ids?.[0]) {
        forwardedId = result.ids[0];
      }

      if (!forwardedId) {
        this.#logger.warn('[ChannelEventHandlers] ForwardMessages returned no ID', {
          userId,
          messageId: message.id,
          result: JSON.stringify(result)
        });
      }

      return {
        id: forwardedId,
        adminId: this.#sessionData.adminId,
      };

    } catch (error) {
      // Check for flood wait
      if (error.errorMessage?.includes('FLOOD_WAIT')) {
        const seconds = parseInt(error.errorMessage.match(/(\d+)/)?.[1] || '60');
        error.isFloodWait = true;
        error.seconds = seconds;
        error.adminId = this.#sessionData.adminId;
      }
      throw error;
    }
  }

  /**
   * Forwards message group (album) to single user
   * @private
   * @param {string} userId - User ID
   * @param {Object} message - First message in group (for metadata)
   * @param {number[]} messageIds - All message IDs in group
   * @returns {Promise<Object>} Forward result
   */
  async #forwardMessageGroupToUser(userId, message, messageIds) {
    try {
      const userEntity = await this.#client.getEntity(BigInt(userId));

      // Extract channel ID from message peer (format: -100channelId)
      const channelId = `-100${message.peerId.channelId}`;

      // Forward all messages in group together
      const result = await this.#client.forwardMessages(userEntity, {
        messages: messageIds,
        fromPeer: channelId,
      });

      // Debug: Log result structure for group messages
      this.#logger.debug('[ChannelEventHandlers] ForwardMessages group result', {
        resultType: typeof result,
        isArray: Array.isArray(result),
        resultLength: result?.length,
        resultKeys: typeof result === 'object' ? Object.keys(result || {}) : 'not-object',
        messageCount: messageIds.length,
        firstId: result?.[0]?.id,
      });

      // Extract first message ID from result
      let firstId;
      var filtered = result.filter(item => item);
      if (Array.isArray(filtered)) {
        if (Array.isArray(filtered[0])) {
          firstId = filtered[0][0]?.id;
        } else {
          firstId = filtered[0]?.id;
        }
      } else if (result?.id) {
        firstId = result.id;
      } else if (result?.ids?.[0]) {
        firstId = result.ids[0];
      }

      if (!firstId) {
        this.#logger.warn('[ChannelEventHandlers] ForwardMessages group returned no IDs', {
          userId,
          messageIds,
        });
      }

      return {
        id: firstId,
        count: Array.isArray(filtered) ? (Array.isArray(filtered[0]) ? filtered[0].length : filtered.length) : messageIds.length,
        groupedId: message.groupedId?.toString(),
        adminId: this.#sessionData.adminId,
        result: Array.isArray(filtered) ? Array.isArray(filtered[0]) ? filtered[0] : filtered : []
      };

    } catch (error) {
      // Check for flood wait
      if (error.errorMessage?.includes('FLOOD_WAIT')) {
        const seconds = parseInt(error.errorMessage.match(/(\d+)/)?.[1] || '60');
        error.isFloodWait = true;
        error.seconds = seconds;
        error.adminId = this.#sessionData.adminId;
      }
      throw error;
    }
  }

  /**
   * Edits forwarded message in user's private chat
   * Called by ForwardingService during batch edit
   * @private
   * @param {string} userId - User ID
   * @param {string|number} forwardedId - Forwarded message ID to edit
   * @param {Object} newMessage - New message content
   * @returns {Promise<void>}
   */
  async #editMessageForUser(userId, forwardedId, newMessage) {
    try {
      if (!forwardedId) {
        throw new Error('Forwarded message ID is required for editing');
      }

      const userEntity = await this.#client.getEntity(BigInt(userId));

      this.#logger.debug('[ChannelEventHandlers] Editing message for user', {
        userId,
        forwardedId,
        hasText: !!newMessage.message,
        hasMedia: !!newMessage.media
      });

      // Convert ID to number if string
      const messageId = typeof forwardedId === 'string' ? parseInt(forwardedId) : forwardedId;

      // Edit message text if present
      if (newMessage.message) {
        await this.#client.editMessage(userEntity, {
          message: messageId,
          text: newMessage.message,
        });

        this.#logger.debug('[ChannelEventHandlers] Successfully edited forwarded message', {
          userId,
          forwardedId,
          newText: newMessage.message.substring(0, 50) + (newMessage.message.length > 50 ? '...' : '')
        });
      } else if (newMessage.media) {
        // If only media changed (rare case), log it
        // Telegram doesn't support editing media via API easily
        this.#logger.debug('[ChannelEventHandlers] Media-only edit detected (not supported)', {
          userId,
          forwardedId
        });
      }

    } catch (error) {
      this.#logger.error('[ChannelEventHandlers] Failed to edit message', {
        userId,
        forwardedId,
        error: error.message,
        stack: error.stack
      });

      // Check for flood wait
      if (error.errorMessage?.includes('FLOOD_WAIT')) {
        const seconds = parseInt(error.errorMessage.match(/(\d+)/)?.[1] || '60');
        error.isFloodWait = true;
        error.seconds = seconds;
      }

      throw error;
    }
  }

  /**
   * Deletes forwarded message from user's private chat
   * Called by ForwardingService during batch deletion
   * @private
   * @param {string} userId - User ID
   * @param {string|number} forwardedId - Forwarded message ID to delete
   * @returns {Promise<void>}
   */
  async #deleteMessageFromUser(userId, forwardedIds) {
    try {
      if (!forwardedIds) {
        throw new Error('Forwarded message IDs are required for deletion');
      }

      const userEntity = await this.#client.getEntity(BigInt(userId));

      this.#logger.debug('[ChannelEventHandlers] Deleting from user', {
        userId,
        forwardedIds,
        type: typeof forwardedIds
      });

      // Delete message from user's chat
      // Handle both string and number IDs
      const messageIds = Array.isArray(forwardedIds)
        ? forwardedIds.map(id => typeof id === 'string' ? parseInt(id) : id)
        : [typeof forwardedIds === 'string' ? parseInt(forwardedIds) : forwardedIds];

      await this.#client.deleteMessages(userEntity, messageIds, { revoke: true });

      this.#logger.debug('[ChannelEventHandlers] Successfully deleted forwarded message', {
        userId,
        forwardedIds,
        messageCount: messageIds.length
      });

    } catch (error) {
      this.#logger.error('[ChannelEventHandlers] Failed to delete message', {
        userId,
        forwardedIds,
        error: error.message,
        stack: error.stack
      });

      // Check for flood wait
      if (error.errorMessage?.includes('FLOOD_WAIT')) {
        const seconds = parseInt(error.errorMessage.match(/(\d+)/)?.[1] || '60');
        error.isFloodWait = true;
        error.seconds = seconds;
      }

      throw error;
    }
  }
}

export default ChannelEventHandlers;
