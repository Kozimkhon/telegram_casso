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
    this.userBotManager = null; // Multi-session manager
    this.adminBot = null;
    this.isShuttingDown = false;
    
    // Bind cleanup method for graceful shutdown
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initializes and starts the application with multi-userbot support
   */
  async start() {
    try {
      log.info('🚀 Starting Telegram Casso Multi-User Application...');
      
      // Validate configuration
      validateConfig();
      log.info('✅ Configuration validated successfully');

      // Initialize database
      await initializeDatabase();
      log.info('✅ Database initialized successfully');

      // Initialize Multi-UserBot Manager
      await this.initializeMultiUserBotManager();
      
      // Initialize AdminBot with multi-session support
      await this.initializeAdminBot();

      // Setup graceful shutdown
      setupGracefulShutdown(this.cleanup);

      log.info('🎉 Telegram Casso Multi-User System started successfully!');
      log.info('📱 Multiple UserBot sessions are monitoring channels');
      log.info('⚙️ AdminBot is ready with session management UI');
      
      // Display startup summary
      await this.displayStartupSummary();

    } catch (error) {
      log.error('❌ Failed to start Telegram Casso', error);
      handleGlobalError(error, 'Application startup');
      process.exit(1);
    }
  }

  /**
   * Initializes the Multi-UserBot Manager and loads all sessions
   */
  async initializeMultiUserBotManager() {
    try {
      log.info('🎛️ Initializing Multi-UserBot Manager...');
      
      // Import UserBotManager
      const { userBotManager } = await import('./bots/userBotManager.js');
      this.userBotManager = userBotManager;
      
      // Initialize all sessions from database
      await this.userBotManager.initializeFromDatabase();
      
      const activeSessions = this.userBotManager.getActiveBots().length;
      const totalSessions = this.userBotManager.bots.size;
      
      log.info('✅ Multi-UserBot Manager initialized');
      log.info(`📊 Active Sessions: ${activeSessions}/${totalSessions}`);
      
      // No automatic session creation - users must add sessions via AdminBot
      if (totalSessions === 0) {
        log.info('💡 No sessions found. Use AdminBot to add sessions manually');
        log.info('📱 Send /start to AdminBot and use "Add Session" button');
      }

    } catch (error) {
      log.error('❌ Failed to initialize Multi-UserBot Manager', error);
      throw error;
    }
  }

  /**
   * Initializes and starts the AdminBot with multi-session support
   */
  async initializeAdminBot() {
    try {
      log.info('⚙️ Initializing AdminBot with Session Management...');
      
      // Import AdminBot with multi-session support
      const AdminBotClass = (await import('./bots/adminBot.js')).default;
      
      // Initialize with userBotManager only
      this.adminBot = new AdminBotClass(null, this.userBotManager);
      
      await this.adminBot.start();
      
      log.info('✅ AdminBot with Session Management initialized');
      log.info('👮 Admin user ID:', config.telegram.adminUserId);
      log.info('🔐 Session management UI is available');

    } catch (error) {
      log.error('❌ Failed to initialize AdminBot', error);
      throw error;
    }
  }

  /**
   * Displays startup summary with multi-session information
   */
  async displayStartupSummary() {
    try {
      const managerStatus = this.userBotManager ? this.userBotManager.getStatus() : null;
      
      log.info('📊 Multi-User Startup Summary:');
      log.info(`   Total Sessions: ${managerStatus?.totalSessions || 0}`);
      log.info(`   Active Sessions: ${managerStatus?.activeSessions || 0}`);
      log.info(`   Paused Sessions: ${managerStatus?.pausedSessions || 0}`);
      log.info(`   Error Sessions: ${managerStatus?.errorSessions || 0}`);
      log.info(`   AdminBot Status: ${this.adminBot?.isRunning ? '✅ Running' : '❌ Stopped'}`);
      log.info(`   Database: ✅ Connected`);
      log.info(`   Environment: ${config.app.environment}`);
      
      log.info('📋 Next Steps:');
      log.info('   1. Send /start to AdminBot for session management');
      log.info('   2. Use "Add Session" button to authenticate new sessions');
      log.info('   3. Sessions are authenticated via AdminBot (no console prompts)');
      log.info('   4. Configure channel throttling and forwarding via AdminBot');
      
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
      // Stop UserBotManager (all sessions)
      if (this.userBotManager) {
        log.info('Stopping all UserBot sessions...');
        await this.userBotManager.stopAll();
        log.info('✅ All UserBot sessions stopped');
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

      log.info('✅ Multi-User System cleanup completed successfully');

    } catch (error) {
      log.error('❌ Error during cleanup', error);
      throw error;
    }
  }

  /**
   * Gets the current status of the multi-user application
   * @returns {Object} Application status
   */
  getStatus() {
    const managerStatus = this.userBotManager ? this.userBotManager.getStatus() : null;
    
    return {
      isRunning: !this.isShuttingDown,
      multiUser: true,
      userBotManager: managerStatus,
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