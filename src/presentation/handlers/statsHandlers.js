/**
 * @fileoverview Statistics Handlers
 * Handles statistics and metrics display
 * @module presentation/handlers/statsHandlers
 */

import { Markup } from 'telegraf';
import { createChildLogger } from '../../shared/logger.js';

const logger = createChildLogger({ component: 'StatsHandlers' });

/**
 * Creates statistics handlers with injected dependencies
 * @param {Object} dependencies - Injected use cases and services
 * @returns {Object} Statistics handler functions
 */
export function createStatsHandlers(dependencies) {
  const {
    getForwardingStatsUseCase,
    metricsService,
  } = dependencies;

  /**
   * Handles forwarding statistics display
   * @param {Object} ctx - Telegraf context
   */
  async function handleForwardingStats(ctx) {
    try {
      // Get stats using use case
      const result = await getForwardingStatsUseCase.execute();
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
      logger.error('Error showing forwarding stats', error);
      await ctx.reply('❌ Error loading statistics');
    }
  }

  /**
   * Handles system statistics display
   * @param {Object} ctx - Telegraf context
   */
  async function handleSystemStats(ctx) {
    try {
      // Get overall metrics using service
      const metrics = await metricsService.getOverallMetrics();

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
      logger.error('Error showing system stats', error);
      await ctx.reply('❌ Error loading statistics');
    }
  }

  /**
   * Handles /stats command (alias for system stats)
   * @param {Object} ctx - Telegraf context
   */
  async function handleStats(ctx) {
    await handleSystemStats(ctx);
  }

  return {
    handleForwardingStats,
    handleSystemStats,
    handleStats,
  };
}
