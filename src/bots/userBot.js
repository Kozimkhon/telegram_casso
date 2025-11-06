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
    this.phone = sessionData?.phone || null;
    this.sessionString = sessionData?.session_string || null;
    this.userId = sessionData?.user_id || null;
    
    // SessionPath is not used in multi-session mode
    this.sessionPath = sessionData ? null : null;
    
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
    return this.phone && this.sessionString;
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
          // Only return phone number if available, no console prompts
          if (this.phone) {
            return this.phone;
          }
          throw new AuthenticationError(
            'No phone number available. Please authenticate via AdminBot.'
          );
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

    // 3. Channel updates - auto-sync new channels and members
    this.client.addEventHandler(
      asyncErrorHandler(this.handleChannelUpdate.bind(this), 'ChannelUpdate handler')
    );

    // 4. NEW: Channel participant updates - track joins/leaves
    this.client.addEventHandler(
      asyncErrorHandler(this.handleChannelParticipantUpdate.bind(this), 'ChannelParticipant handler')
    );

    // 5. NEW: New channel messages - detect new admin channels
    this.client.addEventHandler(
      asyncErrorHandler(this.handleNewChannelDetection.bind(this), 'NewChannelDetection handler')
    );

    this.logger.info('Event handlers setup completed', {
      channelCount: enabledChannels.length,
      events: ['NewMessage', 'MessageEdit', 'ChannelUpdates', 'MemberChanges', 'NewChannelDetection']
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
   * NEW: Handles channel participant updates (joins, leaves, promotions, bans)
   * Auto-syncs user changes to database
   * @param {Object} event - Channel participant update event
   */
  async handleChannelParticipantUpdate(event) {
    try {
      const update = event;

      // Only handle UpdateChannelParticipant
      if (update.className !== 'UpdateChannelParticipant') {
        return;
      }

      const channelId = update.channelId?.toString();

      // Check if we're admin in this channel
      if (!channelId || !this.enabledChannelIds.has(channelId)) {
        return;
      }

      const userId = update.userId?.toString();
      const prevParticipant = update.prevParticipant;
      const newParticipant = update.newParticipant;

      this.logger.info('👥 Channel member update detected', {
        channelId,
        userId,
        prevStatus: prevParticipant?.className,
        newStatus: newParticipant?.className,
        sessionPhone: this.phone
      });

      // Handle member leaving/being removed
      if (prevParticipant && !newParticipant) {
        this.logger.info('👋 User left/removed from channel', {
          channelId,
          userId,
          sessionPhone: this.phone
        });

        // Remove user from channel_members table
        try {
          const { removeChannelMember } = await import('../services/userService.js');
          await removeChannelMember(channelId, userId);
          this.logger.debug('User removed from database', { channelId, userId });
        } catch (error) {
          this.logger.error('Failed to remove user from database', {
            channelId,
            userId,
            error: error.message
          });
        }
      }

      // Handle new member joining
      if (!prevParticipant && newParticipant) {
        this.logger.info('👋 New user joined channel', {
          channelId,
          userId,
          sessionPhone: this.phone
        });

        // Add user to database
        try {
          const userEntity = await this.client.getEntity(BigInt(userId));
          const userInfo = extractUserInfo(userEntity);

          // Add to users table
          await addUser(userInfo);

          // Add to channel_members table
          const { addChannelMember } = await import('../services/userService.js');
          await addChannelMember(channelId, userId);

          this.logger.debug('New user added to database', {
            channelId,
            userId,
            username: userInfo.username
          });
        } catch (error) {
          this.logger.error('Failed to add new user to database', {
            channelId,
            userId,
            error: error.message
          });
        }
      }

    } catch (error) {
      this.logger.error('Error handling channel participant update', {
        error: error.message
      });
    }
  }

  /**
   * NEW: Detects new channels where user becomes admin
   * Auto-syncs channel and its members to database
   * @param {Object} event - New channel message event
   */
  async handleNewChannelDetection(event) {
    try {
      const update = event;

      // Detect UpdateNewChannelMessage
      if (update.className === 'UpdateNewChannelMessage') {
        const message = update.message;
        const channelId = message.peerId?.channelId?.toString();

        if (!channelId) {
          return;
        }

        // Check if this is a new channel (not in our database yet)
        const existingChannels = await getAllChannels();
        const isNewChannel = !existingChannels.some(ch => ch.channel_id === channelId);

        if (!isNewChannel) {
          return; // Channel already synced
        }

        this.logger.info('🆕 New channel detected!', {
          channelId,
          sessionPhone: this.phone
        });

        // Get channel entity
        const channelEntity = await this.client.getEntity(BigInt(channelId));

        // Check if user is admin
        const isAdmin = await this.isUserAdminInChannel(channelEntity);

        if (!isAdmin) {
          this.logger.debug('Not admin in new channel, skipping', { channelId });
          return;
        }

        this.logger.info('✅ New admin channel found! Auto-syncing...', {
          channelId,
          title: channelEntity.title,
          sessionPhone: this.phone
        });

        // Extract and save channel info
        const channelInfo = extractChannelInfo(channelEntity);
        await addChannel(channelInfo, this.phone);
        this.connectedChannels.set(channelInfo.channelId, channelInfo);

        // Sync all users from this new channel (full sync once)
        await this.syncUsersFromChannel(channelId);

        // Update enabled channel IDs
        this.enabledChannelIds.add(channelId);

        this.logger.info('🎉 New admin channel synced successfully!', {
          channelId,
          title: channelInfo.title,
          sessionPhone: this.phone
        });

        // Trigger event handler refresh to include new channel
        await this.setupEventHandlers();

      }

    } catch (error) {
      this.logger.error('Error detecting new channel', {
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
          const dialogs = await this.getAdminChannelsOptimized();
          
          this.logger.info(`Found ${dialogs.length} dialogs`);

          // Filter and sync channels
          await this.syncChannelsOptimized(dialogs);
          
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
   * Gets all channels where user is admin (OPTIMIZED - one API call)
   * @returns {Promise<Array>} Array of admin channel entities
   */
  async getAdminChannelsOptimized() {
    try {
      this.logger.info('🚀 Fetching admin channels (optimized)...');

      // Get current user
      const me = await this.client.getMe();

      // Get ALL channels where we're admin in ONE API call
      const result = await this.client.invoke(
        new Api.channels.GetAdminedPublicChannels({
          byLocation: false,
          checkLimit: false
        })
      );

      const adminChannels = result.chats || [];

      this.logger.info(`✅ Found ${adminChannels.length} admin public channels`, {
        sessionPhone: this.phone
      });

      // Also get private admin channels from dialogs
      const dialogs = await this.client.getDialogs({ limit: 200 });
      
      const privateAdminChannels = [];
      for (const dialog of dialogs) {
        const entity = dialog.entity;
        
        // Only check channels (not groups/chats)
        if (entity?.className === 'Channel' && !entity?.megagroup) {
          // Check if we already have this channel in public list
          const alreadyExists = adminChannels.some(ch => 
            ch.id?.toString() === entity.id?.toString()
          );
          
          if (!alreadyExists) {
            // Quick check: if we're creator or have admin rights
            if (entity.creator || entity.adminRights) {
              privateAdminChannels.push(entity);
            }
          }
        }
      }

      this.logger.info(`✅ Found ${privateAdminChannels.length} private admin channels`, {
        sessionPhone: this.phone
      });

      // Combine public and private channels
      const allAdminChannels = [...adminChannels, ...privateAdminChannels];

      this.logger.info(`🎉 Total admin channels: ${allAdminChannels.length}`, {
        public: adminChannels.length,
        private: privateAdminChannels.length,
        sessionPhone: this.phone
      });

      return allAdminChannels;

    } catch (error) {
      this.logger.warn('Error getting admin channels optimized, falling back to old method', {
        error: error.message
      });
      
      // Fallback to old method
      const dialogs = await this.client.getDialogs({ limit: 200 });
      const channels = dialogs.filter(dialog => 
        dialog.entity?.className === 'Channel' && 
        !dialog.entity?.megagroup
      );
      
      const adminChannels = [];
      for (const dialog of channels) {
        try {
          const isAdmin = await this.isUserAdminInChannel(dialog.entity);
          if (isAdmin) {
            adminChannels.push(dialog.entity);
          }
        } catch (err) {
          this.logger.debug('Skipping channel due to error', {
            channel: dialog.entity?.title,
            error: err.message
          });
        }
      }
      
      return adminChannels;
    }
  }

  /**
   * Syncs admin channels to database (OPTIMIZED - no individual admin checks)
   * @param {Array} adminChannels - Array of admin channel entities
   */
  async syncChannelsOptimized(adminChannels) {
    try {
      this.logger.info(`🔄 Syncing ${adminChannels.length} admin channels...`);

      // Clear previous admin channel entities
      this.adminChannelEntities = [];

      for (const channelEntity of adminChannels) {
        try {
          const channelInfo = extractChannelInfo(channelEntity);
          
          console.log('\n🔍 SYNC DEBUG:');
          console.log('Channel title:', channelEntity.title);
          console.log('Channel ID:', channelInfo.channelId);
          
          // Add to database (linked to this session)
          await addChannel(channelInfo, this.phone);
          this.connectedChannels.set(channelInfo.channelId, channelInfo);
          
          // Store the channel entity for event filtering
          this.adminChannelEntities.push(channelEntity);
          
          console.log('✅ Admin channel synced:', channelInfo.channelId, '-', channelInfo.title, '-> session:', this.phone);
          
          this.logger.debug('Channel synced and linked', {
            channelId: channelInfo.channelId,
            title: channelInfo.title,
            sessionPhone: this.phone
          });

        } catch (error) {
          this.logger.error('Failed to sync channel', {
            channelTitle: channelEntity?.title || 'Unknown',
            error: error.message
          });
        }
      }

      this.logger.info(`✅ Synced ${this.connectedChannels.size} channels for session ${this.phone}`);
    } catch (error) {
      this.logger.error('Error syncing channels optimized', error);
      throw error;
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
   * Syncs users from a specific channel (OPTIMIZED - batch operations)
   * @param {string} channelId - Channel ID
   */
  async syncUsersFromChannel(channelId) {
    try {
      this.logger.info('🔄 Syncing users from channel (optimized)', { 
        channelId,
        sessionPhone: this.phone 
      });

      // Get channel participants with optimization
      const participants = await this.client.getParticipants(channelId, {
        limit: 5000, // Increased limit for better coverage
        aggressive: true // Enable aggressive mode for faster fetching
      });

      this.logger.debug(`📊 Fetched ${participants.length} participants`, {
        channelId,
        sessionPhone: this.phone
      });

      // Filter and extract user info (exclude bots)
      const usersData = participants
        .filter(participant => !participant.bot)
        .map(participant => extractUserInfo(participant));

      if (usersData.length === 0) {
        this.logger.debug('No users to sync from channel', { channelId });
        return {
          success: true,
          totalUsers: 0,
          usersAdded: 0,
          membersLinked: 0
        };
      }

      this.logger.info(`✅ Processing ${usersData.length} users (bots excluded)`, {
        channelId,
        total: participants.length,
        afterBotFilter: usersData.length,
        sessionPhone: this.phone
      });

      // OPTIMIZATION 1: Bulk add users to users table
      const userResults = await bulkAddUsers(usersData);
      const successfulUsers = userResults.filter(r => r.success);
      
      this.logger.debug(`📝 Added ${successfulUsers.length}/${usersData.length} users to database`, {
        channelId,
        sessionPhone: this.phone
      });

      // OPTIMIZATION 2: Clear existing channel members (single query)
      const clearedCount = await clearChannelMembers(channelId);
      
      this.logger.debug(`🧹 Cleared ${clearedCount} existing channel members`, {
        channelId,
        sessionPhone: this.phone
      });

      // OPTIMIZATION 3: Bulk link users to channel
      const userIds = successfulUsers.map(r => r.userId || r.data?.user_id);
      const memberResults = await bulkAddChannelMembers(channelId, userIds);
      
      const successCount = memberResults.filter(r => r.success).length;

      const result = {
        success: true,
        totalUsers: usersData.length,
        usersAdded: successfulUsers.length,
        membersLinked: successCount,
        failed: usersData.length - successCount,
        cleared: clearedCount
      };

      this.logger.info('✅ Users synced from channel (optimized)', {
        channelId,
        ...result,
        sessionPhone: this.phone
      });

      return result;

    } catch (error) {
      // Don't throw here to avoid disrupting other channel syncing
      this.logger.error('❌ Error syncing users from specific channel', {
        channelId,
        error: error.message,
        stack: error.stack,
        sessionPhone: this.phone
      });

      return {
        success: false,
        error: error.message,
        channelId
      };
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
   * Re-syncs all admin channels and their members
   * @returns {Promise<Object>} Sync results
   */
  async syncChannelsManually() {
    try {
      this.logger.info('🔄 Manual channel sync triggered', { 
        sessionPhone: this.phone 
      });
      
      // Use optimized method
      const adminChannels = await this.getAdminChannelsOptimized();
      
      // Sync channels
      await this.syncChannelsOptimized(adminChannels);
      
      // Re-sync all users from enabled channels
      await this.syncUsersFromChannels();
      
      // Update event handlers with new channel list
      await this.setupEventHandlers();
      
      this.logger.info('✅ Manual sync completed successfully', {
        channelCount: this.connectedChannels.size,
        sessionPhone: this.phone
      });
      
      return {
        success: true,
        channelsCount: this.connectedChannels.size,
        sessionPhone: this.phone,
        message: `Successfully synced ${this.connectedChannels.size} admin channels`
      };
    } catch (error) {
      this.logger.error('❌ Manual sync failed', {
        error: error.message,
        sessionPhone: this.phone
      });
      return {
        success: false,
        error: error.message,
        sessionPhone: this.phone,
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