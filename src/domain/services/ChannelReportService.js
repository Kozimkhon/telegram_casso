/**
 * @fileoverview Channel Report Service
 * Builds Excel reports from stored channel posts
 * @module domain/services/ChannelReportService
 */

import ExcelJS from 'exceljs';
import { log } from '../../shared/logger.js';
import { PARSED_COLUMNS, parsePost } from './postParser.js';

/**
 * Report timezone offset: Asia/Tashkent (UTC+5, no DST)
 */
const TZ_OFFSET_SEC = 5 * 60 * 60;

/**
 * Returns period [from, to) of given month in report timezone
 * @param {number} year - Full year
 * @param {number} monthIndex - Month index (0-11)
 * @returns {{from: number, to: number}} Unix timestamps
 */
export function monthPeriod(year, monthIndex) {
  return {
    from: Date.UTC(year, monthIndex, 1) / 1000 - TZ_OFFSET_SEC,
    to: Date.UTC(year, monthIndex + 1, 1) / 1000 - TZ_OFFSET_SEC,
  };
}

/**
 * Returns year and month index of a moment in report timezone
 * @param {number} [nowSec] - Unix timestamp
 * @returns {{year: number, monthIndex: number}}
 */
export function localYearMonth(nowSec = Math.floor(Date.now() / 1000)) {
  const local = new Date((nowSec + TZ_OFFSET_SEC) * 1000);
  return { year: local.getUTCFullYear(), monthIndex: local.getUTCMonth() };
}

/**
 * Returns previous calendar month period in report timezone
 * @param {number} [nowSec] - Unix timestamp
 * @returns {{from: number, to: number, year: number, monthIndex: number}}
 */
export function previousMonthPeriod(nowSec = Math.floor(Date.now() / 1000)) {
  const { year, monthIndex } = localYearMonth(nowSec);
  const prevYear = monthIndex === 0 ? year - 1 : year;
  const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
  return { ...monthPeriod(prevYear, prevMonth), year: prevYear, monthIndex: prevMonth };
}

/**
 * Returns period of last N days ending now
 * @param {number} days - Number of days
 * @param {number} [nowSec] - Unix timestamp
 * @returns {{from: number, to: number}}
 */
export function lastDaysPeriod(days, nowSec = Math.floor(Date.now() / 1000)) {
  return { from: nowSec - days * 24 * 60 * 60, to: nowSec + 1 };
}

/**
 * Formats unix timestamp in report timezone: "YYYY-MM-DD HH:mm"
 * @param {number|null} sec - Unix timestamp
 * @returns {string}
 */
