/**
 * @fileoverview Callback Query Handlers Middleware
 * Registers all callback query handlers
 * @module presentation/middleware/callbacks
 */

import { asyncErrorHandler } from '../../shared/errorHandler.js';

/**
 * Sets up all callback query handlers
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} handlers - Handler functions object
 */
export function setupCallbacks(bot, handlers) {
  // Main menu
  bot.action('main_menu', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleStart(ctx);
  }));

  // Channels list
  bot.action('channels_list', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleChannelsList(ctx);
  }));

  // Toggle channel forwarding
  bot.action(/^toggle_channel_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const channelId = ctx.match[1];
    await handlers.handleToggleChannel(ctx, channelId);
  }));

  // Channel details
  bot.action(/^channel_details_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const channelId = ctx.match[1];
    await handlers.handleChannelDetails(ctx, channelId);
  }));

  // Sessions list
  bot.action('sessions_list', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleSessionsList(ctx);
  }));

  // Forwarding stats
  bot.action('forwarding_stats', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleForwardingStats(ctx);
  }));

  // System stats
  bot.action('system_stats', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleSystemStats(ctx);
  }));

  // Register admin
  bot.action('register_admin', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleAdminRegistration(ctx);
  }, 'Register admin callback'));

  // Contact support
  bot.action('contact_support', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleContactSupport(ctx);
  }));

  // === Session Authentication Callbacks ===

  // Add session
  bot.action('add_session', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleStartPhoneInput(ctx);
  }));

  // Phone numpad callbacks
  bot.action(/^phone_(\d)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const digit = ctx.match[1];
    await handlers.handlePhoneDigit(ctx, digit);
  }));

  bot.action('phone_plus', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handlePhoneDigit(ctx, '+');
  }));

  bot.action('phone_backspace', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handlePhoneBackspace(ctx);
  }));

  bot.action('phone_confirm', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    setImmediate(async () => {
      try {
        await handlers.handleConfirmPhoneNumber(ctx);
      } catch (error) {
        await ctx.editMessageText(
          `❌ <b>Error</b>\n\nFailed to process phone confirmation: ${error.message}\n\nPlease try again.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Try Again', callback_data: 'add_session' },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]]
            }
          }
        );
      }
    });
  }));

  // Code numpad callbacks
  bot.action(/^code_(\d)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const digit = ctx.match[1];
    await handlers.handleCodeDigit(ctx, digit);
  }));

  bot.action('code_backspace', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    await handlers.handleCodeBackspace(ctx);
  }));

  bot.action('code_confirm', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    setImmediate(async () => {
      try {
        await handlers.handleConfirmVerificationCode(ctx);
      } catch (error) {
        await ctx.editMessageText(
          `❌ <b>Error</b>\n\nFailed to verify code: ${error.message}\n\nPlease try again.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔄 Try Again', callback_data: 'add_session' },
                { text: '🏠 Main Menu', callback_data: 'main_menu' }
              ]]
            }
          }
        );
      }
    });
  }));

  // Cancel authentication
  bot.action(/^cancel_auth_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const authId = ctx.match[1];
    await handlers.handleCancelAuth(ctx, authId);
  }));

  bot.action('queue_status', asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    setImmediate(async () => {
      try {
        await handlers.handleQueueStatus(ctx);//TODO implement
      } catch (error) {
        await ctx.editMessageText(
          `❌ <b>Error</b>\n\nFailed to retrieve queue status: ${error.message}\n\nPlease try again.`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          }
        );
      }
    });
  }));

  bot.action( /^remove_channel_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const channelId = ctx.match[1];
    await handlers.handleRemoveChannel(ctx, channelId);//TODO implement
  }));

  bot.action( /^confirm_remove_(.+)$/, asyncErrorHandler(async (ctx) => {
    await ctx.answerCbQuery();
    const channelId = ctx.match[1];
    await handlers.handleConfirmRemoveChannel(ctx, channelId);//TODO implement
  }));

  bot.action(
      /^channels_page_(\d+)$/,
      asyncErrorHandler(async (ctx) => {
        await ctx.answerCbQuery();
        const page = parseInt(ctx.match[1]);
        await handlers.handleChannelsList(ctx, page);
      }, "Channels page callback")
    );
    bot.action(
      "sync_channels",
      asyncErrorHandler(async (ctx) => {
        await ctx.answerCbQuery("⏳ Syncing channels...");
        await handlers.syncChannels(ctx);//TODO implement
      }, "Sync channels callback")
    );

}
