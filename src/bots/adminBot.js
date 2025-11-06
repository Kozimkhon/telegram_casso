/**
 * AdminBot module - responsible for bot administration using Telegraf
 * Provides web interface for managing channels, users, and forwarding settings
 */

import { Telegraf, Markup } from 'telegraf';
import { config } from '../config/index.js';
import { log, createChildLogger } from '../utils/logger.js';
import { 
  handleTelegramError, 
  ValidationError,
  asyncErrorHandler 
} from '../utils/errorHandler.js';
import { formatTimestamp, chunkArray } from '../utils/helpers.js';
import { 
  getAllChannels, 
  toggleChannelForwarding, 
  getChannelStats,
  removeChannel 
} from '../services/channelService.js';
import { 
  getUserStats, 
  getAllUsers,
  getRecentUsers 
} from '../services/userService.js';
import { 
  getForwardingStats, 
  getRecentForwardingLogs,
  cleanupMessageLogs 
} from '../services/messageService.js';
import { setupSessionManagement } from './adminBotSessions.js';
import { setupSessionAuthentication, cleanupExpiredAuthSessions } from './adminBotAuth.js';

class AdminBot {
  constructor(userBot = null, userBotManager) {
    this.bot = new Telegraf(config.telegram.adminBotToken);
    this.userBot = userBot; // Legacy support, not used in multi-session mode
    this.userBotManager = userBotManager; // Required for multi-session support
    this.isRunning = false;
    this.logger = createChildLogger({ component: 'AdminBot' });
    this.adminUserId = config.telegram.adminUserId;
    
    // Ensure userBotManager is provided for pure multi-session mode
    if (!this.userBotManager) {
      throw new Error('UserBotManager is required for multi-session operation');
    }
    
    this.setupMiddleware();
    this.setupCommands();
    this.setupCallbacks();
    
    // Setup session management
    setupSessionManagement(this.bot, asyncErrorHandler);
    
    // Setup session authentication
    setupSessionAuthentication(this.bot, asyncErrorHandler, this.userBotManager);
    
    this.logger.info('Multi-session management and authentication UI enabled');
    
    // Cleanup expired auth sessions every 5 minutes
    setInterval(() => {
      cleanupExpiredAuthSessions();
    }, 300000);
  }

  /**
   * Sets up middleware for admin authentication and error handling
   */
  setupMiddleware() {
    // Admin authentication middleware
    this.bot.use(asyncErrorHandler(async (ctx, next) => {
      const userId = ctx.from?.id;
      
      if (userId !== this.adminUserId) {
        this.logger.warn('Unauthorized access attempt', {
          userId,
          username: ctx.from?.username,
          command: ctx.message?.text
        });
        
        await ctx.reply('❌ Unauthorized access. This bot is for admin use only.');
        return;
      }
      
      this.logger.debug('Admin command received', {
        command: ctx.message?.text || ctx.callbackQuery?.data,
        userId
      });
      
      return next();
    }, 'Admin auth middleware'));

    // Error handling middleware
    this.bot.catch((err, ctx) => {
      this.logger.error('Bot error occurred', {
        error: err.message,
        userId: ctx.from?.id,
        command: ctx.message?.text || ctx.callbackQuery?.data
      });
      
      ctx.reply('❌ An error occurred. Please try again.').catch(() => {
        this.logger.error('Failed to send error message to user');
      });
    });
  }

  /**
   * Sets up bot commands
   */
  setupCommands() {
    // Start command - main menu
    this.bot.command('start', asyncErrorHandler(async (ctx) => {
      await this.showMainMenu(ctx);
    }, 'Start command'));

    // Status command
    this.bot.command('status', asyncErrorHandler(async (ctx) => {
      await this.showStatus(ctx);
    }, 'Status command'));

    // Help command
    this.bot.command('help', asyncErrorHandler(async (ctx) => {
      await this.showHelp(ctx);
    }, 'Help command'));

    // Statistics command
    this.bot.command('stats', asyncErrorHandler(async (ctx) => {
      await this.showStatistics(ctx);
    }, 'Stats command'));

    // Cleanup command
    this.bot.command('cleanup', asyncErrorHandler(async (ctx) => {
      await this.performCleanup(ctx);
    }, 'Cleanup command'));
  }

