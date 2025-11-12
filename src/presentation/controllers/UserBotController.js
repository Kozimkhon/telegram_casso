/**
 * @fileoverview UserBot Controller
 * Presentation layer controller for UserBot functionality
 * Refactored from src/bots/userBot.js with Clean Architecture
 * @module presentation/controllers/UserBotController
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { Api } from "telegram/tl/index.js";

import { config } from "../../config/index.js";
import { createChildLogger } from "../../shared/logger.js";
import { handleTelegramError, AuthenticationError } from "../../shared/errorHandler.js";
import { extractChannelInfo, extractUserInfo } from "../../shared/helpers.js";
import ChannelEventHandlers from "../handlers/channelEventHandlers.js";

/**
 * UserBot Controller
 * Handles Telegram user account automation with Clean Architecture
 * 
 * @class UserBotController
 */
class UserBotController {
  /**
   * Telegram client
   * @private
   */
  #client = null;

  /**
   * Use cases (injected)
   * @private
   */
  #useCases;

  /**
   * Domain services (injected)
   * @private
   */
  #services;

  /**
   * State manager (injected)
   * @private
   */
  #stateManager;

  /**
   * Logger
   * @private
   */
  #logger;

  /**
   * Session data
   * @private
   */
  #sessionData;

  /**
   * Running state
   * @private
   */
  #isRunning = false;

  /**
   * Paused state
   * @private
   */
  #isPaused = false;

  /**
   * Connected channels
   * @private
   */
  #connectedChannels = new Map();

  /**
   * Admin channel entities for filtering
   * @private
   */
  #adminChannelEntities = [];

  /**
   * Sync interval timer
   * @private
   */
  #syncInterval = null;

  /**
   * Delete interval timer
   * @private
   */
  #deleteInterval = null;

  /**
   * Channel event handlers instance
   * @private
   */
  #channelEventHandlers = null;

  /**
   * Creates UserBot controller
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} sessionData - Session data (adminId, sessionString)
   */
  constructor(dependencies, sessionData = null) {
    // Inject use cases
    this.#useCases = {
      createSession: dependencies.createSessionUseCase,
      addChannel: dependencies.addChannelUseCase,
      bulkAddUsers: dependencies.bulkAddUsersUseCase,
      addUserToChannel: dependencies.addUserToChannelUseCase,
      getUsersByChannel: dependencies.getUsersByChannelUseCase,
      logMessage: dependencies.logMessageUseCase,
      markMessageAsDeleted: dependencies.markMessageAsDeletedUseCase,
      findOldMessages: dependencies.findOldMessagesUseCase,
    };

