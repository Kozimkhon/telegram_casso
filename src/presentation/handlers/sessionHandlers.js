/**
 * @fileoverview Session Handlers
 * Handles session-related operations and views
 * @module presentation/handlers/sessionHandlers
 */

import { Markup } from 'telegraf';
import { formatTimestamp } from '../../shared/helpers.js';
import { createChildLogger } from '../../shared/logger.js';

const logger = createChildLogger({ component: 'SessionHandlers' });

/**
 * Creates session handlers with injected dependencies
 * @param {Object} dependencies - Injected repositories
 * @returns {Object} Session handler functions
 */
export function createSessionHandlers(dependencies) {
  const { sessionRepository } = dependencies;

  /**
   * Handles sessions list display
   * @param {Object} ctx - Telegraf context
   */
  async function handleSessionsList(ctx) {
    try {
      // Get sessions from repository
      const sessions = await sessionRepository.findAll();

      if (sessions.length === 0) {

          const keyboard = Markup.inlineKeyboard([
              [Markup.button.callback("📱 Add Session", "add_session")],
              [Markup.button.callback("🏠 Main Menu", "main_menu")],
            ]);
        await ctx.editMessageText('🔧 No sessions configured yet.'
        , { parse_mode: 'Markdown', ...keyboard }
        );
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
      logger.error('Error showing sessions', error);
      await ctx.reply('❌ Error loading sessions');
    }
  }

  return {
    handleSessionsList,
  };
}
