/**
 * @fileoverview Report Handlers
 * AdminBot handlers for channel posts reports (Excel)
 * @module presentation/handlers/reportHandlers
 */

import { Markup } from 'telegraf';
import { createChildLogger } from '../../shared/logger.js';
import {
  lastDaysPeriod,
  formatDay,
} from '../../domain/services/ChannelReportService.js';

const logger = createChildLogger({ component: 'ReportHandlers' });

/** Default report period for button reports (days) */
const REPORT_DAYS = 30;

/**
 * Escapes text for Telegram HTML
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Creates report handlers with injected dependencies
 * @param {Object} dependencies
 * @param {ChannelRepository} dependencies.channelRepository
 * @param {ChannelReportService} dependencies.channelReportService
 * @returns {Object} Report handler functions
 */
export function createReportHandlers(dependencies) {
  const { channelRepository, channelReportService } = dependencies;

  /**
   * Shows list of admin's own channels to choose for report
   * @param {Object} ctx - Telegraf context
   */
  async function handleReportMenu(ctx) {
    try {
      const adminId = ctx.from.id.toString();
      const channels = await channelRepository.findByAdminSession(adminId) || [];

      const buttons = channels.map(channel => [
        Markup.button.callback(`📢 ${channel.title}`, `report_ch_${channel.channelId}`),
      ]);

      if (channels.length > 1) {
        buttons.push([Markup.button.callback('📦 Barcha kanallar', 'report_all')]);
      }
      buttons.push([Markup.button.callback('🏠 Main Menu', 'main_menu')]);

      const text = channels.length === 0
        ? '📑 <b>Hisobot</b>\n\n❌ Kanallar topilmadi. Avval kanallarni sync qiling.'
        : `📑 <b>Hisobot</b>\n\nOxirgi ${REPORT_DAYS} kunlik postlar hisoboti (Excel).\nKanalni tanlang:`;

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      logger.error('Error showing report menu', error);
      await ctx.reply('❌ Hisobot menyusini ochishda xatolik');
    }
  }

  /**
   * Builds and sends report for one channel (only if caller owns it)
   * @param {Object} ctx - Telegraf context
   * @param {string} channelId - Telegram channel ID
   */
  async function handleChannelReport(ctx, channelId) {
    const adminId = ctx.from.id.toString();
    const channel = await channelRepository.findByChannelId(channelId);

    if (!channel || channel.adminId?.toString() !== adminId) {
      await ctx.editMessageText('❌ Kanal topilmadi.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'report_menu')]]),
      });
      return;
    }

    await sendReport(ctx, [channel], `report_${channelId}`);
  }

  /**
   * Builds and sends report for all caller's channels
   * @param {Object} ctx - Telegraf context
   */
  async function handleAllChannelsReport(ctx) {
    const adminId = ctx.from.id.toString();
    const channels = await channelRepository.findByAdminSession(adminId) || [];

    if (channels.length === 0) {
      await ctx.editMessageText('❌ Kanallar topilmadi.');
      return;
    }

    await sendReport(ctx, channels, 'report_all');
  }

  /**
   * Builds Excel for channels and sends it as document
   * @param {Object} ctx - Telegraf context
   * @param {Object[]} channels - Channels (already ownership-checked)
   * @param {string} filePrefix - File name prefix (ASCII)
   */
  async function sendReport(ctx, channels, filePrefix) {
    try {
      await ctx.editMessageText('⏳ Hisobot tayyorlanmoqda...');

      const { from, to } = lastDaysPeriod(REPORT_DAYS);
      const { buffer, totalPosts } = await channelReportService.buildReport({ channels, from, to });

      const title = channels.length === 1 ? escapeHtml(channels[0].title) : `${channels.length} ta kanal`;
      const filename = `${filePrefix}_${formatDay(from)}_${formatDay(to)}.xlsx`;

      await ctx.replyWithDocument(
        { source: buffer, filename },
        {
          caption: `📑 <b>${title}</b>\n${formatDay(from)} — ${formatDay(to)}\nPostlar: ${totalPosts}`,
          parse_mode: 'HTML',
        }
      );

      await ctx.editMessageText('✅ Hisobot yuborildi.', {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📑 Boshqa hisobot', 'report_menu')],
          [Markup.button.callback('🏠 Main Menu', 'main_menu')],
        ]),
      });
    } catch (error) {
      logger.error('Error building report', error);
      await ctx.editMessageText('❌ Hisobot tayyorlashda xatolik. Qayta urinib ko\'ring.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'report_menu')]]),
      });
    }
  }

  return {
    handleReportMenu,
    handleChannelReport,
    handleAllChannelsReport,
  };
}
