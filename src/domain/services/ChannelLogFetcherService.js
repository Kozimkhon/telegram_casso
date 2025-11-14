/**
 * @fileoverview Channel Log Fetcher Service
 * Fetches and processes admin logs from Telegram channels
 * @module domain/services/ChannelLogFetcherService
 */

import { Api } from 'telegram';
import { log } from '../../shared/logger.js';
import { ChannelLog } from '../../core/entities/index.js';

/**
 * Channel Log Fetcher Service
 * Handles fetching and processing of Telegram channel admin logs
 */
class ChannelLogFetcherService {
  #channelLogRepository;
  #channelRepository;
  #userRepository;
  #logger;

  /**
   * Creates service instance
   * @param {Object} dependencies - Service dependencies
   * @param {ChannelLogRepository} dependencies.channelLogRepository - Domain repository for ChannelLog
   * @param {ChannelRepository} dependencies.channelRepository - Domain repository for Channel
   * @param {UserRepository} dependencies.userRepository - Domain repository for User
   * @param {Object} dependencies.logger
   */
  constructor({ channelLogRepository, channelRepository, userRepository, logger = log }) {
    this.#channelLogRepository = channelLogRepository;
    this.#channelRepository = channelRepository;
    this.#userRepository = userRepository;
    this.#logger = logger;
  }

  /**
   * Fetches and saves admin logs for a channel
   * @param {TelegramClient} client - Telegram client instance
   * @param {number} channelDbId - Channel database ID
   * @param {string} channelId - Telegram channel ID
   * @param {string} accessHash - Channel access hash
   * @returns {Promise<Object>} Result with count and logs
   */
  async fetchChannelLogs(client, channelDbId, channelId, accessHash) {
    try {
      // Get last log ID from database
      const lastLogId = await this.#channelLogRepository.getLastLogId(channelDbId);
      const minId = lastLogId ? lastLogId : BigInt(0);

      // Remove "-100" prefix from channelId for API call
      const actualChannelId = channelId.startsWith('-100') 
        ? channelId.slice(4) 
        : channelId;

      this.#logger.info('Fetching channel logs', { 
        channelDbId, 
        channelId,
        actualChannelId,
        minId: minId.toString() 
      });

      // Fetch logs from Telegram
      const result = await client.invoke(
        new Api.channels.GetAdminLog({
          channel: new Api.InputChannel({
            channelId: BigInt(actualChannelId),
            accessHash: BigInt(accessHash),
          }),
          q: '',
          minId: minId,
          maxId: BigInt(0),
          limit: 100,
        })
      );

      if (!result.events || result.events.length === 0) {
        this.#logger.info('No new logs found', { channelDbId });
        return { count: 0, logs: [] };
      }

      // Process and filter logs - create domain entities
      const processedLogs = this.#processLogs(channelDbId, result.events);
      
      // Save to database via domain repository
      const savedCount = await this.#channelLogRepository.bulkSave(processedLogs);

      // Process user operations based on event types
      const userOperations = await this.#processUserOperations(channelId, result.events, result.users || []);

