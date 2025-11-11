/**
 * @fileoverview Main Menu Handler
 * Handles main menu display and navigation
 * @module presentation/handlers/menuHandlers
 */

import { Markup } from 'telegraf';

/**
 * Handles /start command and main menu
 * @param {Object} ctx - Telegraf context
 */
export async function handleStart(ctx) {
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
 * Handles /help command
 * @param {Object} ctx - Telegraf context
 */
export async function handleHelp(ctx) {
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
 * Handles contact support callback
 * @param {Object} ctx - Telegraf context
 */
export async function handleContactSupport(ctx) {
  const message = `
📞 *Contact Support*

For assistance, please contact the system administrator.

You can reach out via:
• Email: support@example.com
• Telegram: @admin_username
  `.trim();

  await ctx.editMessageText(message, { parse_mode: 'Markdown' });
}
