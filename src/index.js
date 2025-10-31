/**
 * Main application entry point - responsible for coordinating UserBot and AdminBot
 * Handles initialization, authentication flow, and graceful shutdown
 */

import { config, validateConfig } from './config/index.js';
import { log } from './utils/logger.js';
import { setupGracefulShutdown, handleGlobalError } from './utils/errorHandler.js';
import { initializeDatabase, closeDatabase } from './db/db.js';
import UserBot from './bots/userBot.js';
import AdminBot from './bots/adminBot.js';

class TelegramCassoApp {
  constructor() {
    this.userBot = null;
    this.adminBot = null;
    this.isShuttingDown = false;
    
    // Bind cleanup method for graceful shutdown
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initializes and starts the application
   */
  async start() {
    try {
      log.info('🚀 Starting Telegram Casso Application...');
      
      // Validate configuration
      validateConfig();
      log.info('✅ Configuration validated successfully');

      // Initialize database
      await initializeDatabase();
      log.info('✅ Database initialized successfully');

      // Initialize UserBot
      await this.initializeUserBot();
      
      // Initialize AdminBot
      await this.initializeAdminBot();

      // Setup graceful shutdown
      setupGracefulShutdown(this.cleanup);

      log.info('🎉 Telegram Casso started successfully!');
      log.info('📱 UserBot is monitoring channels for new messages');
      log.info('⚙️ AdminBot is ready for management commands');
      
      // Display startup summary
      await this.displayStartupSummary();

    } catch (error) {
      log.error('❌ Failed to start Telegram Casso', error);
      handleGlobalError(error, 'Application startup');
      process.exit(1);
    }
  }

  /**
   * Initializes and starts the UserBot
   */
  async initializeUserBot() {
    try {
      log.info('🤖 Initializing UserBot...');
      
      this.userBot = new UserBot();
      await this.userBot.start();
      
      log.info('✅ UserBot initialized and started');
      
      // Get user info for logging
      try {
        const userInfo = await this.userBot.getMe();
        log.info('👤 UserBot authenticated', {
          userId: userInfo.userId,
          firstName: userInfo.firstName,
          username: userInfo.username
        });
      } catch (error) {
        log.warn('Could not retrieve user info', { error: error.message });
      }

    } catch (error) {
      log.error('❌ Failed to initialize UserBot', error);
      throw error;
    }
  }

  /**
   * Initializes and starts the AdminBot
   */
  async initializeAdminBot() {
    try {
      log.info('⚙️ Initializing AdminBot...');
      
      this.adminBot = new AdminBot(this.userBot);
      await this.adminBot.start();
      
      log.info('✅ AdminBot initialized and started');
      log.info('👮 Admin user ID:', config.telegram.adminUserId);

    } catch (error) {
      log.error('❌ Failed to initialize AdminBot', error);
      throw error;
    }
  }

  /**
   * Displays startup summary with important information
   */
  async displayStartupSummary() {
    try {
      const userBotStatus = this.userBot ? this.userBot.getStatus() : null;
      
      log.info('📊 Startup Summary:');
      log.info(`   UserBot Status: ${userBotStatus?.isRunning ? '✅ Running' : '❌ Stopped'}`);
      log.info(`   AdminBot Status: ${this.adminBot?.isRunning ? '✅ Running' : '❌ Stopped'}`);
      log.info(`   Connected Channels: ${userBotStatus?.connectedChannels || 0}`);
      log.info(`   Database: ✅ Connected`);
      log.info(`   Environment: ${config.app.environment}`);
      
      // Display next steps
      log.info('📋 Next Steps:');
      log.info('   1. Send /start to your AdminBot to access the control panel');
      log.info('   2. Use the AdminBot to enable/disable channel forwarding');
      log.info('   3. Monitor logs for forwarding activity');
      
    } catch (error) {
      log.warn('Could not display startup summary', { error: error.message });
    }
  }

  /**
   * Performs cleanup operations before shutdown
   */
  async cleanup() {
    if (this.isShuttingDown) {
      log.warn('Cleanup already in progress, skipping...');
      return;
    }

    this.isShuttingDown = true;
    log.info('🔄 Starting graceful shutdown...');

    try {
      // Stop UserBot
      if (this.userBot) {
        log.info('Stopping UserBot...');
        await this.userBot.stop();
        log.info('✅ UserBot stopped');
      }

      // Stop AdminBot
      if (this.adminBot) {
        log.info('Stopping AdminBot...');
        await this.adminBot.stop();
        log.info('✅ AdminBot stopped');
      }

      // Close database connection
      log.info('Closing database connection...');
      await closeDatabase();
      log.info('✅ Database connection closed');

      log.info('✅ Cleanup completed successfully');

    } catch (error) {
      log.error('❌ Error during cleanup', error);
      throw error;
    }
  }

  /**
   * Gets the current status of the application
   * @returns {Object} Application status
   */
  getStatus() {
    const userBotStatus = this.userBot ? this.userBot.getStatus() : null;
    
    return {
      isRunning: !this.isShuttingDown,
      userBot: userBotStatus,
      adminBot: {
        isRunning: this.adminBot?.isRunning || false
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      environment: config.app.environment
    };
  }
}

/**
 * Application entry point
 */
async function main() {
  // Handle uncaught errors at the top level
  process.on('unhandledRejection', (reason, promise) => {
    log.error('Unhandled Promise Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack
    });
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception', error);
    process.exit(1);
  });

  try {
    // Create and start the application
    const app = new TelegramCassoApp();
    await app.start();

    // Keep the process running
    process.stdin.resume();

  } catch (error) {
    log.error('Fatal error starting application', error);
    process.exit(1);
  }
}

// Start the application if this file is run directly
// if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal startup error:', error);
    process.exit(1);
  });
// }

export default TelegramCassoApp;