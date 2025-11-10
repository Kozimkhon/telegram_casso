/**
 * Main Application Entry Point (Clean Architecture)
 * Coordinates application startup using Dependency Injection
 * 
 * @module index
 */

import { config, validateConfig } from './config/index.js';
import { log } from './shared/logger.js';
import { initializeDatabase, closeDatabase } from './db/db.js';
import Container from './core/di/Container.js';
import AppState from './core/state/AppState.js';
import { ErrorHandler } from './shared/errors/index.js';
import { AppEvents } from './shared/constants/index.js';

/**
 * @class Application
 * @description Main application class coordinating all components
 * Uses Clean Architecture principles with Dependency Injection
 */
class Application {
  /**
   * Creates a new Application instance
   */
  constructor() {
    this.container = Container;
    this.appState = AppState;
    this.isShuttingDown = false;
    
    // Bind methods
    this.cleanup = this.cleanup.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Initializes and starts the application
   * @returns {Promise<void>}
   */
  async start() {
    try {
      log.info('🚀 Starting Telegram Casso Application (Clean Architecture)...');
      
      // Step 1: Validate configuration
      await this.validateConfiguration();
      
      // Step 2: Initialize database
      await this.initializeDatabase();
      
      // Step 3: Initialize DI container
      await this.initializeContainer();
      
      // Step 4: Initialize application state
      await this.initializeAppState();
      
      // Step 5: Initialize bots (using legacy code for now)
      await this.initializeBots();
      
      // Step 6: Setup error handlers
      this.setupErrorHandlers();
      
      // Step 7: Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // Mark application as started
      this.appState.start();
      
      log.info('🎉 Application started successfully!');
      this.displayStartupSummary();
      
    } catch (error) {
      log.error('❌ Failed to start application', error);
      ErrorHandler.handle(error, log, { phase: 'startup' });
      process.exit(1);
    }
  }

  /**
   * Validates application configuration
   * @private
   * @returns {Promise<void>}
   */
  async validateConfiguration() {
    log.info('Validating configuration...');
    validateConfig();
    log.info('✅ Configuration validated');
  }

  /**
   * Initializes the database
   * @private
   * @returns {Promise<void>}
   */
  async initializeDatabase() {
    log.info('Initializing database...');
    await initializeDatabase();
    log.info('✅ Database initialized');
  }

  /**
   * Initializes the dependency injection container
   * @private
   * @returns {Promise<void>}
   */
  async initializeContainer() {
    log.info('Initializing DI container...');
    await this.container.initialize(config);
    log.info('✅ DI container initialized');
    
    // Log registered services
    const services = this.container.getServiceNames();
    log.debug('Registered services:', { services });
  }

  /**
   * Initializes application state
   * @private
   * @returns {Promise<void>}
   */
  async initializeAppState() {
    log.info('Initializing application state...');
    
    // Set configuration
    this.appState.setConfig(config);
    
    // Load sessions from database
    const sessionRepository = this.container.resolve('sessionRepository');
    const sessions = await sessionRepository.findAll();
    
    sessions.forEach(session => {
      this.appState.setSession(session.phone, session.toObject());
    });
    
    // Load channels from database
    const channelRepository = this.container.resolve('channelRepository');
    const channels = await channelRepository.findAll();
    
    channels.forEach(channel => {
      this.appState.setChannel(channel.channelId, channel.toObject());
    });
    
    log.info('✅ Application state initialized', {
      sessions: sessions.length,
      channels: channels.length
    });
  }

  /**
   * Initializes bots (legacy implementation)
   * TODO: Refactor bots to use Clean Architecture
   * @private
   * @returns {Promise<void>}
   */
  async initializeBots() {
    log.info('Initializing bots (legacy mode)...');
    
    // Import legacy bot implementations
    const { userBotManager } = await import('./bots/userBotManager.js');
    const AdminBotClass = (await import('./bots/adminBot.js')).default;
    
    // Initialize UserBot Manager
    await userBotManager.initializeFromDatabase();
    this.appState.setUserBotManager(userBotManager);
    
    // Initialize AdminBot
    const adminBot = new AdminBotClass(null, userBotManager);
    await adminBot.start();
    this.appState.setAdminBot(adminBot);
    
    log.info('✅ Bots initialized');
  }

  /**
   * Sets up global error handlers
   * @private
   */
  setupErrorHandlers() {
    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
      
      if (!ErrorHandler.isOperational(reason)) {
        this.handleError(reason);
      }
    });

    process.on('uncaughtException', (error) => {
      log.error('Uncaught Exception', error);
      this.handleError(error);
    });

    // Listen to AppState events
    this.appState.on(AppEvents.APP_ERROR, (error) => {
      ErrorHandler.handle(error, log, { source: 'AppState' });
    });
  }

  /**
   * Handles critical errors
   * @private
   * @param {Error} error - Error to handle
   */
  handleError(error) {
    log.error('Critical error, shutting down...', error);
    this.cleanup().then(() => {
      process.exit(1);
    });
  }

  /**
   * Sets up graceful shutdown handlers
   * @private
   */
  setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        log.info(`Received ${signal}, starting graceful shutdown...`);
        await this.cleanup();
        process.exit(0);
      });
    });
  }

  /**
   * Performs cleanup operations before shutdown
   * @returns {Promise<void>}
   */
  async cleanup() {
    if (this.isShuttingDown) {
      log.warn('Cleanup already in progress');
      return;
    }

    this.isShuttingDown = true;
    this.appState.stop();
    
    log.info('🔄 Starting graceful shutdown...');

    try {
      // Stop UserBot Manager
      const userBotManager = this.appState.getUserBotManager();
      if (userBotManager) {
        log.info('Stopping UserBot Manager...');
        await userBotManager.stopAll();
        log.info('✅ UserBot Manager stopped');
      }

      // Stop AdminBot
      const adminBot = this.appState.getAdminBot();
      if (adminBot) {
        log.info('Stopping AdminBot...');
        await adminBot.stop();
        log.info('✅ AdminBot stopped');
      }

      // Close database
      log.info('Closing database connection...');
      await closeDatabase();
      log.info('✅ Database closed');

      // Mark as fully stopped
      this.appState.stopped();
      
      log.info('✅ Graceful shutdown completed');

    } catch (error) {
      log.error('❌ Error during cleanup', error);
      throw error;
    }
  }

  /**
   * Displays startup summary
   * @private
   */
  displayStartupSummary() {
    const snapshot = this.appState.getSnapshot();
    
    log.info('📊 Application Status:');
    log.info(`   Sessions: ${snapshot.sessions.total} (${snapshot.sessions.active} active)`);
    log.info(`   Channels: ${snapshot.channels.total} (${snapshot.channels.enabled} enabled)`);
    log.info(`   Environment: ${snapshot.environment}`);
    log.info(`   Architecture: Clean Architecture with DI`);
    log.info('');
    log.info('📋 Next Steps:');
    log.info('   1. Send /start to AdminBot for management');
    log.info('   2. Use DI container to resolve services');
    log.info('   3. Monitor AppState for real-time updates');
  }

  /**
   * Gets current application status
   * @returns {Object} Application status
   */
  getStatus() {
    return this.appState.getSnapshot();
  }
}

/**
 * Application entry point
 */
async function main() {
  const app = new Application();
  await app.start();
  
  // Keep process running
  process.stdin.resume();
}

// Start application
main().catch(error => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});

export default Application;
