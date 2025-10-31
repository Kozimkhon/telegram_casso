/**
 * UserBot module - responsible for user account automation using GramJS
 * Handles authentication, channel monitoring, and message forwarding to channel members
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { Api } from 'telegram/tl/index.js';
import input from 'input';
import fs from 'fs/promises';
import path from 'path';

import { config } from '../config/index.js';
import { log, createChildLogger } from '../utils/logger.js';
import { 
  handleTelegramError, 
  AuthenticationError, 
  withRetry,
  asyncErrorHandler 
} from '../utils/errorHandler.js';
import { 
  extractChannelInfo, 
  extractUserInfo, 
  safeReadFile, 
  safeWriteFile,
  formatTimestamp,
  ensureDirectory
} from '../utils/helpers.js';
import { addChannel, getAllChannels } from '../services/channelService.js';
import { addUser, bulkAddUsers } from '../services/userService.js';
import { processMessageForwarding } from '../services/messageService.js';

class UserBot {
  constructor() {
    this.client = null;
    this.isRunning = false;
    this.logger = createChildLogger({ component: 'UserBot' });
    this.sessionPath = config.paths.sessionPath;
    this.connectedChannels = new Map();
  }

  /**
   * Initializes and starts the UserBot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.logger.info('Starting UserBot initialization...');

      // Ensure data directory exists
      await ensureDirectory(path.dirname(this.sessionPath));

      // Load or create session
      const session = await this.loadSession();
      
      // Create Telegram client
      this.client = new TelegramClient(
        session,
        config.telegram.apiId,
        config.telegram.apiHash,
        {
          connectionRetries: 5,
          timeout: 30000,
          requestRetries: 3
        }
      );

      // Set up event handlers before connecting
      this.setupEventHandlers();

      // Connect and authenticate
      await this.connect();
      
      // Sync channels and users
      await this.syncChannelsAndUsers();
      
      this.isRunning = true;
      this.logger.info('UserBot started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start UserBot', error);
      throw handleTelegramError(error, 'UserBot initialization');
    }
  }

  /**
   * Loads existing session or creates a new one
   * @returns {Promise<StringSession>} Telegram session
   */
  async loadSession() {
    try {
      const sessionData = await safeReadFile(this.sessionPath);
      
      if (sessionData) {
        this.logger.info('Loading existing session');
        return new StringSession(sessionData.trim());
      } else {
        this.logger.info('Creating new session');
        return new StringSession('');
      }
    } catch (error) {
      this.logger.warn('Error loading session, creating new one', { error: error.message });
      return new StringSession('');
    }
  }

  /**
   * Saves session to file
   * @returns {Promise<void>}
   */
  async saveSession() {
    try {
      if (this.client) {
        const sessionString = this.client.session.save();
        await safeWriteFile(this.sessionPath, sessionString);
        this.logger.debug('Session saved successfully');
      }
    } catch (error) {
      this.logger.error('Failed to save session', error);
    }
  }

  /**
   * Connects to Telegram and handles authentication
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      this.logger.info('Connecting to Telegram...');
      
      await this.client.start({
        phoneNumber: async () => {
          this.logger.info('Phone number required for authentication');
          const phone = await input.text('Enter your phone number (with country code): ');
          return phone || config.telegram.phoneNumber;
        },
        password: async () => {
          this.logger.info('2FA password required');
          return await input.password('Enter your 2FA password: ');
        },
        phoneCode: async () => {
          this.logger.info('Verification code required');
          return await input.text('Enter the verification code you received: ');
        },
        onError: (err) => {
          this.logger.error('Authentication error', err);
          throw new AuthenticationError(`Authentication failed: ${err.message}`);
        }
      });

      // Save session after successful authentication
      await this.saveSession();
      
      this.logger.info('Successfully connected to Telegram');
    } catch (error) {
      throw handleTelegramError(error, 'Telegram connection');
    }
  }

  /**
   * Sets up event handlers for message monitoring
   */
  setupEventHandlers() {
    this.logger.debug('Setting up event handlers');

    // Handle new messages in channels
    this.client.addEventHandler(
      asyncErrorHandler(this.handleNewMessage.bind(this), 'NewMessage handler'),
      new NewMessage({ incoming: true })
    );

    // Handle connection state changes
    this.client.addEventHandler(
      asyncErrorHandler(this.handleConnectionUpdate.bind(this), 'Connection handler'),
      'connected'
    );

    this.client.addEventHandler(
      asyncErrorHandler(this.handleDisconnection.bind(this), 'Disconnection handler'),
      'disconnected'
    );
  }

  /**
   * Handles new messages from monitored channels
   * @param {Object} event - New message event
   */
  async handleNewMessage(event) {
    try {
      const message = event.message;
      const chatId = message.peerId?.channelId?.toString() || 
                   message.peerId?.chatId?.toString() || 
                   message.peerId?.userId?.toString();

      if (!chatId) {
        this.logger.debug('Skipping message without valid chat ID');
        return;
      }

      this.logger.debug('New message received', {
        chatId,
        messageId: message.id,
        messageType: message.className,
        hasText: !!message.message
      });

      // Check if this is from a monitored channel
      const enabledChannels = await getAllChannels(true);
      const isMonitored = enabledChannels.some(channel => 
        channel.channel_id === chatId
      );

      if (!isMonitored) {
        this.logger.debug('Message from non-monitored channel, ignoring', { chatId });
        return;
      }

      // Process message forwarding
      const results = await processMessageForwarding(
        message,
        chatId,
        this.forwardMessageToUser.bind(this)
      );

      this.logger.info('Message forwarding completed', {
        chatId,
        messageId: message.id,
        ...results
      });

    } catch (error) {
      this.logger.error('Error handling new message', {
        error: error.message,
        messageId: event.message?.id
      });
    }
  }

  /**
   * Forwards a message to a specific user
   * @param {Object} message - Original message
   * @param {string} userId - Target user ID
   * @returns {Promise<Object>} Forward result
   */
  async forwardMessageToUser(message, userId) {
    try {
      this.logger.debug('Forwarding message to user', {
        userId,
        messageId: message.id,
        hasText: !!message.message
      });

      // Send message to user
      const result = await this.client.sendMessage(userId, {
        message: message.message || '',
        file: message.media || undefined,
        replyMarkup: message.replyMarkup || undefined,
        parseMode: 'html'
      });

      this.logger.debug('Message forwarded successfully', {
        userId,
        messageId: message.id,
        sentMessageId: result.id
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to forward message to user', {
        userId,
        messageId: message.id,
        error: error.message
      });
      throw handleTelegramError(error, `Forward message to user ${userId}`);
    }
  }

  /**
   * Handles connection updates
   */
  async handleConnectionUpdate() {
    this.logger.info('UserBot connected to Telegram');
  }

  /**
   * Handles disconnection
   */
  async handleDisconnection() {
    this.logger.warn('UserBot disconnected from Telegram');
    this.isRunning = false;
  }

  /**
   * Syncs channels and users with the database
   * @returns {Promise<void>}
   */
  async syncChannelsAndUsers() {
    try {
      this.logger.info('Starting channels and users synchronization...');

      await withRetry(
        async () => {
          // Get user's dialogs (chats, channels, groups)
          const dialogs = await this.client.getDialogs({ limit: 100 });
          
          this.logger.info(`Found ${dialogs.length} dialogs`);

          // Filter and sync channels
          await this.syncChannels(dialogs);
          
          // Sync users from enabled channels
          await this.syncUsersFromChannels();
          
          this.logger.info('Synchronization completed successfully');
        },
        {
          maxRetries: 3,
          delay: 2000,
          context: 'Sync channels and users'
        }
      );

    } catch (error) {
      this.logger.error('Failed to sync channels and users', error);
      throw error;
    }
  }

  /**
   * Syncs channels from dialogs to database
   * @param {Array} dialogs - Telegram dialogs
   */
  async syncChannels(dialogs) {
    try {
      const channels = dialogs.filter(dialog => 
        dialog.entity?.className === 'Channel' ||
        dialog.entity?.className === 'Chat'
      );

      this.logger.info(`Syncing ${channels.length} channels`);

      for (const dialog of channels) {
        try {
          const channelInfo = extractChannelInfo(dialog.entity);
          
          // Only sync channels/groups where the user is an admin or owner
          if (await this.isUserAdminInChannel(dialog.entity)) {
            await addChannel(channelInfo);
            this.connectedChannels.set(channelInfo.channelId, channelInfo);
            
            this.logger.debug('Channel synced', {
              channelId: channelInfo.channelId,
              title: channelInfo.title
            });
          } else {
            this.logger.debug('Skipping channel (not admin)', {
              channelId: channelInfo.channelId,
              title: channelInfo.title
            });
          }
        } catch (error) {
          this.logger.error('Failed to sync channel', {
            channelTitle: dialog.entity?.title || 'Unknown',
            error: error.message
          });
        }
      }

      this.logger.info(`Synced ${this.connectedChannels.size} channels where user is admin`);
    } catch (error) {
      this.logger.error('Error syncing channels', error);
      throw error;
    }
  }

  /**
   * Checks if the current user is an admin in the channel
   * @param {Object} channel - Channel entity
   * @returns {Promise<boolean>} True if user is admin
   */
  async isUserAdminInChannel(channel) {
    try {
      // For regular chats, assume admin rights
      if (channel.className === 'Chat') {
        return true;
      }

      // For channels, check admin rights
      const chatId = channel.id;
      const me = await this.client.getMe();
      
      const participant = await this.client.invoke(
        new Api.channels.GetParticipant({
          channel: chatId,
          participant: me.id
        })
      );

      const isAdmin = participant.participant?.className === 'ChannelParticipantAdmin' ||
                     participant.participant?.className === 'ChannelParticipantCreator';

      return isAdmin;
    } catch (error) {
      // If we can't check, assume no admin rights
      this.logger.debug('Could not verify admin status', {
        channelId: channel.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Syncs users from enabled channels
   */
  async syncUsersFromChannels() {
    try {
      const enabledChannels = await getAllChannels(true);
      this.logger.info(`Syncing users from ${enabledChannels.length} enabled channels`);

      for (const channel of enabledChannels) {
        try {
          await this.syncUsersFromChannel(channel.channel_id);
        } catch (error) {
          this.logger.error('Failed to sync users from channel', {
            channelId: channel.channel_id,
            channelTitle: channel.title,
            error: error.message
          });
        }
      }
    } catch (error) {
      this.logger.error('Error syncing users from channels', error);
    }
  }

  /**
   * Syncs users from a specific channel
   * @param {string} channelId - Channel ID
   */
  async syncUsersFromChannel(channelId) {
    try {
      this.logger.debug('Syncing users from channel', { channelId });

      const participants = await this.client.getParticipants(channelId, {
        limit: 1000
      });

      const usersData = participants
        .filter(participant => !participant.bot) // Exclude bots
        .map(participant => extractUserInfo(participant));

      if (usersData.length > 0) {
        const results = await bulkAddUsers(usersData);
        const successCount = results.filter(r => r.success).length;
        
        this.logger.info('Users synced from channel', {
          channelId,
          total: usersData.length,
          successful: successCount,
          failed: usersData.length - successCount
        });
      } else {
        this.logger.debug('No users to sync from channel', { channelId });
      }

    } catch (error) {
      // Don't throw here to avoid disrupting other channel syncing
      this.logger.error('Error syncing users from specific channel', {
        channelId,
        error: error.message
      });
    }
  }

  /**
   * Gets information about the authenticated user
   * @returns {Promise<Object>} User information
   */
  async getMe() {
    try {
      if (!this.client) {
        throw new Error('Client not initialized');
      }

      const me = await this.client.getMe();
      return extractUserInfo(me);
    } catch (error) {
      throw handleTelegramError(error, 'Get user info');
    }
  }

  /**
   * Gets the current status of the UserBot
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isConnected: this.client?.connected || false,
      connectedChannels: this.connectedChannels.size,
      lastStatusCheck: formatTimestamp()
    };
  }

  /**
   * Stops the UserBot gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.logger.info('Stopping UserBot...');
      
      this.isRunning = false;
      
      if (this.client) {
        await this.saveSession();
        await this.client.disconnect();
        this.logger.info('UserBot disconnected gracefully');
      }
      
      this.client = null;
      this.connectedChannels.clear();
      
    } catch (error) {
      this.logger.error('Error stopping UserBot', error);
      throw error;
    }
  }
}

export default UserBot;