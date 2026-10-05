/**
 * @fileoverview Monthly Report Job
 * Sends previous month's channel posts report (Excel) to every admin
 * at the start of each month.
 * @module jobs/MonthlyReportJob
 */

import fs from 'fs';
import path from 'path';
import { log } from '../shared/logger.js';
import {
  previousMonthPeriod,
  localYearMonth,
} from '../domain/services/ChannelReportService.js';

/** Check interval: every hour */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Send not earlier than this hour (Asia/Tashkent) on the 1st day */
const SEND_HOUR = 9;

/** Report timezone offset: Asia/Tashkent (UTC+5) */
const TZ_OFFSET_SEC = 5 * 60 * 60;

/**
 * Monthly Report Job
 * Checks hourly; once a month sends each active admin a report of their own channels.
 * Sent state is persisted to a JSON file so restarts do not resend.
 */
class MonthlyReportJob {
  #channelReportService;
  #channelRepository;
  #adminRepository;
  #stateManager;
  #stateFile;
  #logger;
  #intervalId = null;
  #isRunning = false;

  /**
   * @param {Object} dependencies
   * @param {ChannelReportService} dependencies.channelReportService
   * @param {ChannelRepository} dependencies.channelRepository
   * @param {AdminRepository} dependencies.adminRepository
   * @param {StateManager} dependencies.stateManager
   * @param {string} dependencies.dataDir - Directory for state file
   * @param {Object} [dependencies.logger]
   */
  constructor({
    channelReportService,
    channelRepository,
    adminRepository,
    stateManager,
    dataDir,
    logger = log,
  }) {
    this.#channelReportService = channelReportService;
    this.#channelRepository = channelRepository;
    this.#adminRepository = adminRepository;
    this.#stateManager = stateManager;
    this.#stateFile = path.join(dataDir, 'monthly_report_state.json');
    this.#logger = logger;
  }

  /**
   * Starts the job (checks immediately, then every hour)
   */
  start() {
    if (this.#intervalId) {
      this.#logger.warn('Monthly report job already started');
      return;
    }

    this.execute().catch(error => {
      this.#logger.error('Monthly report initial check failed', { error });
    });

    this.#intervalId = setInterval(() => {
      this.execute().catch(error => {
        this.#logger.error('Monthly report check failed', { error });
      });
    }, CHECK_INTERVAL_MS);

    this.#logger.info('Monthly report job started');
  }

  /**
   * Stops the job
   */
  stop() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
      this.#logger.info('Monthly report job stopped');
    }
  }

  /**
   * Sends previous month report to admins who have not received it yet
   * @returns {Promise<void>}
   */
  async execute() {
    if (this.#isRunning) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const local = new Date((nowSec + TZ_OFFSET_SEC) * 1000);
    if (local.getUTCDate() === 1 && local.getUTCHours() < SEND_HOUR) {
      return;
    }

    const adminBot = this.#stateManager.getBot('adminBot');
    if (!adminBot?.sendDocumentToAdmin) {
      this.#logger.debug('AdminBot not available, monthly report postponed');
      return;
    }

    this.#isRunning = true;

    try {
      const period = previousMonthPeriod(nowSec);
      const monthKey = `${period.year}-${String(period.monthIndex + 1).padStart(2, '0')}`;

      const state = this.#loadState();

      // First run ever: no posts were stored for previous month yet,
      // so mark it as handled and send the first report next month
      if (!state.month) {
        this.#saveState({ month: monthKey, sentAdmins: [], skipped: true });
        this.#logger.info('Monthly report state initialized, first report next month', { month: monthKey });
        return;
      }

      if (state.month !== monthKey) {
        state.month = monthKey;
        state.sentAdmins = [];
        state.skipped = false;
      }

      if (state.skipped) {
        return;
      }

      const admins = await this.#adminRepository.findAll({ active: true });

      for (const admin of admins) {
        const adminId = admin.userId?.toString();
        if (!adminId || state.sentAdmins.includes(adminId)) continue;

        try {
          // Only channels owned by this admin
          const channels = await this.#channelRepository.findByAdminId(adminId);

          if (!channels || channels.length === 0) {
            state.sentAdmins.push(adminId);
            this.#saveState(state);
            continue;
          }

          const { buffer, totalPosts } = await this.#channelReportService.buildReport({
            channels,
            from: period.from,
            to: period.to,
          });

          const sent = await adminBot.sendDocumentToAdmin(
            adminId,
            buffer,
            `report_${monthKey}.xlsx`,
            `📑 <b>Oylik hisobot: ${monthKey}</b>\n\nKanallar: ${channels.length}\nPostlar: ${totalPosts}`
          );

          if (sent) {
            state.sentAdmins.push(adminId);
            this.#saveState(state);
            this.#logger.info('Monthly report sent', { adminId, month: monthKey, totalPosts });
          }
        } catch (error) {
          this.#logger.error('Failed to send monthly report', { adminId, error });
        }
      }
    } finally {
      this.#isRunning = false;
    }
  }

  /**
   * Loads persisted state
   * @private
   * @returns {{month: string|null, sentAdmins: string[]}}
   */
  #loadState() {
    try {
      const data = JSON.parse(fs.readFileSync(this.#stateFile, 'utf8'));
      return {
        month: data.month || null,
        sentAdmins: data.sentAdmins || [],
        skipped: !!data.skipped,
      };
    } catch {
      return { month: null, sentAdmins: [], skipped: false };
    }
  }

  /**
   * Persists state
   * @private
   * @param {Object} state
   */
  #saveState(state) {
    try {
      fs.writeFileSync(this.#stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      this.#logger.error('Failed to save monthly report state', { error });
    }
  }
}

export default MonthlyReportJob;
