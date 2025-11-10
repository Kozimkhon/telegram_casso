/**
 * @fileoverview AdminBot Controller
 * Presentation layer controller for AdminBot functionality
 * Refactored from src/bots/adminBot.js with Clean Architecture
 * @module presentation/controllers/AdminBotController
 */

import { Telegraf, Markup } from 'telegraf';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../shared/logger.js';
import { asyncErrorHandler } from '../../shared/errorHandler.js';
import { formatTimestamp, chunkArray } from '../../shared/helpers.js';

/**
 * AdminBot Controller
 * Handles Telegram admin bot with Clean Architecture
 * 
 * @class AdminBotController
 */
class AdminBotController {
  /**
   * Telegraf bot instance
   * @private
   */
  #bot;

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
   * Running state
   * @private
   */
  #isRunning = false;

  /**
   * UserBot manager reference
   * @private
   */
  #userBotManager;

  /**
   * Creates AdminBot controller
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} userBotManager - UserBot manager
   */
  constructor(dependencies, userBotManager = null) {
    // Inject use cases
    this.#useCases = {
      // Channel use cases
      addChannel: dependencies.addChannelUseCase,
      toggleChannelForwarding: dependencies.toggleChannelForwardingUseCase,
      removeChannel: dependencies.removeChannelUseCase,
      getChannelStats: dependencies.getChannelStatsUseCase,
      
      // Session use cases
      getSessionStats: dependencies.getSessionStatsUseCase,
      pauseSession: dependencies.pauseSessionUseCase,
      resumeSession: dependencies.resumeSessionUseCase,
      deleteSession: dependencies.deleteSessionUseCase,
      
      // User use cases
      getUsersByChannel: dependencies.getUsersByChannelUseCase,
      
      // Message use cases
      getForwardingStats: dependencies.getForwardingStatsUseCase,
      cleanupOldMessages: dependencies.cleanupOldMessagesUseCase,
      
      // Admin use cases
      checkAdminAccess: dependencies.checkAdminAccessUseCase,
      addAdmin: dependencies.addAdminUseCase,
      getAdminStats: dependencies.getAdminStatsUseCase,
    };

