/**
 * @fileoverview Channel Handlers
 * Handles channel-related operations and views
 * @module presentation/handlers/channelHandlers
 */

import { Markup } from 'telegraf';
import { formatTimestamp } from '../../shared/helpers.js';
import { createChildLogger } from '../../shared/logger.js';

const logger = createChildLogger({ component: 'ChannelHandlers' });

/**
 * Creates channel handlers with injected dependencies
 * @param {Object} dependencies - Injected use cases and repositories
 * @returns {Object} Channel handler functions
 */
export function createChannelHandlers(dependencies) {
  const {
    channelRepository,
    toggleChannelForwardingUseCase,
    getChannelStatsUseCase,
    getUsersByChannelUseCase,
  } = dependencies;

  /**
   * Handles channels list display
   * @param {Object} ctx - Telegraf context
   */
  async function handleChannelsList(ctx) {
    try {
      // Get channels from repository
      const channels = await channelRepository.findAll();

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
      logger.error('Error showing channels', error);
      await ctx.reply('❌ Error loading channels');
    }
  }

  /**
   * Handles channel toggle
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID
   */
  async function handleToggleChannel(ctx, channelId) {
    try {
      // Toggle using use case
      const result = await toggleChannelForwardingUseCase.execute(
        channelId,
        null // Toggle current state
      );

      await ctx.answerCbQuery(`✅ ${result.message}`);
      await handleChannelDetails(ctx, channelId);

    } catch (error) {
      logger.error('Error toggling channel', error);
      await ctx.answerCbQuery('❌ Error toggling channel');
    }
  }

  /**
   * Handles channel details display
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID
   */
  async function handleChannelDetails(ctx, channelId) {
    try {
      // Get channel details using use case
      const result = await getChannelStatsUseCase.getChannelDetails(channelId);
      const channel = result.channel;

      // Get users count
      const usersResult = await getUsersByChannelUseCase.execute(channelId);

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
      logger.error('Error showing channel details', error);
      await ctx.reply('❌ Error loading channel details');
    }
  }

  return {
    handleChannelsList,
    handleToggleChannel,
    handleChannelDetails,
  };
}
