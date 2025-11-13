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
*Successful:* ${stats.success} ✅
*Failed:* ${stats.failed} ❌
*Skipped:* ${stats.skipped} ⏭️
*Pending:* ${stats.pending} ⏳
*Success Rate:* ${stats.successRate}
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

  /**
   * Handles queue status display
   * @param {Object} ctx - Telegraf context
   */
  async function handleQueueStatus(ctx) {
    try {
      let statusText = `🎛️ *Queue Status - Multi-Session System*\n\n`;

      // Get all sessions
      const sessions = await dependencies.sessionRepository.findAll();
      
      if (sessions.length === 0) {
        statusText += `📋 No active sessions\n\n`;
      } else {
        // Display queue status for each session
        for (const session of sessions) {
          const emoji = session.status === 'active' ? '✅' : 
                       session.status === 'paused' ? '⏸️' : 
                       session.status === 'error' ? '❌' : '⏹️';
          
          statusText += `${emoji} *Admin ID: ${session.adminId}*\n`;
          statusText += `   Status: ${session.status}\n`;
          
          if (session.autoPaused) {
            statusText += `   Auto-paused: Yes\n`;
            if (session.pauseReason) {
              statusText += `   Reason: ${session.pauseReason}\n`;
            }
          }
          
          if (session.floodWaitUntil) {
            const waitTime = new Date(session.floodWaitUntil).getTime() - Date.now();
            if (waitTime > 0) {
              const minutes = Math.ceil(waitTime / 60000);
              statusText += `   Flood wait: ${minutes} minutes\n`;
            }
          }
          
          statusText += `\n`;
        }
      }

      // Add session summary
      const activeCount = sessions.filter(s => s.status === 'active').length;
      const pausedCount = sessions.filter(s => s.status === 'paused').length;
      const errorCount = sessions.filter(s => s.status === 'error').length;

      statusText += `📊 *Session Summary*\n`;
      statusText += `Active: ${activeCount}\n`;
      statusText += `Paused: ${pausedCount}\n`;
      statusText += `Error: ${errorCount}\n`;
      statusText += `Total: ${sessions.length}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'queue_status')],
        [Markup.button.callback('⬅️ Back to Menu', 'main_menu')],
      ]);

      await ctx.editMessageText(statusText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

    } catch (error) {
      logger.error('Error showing queue status', error);
      await ctx.reply('❌ Error loading queue status');
    }
  }

  return {
    handleForwardingStats,
    handleSystemStats,
    handleStats,
    handleQueueStatus,
  };
}
