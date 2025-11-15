/**
 * @fileoverview Daily Channel Logs Fetch Job
 * Scheduled job to fetch channel logs once per day
 * @module jobs/DailyChannelLogsFetchJob
 */

import { log } from '../shared/logger.js';

/**
 * Daily Channel Logs Fetch Job
 * Runs once per day to fetch admin logs for all channels
 */
class DailyChannelLogsFetchJob {
  #channelLogFetcherService;
  #adminRepository;
  #sessionManager;
  #logger;
  #intervalId;
  #isRunning;
  #hasRunInitially;

  constructor({ 
    channelLogFetcherService, 
    adminRepository,
    sessionManager,
    logger = log 
  }) {
    this.#channelLogFetcherService = channelLogFetcherService;
    this.#adminRepository = adminRepository;
    this.#sessionManager = sessionManager;
    this.#logger = logger;
    this.#intervalId = null;
    this.#isRunning = false;
    this.#hasRunInitially = false;
  }

  /**
   * Starts the daily job
   * Runs immediately once on first startup, then every 24 hours
   */
  start() {
    if (this.#intervalId) {
      this.#logger.warn('Daily channel logs fetch job already started');
      return;
    }

    // Run immediately on first startup only
    if (!this.#hasRunInitially) {
      this.#hasRunInitially = true;
      this.execute().catch(error => {
        this.#logger.error('Initial execution failed', { error });
      });
    }

    // Schedule to run every 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    this.#intervalId = setInterval(() => {
      this.execute().catch(error => {
        this.#logger.error('Scheduled execution failed', { error });
      });
    }, TWENTY_FOUR_HOURS);

    this.#logger.info('Daily channel logs fetch job started', {
      intervalHours: 24
    });
  }

  /**
   * Stops the job
   */
  stop() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
      this.#logger.info('Daily channel logs fetch job stopped');
    }
  }

  /**
   * Executes the job
   * Fetches logs for all active admins
   */
  async execute() {
    if (this.#isRunning) {
      this.#logger.warn('Job already running, skipping execution');
      return;
    }

    this.#isRunning = true;
    const startTime = Date.now();

    try {
      this.#logger.info('Starting daily channel logs fetch');

      // Get all active admins
      const admins = await this.#adminRepository.findAll({ isActive: true });

      if (!admins || admins.length === 0) {
        this.#logger.info('No active admins found');
        return { totalAdmins: 0, successCount: 0, errorCount: 0, totalLogsFetched: 0 };
      }

      const summary = {
        totalAdmins: admins.length,
        successCount: 0,
        errorCount: 0,
        totalLogsFetched: 0,
        errors: []
      };

      for (const admin of admins) {
        try {
          // Get UserBotController for this admin from StateManager
          const userBot = this.#sessionManager.getBot(admin.userId);
          
          if (!userBot) {
            this.#logger.warn('No active UserBot for admin', { adminUserId: admin.userId });
            summary.errorCount++;
            summary.errors.push({
              adminUserId: admin.userId,
              error: 'No active UserBot instance'
            });
            continue;
          }

          // Get Telegram client from UserBot
          const client = userBot.getClient();
          
          if (!client) {
            this.#logger.warn('UserBot has no active client', { adminUserId: admin.userId });
            summary.errorCount++;
            summary.errors.push({
              adminUserId: admin.userId,
              error: 'No active Telegram client'
            });
            continue;
          }

          // Fetch logs for all admin channels
          const result = await this.#channelLogFetcherService.fetchAllAdminChannelLogs(
            client,
            admin.userId
          );

          summary.successCount++;
          summary.totalLogsFetched += result.totalLogs;

          this.#logger.info('Fetched logs for admin', {
            adminUserId: admin.userId,
            channelsCount: result.totalChannels,
            logsCount: result.totalLogs,
          });
        } catch (error) {
          summary.errorCount++;
          summary.errors.push({
            adminUserId: admin.userId,
            error: error.message
          });
          this.#logger.error('Failed to fetch logs for admin', {
            adminUserId: admin.userId,
            error,
          });
        }
      }

      const duration = Date.now() - startTime;
      this.#logger.info('Daily channel logs fetch completed', {
        ...summary,
        durationMs: duration
      });

      return summary;
    } catch (error) {
      this.#logger.error('Daily channel logs fetch job failed', { error });
      throw error;
    } finally {
      this.#isRunning = false;
    }
  }

  /**
   * Gets job status
   * @returns {Object} Job status
   */
  getStatus() {
    return {
      isRunning: this.#isRunning,
      isScheduled: this.#intervalId !== null,
      hasRunInitially: this.#hasRunInitially,
    };
  }
}

export default DailyChannelLogsFetchJob;
