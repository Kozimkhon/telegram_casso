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
  async function handleChannelsList(ctx, page = 1) {
    try {
      // Get channels from repository

      const channels = await channelRepository.findAll();
      // Build keyboard
      const itemsPerPage = 5;
      const totalPages = Math.ceil(channels.length / itemsPerPage);
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageChannels = channels.slice(startIndex, endIndex);
      const buttons = [];
      let text = `📋 *Channels Management* (Page ${page}/${totalPages})\n\n`;

      if (channels.length === 0) {
        text += "❌ No channels found. UserBot needs to sync channels first.";
      } else {
        text += `Total channels: ${channels.length}\n\n`;

        pageChannels.forEach((channel, index) => {
          const status = channel.forwardEnabled ? "✅ Enabled" : "❌ Disabled";
          const number = startIndex + index + 1;
          text += `${number}. *${channel.title}*\n`;
          text += `   Status: ${status}\n`;
          text += `   ID: \`${channel.channelId}\`\n\n`;
        });

      }
      // Sync button at the top
      buttons.push([
        Markup.button.callback("🔄 Sync Channels", "sync_channels"),
      ]);

      // Channel control buttons
      pageChannels.forEach((channel, index) => {
        const number = startIndex + index + 1;
        const toggleText = channel.forward_enabled
          ? `❌ Disable ${number}`
          : `✅ Enable ${number}`;
        buttons.push([
          Markup.button.callback(
            toggleText,
            `toggle_channel_${channel.channel_id}`
          ),
          Markup.button.callback(
            `🗑 Remove ${number}`,
            `remove_channel_${channel.channel_id}`
          ),
        ]);
      });

      // Pagination buttons
      if (totalPages > 1) {
        const paginationButtons = [];
        if (page > 1) {
          paginationButtons.push(
            Markup.button.callback("⬅️ Previous", `channels_page_${page - 1}`)
          );
        }
        if (page < totalPages) {
          paginationButtons.push(
            Markup.button.callback("➡️ Next", `channels_page_${page + 1}`)
          );
        }
        if (paginationButtons.length > 0) {
          buttons.push(paginationButtons);
        }
      }

      // Back to main menu
      buttons.push([Markup.button.callback("🏠 Main Menu", "main_menu")]);

      const keyboard = Markup.inlineKeyboard(buttons);

      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        ...keyboard,
      });


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
