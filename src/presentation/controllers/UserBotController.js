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
   * Creates UserBot controller
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} sessionData - Session data
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

    // Session data
    this.#sessionData = {
      phone: sessionData?.phone || null,
      sessionString: sessionData?.session_string || null,
      userId: sessionData?.user_id || null,
    };

    // Logger
    this.#logger = createChildLogger({ 
      component: 'UserBotController',
      phone: this.#sessionData.phone 
    });
  }

  /**
   * Starts UserBot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.#logger.info('Starting UserBot...', { phone: this.#sessionData.phone });

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
      if (this.#sessionData.phone) {
        await this.sessionRepository.updateActivity(this.#sessionData.phone);
      }

      // Sync channels
      await this.#syncChannels();

      // Setup event handlers
      await this.#setupEventHandlers();

      // Start periodic tasks
      this.#startPeriodicTasks();

      this.#isRunning = true;
      this.#logger.info('UserBot started successfully');

    } catch (error) {
      this.#logger.error('Failed to start UserBot', error);
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
      if (this.#client && this.#sessionData.phone) {
        const sessionString = this.#client.session.save();

        await this.#useCases.createSession.execute({
          phone: this.#sessionData.phone,
          sessionString: sessionString,
          status: 'active',
        });

        this.#logger.debug('Session saved to database');
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
          if (this.#sessionData.phone) {
            return this.#sessionData.phone;
          }
          throw new AuthenticationError(
            'No phone number available. Please authenticate via AdminBot.'
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

      // Get user info
      const me = await this.#client.getMe();
      this.#sessionData.userId = me.id?.toString();

      // Save session
      await this.#saveSession();

      this.#logger.info('Connected to Telegram', {
        userId: this.#sessionData.userId,
        phone: this.#sessionData.phone,
      });

    } catch (error) {
      throw handleTelegramError(error, 'Telegram connection');
    }
  }

  /**
   * Syncs channels from database
   * @private
   * @returns {Promise<void>}
   */
  async #syncChannels() {
    try {
      this.#logger.info('Syncing channels...');

      // Get channels from database
      const channels = await this.channelRepository.findByAdminSession(
        this.#sessionData.phone
      );

      this.#logger.info(`Found ${channels.length} channels to monitor`);

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
      const channelEntity = await this.#client.getEntity(channel.channelId);
      
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
   * Sets up event handlers
   * @private
   * @returns {Promise<void>}
   */
  async #setupEventHandlers() {
    try {
      // Listen for new messages in admin channels
      this.#client.addEventHandler(
        async (event) => await this.#handleNewMessage(event),
        new NewMessage({ chats: this.#adminChannelEntities })
      );

      // Listen for message deletions
      this.#client.addEventHandler(
        async (event) => await this.#handleMessageDeleted(event)
      );

      this.#logger.info('Event handlers set up');

    } catch (error) {
      this.#logger.error('Failed to setup event handlers', error);
    }
  }

  /**
   * Handles new message event
   * @private
   * @param {Object} event - Telegram event
   * @returns {Promise<void>}
   */
  async #handleNewMessage(event) {
    try {
      const message = event.message;
      const channelId = message.peerId?.channelId?.toString();

      if (!channelId) return;

      // Check if channel forwarding is enabled
      const channelInfo = this.#connectedChannels.get(`-100${channelId}`);
      if (!channelInfo || !channelInfo.forwardEnabled) {
        return;
      }

      this.#logger.info('New message received', {
        channelId: `-100${channelId}`,
        messageId: message.id,
      });

      // Forward to channel users using ForwardingService
      await this.#services.forwarding.forwardToChannelUsers(
        `-100${channelId}`,
        message,
        async (userId, msg) => await this.#forwardMessageToUser(userId, msg)
      );

    } catch (error) {
      this.#logger.error('Error handling new message', error);
    }
  }

  /**
   * Forwards message to single user
   * @private
   * @param {string} userId - User ID
   * @param {Object} message - Message to forward
   * @returns {Promise<Object>} Forward result
   */
  async #forwardMessageToUser(userId, message) {
    try {
      const userEntity = await this.#client.getEntity(parseInt(userId));
      
      const result = await this.#client.forwardMessages(userEntity, {
        messages: [message.id],
        fromPeer: message.peerId,
      });

      return {
        id: result[0]?.id,
        sessionPhone: this.#sessionData.phone,
      };

    } catch (error) {
      // Check for flood wait
      if (error.errorMessage?.includes('FLOOD_WAIT')) {
        const seconds = parseInt(error.errorMessage.match(/(\d+)/)?.[1] || '60');
        error.isFloodWait = true;
        error.seconds = seconds;
        error.sessionPhone = this.#sessionData.phone;
      }
      throw error;
    }
  }

  /**
   * Handles message deleted event
   * @private
   * @param {Object} event - Telegram event
   * @returns {Promise<void>}
   */
  async #handleMessageDeleted(event) {
    try {
      const messages = event.deletedIds || [];
      
      for (const messageId of messages) {
        // Mark as deleted in database using use case
        // Note: Need to get userId from message logs
        this.#logger.debug('Message deleted', { messageId });
      }

    } catch (error) {
      this.#logger.error('Error handling message deletion', error);
    }
  }

  /**
   * Starts periodic tasks
   * @private
   */
  #startPeriodicTasks() {
    // Sync channels every 2 minutes
    this.#syncInterval = setInterval(
      async () => await this.#syncChannels(),
      2 * 60 * 1000
    );

    // Delete old messages every hour
    this.#deleteInterval = setInterval(
      async () => await this.#deleteOldMessages(),
      60 * 60 * 1000
    );

    this.#logger.info('Periodic tasks started');
  }

  /**
   * Deletes old forwarded messages
   * @private
   * @returns {Promise<void>}
   */
  async #deleteOldMessages() {
    try {
      const result = await this.#useCases.findOldMessages.execute(24);
      
      this.#logger.info(`Found ${result.total} old messages to delete`);

      for (const msg of result.messages) {
        try {
          const userEntity = await this.#client.getEntity(parseInt(msg.userId));
          await this.#client.deleteMessages(userEntity, [msg.forwardedMessageId], {
            revoke: true,
          });

          await this.#useCases.markMessageAsDeleted.execute(
            msg.userId,
            msg.forwardedMessageId
          );

        } catch (error) {
          this.#logger.debug('Failed to delete message', {
            messageId: msg.forwardedMessageId,
            error: error.message,
          });
        }
      }

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
      phone: this.#sessionData.phone,
      connectedChannels: this.#connectedChannels.size,
    };
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