      this.#logger.info('Channel logs fetched and saved', { 
        channelDbId, 
        total: result.events.length,
        saved: savedCount,
        userOperations 
      });

      return { 
        count: savedCount, 
        logs: processedLogs,
        userOperations 
      };
    } catch (error) {
      this.#logger.error('Failed to fetch channel logs', { 
        channelDbId, 
        channelId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Fetches logs for all admin channels
   * Each admin fetches logs only for their own channels
   * @param {TelegramClient} client - Telegram client for specific admin
   * @param {string} adminUserId - Admin user ID
   * @returns {Promise<Object>} Summary of fetched logs
   */
  async fetchAllAdminChannelLogs(client, adminUserId) {
    try {
      // Get all channels that belong to this specific admin
      const channels = await this.#channelRepository.findByAdminId(adminUserId);

      if (!channels || channels.length === 0) {
        this.#logger.info('No channels found for admin', { adminUserId });
        return { totalChannels: 0, totalLogs: 0, errors: [] };
      }

      const summary = {
        totalChannels: channels.length,
        totalLogs: 0,
        channelResults: [],
        errors: [],
      };

      // Fetch logs for each channel
      for (const channel of channels) {
        try {
          const result = await this.fetchChannelLogs(
            client,
            channel.id,
            channel.channelId,
            channel.accessHash
          );

          summary.totalLogs += result.count;
          summary.channelResults.push({
            channelId: channel.channelId,
            channelTitle: channel.title,
            logsCount: result.count,
          });
        } catch (error) {
          this.#logger.error('Failed to fetch logs for channel', { 
            channelId: channel.channelId,
            error 
          });
          summary.errors.push({
            channelId: channel.channelId,
            error: error.message,
          });
        }
      }

      this.#logger.info('Completed fetching logs for all channels', summary);
      return summary;
    } catch (error) {
      this.#logger.error('Failed to fetch logs for admin channels', { 
        adminUserId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Processes raw Telegram log events
   * @private
   * @param {number} channelDbId - Channel database ID
   * @param {Array} events - Raw Telegram events
   * @returns {Array<ChannelLog>} Processed domain log entities
   */
  #processLogs(channelDbId, events) {
    const processedLogs = [];

    for (const event of events) {
      try {
        // Create domain entity from Telegram event
        const logEntry = ChannelLog.fromTelegramEvent(event, channelDbId);
        processedLogs.push(logEntry);
      } catch (error) {
        this.#logger.warn('Failed to process log event', { 
          eventId: event.id, 
          error 
        });
      }
    }

    return processedLogs;
  }

  /**
   * Processes user operations based on admin log events
   * @private
   * @param {string} channelId - Telegram channel ID
   * @param {Array} events - Admin log events
   * @param {Array} users - Users from admin log response
   * @returns {Promise<Object>} Summary of operations
   */
  async #processUserOperations(channelId, events, users) {
    const usersAdded = [];
    const usersRemoved = [];
    const errors = [];

    // Create user lookup map
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user.id.toString(), user);
    });

    for (const event of events) {
      const actionClassName = event.action?.className || '';
      const actionType = actionClassName.split('.').pop();
      
      try {
        switch (actionType) {
          case 'ChannelAdminLogEventActionParticipantJoin':
          case 'ChannelAdminLogEventActionParticipantInvite':
          case 'ChannelAdminLogEventActionParticipantJoinByInvite':
          case 'ChannelAdminLogEventActionParticipantJoinByRequest': {
            // Get user ID from event
            const userId = event.action.participant?.userId?.toString() || 
                          event.userId?.toString();
            
            if (userId && userMap.has(userId)) {
              const telegramUser = userMap.get(userId);
              const added = await this.#addUserToChannel(channelId, telegramUser);
              if (added) {
                usersAdded.push(userId);
              }
            }
            break;
          }

          case 'ChannelAdminLogEventActionParticipantLeave':
          case 'ChannelAdminLogEventActionParticipantToggleBan': {
            // Get user ID from event
            const userId = event.action.participant?.userId?.toString() || 
                          event.action.prevParticipant?.userId?.toString() ||
                          event.userId?.toString();
            
            if (userId) {
              const removed = await this.#removeUserFromChannel(channelId, userId);
              if (removed) {
                usersRemoved.push(userId);
              }
            }
            break;
          }
        }
      } catch (error) {
        this.#logger.error('Error processing user operation', { 
          eventId: event.id, 
          actionType,
          error: error.message 
        });
        errors.push({
          eventId: event.id,
          actionType,
          error: error.message
        });
      }
    }

    return {
      usersAdded: usersAdded.length,
      usersRemoved: usersRemoved.length,
      errors: errors.length,
      details: { usersAdded, usersRemoved, errors }
    };
  }

  /**
   * Adds user to channel
   * Creates user if doesn't exist, then links to channel
   * @private
   * @param {string} channelId - Telegram channel ID
   * @param {Object} telegramUser - User object from Telegram
   * @returns {Promise<boolean>} Success status
   */
  async #addUserToChannel(channelId, telegramUser) {
    try {
      const userId = telegramUser.id.toString();
      
      // Check if user exists
      let user = await this.#userRepository.findByUserId(userId);
      
      // Create user if doesn't exist
      if (!user) {
        const userData = {
          userId,
          firstName: telegramUser.firstName || '',
          lastName: telegramUser.lastName || '',
          username: telegramUser.username || null,
          phone: telegramUser.phone || null,
          isBot: telegramUser.bot || false,
          isPremium: telegramUser.premium || false,
          isActive: true
        };
        
        await this.#userRepository.create({
          ...userData,
          toObject: () => ({
            user_id: userData.userId,
            first_name: userData.firstName,
            last_name: userData.lastName,
            username: userData.username,
            phone: userData.phone,
            is_bot: userData.isBot,
            is_premium: userData.isPremium,
            is_active: userData.isActive
          })
        });
        
        this.#logger.info('User created from admin log', { userId, channelId });
      }
      
      // Add user to channel
      const added = await this.#userRepository.addToChannel(channelId, userId);
      
      if (added) {
        this.#logger.info('User added to channel from admin log', { userId, channelId });
      }
      
      return added;
    } catch (error) {
      this.#logger.error('Failed to add user to channel', { 
        userId: telegramUser.id, 
        channelId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Removes user from channel
   * If user is only in this channel, deletes user from DB
   * Otherwise, just removes channel association
   * @private
   * @param {string} channelId - Telegram channel ID
   * @param {string} userId - Telegram user ID
   * @returns {Promise<boolean>} Success status
   */
  async #removeUserFromChannel(channelId, userId) {
    try {
      // Check if user exists
      const user = await this.#userRepository.findByUserId(userId);
      
      if (!user) {
        this.#logger.debug('User not found for removal', { userId, channelId });
        return false;
      }
      
      // Get user's channels using ORM repository to check count
      const userChannels = await this.#userRepository.findByChannel(channelId);
      const userInChannel = userChannels.find(u => u.userId === userId);
      
      if (!userInChannel) {
        this.#logger.debug('User not in channel', { userId, channelId });
        return false;
      }
      
      // Remove user from this channel
      const removed = await this.#userRepository.removeFromChannel(channelId, userId);
      
      if (removed) {
        this.#logger.info('User removed from channel', { userId, channelId });
        
        // Check if user has other channels
        // We need to query all channels and see if user is still in any
        const allChannels = await this.#channelRepository.findAll();
        let userHasOtherChannels = false;
        
        for (const channel of allChannels) {
          if (channel.channelId === channelId) continue; // Skip current channel
          
          const channelUsers = await this.#userRepository.findByChannel(channel.channelId);
          if (channelUsers.find(u => u.userId === userId)) {
            userHasOtherChannels = true;
            break;
          }
        }
        
        // If user has no other channels, delete from DB
        if (!userHasOtherChannels) {
          await this.#userRepository.delete(user.id);
          this.#logger.info('User deleted from DB (no other channels)', { userId });
        }
      }
      
      return removed;
    } catch (error) {
      this.#logger.error('Failed to remove user from channel', { 
        userId, 
        channelId, 
        error: error.message 
      });
      return false;
    }
  }
}

export default ChannelLogFetcherService;
