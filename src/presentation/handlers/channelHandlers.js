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

      const channels = await channelRepository.findByAdminSession(ctx.from.id.toString())||[];

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
      // Sync buttons at the top
      buttons.push([
        Markup.button.callback("🔄 Sync Channels", "sync_channels"),
        Markup.button.callback("📊 Sync Actions", "sync_actions"),
      ]);

      // Channel control buttons
      pageChannels.forEach((channel, index) => {
        const number = startIndex + index + 1;
        const toggleText = channel.forwardEnabled
          ? `❌ Disable ${number}`
          : `✅ Enable ${number}`;
        buttons.push([
          Markup.button.callback(
            toggleText,
            `toggle_channel_${channel.channelId}`
          ),
          Markup.button.callback(
            `🗑 Remove ${number}`,
            `remove_channel_${channel.channelId}`
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
   * Checks that channel belongs to the caller; shows "not found" otherwise
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID
   * @returns {Promise<boolean>} True if caller owns the channel
   */
  async function ensureOwnChannel(ctx, channelId) {
    const channel = await channelRepository.findByChannelId(channelId);

    if (channel && channel.adminId?.toString() === ctx.from.id.toString()) {
      return true;
    }

    logger.warn('Channel access denied', { channelId, userId: ctx.from.id });
    await ctx.editMessageText('❌ Channel not found.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Channels', 'channels_list')],
      ]),
    });
    return false;
  }

  /**
   * Handles channel toggle
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID
   */
  async function handleToggleChannel(ctx, channelId) {
    try {
      if (!(await ensureOwnChannel(ctx, channelId))) return;

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
      if (!(await ensureOwnChannel(ctx, channelId))) return;

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
*Session Admin:* ${channel.adminId || 'Not linked'}
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
      
      // Send more detailed error
      const errorMessage = `❌ Error loading channel details\n\nError: ${error.message}`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Back to Channels', 'channels_list')],
        [Markup.button.callback('🏠 Main Menu', 'main_menu')],
      ]);
      
      try {
        await ctx.editMessageText(errorMessage, { 
          parse_mode: 'Markdown',
          ...keyboard 
        });
      } catch (editError) {
        await ctx.reply(errorMessage, { 
          parse_mode: 'Markdown',
          ...keyboard 
        });
      }
    }
  }

  /**
   * Handles channel removal confirmation
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID
   */
  async function handleRemoveChannel(ctx, channelId) {
    try {
      // Get channel details
      if (!(await ensureOwnChannel(ctx, channelId))) return;

      const channel = await channelRepository.findByChannelId(channelId);

      const text = `⚠️ *Confirm Channel Removal*\n\nAre you sure you want to remove this channel?\n\n*${channel.title}*\nID: \`${channel.channelId}\`\n\n*This action cannot be undone.*`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Yes, Remove', `confirm_remove_${channelId}`),
          Markup.button.callback('❌ Cancel', 'channels_list'),
        ],
      ]);

      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

    } catch (error) {
      logger.error('Error showing remove confirmation', { channelId, error });
      await ctx.reply('❌ Error loading confirmation dialog.');
    }
  }

  /**
   * Handles channel removal confirmation
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Channel ID
   */
  async function handleConfirmRemoveChannel(ctx, channelId) {
    try {
      if (!(await ensureOwnChannel(ctx, channelId))) return;

      // Use RemoveChannelUseCase if provided
      if (dependencies.removeChannelUseCase) {
        const result = await dependencies.removeChannelUseCase.execute(channelId);
        
        if (result.success) {
          await ctx.editMessageText(
            `✅ Channel removed successfully.\n\n${result.clearedMembers} members cleared.`
          );
        }
      } else {
        // Fallback to direct repository call
        const deleted = await channelRepository.delete(channelId);
        
        if (deleted) {
          await ctx.editMessageText('✅ Channel removed successfully.');
        } else {
          await ctx.editMessageText('❌ Channel not found or already removed.');
        }
      }

      // Return to channels list after 2 seconds
      setTimeout(async () => {
        try {
          await handleChannelsList(ctx, 1);
        } catch (error) {
          logger.error('Error returning to channels list', error);
        }
      }, 2000);

    } catch (error) {
      logger.error('Error removing channel', { channelId, error });
      await ctx.editMessageText('❌ Error removing channel.');
    }
  }

  /**
   * Handles channel sync from UserBot
   * @param {Object} ctx - Telegraf context
   */
  async function handleSyncChannels(ctx) {
    try {
      // Get StateManager instance
      const stateManager = dependencies.stateManager;
      
      if (!stateManager) {
        await ctx.editMessageText('❌ StateManager not available.');
        return;
      }

      // Get active sessions
      const sessions = await dependencies.sessionRepository.findActive();
      
      if (sessions.length === 0) {
        await ctx.editMessageText('❌ No active UserBot sessions found. Please add a session first.');
        return;
      }
      
      // Get bot instance from StateManager
      const botInstance = stateManager.getBot(ctx.from.id.toString());
      
      if (!botInstance || !botInstance.syncChannelsManually) {
        await ctx.editMessageText('❌ UserBot is not connected. Cannot sync channels.');
        return;
      }

      // Show processing message
      await ctx.editMessageText('🔄 Syncing channels from Telegram...\n\nThis may take a few moments.');

      // Perform sync
      const result = await botInstance.syncChannelsManually();

      if (result.success) {
        await ctx.editMessageText(`✅ ${result.message}`);
        
        // Refresh channels list after 2 seconds
        setTimeout(async () => {
          try {
            await handleChannelsList(ctx, 1);
          } catch (error) {
            logger.error('Error refreshing channels list', error);
          }
        }, 2000);
      } else {
        await ctx.editMessageText(`❌ Sync failed: ${result.message}`);
      }

      logger.info('Channels sync completed', result);

    } catch (error) {
      logger.error('Error syncing channels', error);
      await ctx.editMessageText('❌ Error syncing channels. Please try again.');
    }
  }

  /**
   * Handles manual actions (logs) sync from channels
   * @param {Object} ctx - Telegraf context
   */
  async function handleSyncActions(ctx) {
    try {
      // Get StateManager instance
      const stateManager = dependencies.stateManager;
      
      if (!stateManager) {
        await ctx.editMessageText('❌ StateManager not available.');
        return;
      }

      const adminId = ctx.from.id.toString();

      // Get bot instance from StateManager
      const botInstance = stateManager.getBot(adminId);
      
      if (!botInstance) {
        await ctx.editMessageText('❌ UserBot is not connected. Cannot fetch logs.');
        return;
      }

      // Get ChannelLogFetcherService from StateManager
      const channelLogFetcherService = stateManager.getService('channelLogFetcherService');
      
      if (!channelLogFetcherService) {
        await ctx.editMessageText('❌ Channel log fetcher service not available.');
        return;
      }

      // Show processing message
      await ctx.editMessageText('🔄 Fetching admin logs from channels...\n\nThis may take a few moments.');

      // Fetch logs using the service
      const client = botInstance.getClient();
      const result = await channelLogFetcherService.fetchAllAdminChannelLogs(client, adminId);

      // Format result message
      let message = '✅ <b>Admin Logs Sync Complete</b>\n\n';
      message += `📊 <b>Summary:</b>\n`;
      message += `• Total Channels: ${result.totalChannels}\n`;
      message += `• Total Logs Fetched: ${result.totalLogs}\n\n`;

      if (result.channelResults && result.channelResults.length > 0) {
        message += '<b>Channel Results:</b>\n';
        result.channelResults.forEach((ch, idx) => {
          const icon = ch.logsCount > 0 ? '✅' : '⚪️';
          message += `${icon} ${idx + 1}. <b>${ch.channelTitle}</b>: ${ch.logsCount} logs\n`;
        });
      }

      if (result.errors && result.errors.length > 0) {
        message += '\n❌ <b>Errors:</b>\n';
        result.errors.forEach((err, idx) => {
          message += `${idx + 1}. ${err.channelId}: ${err.error}\n`;
        });
      }

      await ctx.editMessageText(message, { parse_mode: 'HTML' });

      // Return to channels list after 3 seconds
      setTimeout(async () => {
        try {
          await handleChannelsList(ctx, 1);
        } catch (error) {
          logger.error('Error returning to channels list', error);
        }
      }, 3000);

      logger.info('Manual actions sync completed', { adminId, result });

    } catch (error) {
      logger.error('Error syncing actions', error);
      await ctx.editMessageText(`❌ Error fetching admin logs: ${error.message}\n\nPlease try again.`, {
        parse_mode: 'HTML'
      });
    }
  }

  return {
    handleChannelsList,
    handleToggleChannel,
    handleChannelDetails,
    handleRemoveChannel,
    handleConfirmRemoveChannel,
    handleSyncChannels,
    handleSyncActions,
  };
}