    // Inject domain services
    this.#services = {
      forwarding: dependencies.forwardingService,
      queue: dependencies.queueService,
      throttle: dependencies.throttleService,
    };

    // Inject state manager
    this.#stateManager = dependencies.stateManager;

    // Inject repositories (for direct queries)
    this.channelRepository = dependencies.channelRepository;
    this.sessionRepository = dependencies.sessionRepository;
    this.messageRepository = dependencies.messageRepository;

    // Session data - use adminId instead of phone
    this.#sessionData = {
      adminId: sessionData?.adminId || sessionData?.admin_id || null,
      sessionString: sessionData?.session_string || null,
      userId: sessionData?.user_id || null,
    };

    // Logger
    this.#logger = createChildLogger({ 
      component: 'UserBotController',
      adminId: this.#sessionData.adminId 
    });
  }

  /**
   * Starts UserBot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.#logger.info('Starting UserBot...', { adminId: this.#sessionData.adminId });

      // Load session
      const session = this.#loadSession();

      // Create Telegram client
      this.#client = new TelegramClient(
        session,
        config.telegram.apiId,
        config.telegram.apiHash,
        {
          connectionRetries: 5,
          timeout: 30000,
          requestRetries: 3,
        }
      );

      // Connect and authenticate
      await this.#connect();

      // Update session activity
      if (this.#sessionData.adminId) {
        await this.sessionRepository.updateActivity(this.#sessionData.adminId);
      }

      // Sync channels
      await this.#syncChannels();

      // Setup event handlers
      await this.#setupEventHandlers();

      // Start periodic tasks
      this.#startPeriodicTasks();

      // Register bot instance in StateManager
      if (this.#stateManager && this.#sessionData.adminId) {
        this.#stateManager.registerBot(this.#sessionData.adminId, this);
        this.#logger.info('Bot instance registered in StateManager', { adminId: this.#sessionData.adminId });
      }

      this.#isRunning = true;
      this.#logger.info('UserBot started successfully');

    } catch (error) {
      this.#logger.error('Failed to start UserBot', error);
      
      // If AUTH error, mark session as invalid
      if (error.code === 401 || error.message?.includes('AUTH_KEY_UNREGISTERED')) {
        this.#logger.error('Authentication error detected - session needs re-authentication');
        try {
          const session = await this.sessionRepository.findByAdminId(this.#sessionData.adminId);
          if (session) {
            await this.sessionRepository.update(session.id, {
              status: 'error',
              last_error: 'Authentication failed: Session key invalid. Delete and recreate session.',
              auto_paused: true
            });
          }
        } catch (dbError) {
          this.#logger.error('Failed to update session after auth error', dbError);
        }
      }
      
      throw handleTelegramError(error, 'UserBot initialization');
    }
  }

  /**
   * Stops UserBot
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.#logger.info('Stopping UserBot...');

      // Clear intervals
      if (this.#syncInterval) clearInterval(this.#syncInterval);
      if (this.#deleteInterval) clearInterval(this.#deleteInterval);

      // Unregister bot instance from StateManager
      if (this.#stateManager && this.#sessionData.adminId) {
        this.#stateManager.unregisterBot(this.#sessionData.adminId);
        this.#logger.info('Bot instance unregistered from StateManager', { adminId: this.#sessionData.adminId });
      }

      // Disconnect client
      if (this.#client) {
        await this.#client.disconnect();
      }

      this.#isRunning = false;
      this.#logger.info('UserBot stopped');

    } catch (error) {
      this.#logger.error('Error stopping UserBot', error);
    }
  }

  /**
   * Loads session from database
   * @private
   * @returns {StringSession}
   */
  #loadSession() {
    if (this.#sessionData.sessionString) {
      this.#logger.info('Loading session from database');
      return new StringSession(this.#sessionData.sessionString.trim());
    }

    this.#logger.info('Creating new session');
    return new StringSession('');
  }

  /**
   * Saves session to database
   * @private
   * @returns {Promise<void>}
   */
  async #saveSession() {
    try {
      if (this.#client && this.#sessionData.adminId) {
        const sessionString = this.#client.session.save();

        // Check if session exists, update instead of create to avoid UNIQUE constraint error
        const existingSession = await this.sessionRepository.findByAdminId(this.#sessionData.adminId);
        
        if (existingSession) {
          // Update existing session
          await this.sessionRepository.update(existingSession.id, {
            session_string: sessionString,
            status: 'active',
            last_active: new Date(),
          });
          this.#logger.debug('Session updated in database');
        } else {
          // Create new session
          await this.#useCases.createSession.execute({
            adminId: this.#sessionData.adminId,
            sessionString: sessionString,
            status: 'active',
          });
          this.#logger.debug('Session created in database');
        }
      }
    } catch (error) {
      this.#logger.error('Failed to save session', error);
    }
  }

  /**
   * Connects to Telegram
   * @private
   * @returns {Promise<void>}
   */
  async #connect() {
    try {
      this.#logger.info('Connecting to Telegram...');

      await this.#client.start({
        phoneNumber: async () => {
          // Get phone from admin record
          // For now, we'll rely on stored session
          throw new AuthenticationError(
            'Session authentication required. Please re-authenticate via AdminBot.'
          );
        },
        password: async () => {
          throw new AuthenticationError(
            'Session requires 2FA authentication. Please authenticate via AdminBot.'
          );
        },
        phoneCode: async () => {
          throw new AuthenticationError(
            'Session requires phone verification. Please authenticate via AdminBot.'
          );
        },
        onError: (err) => {
          this.#logger.error('Authentication error', err);
          throw new AuthenticationError(`Authentication failed: ${err.message}`);
        },
      });

      // Get user info with error handling
      try {
        const me = await this.#client.getMe();
        this.#sessionData.userId = me.id?.toString();

        // Save session
        await this.#saveSession();

        this.#logger.info('Connected to Telegram', {
          userId: this.#sessionData.userId,
          adminId: this.#sessionData.adminId,
        });
      } catch (authError) {
        // Handle AUTH_KEY_UNREGISTERED error
        if (authError.errorMessage === 'AUTH_KEY_UNREGISTERED' || authError.code === 401) {
          this.#logger.error('Session authentication failed - session is invalid or expired', {
            adminId: this.#sessionData.adminId,
            error: authError.message
          });
          
          // Mark session as invalid in database
          try {
            const session = await this.sessionRepository.findByAdminId(this.#sessionData.adminId);
            if (session) {
              await this.sessionRepository.update(session.id, {
                status: 'error',
                last_error: 'AUTH_KEY_UNREGISTERED: Session expired or revoked. Re-authentication required.',
                auto_paused: true
              });
              this.#logger.info('Session marked as error and paused', { adminId: this.#sessionData.adminId });
            }
          } catch (dbError) {
            this.#logger.error('Failed to update session status', dbError);
          }
          
          throw new AuthenticationError(
            'Session authentication failed. The session key is no longer valid. ' +
            'Please delete this session and create a new one through the AdminBot.'
          );
        }
        throw authError;
      }

    } catch (error) {
      // Update session with error info
      try {
        const session = await this.sessionRepository.findByAdminId(this.#sessionData.adminId);
        if (session) {
          await this.sessionRepository.update(session.id, {
            status: 'error',
            last_error: error.message,
            auto_paused: true
          });
        }
      } catch (dbError) {
        this.#logger.error('Failed to update session error status', dbError);
      }
      
      throw handleTelegramError(error, 'Telegram connection');
    }
  }

  /**
  /**
   * Syncs channels from database
   * @private
   * @returns {Promise<void>}
   */
  async #syncChannels() {
    try {
      this.#logger.info('Syncing channels...');

      // Clear previous channel data
      this.#adminChannelEntities = [];
      this.#connectedChannels.clear();

      // Get channels from database - Session linked to admin via adminId
      // Channels should be linked to session via admin's phone (from Admin entity)
      // For now, get all channels - can be filtered by admin later
      const channels = await this.channelRepository.findByAdminSession(this.#sessionData.adminId);
      if(!channels || channels.length === 0){
        this.#logger.warn('No channels found', { adminId: this.#sessionData.adminId });
        return;
      }
      this.#logger.info(`Found ${channels?.length} channels to monitor`);

      // Process each channel
      for (const channel of channels) {
        try {
          await this.#syncChannelMembers(channel);
        } catch (error) {
          this.#logger.error(`Failed to sync channel ${channel.channelId}`, error);
        }
      }

      this.#logger.info('Channel sync complete');

    } catch (error) {
      this.#logger.error('Failed to sync channels', error);
    }
  }
  /**
   * Syncs channel members
   * @private
   * @param {Channel} channel - Channel entity
   * @returns {Promise<void>}
   */
  async #syncChannelMembers(channel) {
    try {
      // Get channel entity from Telegram
      // Channel ID format: "-1001234567890"
      // Remove "-100" prefix to get actual channel ID for API calls
      const channelIdStr = channel.channelId.toString();
      const actualChannelId = channelIdStr.startsWith('-100') 
        ? channelIdStr.slice(4) // Remove "-100" prefix
        : channelIdStr;
      
      // Use access hash if available for better reliability
      let channelEntity;
      if (channel.accessHash) {
        // Create InputPeerChannel with access hash
        channelEntity = new Api.InputPeerChannel({
          channelId: BigInt(actualChannelId),
          accessHash: BigInt(channel.accessHash)
        });
        // Get full entity
        channelEntity = await this.#client.getEntity(channelEntity);
      } else {
        // Fallback: get entity by ID only
        channelEntity = await this.#client.getEntity(BigInt(actualChannelId));
      }
      
      // Store for event filtering
      this.#adminChannelEntities.push(channelEntity);
      this.#connectedChannels.set(channel.channelId, {
        entity: channelEntity,
        title: channel.title,
        forwardEnabled: channel.forwardEnabled,
      });

      // Get channel participants
      const participants = await this.#client.getParticipants(channelEntity, {
        limit: 10000,
      });

      this.#logger.info(`Found ${participants.length} members in ${channel.title}`);

      // Extract user data
      const usersData = participants
        .filter(p => p.id && !p.bot)
        .map(p => extractUserInfo(p));

      // Bulk add users
      if (usersData.length > 0) {
        const result = await this.#useCases.bulkAddUsers.execute(usersData);
        this.#logger.info(`Added ${result.added} users to database`);

        // Link users to channel
        const userIds = usersData.map(u => u.userId);
        await this.#useCases.addUserToChannel.bulkExecute(
          channel.channelId,
          userIds
        );
      }

    } catch (error) {
      this.#logger.error(`Failed to sync members for ${channel.channelId}`, error);
      throw error;
    }
  }

  /**
   * Universal event handler - routes events to appropriate handlers based on class name
   * Only processes events from channels where admin has admin rights
   * @private
   * @param {Object} event - Telegram event object
   * @returns {Promise<void>}
   */
  async #handleTelegramEvent(event) {
    try {
      // Get event class name
      const eventClassName = event?.className || event?.constructor?.name;
      
      if (!eventClassName) {
        this.#logger.debug('Event without className', { event: typeof event });
        return;
      }

      // Extract channel ID from event (different events have different structures)
      let channelId = null;
      
      if (event.message?.peerId?.channelId) {
        // UpdateNewChannelMessage, UpdateEditChannelMessage
        channelId = `-100${event.message.peerId.channelId.toString()}`;
      } else if (event.channelId) {
        // UpdateDeleteChannelMessages, UpdateChannel, etc.
        channelId = `-100${event.channelId.toString()}`;
      }

      // If we have a channel ID, check if it's an admin channel
      if (channelId) {
        // Check in memory first (no DB call)
        const isAdminChannel = this.#connectedChannels.has(channelId);
        
        var chanel_entity=event?._entities?.valueOf(channelId);
        if (!isAdminChannel) {
          // Channel not in our list - check if it's a new admin channel
          if(!chanel_entity||!chanel_entity?.adminRights){
            return;
          }
          try {
            // Get channel entity from Telegram
            const channelIdNum = channelId.startsWith('-100') ? channelId.slice(4) : channelId;
            const inputChanel=Api.InputChannel({
              channelId: BigInt(channelIdNum),
              accessHash: BigInt(channelEntity.accessHash),
            });
            const channelEntity = await this.#client.getEntity(inputChanel);
            
            // Check if we have admin rights
            if (channelEntity.adminRights || channelEntity.creator) {
              this.#logger.info('New admin channel detected', {
                channelId,
                title: channelEntity.title,
                isCreator: !!channelEntity.creator,
              });

              // Extract channel info
              const channelInfo = extractChannelInfo(channelEntity);
              
              // Add to database
              await this.#useCases.addChannel.execute({
                ...channelInfo,
                adminId: this.#sessionData.adminId,
                memberCount: channelEntity.participantsCount || 0,
                forwardEnabled: false, // Disabled by default for new channels
              });

              // Add to connected channels
              this.#connectedChannels.set(channelId, {
                entity: channelEntity,
                title: channelEntity.title,
                forwardEnabled: false,
              });

              this.#logger.info('New admin channel added to monitoring', { channelId });
              
              // Now process the event
              // Continue to handler below
            } else {
              // Not an admin channel - skip silently
              return;
            }
          } catch (error) {
            // Error getting channel entity - skip this event
            this.#logger.debug('Could not verify channel', {
              channelId,
              error: error.message,
            });
            return;
          }
        }
      }else{
        return;
      }
      
      // Map event class names to handler methods
      const handlerMap = {
        'UpdateNewChannelMessage': 'handleNewChannelMessage',
        'UpdateEditChannelMessage': 'handleEditChannelMessage',
        'UpdateDeleteChannelMessages': 'handleDeleteChannelMessages',
        'UpdateChannel': 'handleChannelUpdate',
        'UpdateChannelMessageViews': 'handleChannelMessageViews',
        'UpdateChannelTooLong': 'handleChannelTooLong',
        'UpdateChannelParticipant': 'handleChannelParticipant',
        'UpdateChannelUserTyping': 'handleChannelUserTyping',
        'UpdateChannelMessageForwards': 'handleChannelMessageForwards',
        'UpdateChannelAvailableMessages': 'handleChannelAvailableMessages',
        'UpdateChannelReadMessagesContents': 'handleChannelReadMessagesContents',
        'UpdateReadChannelInbox': 'handleReadChannelInbox',
        'UpdateReadChannelOutbox': 'handleReadChannelOutbox',
      };

      // Get handler method name
      const handlerMethodName = handlerMap[eventClassName];

      if (handlerMethodName && this.#channelEventHandlers[handlerMethodName]) {
        // Call the appropriate handler
        await this.#channelEventHandlers[handlerMethodName](event);
      } else {
        // Log unhandled event types (only once per type for debugging)
        if (!this._loggedEventTypes) this._loggedEventTypes = new Set();
        if (!this._loggedEventTypes.has(eventClassName)) {
          this.#logger.debug('Unhandled event type', { eventClassName });
          this._loggedEventTypes.add(eventClassName);
        }
      }

    } catch (error) {
      this.#logger.error('Error handling Telegram event', {
        error: error.message,
        eventType: event?.className || 'unknown'
      });
    }
  }

  /**
   * Sets up event handlers
   * @private
   * @returns {Promise<void>}
   */
  async #setupEventHandlers() {
    try {
      // Only setup handlers if we have channels to monitor
      if (this.#adminChannelEntities.length === 0) {
        this.#logger.warn('No channels to monitor, skipping event handlers setup');
        return;
      }

      // Initialize channel event handlers with dependencies
      this.#channelEventHandlers = new ChannelEventHandlers({
        useCases: this.#useCases,
        services: this.#services,
        connectedChannels: this.#connectedChannels,
        sessionData: this.#sessionData,
        client: this.#client,
      });

      // Register a single universal event handler for all Telegram updates
      // This avoids issues with non-constructor Update types
      this.#client.addEventHandler(
        async (event) => await this.#handleTelegramEvent(event)
      );

      this.#logger.info(`Universal event handler set up for ${this.#adminChannelEntities.length} channels`);

    } catch (error) {
      this.#logger.error('Failed to setup event handlers', error);
    }
  }

  /**
   * Starts periodic tasks
   * @private
   */
  #startPeriodicTasks() {
    // Delete old messages every hour
    this.#deleteInterval = setInterval(
      async () => await this.#deleteOldMessages(),
      60 * 60 * 1000
    );

    this.#logger.info('Periodic tasks started');
  }

  /**
   * Deletes old forwarded messages
   * Handles both single and grouped messages (albums)
   * @private
   * @returns {Promise<void>}
   */
  async #deleteOldMessages() {
    try {
      const hoursOld = 24; // Delete messages older than 24 hours
      
      this.#logger.info('Starting old message deletion process...');

      // 1. Find old single messages
      const singleMessages = await this.#useCases.findOldMessages.execute(hoursOld);
      
      // 2. Find old grouped messages (albums)
      const groupedMessages = await this.messageRepository.findOldGroupedMessages(hoursOld / 24);

      const singleCount = singleMessages?.messages?.length || 0;
      const groupedCount = groupedMessages?.size || 0;
      
      this.#logger.info(`Found messages to delete`, {
        singleMessages: singleCount,
        groupedMessageGroups: groupedCount,
      });

      // Process single messages
      let deletedSingle = 0;
      let failedSingle = 0;

      if (singleMessages?.messages && singleMessages.messages.length > 0) {
        for (const msg of singleMessages.messages) {
          try {
            // Skip if it's a grouped message (will be handled separately)
            if (msg.isGrouped && msg.groupedId) {
              continue;
            }

            const userEntity = await this.#client.getEntity(BigInt(msg.userId));
            
            await this.#client.deleteMessages(userEntity, [msg.forwardedMessageId], {
              revoke: true,
            });

            await this.#useCases.markMessageAsDeleted.execute(
              msg.userId,
              msg.forwardedMessageId
            );

            deletedSingle++;

          } catch (error) {
            failedSingle++;
            this.#logger.debug('Failed to delete single message', {
              messageId: msg.forwardedMessageId,
              userId: msg.userId,
              error: error.message,
            });
          }
        }
      }

      // Process grouped messages (albums)
      let deletedGrouped = 0;
      let failedGrouped = 0;

      if (groupedMessages && groupedMessages.size > 0) {
        for (const [key, messages] of groupedMessages.entries()) {
          try {
            if (!messages || messages.length === 0) continue;

            const [userId, groupedId] = key.split(':');
            const userEntity = await this.#client.getEntity(BigInt(userId));

            // Extract all forwarded message IDs from the group
            const forwardedMessageIds = messages
              .map(m => m.forwardedMessageId)
              .filter(Boolean);

            if (forwardedMessageIds.length === 0) continue;

            // Delete all messages in the group together
            await this.#client.deleteMessages(userEntity, forwardedMessageIds, {
              revoke: true,
            });

            // Mark all messages as deleted in database
            for (const msg of messages) {
              if (msg.forwardedMessageId) {
                await this.#useCases.markMessageAsDeleted.execute(
                  msg.userId,
                  msg.forwardedMessageId
                );
              }
            }

            deletedGrouped += messages.length;

            this.#logger.debug('Deleted grouped messages', {
              groupedId,
              userId,
              count: messages.length,
              messageIds: forwardedMessageIds,
            });

          } catch (error) {
            failedGrouped += messages.length;
            this.#logger.debug('Failed to delete grouped messages', {
              key,
              count: messages.length,
              error: error.message,
            });
          }
        }
      }

      this.#logger.info('Old message deletion complete', {
        single: {
          deleted: deletedSingle,
          failed: failedSingle,
        },
        grouped: {
          deleted: deletedGrouped,
          failed: failedGrouped,
        },
        total: {
          deleted: deletedSingle + deletedGrouped,
          failed: failedSingle + failedGrouped,
        },
      });

    } catch (error) {
      this.#logger.error('Error deleting old messages', error);
    }
  }

  /**
   * Gets status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      isRunning: this.#isRunning,
      isPaused: this.#isPaused,
      adminId: this.#sessionData.adminId,
      connectedChannels: this.#connectedChannels.size,
    };
  }

  /**
   * Gets Telegram client instance
   * @returns {TelegramClient|null} Client instance or null
   */
  getClient() {
    return this.#client;
  }

  /**
   * Manually syncs channels from Telegram
   * @returns {Promise<Object>} Sync result
   */
  async syncChannelsManually() {
    try {
      if (!this.#client || !this.#isRunning) {
        return {
          success: false,
          message: 'UserBot is not connected',
        };
      }

      this.#logger.info('Manual channel sync started');

      const dialogs = [];
  for await (const dialog of this.#client.iterDialogs()) {
    if (dialog.isChannel&&dialog?.entity?.adminRights) {
      dialogs.push(dialog);
    }
  }
      
      let addedCount = 0;
      let updatedCount = 0;
      
      for (const dialog of dialogs) {
        try {
          // Only process channels
          if (!dialog.isChannel) continue;

          const entity = dialog.entity;
          const channelInfo = extractChannelInfo(entity);
          
          // Check if channel exists
          const existing = await this.channelRepository.findByChannelId(channelInfo.channelId);
          
          if (existing) {
            // Update existing channel
            await this.channelRepository.update(existing.id, {
              title: channelInfo.title,
              username: channelInfo.username,
              access_hash: channelInfo.accessHash,
              member_count: entity.participantsCount || 0,
            });
            updatedCount++;
          } else {
            // Add new channel using use case
            await this.#useCases.addChannel.execute({
              ...channelInfo,
              adminId: this.#sessionData.adminId,
              memberCount: entity.participantsCount || 0,
              forwardEnabled: true, // Disabled by default
            });
            addedCount++;
          }
          
        } catch (error) {
          this.#logger.error(`Failed to sync channel: ${dialog.title}`, error);
        }
      }

      this.#logger.info(`Channel sync complete: ${addedCount} added, ${updatedCount} updated`);

      return {
        success: true,
        message: `Synced successfully: ${addedCount} new channels added, ${updatedCount} updated`,
        added: addedCount,
        updated: updatedCount,
      };

    } catch (error) {
      this.#logger.error('Manual channel sync failed', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Pauses message forwarding
   * @param {string} reason - Pause reason
   */
  pause(reason = 'Manual pause') {
    this.#isPaused = true;
    this.#logger.info('UserBot paused', { reason });
  }

  /**
   * Resumes message forwarding
   */
  resume() {
    this.#isPaused = false;
    this.#logger.info('UserBot resumed');
  }
}

export default UserBotController;
