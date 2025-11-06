/**
 * UserBot module - responsible for user account automation using GramJS
 * Handles authentication, channel monitoring, and message forwarding to channel members
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { Api } from 'telegram/tl/index.js';
import { utils } from 'telegram';
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
import { 
  addUser, 
  bulkAddUsers, 
  getUsersByChannel,
  bulkAddChannelMembers,
  clearChannelMembers 
} from '../services/userService.js';
import { 
  processMessageForwarding, 
  getOldForwardedMessages, 
  markMessageAsDeleted 
} from '../services/messageService.js';
import { saveSession as saveSessionToDB, updateSessionActivity } from '../services/sessionService.js';

class UserBot {
  constructor(sessionData = null) {
    this.client = null;
    this.isRunning = false;
    this.isPaused = false;
    this.pauseReason = null;
    this.logger = createChildLogger({ component: 'UserBot' });
    
    // Session data (for multi-userbot support)
    this.phone = sessionData?.phone || config.telegram.phoneNumber;
    this.sessionString = sessionData?.session_string || null;
    this.userId = sessionData?.user_id || null;
    
    // Default to config path for backwards compatibility
    this.sessionPath = sessionData ? null : config.paths.sessionPath;
    
    this.connectedChannels = new Map(); // channel_id -> channelInfo
    this.adminChannelEntities = []; // Store admin channel entities for event filtering
    this.syncInterval = null; // Timer for periodic sync
    this.syncIntervalMinutes = 2; // Sync every 2 minutes
    this.deleteInterval = null; // Timer for periodic message deletion
    this.deleteIntervalHours = 1; // Check for old messages every 1 hour
    this.messageAgeHours = 24; // Delete messages older than 24 hours
  }

  /**
   * Checks if this is running in multi-session mode
   * @returns {boolean} True if multi-session mode
   */
  isMultiSessionMode() {
    return this.phone && this.phone !== config.telegram.phoneNumber;
  }

  /**
   * Initializes and starts the UserBot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.logger.info('Starting UserBot initialization...', { phone: this.phone });

      // Ensure data directory exists (only for file-based sessions)
      if (this.sessionPath) {
        await ensureDirectory(path.dirname(this.sessionPath));
      }

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

      // Connect and authenticate FIRST
      await this.connect();
      
      // Update session activity in database
      if (this.phone) {
        await updateSessionActivity(this.phone).catch(err => 
          this.logger.debug('Failed to update session activity', { error: err.message })
        );
      }
      
      // Sync channels and users BEFORE setting up event handlers
      await this.syncChannelsAndUsers();
      
      // NOW set up event handlers with synced channels
      await this.setupEventHandlers();
      
      // Start periodic sync (every 30 minutes)
      this.startPeriodicSync();
      
      // Start periodic message deletion (every 1 hour)
      this.startPeriodicMessageDeletion();
      
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
      // If sessionString is provided from database, use it
      if (this.sessionString) {
        this.logger.info('Loading session from database', { phone: this.phone });
        return new StringSession(this.sessionString.trim());
      }
      
      // Otherwise, try to load from file (legacy support)
      if (this.sessionPath) {
        const sessionData = await safeReadFile(this.sessionPath);
        
        if (sessionData) {
          this.logger.info('Loading existing session from file');
          return new StringSession(sessionData.trim());
        }
      }
      
      this.logger.info('Creating new session', { phone: this.phone });
      return new StringSession('');
    } catch (error) {
      this.logger.warn('Error loading session, creating new one', { error: error.message });
      return new StringSession('');
    }
  }

  /**
   * Saves session to file or database
   * @returns {Promise<void>}
   */
  async saveSession() {
    try {
      if (this.client) {
        const sessionString = this.client.session.save();
        
        // If we have a phone (multi-userbot mode), save to database
        if (this.isMultiSessionMode()) {
          await saveSessionToDB({
            phone: this.phone,
            userId: this.userId,
            sessionString: sessionString,
            status: 'active'
          });
          this.logger.debug('Session saved to database', { phone: this.phone });
        } else if (this.sessionPath) {
          // Legacy mode: save to file
          await safeWriteFile(this.sessionPath, sessionString);
          this.logger.debug('Session saved to file');
        }
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
      this.logger.info('Connecting to Telegram...', { phone: this.phone });
      
      await this.client.start({
        phoneNumber: async () => {
          // Only return phone number, no console prompts
          if (this.isMultiSessionMode()) {
            return this.phone;
          }
          return config.telegram.phoneNumber;
        },
        password: async () => {
          // No console prompts - throw error if password is needed
          throw new AuthenticationError(
            'Session requires 2FA authentication. Please authenticate via AdminBot.'
          );
        },
        phoneCode: async () => {
          // No console prompts - throw error if code is needed
          throw new AuthenticationError(
            'Session requires phone verification. Please authenticate via AdminBot.'
          );
        },
        onError: (err) => {
          this.logger.error('Authentication error', err);
          throw new AuthenticationError(`Authentication failed: ${err.message}`);
        }
      });

      // Get and store user info
      const me = await this.client.getMe();
      this.userId = me.id?.toString();
      
      // Save session after successful authentication
      await this.saveSession();
      
      this.logger.info('Successfully connected to Telegram', { 
        phone: this.phone,
        userId: this.userId 
      });
    } catch (error) {
      throw handleTelegramError(error, 'Telegram connection');
    }
  }

  /**
   * Sets up event handlers for comprehensive channel monitoring
   */
  async setupEventHandlers() {
    this.logger.debug('Setting up comprehensive event handlers');

    // Store enabled channel IDs for filtering in handleNewMessage
    const enabledChannels = await getAllChannels(true);
    this.enabledChannelIds = new Set(enabledChannels.map(ch => ch.channel_id));
    
    console.log('🔧 Setting up listener for channels:', enabledChannels.map(c => c.title));
    console.log('🔧 Enabled channel IDs:', Array.from(this.enabledChannelIds));

    // Convert channel IDs to BigInt for GramJS chats parameter
    const chatIds = Array.from(this.enabledChannelIds).map(id => BigInt(id));
    
    // 1. New messages
    this.client.addEventHandler(
      asyncErrorHandler(this.handleNewMessage.bind(this), 'NewMessage handler'),
      new NewMessage({ 
        chats: chatIds
      })
    );

    // 2. Message edits
    this.client.addEventHandler(
      asyncErrorHandler(this.handleMessageEdit.bind(this), 'MessageEdit handler'),
      new NewMessage({
        chats: chatIds
      })
    );

    // 3. Message deletes (use Raw event for deletions)
    this.client.addEventHandler(
      asyncErrorHandler(this.handleChannelUpdate.bind(this), 'ChannelUpdate handler'),
      // Listen to all updates for admin channels
    );

    this.logger.info('Event handlers setup completed', {
      channelCount: enabledChannels.length,
      events: ['NewMessage', 'MessageEdit', 'ChannelUpdates', 'MemberChanges']
    });
  }

  /**
   * Handles message edits
   * @param {Object} event - Message edit event
   */
  async handleMessageEdit(event) {
    try {
      if (!event.message?.edit_date) {
        return; // Not an edit
      }

      const message = event.message;
      const chatId = this.extractChatId(message);

      if (!chatId || !this.enabledChannelIds.has(chatId)) {
        return;
      }

      this.logger.info('📝 Message edited', {
        channelId: chatId,
        messageId: message.id,
        sessionPhone: this.phone
      });

      // Process edited message (could forward update to members)
      // Implementation depends on requirements
    } catch (error) {
      this.logger.error('Error handling message edit', {
        error: error.message
      });
    }
  }

  /**
   * Handles various channel updates (deletes, pins, member changes, etc.)
   * @param {Object} event - Channel update event
   */
  async handleChannelUpdate(event) {
    try {
      const update = event;

      // Handle message deletions
      if (update.className === 'UpdateDeleteChannelMessages' || 
          update.className === 'UpdateDeleteMessages') {
        const channelId = update.channelId?.toString();
        const messages = update.messages || [];

        if (channelId && this.enabledChannelIds.has(channelId)) {
          this.logger.info('🗑️ Messages deleted', {
            channelId,
            count: messages.length,
            messageIds: messages,
            sessionPhone: this.phone
          });
        }
      }

      // Handle pinned messages
      if (update.className === 'UpdatePinnedChannelMessages' ||
          update.className === 'UpdatePinnedMessages') {
        const channelId = update.channelId?.toString();

        if (channelId && this.enabledChannelIds.has(channelId)) {
          this.logger.info('📌 Message pinned/unpinned', {
            channelId,
            pinned: update.pinned,
            sessionPhone: this.phone
          });
        }
      }

      // Handle channel participant updates (joins, leaves, bans)
      if (update.className === 'UpdateChannelParticipant') {
        const channelId = update.channelId?.toString();

        if (channelId && this.enabledChannelIds.has(channelId)) {
          this.logger.info('👥 Member update', {
            channelId,
            userId: update.userId?.toString(),
            prevParticipant: update.prevParticipant?.className,
            newParticipant: update.newParticipant?.className,
            sessionPhone: this.phone
          });
        }
      }

      // Handle channel info changes
      if (update.className === 'UpdateChannel') {
        const channelId = update.channelId?.toString();

        if (channelId && this.enabledChannelIds.has(channelId)) {
          this.logger.info('ℹ️ Channel info updated', {
            channelId,
            sessionPhone: this.phone
          });
        }
      }

      // Handle poll updates
      if (update.className === 'UpdateMessagePoll') {
        const pollId = update.pollId?.toString();

        this.logger.info('📊 Poll updated', {
          pollId,
          sessionPhone: this.phone
        });
      }

    } catch (error) {
      this.logger.error('Error handling channel update', {
        error: error.message
      });
    }
  }

  /**
   * Extracts chat ID from a message
   * @param {Object} message - Message object
   * @returns {string|null} Chat ID
   */
  extractChatId(message) {
    let chatId = null;
    
    if (message.chat?.id) {
      const rawChatId = message.chat.id;
      
      if (typeof rawChatId === 'bigint') {
        chatId = rawChatId.toString();
      } else if (rawChatId.value !== undefined) {
        chatId = rawChatId.value.toString();
      } else {
        chatId = rawChatId.toString();
      }
    } else if (message.peerId?.channelId) {
      const rawChannelId = message.peerId.channelId;
      
      let channelIdStr;
      if (typeof rawChannelId === 'bigint') {
        channelIdStr = rawChannelId.toString();
      } else if (rawChannelId.value !== undefined) {
        channelIdStr = rawChannelId.value.toString();
      } else {
        channelIdStr = rawChannelId.toString();
      }
      
      const channelIdNum = BigInt(channelIdStr);
      
      if (channelIdNum < 0n) {
        const actualId = channelIdNum * -1n - 1000000000000n;
        chatId = actualId.toString();
      } else {
        chatId = channelIdStr;
      }
    }

    return chatId;
  }

  /**
   * Handles new messages from monitored channels
   * @param {Object} event - New message event
   */
  async handleNewMessage(event) {
    try {
      const message = event.message;
      
      // DEBUG: Show channel title to identify which channel sent the message
      console.log('\n=== 📨 NEW MESSAGE ===');
      console.log('Channel title:', message.chat?.title || 'Unknown');
      console.log('message.chat.id:', message.chat?.id);
      
      // Use extracted method to get chat ID
      const chatId = this.extractChatId(message);
      
      console.log('🎯 FINAL chatId:', chatId);
      console.log('📋 Enabled channel IDs:', Array.from(this.enabledChannelIds || []));
      console.log('=== END DEBUG ===\n');

      if (!chatId) {
        this.logger.debug('Skipping message without valid chat ID');
        return;
      }

      // Check if this channel is enabled for forwarding
      if (!this.enabledChannelIds || !this.enabledChannelIds.has(chatId)) {
        console.log('❌ Message from non-enabled channel:', chatId);
        return;
      }

      console.log('✅ Message from enabled channel:', chatId);

      this.logger.debug('New message received', {
        chatId,
        messageId: message.id,
        messageType: message.className,
        hasText: !!message.message
      });

      // ✅ IMPORTANT: Check if user is admin in this channel (only forward from YOUR channels)
      const isAdmin = await this.isUserAdminInChannel(chatId);
      if (!isAdmin) {
        this.logger.debug('Not admin in this channel, ignoring', { chatId });
        console.log('❌ You are NOT admin in channel:', chatId);
        return;
      }
      
      console.log('✅ You are admin in channel:', chatId, '- proceeding with forwarding');

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
      // Filter only channels (not groups/chats)
      const channels = dialogs.filter(dialog => 
        dialog.entity?.className === 'Channel' && 
        !dialog.entity?.megagroup // Exclude megagroups (supergroups)
      );

      this.logger.info(`Syncing ${channels.length} channels (groups excluded)`);

      // Clear previous admin channel entities
      this.adminChannelEntities = [];

      for (const dialog of channels) {
        try {
          const channelInfo = extractChannelInfo(dialog.entity);
          
          // DEBUG: Log both ID formats
          console.log('\n🔍 SYNC DEBUG:');
          console.log('Channel title:', dialog.entity.title);
          console.log('dialog.entity.id:', dialog.entity.id);
          console.log('Extracted channelId:', channelInfo.channelId);
          
          // Only sync channels where the user is an admin or owner
          const isAdmin = await this.isUserAdminInChannel(dialog.entity);
          
          if (isAdmin) {
            // Link channel to this session
            await addChannel(channelInfo, this.phone);
            this.connectedChannels.set(channelInfo.channelId, channelInfo);
            
            // Store the channel entity for event filtering
            this.adminChannelEntities.push(dialog.entity);
            
            console.log('✅ Admin channel synced:', channelInfo.channelId, '-', channelInfo.title, '-> session:', this.phone);
            
            this.logger.debug('Channel synced and linked', {
              channelId: channelInfo.channelId,
              title: channelInfo.title,
              sessionPhone: this.phone
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

      this.logger.info(`Synced ${this.connectedChannels.size} channels (admin only) for session ${this.phone}`);
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
  async isUserAdminInChannel(channelInput) {
    try {
      let channelEntity;
      
      // If channelInput is a string (chatId), get the entity
      if (typeof channelInput === 'string') {
        // Get channel entity from chatId
        channelEntity = await this.client.getEntity(BigInt(channelInput));
      } else {
        // Already an entity object
        channelEntity = channelInput;
      }
      
      // For regular chats, assume admin rights
      if (channelEntity.className === 'Chat') {
        return true;
      }

      // For channels, check admin rights
      const me = await this.client.getMe();
      
      const participant = await this.client.invoke(
        new Api.channels.GetParticipant({
          channel: channelEntity,
          participant: me.id
        })
      );

      const isAdmin = participant.participant?.className === 'ChannelParticipantAdmin' ||
                     participant.participant?.className === 'ChannelParticipantCreator';

      return isAdmin;
    } catch (error) {
      // If we can't check, assume no admin rights
      this.logger.debug('Could not verify admin status', {
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
        // First add users to the general users table
        const userResults = await bulkAddUsers(usersData);
        const successfulUsers = userResults.filter(r => r.success);
        
        // Clear existing channel members for this channel (for clean sync)
        await clearChannelMembers(channelId);
        
        // Then add users as channel members
        const userIds = successfulUsers.map(r => r.userId || r.data?.user_id);
        const memberResults = await bulkAddChannelMembers(channelId, userIds);
        
        const successCount = memberResults.filter(r => r.success).length;
        
        this.logger.info('Users synced from channel', {
          channelId,
          total: usersData.length,
          usersAdded: successfulUsers.length,
          membersAdded: successCount,
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
   * Manually trigger channel synchronization (for AdminBot)
   * @returns {Promise<Object>} Sync results
   */
  async syncChannelsManually() {
    try {
      this.logger.info('Manual channel sync triggered');
      
      const dialogs = await this.client.getDialogs({ limit: 100 });
      await this.syncChannels(dialogs);
      
      return {
        success: true,
        channelsCount: this.connectedChannels.size,
        message: `Successfully synced ${this.connectedChannels.size} channels`
      };
    } catch (error) {
      this.logger.error('Manual sync failed', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to sync channels'
      };
    }
  }

  /**
   * Starts periodic synchronization of channels and users
   * Runs every 2 minutes to keep data up-to-date
   */
  startPeriodicSync() {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    const intervalMs = this.syncIntervalMinutes * 60 * 1000;
    
    this.syncInterval = setInterval(async () => {
      try {
        this.logger.info('🔄 Starting periodic sync...', {
          intervalMinutes: this.syncIntervalMinutes
        });
        
        // Re-sync channels and users
        await this.syncChannelsAndUsers();
        
        // Update event handlers with new channel list
        await this.setupEventHandlers();
        
        this.logger.info('✅ Periodic sync completed successfully');
      } catch (error) {
        this.logger.error('❌ Periodic sync failed', {
          error: error.message
        });
      }
    }, intervalMs);

    this.logger.info('⏰ Periodic sync started', {
      intervalMinutes: this.syncIntervalMinutes,
      nextSyncAt: new Date(Date.now() + intervalMs).toISOString()
    });
  }

  /**
   * Starts periodic deletion of old forwarded messages
   * Runs every hour to delete messages older than 24 hours
   */
  startPeriodicMessageDeletion() {
    // Clear any existing interval
    if (this.deleteInterval) {
      clearInterval(this.deleteInterval);
    }

    const intervalMs = this.deleteIntervalHours * 60 * 60 * 1000;
    
    // Run immediately on start
    this.deleteOldMessages();
    
    this.deleteInterval = setInterval(async () => {
      await this.deleteOldMessages();
    }, intervalMs);

    this.logger.info('🗑️ Periodic message deletion started', {
      checkIntervalHours: this.deleteIntervalHours,
      messageAgeHours: this.messageAgeHours,
      nextCheckAt: new Date(Date.now() + intervalMs).toISOString()
    });
  }

  /**
   * Deletes old forwarded messages from user chats
   * @returns {Promise<void>}
   */
  async deleteOldMessages() {
    try {
      this.logger.info('🗑️ Starting old message deletion...', {
        messageAgeHours: this.messageAgeHours
      });

      // Get old forwarded messages from database
      const oldMessages = await getOldForwardedMessages(this.messageAgeHours);

      if (oldMessages.length === 0) {
        this.logger.info('✅ No old messages to delete');
        return;
      }

      let deletedCount = 0;
      let failedCount = 0;

      // Delete messages in batches
      for (const msgLog of oldMessages) {
        try {
          const userId = BigInt(msgLog.user_id);
          const messageId = parseInt(msgLog.forwarded_message_id);

          // Delete message using Telegram API
          await this.client.invoke(
            new Api.messages.DeleteMessages({
              id: [messageId],
              revoke: true
            })
          );

          // Mark as deleted in database
          await markMessageAsDeleted(msgLog.user_id, msgLog.forwarded_message_id);

          deletedCount++;
          this.logger.debug('Deleted old message', {
            userId: msgLog.user_id,
            messageId: msgLog.forwarded_message_id,
            age: msgLog.created_at
          });

        } catch (error) {
          failedCount++;
          this.logger.warn('Failed to delete old message', {
            userId: msgLog.user_id,
            messageId: msgLog.forwarded_message_id,
            error: error.message
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.info('✅ Old message deletion completed', {
        total: oldMessages.length,
        deleted: deletedCount,
        failed: failedCount
      });

    } catch (error) {
      this.logger.error('❌ Old message deletion failed', {
        error: error.message
      });
    }
  }

  /**
   * Stops the UserBot gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.logger.info('Stopping UserBot...');
      
      this.isRunning = false;
      
      // Stop periodic sync
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
        this.logger.info('Periodic sync stopped');
      }
      
      // Stop periodic message deletion
      if (this.deleteInterval) {
        clearInterval(this.deleteInterval);
        this.deleteInterval = null;
        this.logger.info('Periodic message deletion stopped');
      }
      
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