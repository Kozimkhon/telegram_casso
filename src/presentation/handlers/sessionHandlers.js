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
  const { sessionRepository, adminRepository, deleteSessionUseCase, stateManager } = dependencies;

  const escapeMarkdown = (text) => {
    if (!text) return text;
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  };

  /**
   * Handles sessions list display
   * @param {Object} ctx - Telegraf context
   */
  async function handleSessionsList(ctx) {
    try {
      const sessions = await sessionRepository.findAll();

      if (sessions.length === 0) {
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📱 Add Session', 'add_session')],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')],
        ]);
        await ctx.editMessageText('🔧 No sessions configured yet.', {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        return;
      }

      let message = `🔧 *Active Sessions* (${sessions.length})\n\n`;
      const buttons = [];

      for (let idx = 0; idx < sessions.length; idx++) {
        const session = sessions[idx];
        const admin = await adminRepository.findByUserId(session.adminId);

        const statusIcon = session.isActive() ? '✅' : '❌';
        const phone = escapeMarkdown(admin?.phone || 'No phone');
        const username = admin?.username ? escapeMarkdown(`@${admin.username}`) : 'No username';

        message += `${idx + 1}. ${statusIcon} ${phone}\n`;
        message += `   Username: ${username}\n`;
        message += `   Status: ${session.status}\n`;
        message += `   Last Active: ${formatTimestamp(session.lastActive)}\n`;

        if (session.lastError) {
          message += `   ⚠️ Error: ${escapeMarkdown(session.lastError)}\n`;
        }
        if (session.floodWaitUntil && new Date() < session.floodWaitUntil) {
          message += `   🕐 Flood wait until: ${formatTimestamp(session.floodWaitUntil)}\n`;
        }

        message += `\n`;
        buttons.push([
          Markup.button.callback(`🗑 Delete session ${idx + 1} (${admin?.phone || session.adminId})`, `delete_session_${session.adminId}`),
        ]);
      }

      buttons.push([Markup.button.callback('📱 Add Session', 'add_session')]);
      buttons.push([Markup.button.callback('🔙 Back', 'main_menu')]);

      const keyboard = Markup.inlineKeyboard(buttons);
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });

    } catch (error) {
      logger.error('Error showing sessions', error);
      await ctx.reply('❌ Error loading sessions');
    }
  }

  /**
   * Handles delete session confirmation dialog
   * @param {Object} ctx - Telegraf context
   * @param {string} adminId - Admin ID of session to delete
   */
  async function handleDeleteSession(ctx, adminId) {
    try {
      const session = await sessionRepository.findByAdminId(adminId);
      if (!session) {
        await ctx.editMessageText('❌ Session not found.', {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'sessions_list' }]] },
        });
        return;
      }

      const admin = await adminRepository.findByUserId(adminId);
      const phone = escapeMarkdown(admin?.phone || adminId);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes, delete', `confirm_delete_session_${adminId}`)],
        [Markup.button.callback('❌ Cancel', 'sessions_list')],
      ]);

      await ctx.editMessageText(
        `⚠️ *Delete Session*\n\nAre you sure you want to delete the session for *${phone}*?\n\nThis will:\n• Stop the UserBot\n• Unlink all associated channels\n• Remove the session permanently`,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } catch (error) {
      logger.error('Error showing delete confirmation', error);
      await ctx.reply('❌ Error loading session info');
    }
  }

  /**
   * Executes session deletion and redirects to add_session if own session deleted
   * @param {Object} ctx - Telegraf context
   * @param {string} adminId - Admin ID of session to delete
   */
  async function handleConfirmDeleteSession(ctx, adminId) {
    try {
      await ctx.editMessageText('🔄 Deleting session...');

      await deleteSessionUseCase.execute(adminId);

      const currentUserId = ctx.from.id.toString();
      const isOwnSession = currentUserId === adminId;

      if (isOwnSession) {
        // Own session deleted — redirect to add new session
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📱 Add New Session', 'add_session')],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')],
        ]);
        await ctx.editMessageText(
          '✅ *Session deleted successfully.*\n\nYour UserBot session has been removed\\. Add a new session to continue:',
          { parse_mode: 'Markdown', ...keyboard }
        );
      } else {
        // Someone else's session deleted — go back to sessions list
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔧 Sessions List', 'sessions_list')],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')],
        ]);
        await ctx.editMessageText('✅ Session deleted successfully.', { ...keyboard });
      }

      logger.info('Session deleted', { adminId, deletedBy: currentUserId });
    } catch (error) {
      logger.error('Error deleting session', error);
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back', 'sessions_list')],
      ]);
      await ctx.editMessageText(`❌ Failed to delete session: ${error.message}`, { ...keyboard });
    }
  }

  return {
    handleSessionsList,
    handleDeleteSession,
    handleConfirmDeleteSession,
  };
}
