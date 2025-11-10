/**
 * UserBot Manager - manages multiple userbot sessions
 * Provides session pooling, load balancing, and health monitoring
 */

import UserBot from '../bots/userBot.js';
import { log, createChildLogger } from '../utils/logger.js';
import { 
  getAllSessions, 
  updateSessionStatus, 
  autoPauseSession,
  resumeSession,
  getSessionsReadyToResume,
  updateSessionActivity
} from '../services/sessionService.js';
import { getChannelAdminSession } from '../services/channelService.js';
import { isFloodWaitError, isSpamWarning } from '../utils/errorHandler.js';
import { queueManager } from '../utils/messageQueue.js';

class UserBotManager {
  constructor() {
    this.bots = new Map(); // phone -> UserBot instance
    this.logger = createChildLogger({ component: 'UserBotManager' });
    this.resumeCheckInterval = null;
  }

  /**
   * Initializes all active sessions from database
   * @returns {Promise<void>}
   */
  async initializeFromDatabase() {
    try {
      this.logger.info('Initializing userbots from database...');
      
      const sessions = await getAllSessions({ status: 'active' });
      this.logger.info(`Found ${sessions.length} active sessions`);

      for (const session of sessions) {
        try {
          await this.addUserBot(session);
        } catch (error) {
          this.logger.error('Failed to initialize session', {
            phone: session.phone,
            error: error.message
          });
          
          // Mark session as error but continue with others
          await updateSessionStatus(session.phone, 'error', {
            lastError: error.message
          });
        }
      }

      // Start periodic check for sessions ready to resume
      this.startResumeChecker();

      this.logger.info('UserBot manager initialized', {
        activeBots: this.bots.size
      });
    } catch (error) {
      this.logger.error('Failed to initialize from database', error);
      throw error;
    }
  }

