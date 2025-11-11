/**
 * @fileoverview Command Handlers Middleware
 * Registers all bot commands
 * @module presentation/middleware/commands
 */

import { asyncErrorHandler } from '../../shared/errorHandler.js';

/**
 * Sets up all bot commands
 * @param {Object} bot - Telegraf bot instance
 * @param {Object} handlers - Handler functions object
 */
export function setupCommands(bot, handlers) {
  // Start command
  bot.command('start', asyncErrorHandler(async (ctx) => {
    await handlers.handleStart(ctx);
  }));

  // Channels command
  bot.command('channels', asyncErrorHandler(async (ctx) => {
    await handlers.handleChannelsList(ctx);
  }));

  // Sessions command
  bot.command('sessions', asyncErrorHandler(async (ctx) => {
    await handlers.handleSessionsList(ctx);
  }));

  // Stats command
  bot.command('stats', asyncErrorHandler(async (ctx) => {
    await handlers.handleStats(ctx);
  }));

  // Help command
  bot.command('help', asyncErrorHandler(async (ctx) => {
    await handlers.handleHelp(ctx);
  }));
}