  /**
   * Sets up callback query handlers
   */
  setupCallbacks() {
    // Main menu callbacks
    this.bot.action('channels_list', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showChannelsList(ctx);
    }, 'Channels list callback'));

    this.bot.action('user_stats', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showUserStats(ctx);
    }, 'User stats callback'));

    this.bot.action('forwarding_stats', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showForwardingStats(ctx);
    }, 'Forwarding stats callback'));

    this.bot.action('bot_status', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showBotStatus(ctx);
    }, 'Bot status callback'));

    // Multi-session callbacks
    this.bot.action('sessions_list', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      if (this.userBotManager) {
        // This will be handled by adminBotSessions.js
        await ctx.reply('🔐 Session management is available. Use /sessions command.');
      } else {
        await ctx.reply('❌ UserBotManager not initialized. Please restart the application.');
      }
    }, 'Sessions list callback'));

    this.bot.action('queue_status', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showQueueStatus(ctx);
    }, 'Queue status callback'));

    this.bot.action('performance_stats', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showPerformanceStats(ctx);
    }, 'Performance stats callback'));

    this.bot.action('main_menu', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showMainMenu(ctx);
    }, 'Main menu callback'));

    // Channel management callbacks
    this.bot.action(/^toggle_channel_(.+)$/, asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      const channelId = ctx.match[1];
      await this.toggleChannel(ctx, channelId);
    }, 'Toggle channel callback'));

    this.bot.action(/^remove_channel_(.+)$/, asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      const channelId = ctx.match[1];
      await this.removeChannelConfirm(ctx, channelId);
    }, 'Remove channel callback'));

    this.bot.action(/^confirm_remove_(.+)$/, asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      const channelId = ctx.match[1];
      await this.confirmRemoveChannel(ctx, channelId);
    }, 'Confirm remove channel callback'));

    // Navigation callbacks
    this.bot.action(/^channels_page_(\d+)$/, asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      const page = parseInt(ctx.match[1]);
      await this.showChannelsList(ctx, page);
    }, 'Channels page callback'));

    // Sync channels callback
    this.bot.action('sync_channels', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery('⏳ Syncing channels...');
      await this.syncChannels(ctx);
    }, 'Sync channels callback'));

    // Help callback
    this.bot.action('help', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.showHelp(ctx);
    }, 'Help callback'));
  }

  /**
   * Shows the main menu
   * @param {Object} ctx - Telegraf context
   */
  async showMainMenu(ctx) {
    const menuText = `
🤖 *Telegram Casso Multi-Session Admin Panel*

Welcome to the multi-session management system!

📊 View system-wide statistics and session status
⚙️ Manage channels with load balancing
👥 Monitor users across all sessions
🔐 Full session lifecycle management
🎛️ Advanced throttling and queue control
`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 Channels List', 'channels_list'),
        Markup.button.callback('📊 System Status', 'bot_status')
      ],
      [
        Markup.button.callback('👥 User Stats', 'user_stats'),
        Markup.button.callback('📨 Forwarding Stats', 'forwarding_stats')
      ],
      [
        Markup.button.callback('🔐 Sessions Manager', 'sessions_list'),
        Markup.button.callback('➕ Add Session', 'add_session')
      ],
      [
        Markup.button.callback('⚡ Performance', 'performance_stats'),
        Markup.button.callback('🎛️ Queue Status', 'queue_status')
      ],
      [
        Markup.button.callback('❓ Help', 'help')
      ]
    ]);

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(menuText, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      } else {
        await ctx.reply(menuText, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
    } catch (error) {
      this.logger.error('Error showing multi-user main menu', error);
      await ctx.reply('❌ Error loading main menu. Please try /start again.');
    }
  }

  /**
   * Shows queue status across all sessions
   */
  async showQueueStatus(ctx) {
    try {
      if (!this.userBotManager) {
        await ctx.answerCbQuery('Multi-session support not available');
        return;
      }

      let statusText = `🎛️ *Queue Status - Multi-Session System*\n\n`;
      
      try {
        const { queueManager } = await import('../utils/messageQueue.js');
        const queueStatus = queueManager.getStatus();
        
        if (Object.keys(queueStatus).length === 0) {
          statusText += `📋 No active queues\n\n`;
        } else {
          for (const [sessionPhone, status] of Object.entries(queueStatus)) {
            const emoji = status.processing ? '🔄' : status.queueLength > 0 ? '⏳' : '✅';
            statusText += `${emoji} *${sessionPhone}*\n`;
            statusText += `   Queue: ${status.queueLength} messages\n`;
            statusText += `   Processing: ${status.processing ? 'Yes' : 'No'}\n`;
            statusText += `   Delays: ${status.minDelay}-${status.maxDelay}ms\n\n`;
          }
        }
      } catch (error) {
        statusText += `❌ Error loading queue status: ${error.message}\n\n`;
      }

      // Add session summary
      const managerStatus = this.userBotManager.getStatus();
      statusText += `📊 *Session Summary*\n`;
      statusText += `Active: ${managerStatus.activeSessions}\n`;
      statusText += `Paused: ${managerStatus.pausedSessions}\n`;
      statusText += `Error: ${managerStatus.errorSessions}\n`;
      statusText += `Total: ${managerStatus.totalSessions}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'queue_status')],
        [Markup.button.callback('⬅️ Back to Menu', 'main_menu')]
      ]);

      await ctx.editMessageText(statusText, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      this.logger.error('Error showing queue status', error);
      await ctx.answerCbQuery('Error loading queue status');
    }
  }

  /**
   * Shows performance statistics across all sessions
   */
  async showPerformanceStats(ctx) {
    try {
      if (!this.userBotManager) {
        await ctx.answerCbQuery('Multi-session support not available');
        return;
      }

      let statsText = `⚡ *Performance Statistics*\n\n`;
      
      // System uptime and memory
      const uptime = Math.floor(process.uptime());
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const memory = process.memoryUsage();
      
      statsText += `🕐 *System Status*\n`;
      statsText += `Uptime: ${hours}h ${minutes}m\n`;
      statsText += `Memory: ${Math.round(memory.heapUsed / 1024 / 1024)}MB\n`;
      statsText += `CPU: ${process.cpuUsage().user}μs\n\n`;

      // Session performance
      const managerStatus = this.userBotManager.getStatus();
      statsText += `📊 *Session Performance*\n`;
      
      for (const session of managerStatus.sessions) {
        const status = session.isRunning && !session.isPaused ? '✅' : 
                      session.isPaused ? '⏸️' : '❌';
        statsText += `${status} ${session.phone}\n`;
        statsText += `   Channels: ${session.connectedChannels}\n`;
        if (session.pauseReason) {
          statsText += `   Reason: ${session.pauseReason}\n`;
        }
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'performance_stats')],
        [Markup.button.callback('⬅️ Back to Menu', 'main_menu')]
      ]);

      await ctx.editMessageText(statsText, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      this.logger.error('Error showing performance stats', error);
      await ctx.answerCbQuery('Error loading performance stats');
    }
  }

  /**
   * Shows the list of channels with management options
   * @param {Object} ctx - Telegraf context
   * @param {number} page - Page number for pagination
   */
  async showChannelsList(ctx, page = 1) {
    try {
      const channels = await getAllChannels();
      const itemsPerPage = 5;
      const totalPages = Math.ceil(channels.length / itemsPerPage);
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageChannels = channels.slice(startIndex, endIndex);

      let text = `📋 *Channels Management* (Page ${page}/${totalPages})\n\n`;
      
      if (channels.length === 0) {
        text += '❌ No channels found. UserBot needs to sync channels first.';
      } else {
        text += `Total channels: ${channels.length}\n\n`;
        
        pageChannels.forEach((channel, index) => {
          const status = channel.forward_enabled ? '✅ Enabled' : '❌ Disabled';
          const number = startIndex + index + 1;
          text += `${number}. *${channel.title}*\n`;
          text += `   Status: ${status}\n`;
          text += `   ID: \`${channel.channel_id}\`\n\n`;
        });
      }

      // Build keyboard
      const buttons = [];
      
      // Sync button at the top
      buttons.push([Markup.button.callback('🔄 Sync Channels', 'sync_channels')]);
      
      // Channel control buttons
      pageChannels.forEach((channel, index) => {
        const number = startIndex + index + 1;
        const toggleText = channel.forward_enabled ? `❌ Disable ${number}` : `✅ Enable ${number}`;
        buttons.push([
          Markup.button.callback(toggleText, `toggle_channel_${channel.channel_id}`),
          Markup.button.callback(`🗑 Remove ${number}`, `remove_channel_${channel.channel_id}`)
        ]);
      });

      // Pagination buttons
      if (totalPages > 1) {
        const paginationButtons = [];
        if (page > 1) {
          paginationButtons.push(
            Markup.button.callback('⬅️ Previous', `channels_page_${page - 1}`)
          );
        }
        if (page < totalPages) {
          paginationButtons.push(
            Markup.button.callback('➡️ Next', `channels_page_${page + 1}`)
          );
        }
        if (paginationButtons.length > 0) {
          buttons.push(paginationButtons);
        }
      }

      // Back to main menu
      buttons.push([Markup.button.callback('🏠 Main Menu', 'main_menu')]);

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      this.logger.error('Error showing channels list', error);
      await ctx.reply('❌ Error loading channels list.');
    }
  }

  /**
   * Toggles a channel's forwarding status
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID to toggle
   */
  async toggleChannel(ctx, channelId) {
    try {
      const channel = await toggleChannelForwarding(channelId);
      const status = channel.forward_enabled ? 'enabled' : 'disabled';
      
      await ctx.reply(`✅ Channel "${channel.title}" forwarding ${status}.`);
      
      // Refresh the channels list
      setTimeout(() => {
        this.showChannelsList(ctx).catch(err => 
          this.logger.error('Error refreshing channels list', err)
        );
      }, 1000);

    } catch (error) {
      this.logger.error('Error toggling channel', { channelId, error: error.message });
      await ctx.reply('❌ Error toggling channel status.');
    }
  }

  /**
   * Shows confirmation for channel removal
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID to remove
   */
  async removeChannelConfirm(ctx, channelId) {
    try {
      const channels = await getAllChannels();
      const channel = channels.find(c => c.channel_id === channelId);
      
      if (!channel) {
        await ctx.reply('❌ Channel not found.');
        return;
      }

      const text = `⚠️ *Confirm Channel Removal*\n\nAre you sure you want to remove this channel?\n\n*${channel.title}*\nID: \`${channel.channel_id}\`\n\n*This action cannot be undone.*`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Yes, Remove', `confirm_remove_${channelId}`),
          Markup.button.callback('❌ Cancel', 'channels_list')
        ]
      ]);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      this.logger.error('Error showing remove confirmation', { channelId, error: error.message });
      await ctx.reply('❌ Error loading confirmation dialog.');
    }
  }

  /**
   * Confirms and removes a channel
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID to remove
   */
  async confirmRemoveChannel(ctx, channelId) {
    try {
      const removed = await removeChannel(channelId);
      
      if (removed) {
        await ctx.reply('✅ Channel removed successfully.');
      } else {
        await ctx.reply('❌ Channel not found or already removed.');
      }
      
      // Return to channels list
      setTimeout(() => {
        this.showChannelsList(ctx).catch(err => 
          this.logger.error('Error returning to channels list', err)
        );
      }, 1000);

    } catch (error) {
      this.logger.error('Error removing channel', { channelId, error: error.message });
      await ctx.reply('❌ Error removing channel.');
    }
  }

  /**
   * Shows bot status information
   * @param {Object} ctx - Telegraf context
   */
  async showBotStatus(ctx) {
    try {
      const userBotStatus = this.userBot ? this.userBot.getStatus() : null;
      
      let text = `🤖 *Bot Status Report*\n\n`;
      
      // UserBot status
      if (userBotStatus) {
        text += `👤 *UserBot Status:*\n`;
        text += `   Running: ${userBotStatus.isRunning ? '✅ Yes' : '❌ No'}\n`;
        text += `   Connected: ${userBotStatus.isConnected ? '✅ Yes' : '❌ No'}\n`;
        text += `   Monitored Channels: ${userBotStatus.connectedChannels}\n`;
        text += `   Last Check: ${userBotStatus.lastStatusCheck}\n\n`;
      } else {
        text += `👤 *UserBot Status:* ❌ Not Available\n\n`;
      }

      // AdminBot status
      text += `⚙️ *AdminBot Status:*\n`;
      text += `   Running: ${this.isRunning ? '✅ Yes' : '❌ No'}\n`;
      text += `   Admin User: ${this.adminUserId}\n\n`;

      // System info
      text += `💾 *System Info:*\n`;
      text += `   Uptime: ${Math.floor(process.uptime())} seconds\n`;
      text += `   Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB\n`;
      text += `   Node.js Version: ${process.version}\n`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'bot_status')],
        [Markup.button.callback('🏠 Main Menu', 'main_menu')]
      ]);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      this.logger.error('Error showing bot status', error);
      await ctx.reply('❌ Error loading bot status.');
    }
  }

  /**
   * Shows user statistics
   * @param {Object} ctx - Telegraf context
   */
  async showUserStats(ctx) {
    try {
      const stats = await getUserStats();
      const recentUsers = await getRecentUsers(7);

      let text = `👥 *User Statistics*\n\n`;
      text += `📊 *Overview:*\n`;
      text += `   Total Users: ${stats.total}\n`;
      text += `   With Username: ${stats.withUsername}\n`;
      text += `   With Phone: ${stats.withPhone}\n`;
      text += `   Recent (7 days): ${recentUsers.length}\n\n`;

      if (recentUsers.length > 0) {
        text += `🆕 *Recent Users (last 7 days):*\n`;
        recentUsers.slice(0, 5).forEach((user, index) => {
          const name = user.first_name || 'Unknown';
          const username = user.username ? `@${user.username}` : 'No username';
          text += `   ${index + 1}. ${name} (${username})\n`;
        });
        
        if (recentUsers.length > 5) {
          text += `   ... and ${recentUsers.length - 5} more\n`;
        }
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'user_stats')],
        [Markup.button.callback('🏠 Main Menu', 'main_menu')]
      ]);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      this.logger.error('Error showing user stats', error);
      await ctx.reply('❌ Error loading user statistics.');
    }
  }

  /**
   * Shows forwarding statistics
   * @param {Object} ctx - Telegraf context
   */
  async showForwardingStats(ctx) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const [todayStats, yesterdayStats, recentLogs] = await Promise.all([
        getForwardingStats({ fromDate: today }),
        getForwardingStats({ fromDate: yesterday, toDate: today }),
        getRecentForwardingLogs({ limit: 10 })
      ]);

      let text = `📨 *Forwarding Statistics*\n\n`;
      
      text += `📅 *Today:*\n`;
      text += `   Total: ${todayStats.total}\n`;
      text += `   Successful: ${todayStats.successful} (${todayStats.successRate}%)\n`;
      text += `   Failed: ${todayStats.failed}\n\n`;

      text += `📅 *Yesterday:*\n`;
      text += `   Total: ${yesterdayStats.total}\n`;
      text += `   Successful: ${yesterdayStats.successful} (${yesterdayStats.successRate}%)\n`;
      text += `   Failed: ${yesterdayStats.failed}\n\n`;

      if (recentLogs.length > 0) {
        text += `🕐 *Recent Activity:*\n`;
        recentLogs.slice(0, 5).forEach((log, index) => {
          const status = log.status === 'success' ? '✅' : '❌';
          const time = new Date(log.created_at).toLocaleTimeString();
          text += `   ${status} ${time} - Channel ${log.channel_id}\n`;
        });
      } else {
        text += `🕐 *Recent Activity:* None\n`;
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'forwarding_stats')],
        [Markup.button.callback('🏠 Main Menu', 'main_menu')]
      ]);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard
      });

    } catch (error) {
      this.logger.error('Error showing forwarding stats', error);
      await ctx.reply('❌ Error loading forwarding statistics.');
    }
  }

  /**
   * Shows help information
   * @param {Object} ctx - Telegraf context
   */
  async showHelp(ctx) {
    const helpText = `
📖 *Help - Telegram Casso Admin Bot*

*Available Commands:*
/start - Show main menu
/status - Show bot status
/stats - Show statistics
/help - Show this help message
/cleanup - Clean old message logs

*Features:*
• Manage channel forwarding settings
• Monitor user statistics
• View forwarding statistics
• Real-time bot status monitoring

*Navigation:*
Use the inline keyboard buttons to navigate through the admin panel. All actions are logged for security.

*Support:*
If you encounter any issues, check the bot logs or restart the application.
`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }

  /**
   * Shows overall statistics
   * @param {Object} ctx - Telegraf context
   */
  async showStatistics(ctx) {
    try {
      const [channelStats, userStats, forwardingStats] = await Promise.all([
        getChannelStats(),
        getUserStats(),
        getForwardingStats()
      ]);

      let text = `📊 *Overall Statistics*\n\n`;
      
      text += `📋 *Channels:*\n`;
      text += `   Total: ${channelStats.total}\n`;
      text += `   Enabled: ${channelStats.enabled}\n`;
      text += `   Disabled: ${channelStats.disabled}\n\n`;

      text += `👥 *Users:*\n`;
      text += `   Total: ${userStats.total}\n`;
      text += `   With Username: ${userStats.withUsername}\n`;
      text += `   With Phone: ${userStats.withPhone}\n\n`;

      text += `📨 *Message Forwarding:*\n`;
      text += `   Total Attempts: ${forwardingStats.total}\n`;
      text += `   Successful: ${forwardingStats.successful}\n`;
      text += `   Failed: ${forwardingStats.failed}\n`;
      text += `   Success Rate: ${forwardingStats.successRate}%\n\n`;

      text += `🕐 *Last Updated:* ${formatTimestamp()}`;

      await ctx.reply(text, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Error showing statistics', error);
      await ctx.reply('❌ Error loading statistics.');
    }
  }

  /**
   * Performs database cleanup
   * @param {Object} ctx - Telegraf context
   */
  async performCleanup(ctx) {
    try {
      await ctx.reply('🧹 Starting database cleanup...');
      
      const deletedLogs = await cleanupMessageLogs(30); // Keep 30 days
      
      await ctx.reply(`✅ Cleanup completed!\n\nDeleted ${deletedLogs} old message logs.`);
      
    } catch (error) {
      this.logger.error('Error performing cleanup', error);
      await ctx.reply('❌ Error during cleanup operation.');
    }
  }

  /**
   * Shows bot status
   * @param {Object} ctx - Telegraf context
   */
  async showStatus(ctx) {
    try {
      const userBotStatus = this.userBot ? this.userBot.getStatus() : null;
      
      let text = `🤖 *Quick Status*\n\n`;
      text += `UserBot: ${userBotStatus?.isRunning ? '✅' : '❌'}\n`;
      text += `AdminBot: ${this.isRunning ? '✅' : '❌'}\n`;
      text += `Channels: ${userBotStatus?.connectedChannels || 0}\n`;
      
      await ctx.reply(text, { parse_mode: 'Markdown' });

    } catch (error) {
      this.logger.error('Error showing status', error);
      await ctx.reply('❌ Error loading status.');
    }
  }

  /**
   * Syncs channels from UserBot
   * @param {Object} ctx - Telegraf context
   */
  async syncChannels(ctx) {
    try {
      if (!this.userBot || !this.userBot.client) {
        await ctx.reply('❌ UserBot is not connected. Cannot sync channels.');
        return;
      }

      const result = await this.userBot.syncChannelsManually();
      
      if (result.success) {
        await ctx.reply(`✅ ${result.message}`);
        // Refresh the channels list
        await this.showChannelsList(ctx, 1);
      } else {
        await ctx.reply(`❌ Sync failed: ${result.message}`);
      }
      
      this.logger.info('Channels sync completed', result);
      
    } catch (error) {
      this.logger.error('Error syncing channels', error);
      await ctx.reply('❌ Error syncing channels. Please try again.');
    }
  }

  /**
   * Starts the AdminBot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.logger.info('Starting AdminBot...');
      
      this.logger.info('About to launch AdminBot...');
      await this.bot.launch();
      this.logger.info('AdminBot launch completed');
      
      this.isRunning = true;
      
      this.logger.info('AdminBot started successfully');
      
      // Enable graceful stop
      process.once('SIGINT', () => this.stop());
      process.once('SIGTERM', () => this.stop());
      
    } catch (error) {
      this.logger.error('Failed to start AdminBot', error);
      console.error('AdminBot start error:', error);
      throw handleTelegramError(error, 'AdminBot startup');
    }
  }

  /**
   * Stops the AdminBot gracefully
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.logger.info('Stopping AdminBot...');
      
      this.isRunning = false;
      this.bot.stop();
      
      this.logger.info('AdminBot stopped gracefully');
      
    } catch (error) {
      this.logger.error('Error stopping AdminBot', error);
      throw error;
    }
  }
}

export default AdminBot;