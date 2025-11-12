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

      this.#logger.info('Channel message edited', {
        channelId: fullChannelId,
        messageId: message.id,
      });

      // TODO: Implement message edit forwarding logic
      // For now, we just log the event

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

      // Mark messages as deleted in database
      for (const messageId of messageIds) {
        try {
          // TODO: Implement mark as deleted logic via use case
          this.#logger.debug('Marking message as deleted', { messageId });
        } catch (err) {
          this.#logger.debug('Failed to mark message as deleted', { messageId, error: err.message });
        }
      }

    } catch (error) {
      this.#logger.error('Error handling channel message deletion', error);
    }
  }

  /**
   * Handles channel update event (title, bio, settings changes)
   * @param {Object} event - UpdateChannel event
   * @returns {Promise<void>}
   */
  async handleChannelUpdate(event) {
    try {
      const channelId = event.channelId?.toString();

      if (!channelId) return;

      const fullChannelId = `-100${channelId}`;

      this.#logger.info('Channel updated', {
        channelId: fullChannelId,
      });

      // Fetch updated channel info and sync
      const channelInfo = this.#connectedChannels.get(fullChannelId);
      if (channelInfo && channelInfo.entity) {
        try {
          const updatedEntity = await this.#client.getEntity(channelInfo.entity);
          
          // Update in database via repository
          // TODO: Implement channel update logic
          this.#logger.debug('Channel entity updated', {
            title: updatedEntity.title,
            username: updatedEntity.username,
          });

        } catch (err) {
          this.#logger.debug('Failed to fetch updated channel entity', err);
        }
      }

    } catch (error) {
      this.#logger.error('Error handling channel update', error);
    }
  }

  /**
   * Handles channel message views update
   * @param {Object} event - UpdateChannelMessageViews event
   * @returns {Promise<void>}
   */
  async handleChannelMessageViews(event) {
    try {
      const channelId = event.channelId?.toString();
      const messageId = event.id;
      const views = event.views;

      if (!channelId) return;

      this.#logger.debug('Channel message views updated', {
        channelId: `-100${channelId}`,
        messageId,
        views,
      });

      // Optional: Store view counts in metrics
      // TODO: Implement metrics use case

    } catch (error) {
      this.#logger.error('Error handling channel message views', error);
    }
  }

  /**
   * Handles channel too long event (message limit exceeded)
   * @param {Object} event - UpdateChannelTooLong event
   * @returns {Promise<void>}
   */
  async handleChannelTooLong(event) {
    try {
      const channelId = event.channelId?.toString();

      if (!channelId) return;

      this.#logger.warn('Channel message limit exceeded', {
        channelId: `-100${channelId}`,
      });

      // May need to resync channel messages
      // TODO: Implement resync logic

    } catch (error) {
      this.#logger.error('Error handling channel too long', error);
    }
  }

  /**
   * Handles channel pinned message update
   * @param {Object} event - UpdateChannelPinnedMessage event
   * @returns {Promise<void>}
   */
  async handleChannelPinnedMessage(event) {
    try {
      const channelId = event.channelId?.toString();
      const messageId = event.id;

      if (!channelId) return;

      this.#logger.info('Channel pinned message updated', {
        channelId: `-100${channelId}`,
        messageId,
      });

      // Optional: Forward pinned message announcement
      // TODO: Implement pinned message logic

    } catch (error) {
      this.#logger.error('Error handling channel pinned message', error);
    }
  }

  /**
   * Handles channel participant update (join/leave)
   * @param {Object} event - UpdateChannelParticipant event
   * @returns {Promise<void>}
   */
  async handleChannelParticipant(event) {
    try {
      const channelId = event.channelId?.toString();
      const userId = event.userId?.toString();

      if (!channelId || !userId) return;

      this.#logger.info('Channel participant updated', {
        channelId: `-100${channelId}`,
        userId,
      });

      // Update user-channel association in database
      // TODO: Implement participant sync logic

    } catch (error) {
      this.#logger.error('Error handling channel participant', error);
    }
  }

  /**
   * Handles channel user typing event
   * @param {Object} event - UpdateChannelUserTyping event
   * @returns {Promise<void>}
   */
  async handleChannelUserTyping(event) {
    try {
      // This event is typically not needed for forwarding bot
      // Can be used for analytics or monitoring
      this.#logger.debug('User typing in channel', {
        channelId: event.channelId?.toString(),
        userId: event.userId?.toString(),
      });

    } catch (error) {
      this.#logger.error('Error handling channel user typing', error);
    }
  }

  /**
   * Handles channel message forwards count update
   * @param {Object} event - UpdateChannelMessageForwards event
   * @returns {Promise<void>}
   */
  async handleChannelMessageForwards(event) {
    try {
      const channelId = event.channelId?.toString();
      const messageId = event.id;
      const forwards = event.forwards;

      if (!channelId) return;

      this.#logger.debug('Channel message forwards updated', {
        channelId: `-100${channelId}`,
        messageId,
        forwards,
      });

      // Optional: Store forward counts in metrics
      // TODO: Implement metrics use case

    } catch (error) {
      this.#logger.error('Error handling channel message forwards', error);
    }
  }

  /**
   * Handles channel available messages update
   * @param {Object} event - UpdateChannelAvailableMessages event
   * @returns {Promise<void>}
   */
  async handleChannelAvailableMessages(event) {
    try {
      const channelId = event.channelId?.toString();
      const availableMinId = event.availableMinId;

      if (!channelId) return;

      this.#logger.debug('Channel available messages updated', {
        channelId: `-100${channelId}`,
        availableMinId,
      });

      // May indicate old messages were deleted
      // TODO: Implement cleanup logic

    } catch (error) {
      this.#logger.error('Error handling channel available messages', error);
    }
  }

  /**
   * Handles read channel messages contents event
   * @param {Object} event - UpdateChannelReadMessagesContents event
   * @returns {Promise<void>}
   */
  async handleChannelReadMessagesContents(event) {
    try {
      const channelId = event.channelId?.toString();
      const messageIds = event.messages || [];

      if (!channelId) return;

      this.#logger.debug('Channel messages contents read', {
        channelId: `-100${channelId}`,
        count: messageIds.length,
      });

      // Optional: Track read status
      // TODO: Implement read tracking

    } catch (error) {
      this.#logger.error('Error handling channel read messages contents', error);
    }
  }

  /**
   * Handles read channel inbox event
   * @param {Object} event - UpdateReadChannelInbox event
   * @returns {Promise<void>}
   */
  async handleReadChannelInbox(event) {
    try {
      const channelId = event.channelId?.toString();
      const maxId = event.maxId;

      if (!channelId) return;

      this.#logger.debug('Channel inbox read', {
        channelId: `-100${channelId}`,
        maxId,
      });

      // Optional: Track read status
      // TODO: Implement read tracking

    } catch (error) {
      this.#logger.error('Error handling read channel inbox', error);
    }
  }

  /**
   * Handles read channel outbox event (your messages read)
   * @param {Object} event - UpdateReadChannelOutbox event
   * @returns {Promise<void>}
   */
  async handleReadChannelOutbox(event) {
    try {
      const channelId = event.channelId?.toString();
      const maxId = event.maxId;

      if (!channelId) return;

      this.#logger.debug('Channel outbox read', {
        channelId: `-100${channelId}`,
        maxId,
      });

      // Optional: Track delivery status
      // TODO: Implement delivery tracking

    } catch (error) {
      this.#logger.error('Error handling read channel outbox', error);
    }
  }

  /**
   * Handles channel participant add event (legacy)
   * @param {Object} event - UpdateChannelParticipantAdd event
   * @returns {Promise<void>}
   */
  async handleChannelParticipantAdd(event) {
    try {
      const channelId = event.channelId?.toString();
      const userId = event.userId?.toString();

      if (!channelId || !userId) return;

      this.#logger.info('User added to channel', {
        channelId: `-100${channelId}`,
        userId,
      });

      // Add user to channel members in database
      // TODO: Implement add member logic

    } catch (error) {
      this.#logger.error('Error handling channel participant add', error);
    }
  }

  /**
   * Handles channel participant delete event
   * @param {Object} event - UpdateChannelParticipantDelete event
   * @returns {Promise<void>}
   */
  async handleChannelParticipantDelete(event) {
    try {
      const channelId = event.channelId?.toString();
      const userId = event.userId?.toString();

      if (!channelId || !userId) return;

      this.#logger.info('User left channel', {
        channelId: `-100${channelId}`,
        userId,
      });

      // Remove user from channel members in database
      // TODO: Implement remove member logic

    } catch (error) {
      this.#logger.error('Error handling channel participant delete', error);
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

      const result = await this.#client.forwardMessages(userEntity, {
        messages: [message.id],
        fromPeer: message.peerId,
      });

      return {
        id: result[0]?.id,
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

      // Forward all messages in group together
      const result = await this.#client.forwardMessages(userEntity, {
        messages: messageIds,
        fromPeer: message.peerId,
      });

      return {
        id: result[0]?.id,
        count: result.length,
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
}

export default ChannelEventHandlers;