export function formatDate(sec) {
  if (!sec) return '';
  return new Date((sec + TZ_OFFSET_SEC) * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Formats unix timestamp as date only: "YYYY-MM-DD"
 * @param {number} sec - Unix timestamp
 * @returns {string}
 */
export function formatDay(sec) {
  return formatDate(sec).slice(0, 10);
}

/**
 * Builds public link to channel post
 * @param {Object} channel - Channel entity
 * @param {number} messageId - Message ID
 * @returns {string}
 */
function postLink(channel, messageId) {
  if (channel.username) {
    return `https://t.me/${channel.username}/${messageId}`;
  }
  const internalId = channel.channelId.toString().replace(/^-100/, '');
  return `https://t.me/c/${internalId}/${messageId}`;
}

/**
 * Collapses album items (same groupedId) into one report row
 * @param {Object[]} posts - Posts of one channel ordered by date
 * @returns {Object[]} Report items
 */
function collapseAlbums(posts) {
  const items = [];
  const albums = new Map();

  for (const post of posts) {
    if (!post.groupedId) {
      items.push({ ...post, itemsCount: 1 });
      continue;
    }

    const album = albums.get(post.groupedId);
    if (!album) {
      const item = { ...post, itemsCount: 1, allDeleted: !!post.deletedAt };
      albums.set(post.groupedId, item);
      items.push(item);
      continue;
    }

    album.itemsCount++;
    album.messageId = Math.min(album.messageId, post.messageId);
    album.postedAt = Math.min(album.postedAt, post.postedAt);
    if (!album.text && post.text) album.text = post.text;
    if (post.editedAt && (!album.editedAt || post.editedAt > album.editedAt)) {
      album.editedAt = post.editedAt;
    }
    album.allDeleted = album.allDeleted && !!post.deletedAt;
    if (post.deletedAt && (!album.deletedAt || post.deletedAt > album.deletedAt)) {
      album.deletedAt = post.deletedAt;
    }
  }

  // Album counts as deleted only if all its items were deleted
  for (const item of items) {
    if (item.groupedId && item.itemsCount > 1) {
      item.mediaType = `album (${item.itemsCount})`;
      if (!item.allDeleted) item.deletedAt = null;
    }
  }

  return items;
}

/**
 * Makes valid unique Excel sheet name (max 31 chars, no []:*?/\)
 * @param {string} title - Desired name
 * @param {Set<string>} used - Already used names (lowercase)
 * @returns {string}
 */
function sheetName(title, used) {
  const base = (title || 'Channel').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Channel';
  let name = base;
  let counter = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${counter++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

/**
 * Channel Report Service
 */
class ChannelReportService {
  #channelPostRepository;
  #logger;

  /**
   * @param {Object} dependencies
   * @param {ChannelPostRepository} dependencies.channelPostRepository
   * @param {Object} [dependencies.logger]
   */
  constructor({ channelPostRepository, logger = log }) {
    this.#channelPostRepository = channelPostRepository;
    this.#logger = logger;
  }

  /**
   * Builds Excel report for channels in period [from, to)
   * @param {Object} params
   * @param {Object[]} params.channels - Channel entities (channelId, title, username)
   * @param {number} params.from - Unix timestamp (inclusive)
   * @param {number} params.to - Unix timestamp (exclusive)
   * @returns {Promise<{buffer: Buffer, totalPosts: number}>}
   */
  async buildReport({ channels, from, to }) {
    const channelIds = channels.map(c => c.channelId);
    const posts = await this.#channelPostRepository.findByChannelsAndPeriod(channelIds, from, to);

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Jami');
    summarySheet.columns = [
      { header: 'Kanal', key: 'title', width: 35 },
      { header: 'Postlar', key: 'total', width: 12 },
      { header: 'Tahrirlangan', key: 'edited', width: 14 },
      { header: "O'chirilgan", key: 'deleted', width: 14 },
    ];
    summarySheet.getRow(1).font = { bold: true };

    const usedNames = new Set(['jami']);
    let totalPosts = 0;

    for (const channel of channels) {
      const channelPosts = posts.filter(p => p.channelId === channel.channelId);
      const items = collapseAlbums(channelPosts);
      totalPosts += items.length;

      summarySheet.addRow({
        title: channel.title,
        total: items.length,
        edited: items.filter(i => i.editedAt).length,
        deleted: items.filter(i => i.deletedAt).length,
      });

      const sheet = workbook.addWorksheet(sheetName(channel.title, usedNames));
      sheet.columns = [
        { header: 'Sana', key: 'postedAt', width: 18 },
        { header: 'Post ID', key: 'messageId', width: 10 },
        { header: 'Turi', key: 'mediaType', width: 14 },
        { header: 'Matn', key: 'text', width: 60 },
        ...PARSED_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width || 20 })),
        { header: 'Havola', key: 'link', width: 35 },
        { header: 'Tahrirlangan', key: 'editedAt', width: 18 },
        { header: "O'chirilgan", key: 'deletedAt', width: 18 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getColumn('text').alignment = { wrapText: true, vertical: 'top' };

      for (const item of items) {
        sheet.addRow({
          postedAt: formatDate(item.postedAt),
          messageId: item.messageId,
          mediaType: item.mediaType || 'text',
          text: item.text || '',
          ...parsePost(item.text),
          link: postLink(channel, item.messageId),
          editedAt: formatDate(item.editedAt),
          deletedAt: formatDate(item.deletedAt),
        });
      }
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    this.#logger.info('Channel report built', {
      channels: channels.length,
      totalPosts,
      from: formatDate(from),
      to: formatDate(to),
    });

    return { buffer, totalPosts };
  }
}

export default ChannelReportService;