  /**
   * Adds a new userbot session
   * @param {Object} sessionData - Session data from database
   * @returns {Promise<UserBot>} UserBot instance
   */
  async addUserBot(sessionData) {
    const { phone } = sessionData;

    if (this.bots.has(phone)) {
      this.logger.warn('UserBot already exists', { phone });
      return this.bots.get(phone);
    }

    try {
      this.logger.info('Adding new userbot', { phone });

      const userBot = new UserBot(sessionData);
      await userBot.start();

      this.bots.set(phone, userBot);
      
      this.logger.info('UserBot added successfully', { phone });
      
      return userBot;
    } catch (error) {
      this.logger.error('Failed to add userbot', {
        phone,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Removes a userbot session
   * @param {string} phone - Phone number
   * @returns {Promise<boolean>} True if removed
   */
  async removeUserBot(phone) {
    if (!this.bots.has(phone)) {
      this.logger.warn('UserBot not found', { phone });
      return false;
    }

    try {
      this.logger.info('Removing userbot', { phone });

      const userBot = this.bots.get(phone);
      await userBot.stop();

      this.bots.delete(phone);
      
      this.logger.info('UserBot removed successfully', { phone });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to remove userbot', {
        phone,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Gets the admin bot for a specific channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<UserBot|null>} UserBot instance or null
   */
  async getBotForChannel(channelId) {
    try {
      const adminSessionPhone = await getChannelAdminSession(channelId);
      
      if (!adminSessionPhone) {
        this.logger.warn('No admin session found for channel', { channelId });
        return null;
      }

      const bot = this.getUserBot(adminSessionPhone);
      
      if (!bot) {
        this.logger.warn('Admin session not found in bot pool', { 
          channelId, 
          adminSessionPhone 
        });
        return null;
      }

      if (!bot.isRunning || bot.isPaused) {
        this.logger.warn('Admin bot is not active', { 
          channelId, 
          adminSessionPhone,
          isRunning: bot.isRunning,
          isPaused: bot.isPaused
        });
        return null;
      }

      return bot;
    } catch (error) {
      this.logger.error('Error getting bot for channel', {
        channelId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Gets an active userbot (random selection for load balancing)
   * @deprecated Use getBotForChannel for channel-specific operations
   * @returns {UserBot|null} Active userbot or null
   */
  getRandomActiveBot() {
    const activeBots = this.getActiveBots();

    if (activeBots.length === 0) {
      this.logger.warn('No active bots available');
      return null;
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * activeBots.length);
    return activeBots[randomIndex];
  }

  /**
   * Gets all active userbots
   * @returns {Array<UserBot>} Array of active userbots
   */
  getActiveBots() {
    return Array.from(this.bots.values()).filter(
      bot => bot.isRunning && !bot.isPaused
    );
  }

  /**
   * Gets a specific userbot by phone
   * @param {string} phone - Phone number
   * @returns {UserBot|null} UserBot instance or null
   */
  getUserBot(phone) {
    return this.bots.get(phone) || null;
  }

  /**
   * Gets status of all userbots
   * @returns {Object} Status summary
   */
  getStatus() {
    const bots = Array.from(this.bots.values());
    
    return {
      totalSessions: bots.length,
      activeSessions: bots.filter(b => b.isRunning && !b.isPaused).length,
      pausedSessions: bots.filter(b => b.isPaused).length,
      errorSessions: bots.filter(b => !b.isRunning && !b.isPaused).length,
      sessions: bots.map(bot => ({
        phone: bot.phone,
        isRunning: bot.isRunning,
        isPaused: bot.isPaused,
        pauseReason: bot.pauseReason,
        connectedChannels: bot.connectedChannels.size
      })),
      // Legacy compatibility
      total: bots.length,
      active: bots.filter(b => b.isRunning && !b.isPaused).length,
      paused: bots.filter(b => b.isPaused).length,
      error: bots.filter(b => !b.isRunning && !b.isPaused).length
    };
  }

  /**
   * Handles an error from a userbot session
   * @param {string} phone - Phone number
   * @param {Error} error - Error that occurred
   * @returns {Promise<void>}
   */
  async handleBotError(phone, error) {
    this.logger.error('Handling bot error', { phone, error: error.message });

    try {
      const userBot = this.bots.get(phone);
      if (!userBot) {
        return;
      }

      // Check for FloodWait
      const floodWait = isFloodWaitError(error);
      if (floodWait) {
        const waitUntil = new Date(Date.now() + floodWait.seconds * 1000);
        await autoPauseSession(phone, `FloodWait: ${floodWait.seconds}s`, waitUntil);
        
        userBot.isPaused = true;
        userBot.pauseReason = `FloodWait: ${floodWait.seconds}s`;
        
        this.logger.warn('Session auto-paused due to FloodWait', {
          phone,
          waitSeconds: floodWait.seconds,
          waitUntil
        });
        
        return;
      }

      // Check for spam warning
      if (isSpamWarning(error)) {
        await autoPauseSession(phone, 'Spam warning detected');
        
        userBot.isPaused = true;
        userBot.pauseReason = 'Spam warning';
        
        this.logger.warn('Session auto-paused due to spam warning', { phone });
        
        return;
      }

      // For other errors, just log them
      await updateSessionStatus(phone, 'error', {
        lastError: error.message
      });

    } catch (err) {
      this.logger.error('Failed to handle bot error', {
        phone,
        error: err.message
      });
    }
  }

  /**
   * Pauses a userbot session
   * @param {string} phone - Phone number
   * @param {string} reason - Reason for pause
   * @returns {Promise<boolean>} True if paused
   */
  async pauseBot(phone, reason = 'Manual pause') {
    const userBot = this.bots.get(phone);
    if (!userBot) {
      this.logger.warn('UserBot not found for pause', { phone });
      return false;
    }

    try {
      await updateSessionStatus(phone, 'paused', {
        pauseReason: reason
      });

      userBot.isPaused = true;
      userBot.pauseReason = reason;

      this.logger.info('UserBot paused', { phone, reason });
      return true;
    } catch (error) {
      this.logger.error('Failed to pause userbot', {
        phone,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Resumes a paused userbot session
   * @param {string} phone - Phone number
   * @returns {Promise<boolean>} True if resumed
   */
  async resumeBot(phone) {
    const userBot = this.bots.get(phone);
    if (!userBot) {
      this.logger.warn('UserBot not found for resume', { phone });
      return false;
    }

    try {
      await resumeSession(phone);

      userBot.isPaused = false;
      userBot.pauseReason = null;

      this.logger.info('UserBot resumed', { phone });
      return true;
    } catch (error) {
      this.logger.error('Failed to resume userbot', {
        phone,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Starts periodic checker for sessions ready to resume
   */
  startResumeChecker() {
    if (this.resumeCheckInterval) {
      clearInterval(this.resumeCheckInterval);
    }

    // Check every minute
    this.resumeCheckInterval = setInterval(async () => {
      try {
        const readyToResume = await getSessionsReadyToResume();
        
        for (const session of readyToResume) {
          this.logger.info('Auto-resuming session after FloodWait', {
            phone: session.phone
          });
          
          await this.resumeBot(session.phone);
        }
      } catch (error) {
        this.logger.error('Error in resume checker', {
          error: error.message
        });
      }
    }, 60000); // Every minute

    this.logger.info('Resume checker started');
  }

  /**
   * Stops all userbots gracefully
   * @returns {Promise<void>}
   */
  async stopAll() {
    try {
      this.logger.info('Stopping all userbots...');

      // Stop resume checker
      if (this.resumeCheckInterval) {
        clearInterval(this.resumeCheckInterval);
        this.resumeCheckInterval = null;
      }

      // Stop all bots
      const stopPromises = Array.from(this.bots.entries()).map(
        async ([phone, bot]) => {
          try {
            await bot.stop();
            this.logger.info('UserBot stopped', { phone });
          } catch (error) {
            this.logger.error('Failed to stop userbot', {
              phone,
              error: error.message
            });
          }
        }
      );

      await Promise.all(stopPromises);
      this.bots.clear();

      this.logger.info('All userbots stopped');
    } catch (error) {
      this.logger.error('Error stopping all userbots', error);
      throw error;
    }
  }
}

// Export singleton instance
export const userBotManager = new UserBotManager();

export default UserBotManager;