    // Inject domain services
    this.#services = {
      metrics: dependencies.metricsService,
    };

    // Inject state manager
    this.#stateManager = dependencies.stateManager;

    // Inject repositories (for direct queries)
    this.channelRepository = dependencies.channelRepository;
    this.sessionRepository = dependencies.sessionRepository;

    // UserBot manager
    this.#userBotManager = userBotManager;

    // Logger
    this.#logger = createChildLogger({ component: 'AdminBotController' });

    // Create Telegraf bot
    this.#bot = new Telegraf(config.telegram.adminBotToken, {
      handlerTimeout: 90000,
    });

    // Setup bot
    this.#setupMiddleware();
    this.#setupCommands();
    this.#setupCallbacks();
  }

  /**
   * Starts AdminBot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.#logger.info('Starting AdminBot...');

      await this.#bot.launch();

      this.#isRunning = true;
      this.#logger.info('AdminBot started successfully');

    } catch (error) {
      this.#logger.error('Failed to start AdminBot', error);
      throw error;
    }
  }

  /**
   * Stops AdminBot
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.#logger.info('Stopping AdminBot...');

      await this.#bot.stop();

      this.#isRunning = false;
      this.#logger.info('AdminBot stopped');

    } catch (error) {
      this.#logger.error('Error stopping AdminBot', error);
    }
  }

  /**
   * Sets up middleware
   * @private
   */
  #setupMiddleware() {
    // Admin authentication middleware
    this.#bot.use(asyncErrorHandler(async (ctx, next) => {
      const userId = ctx.from?.id?.toString();

      if (!userId) {
        return;
      }

      try {
        // Check admin access using use case
        const access = await this.#useCases.checkAdminAccess.execute(userId);

        if (!access.hasAccess) {
          await ctx.reply('⛔ Access denied. You are not authorized to use this bot.');
          return;
        }

        // Store admin info in context
        ctx.state.admin = access;
        await next();

      } catch (error) {
        this.#logger.error('Middleware error', error);
        await ctx.reply('❌ Error checking permissions');
      }
    }));
  }

  /**
   * Sets up commands
   * @private
   */
  #setupCommands() {
    // Start command
    this.#bot.command('start', asyncErrorHandler(async (ctx) => {
      await this.#handleStart(ctx);
    }));

    // Channels command
    this.#bot.command('channels', asyncErrorHandler(async (ctx) => {
      await this.#handleChannelsList(ctx);
    }));

    // Sessions command
    this.#bot.command('sessions', asyncErrorHandler(async (ctx) => {
      await this.#handleSessionsList(ctx);
    }));

    // Stats command
    this.#bot.command('stats', asyncErrorHandler(async (ctx) => {
      await this.#handleStats(ctx);
    }));

    // Help command
    this.#bot.command('help', asyncErrorHandler(async (ctx) => {
      await this.#handleHelp(ctx);
    }));
  }

  /**
   * Sets up callback handlers
   * @private
   */
  #setupCallbacks() {
    // Main menu
    this.#bot.action('main_menu', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.#handleStart(ctx);
    }));

    // Channels list
    this.#bot.action('channels_list', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.#handleChannelsList(ctx);
    }));

    // Toggle channel forwarding
    this.#bot.action(/^toggle_channel_(.+)$/, asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      const channelId = ctx.match[1];
      await this.#handleToggleChannel(ctx, channelId);
    }));

    // Channel details
    this.#bot.action(/^channel_details_(.+)$/, asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      const channelId = ctx.match[1];
      await this.#handleChannelDetails(ctx, channelId);
    }));

    // Sessions list
    this.#bot.action('sessions_list', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.#handleSessionsList(ctx);
    }));

    // Forwarding stats
    this.#bot.action('forwarding_stats', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.#handleForwardingStats(ctx);
    }));

    // System stats
    this.#bot.action('system_stats', asyncErrorHandler(async (ctx) => {
      await ctx.answerCbQuery();
      await this.#handleSystemStats(ctx);
    }));
  }

  /**
   * Handles /start command
   * @private
   */
  async #handleStart(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Channels', 'channels_list')],
      [Markup.button.callback('🔧 Sessions', 'sessions_list')],
      [Markup.button.callback('📊 Statistics', 'system_stats')],
      [Markup.button.callback('📈 Forwarding Stats', 'forwarding_stats')],
    ]);

    const message = `
🤖 *Telegram Casso Admin Panel*

Welcome to the admin control panel!

Choose an option from the menu below:
    `.trim();

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
    } else {
      await ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
    }
  }

  /**
   * Handles channels list
   * @private
   */
  async #handleChannelsList(ctx) {
    try {
      // Get channels from repository
      const channels = await this.channelRepository.findAll();

      if (channels.length === 0) {
        await ctx.editMessageText('📋 No channels configured yet.');
        return;
      }

      // Build keyboard
      const buttons = channels.map(ch => [
        Markup.button.callback(
          `${ch.forwardEnabled ? '✅' : '❌'} ${ch.title}`,
          `channel_details_${ch.channelId}`
        )
      ]);

      buttons.push([Markup.button.callback('🔙 Back', 'main_menu')]);

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.editMessageText(
        `📋 *Channels* (${channels.length})\n\nClick to see details:`,
        { parse_mode: 'Markdown', ...keyboard }
      );

    } catch (error) {
      this.#logger.error('Error showing channels', error);
      await ctx.reply('❌ Error loading channels');
    }
  }

  /**
   * Handles channel toggle
   * @private
   */
  async #handleToggleChannel(ctx, channelId) {
    try {
      // Toggle using use case
      const result = await this.#useCases.toggleChannelForwarding.execute(
        channelId,
        null // Toggle current state
      );

      await ctx.answerCbQuery(`✅ ${result.message}`);
      await this.#handleChannelDetails(ctx, channelId);

    } catch (error) {
      this.#logger.error('Error toggling channel', error);
      await ctx.answerCbQuery('❌ Error toggling channel');
    }
  }

  /**
   * Handles channel details
   * @private
   */
  async #handleChannelDetails(ctx, channelId) {
    try {
      // Get channel details using use case
      const result = await this.#useCases.getChannelStats.getChannelDetails(channelId);
      const channel = result.channel;

      // Get users count
      const usersResult = await this.#useCases.getUsersByChannel.execute(channelId);

      const message = `
📋 *Channel Details*

*Title:* ${channel.title}
*ID:* \`${channel.channelId}\`
*Members:* ${usersResult.total}
*Forwarding:* ${channel.forwardEnabled ? '✅ Enabled' : '❌ Disabled'}
*Session:* ${channel.adminSessionPhone || 'Not linked'}
*Added:* ${formatTimestamp(channel.createdAt)}
      `.trim();

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback(
          channel.forwardEnabled ? '❌ Disable Forwarding' : '✅ Enable Forwarding',
          `toggle_channel_${channelId}`
        )],
        [Markup.button.callback('🔙 Back to Channels', 'channels_list')],
        [Markup.button.callback('🏠 Main Menu', 'main_menu')],
      ]);

      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
      this.#logger.error('Error showing channel details', error);
      await ctx.reply('❌ Error loading channel details');
    }
  }

  /**
   * Handles sessions list
   * @private
   */
  async #handleSessionsList(ctx) {
    try {
      // Get sessions from repository
      const sessions = await this.sessionRepository.findAll();

      if (sessions.length === 0) {
        await ctx.editMessageText('🔧 No sessions configured yet.');
        return;
      }

      let message = `🔧 *Active Sessions* (${sessions.length})\n\n`;

      sessions.forEach((session, idx) => {
        const statusIcon = session.isActive() ? '✅' : '❌';
        message += `${idx + 1}. ${statusIcon} ${session.phone}\n`;
        message += `   Status: ${session.status}\n`;
        message += `   Messages: ${session.messagesSent}\n`;
        message += `   Last Active: ${formatTimestamp(session.lastActive)}\n\n`;
      });

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back', 'main_menu')],
      ]);

      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
      this.#logger.error('Error showing sessions', error);
      await ctx.reply('❌ Error loading sessions');
    }
  }

  /**
   * Handles forwarding stats
   * @private
   */
  async #handleForwardingStats(ctx) {
    try {
      // Get stats using use case
      const result = await this.#useCases.getForwardingStats.execute();
      const stats = result.statistics;

      const message = `
📈 *Forwarding Statistics*

*Total Messages:* ${stats.total}
*Successful:* ${stats.successful} ✅
*Failed:* ${stats.failed} ❌
*Skipped:* ${stats.skipped} ⏭️
*Success Rate:* ${stats.successRate}%
      `.trim();

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back', 'main_menu')],
      ]);

      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
      this.#logger.error('Error showing forwarding stats', error);
      await ctx.reply('❌ Error loading statistics');
    }
  }

  /**
   * Handles system stats
   * @private
   */
  async #handleSystemStats(ctx) {
    try {
      // Get overall metrics using service
      const metrics = await this.#services.metrics.getOverallMetrics();

      const message = `
📊 *System Statistics*

*Sessions:*
  Active: ${metrics.sessions.active}
  Paused: ${metrics.sessions.paused}
  Error: ${metrics.sessions.error}

*Channels:*
  Total: ${metrics.channels.total}
  Enabled: ${metrics.channels.enabled}
  Disabled: ${metrics.channels.disabled}

*Users:*
  Total: ${metrics.users.total}
  With Username: ${metrics.users.withUsername}

*Messages:*
  Total: ${metrics.messages.total}
  Success Rate: ${metrics.messages.successRate}%
      `.trim();

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back', 'main_menu')],
      ]);

      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
      this.#logger.error('Error showing system stats', error);
      await ctx.reply('❌ Error loading statistics');
    }
  }

  /**
   * Handles /stats command
   * @private
   */
  async #handleStats(ctx) {
    await this.#handleSystemStats(ctx);
  }

  /**
   * Handles /help command
   * @private
   */
  async #handleHelp(ctx) {
    const message = `
📖 *Help - Available Commands*

/start - Show main menu
/channels - List all channels
/sessions - List all sessions
/stats - Show system statistics
/help - Show this help message

*Features:*
• Manage channels and forwarding settings
• Monitor active sessions
• View forwarding statistics
• Real-time system metrics
    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
  }

  /**
   * Gets status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      isRunning: this.#isRunning,
    };
  }
}

export default AdminBotController;
