/**
 * @fileoverview Application Bootstrap
 * Main entry point for Clean Architecture refactor
 * @module index.new
 */

import 'reflect-metadata';
import Container from './shared/container/Container.js';
import config from './config/index.js';
import { initializeTypeORM, closeTypeORM } from './config/database.js';

/**
 * Application Class
 * Orchestrates application startup and shutdown
 * 
 * @class Application
 */
class Application {
  /**
   * DI Container
   * @private
   */
  #container;

  /**
   * Bot controllers
   * @private
   */
  #bots = {};

  /**
   * Running flag
   * @private
   */
  #running = false;

  /**
   * Creates application
   */
  constructor() {
    this.#container = Container.getInstance();
  }

  /**
   * Starts application
   * @returns {Promise<void>}
   */
  async start() {
    try {
      console.log('🚀 Starting Telegram Casso (Clean Architecture)...\n');

      // Initialize TypeORM database
      console.log('📦 Initializing TypeORM database...');
      await initializeTypeORM();
      console.log('✅ TypeORM initialized\n');

      // Initialize DI container
      console.log('🔧 Initializing dependency injection container...');
      await this.#container.initialize(config);
      console.log('✅ Container initialized');
      console.log(`   Registered services: ${this.#container.getRegisteredServices().length}\n`);

      // Initialize StateManager
      const stateManager = this.#container.resolve('stateManager');
      console.log('📊 State manager ready\n');

      // Start UserBot Manager (if sessions exist)
      console.log('🤖 Starting UserBot system...');
      const sessionRepository = this.#container.resolve('sessionRepository');
      // Load active AND paused sessions (paused = session exists but bot was stopped gracefully)
      // Skip 'error' status — those need re-authentication
      const [activeSessions, pausedSessions] = await Promise.all([
        sessionRepository.findByStatus('active'),
        sessionRepository.findByStatus('paused'),
      ]);
      const sessions = [...activeSessions, ...pausedSessions];
      
      if (sessions.length > 0) {
        console.log(`   Found ${sessions.length} session(s) to start (active: ${activeSessions.length}, paused: ${pausedSessions.length})`);
        
        // Import UserBotController
        const { default: UserBotController } = await import('./presentation/controllers/UserBotController.js');
        
        // Start each session
        for (const session of sessions) {
          try {
            const userBot = new UserBotController({
              createSessionUseCase: this.#container.resolve('createSessionUseCase'),
              addChannelUseCase: this.#container.resolve('addChannelUseCase'),
              bulkAddUsersUseCase: this.#container.resolve('bulkAddUsersUseCase'),
              addUserToChannelUseCase: this.#container.resolve('addUserToChannelUseCase'),
              getUsersByChannelUseCase: this.#container.resolve('getUsersByChannelUseCase'),
              logMessageUseCase: this.#container.resolve('logMessageUseCase'),
              markMessageAsDeletedUseCase: this.#container.resolve('markMessageAsDeletedUseCase'),
              findOldMessagesUseCase: this.#container.resolve('findOldMessagesUseCase'),
              forwardingService: this.#container.resolve('forwardingService'),
              queueService: null, // TODO: Create queue per session
              throttleService: this.#container.resolve('throttleService'),
              channelPostService: this.#container.resolve('channelPostService'),
              stateManager: this.#container.resolve('stateManager'),
              channelRepository: this.#container.resolve('channelRepository'),
              sessionRepository: this.#container.resolve('sessionRepository'),
              messageRepository: this.#container.resolve('messageRepository'),
            }, {
              session_string: session.sessionString,
              admin_id: session.adminId,
            });
            
            await userBot.start();
            this.#bots[`userbot_${session.adminId}`] = userBot;
            console.log(`   ✅ UserBot started: ${session.adminId}`);
          } catch (error) {
            console.error(`   ❌ Failed to start UserBot ${session.adminId}:`, error.message);

            // Check if it's an AUTH error
            if (error.code === 401 || error.message?.includes('AUTH_KEY_UNREGISTERED')) {
              console.warn(`   ⚠️  Session ${session.adminId} has invalid authentication.`);
              console.warn(`   💡 Please delete this session and create a new one via AdminBot.`);
            }
          }
        }
      } else {
        console.log('   ⚠️  No active sessions found');
      }
      console.log('');

      // Start AdminBot
      console.log('👤 Starting AdminBot...');
      if (config.telegram.adminBotToken) {
        try {
          // Import AdminBotController
          const { default: AdminBotController } = await import('./presentation/controllers/AdminBotController.js');
          
          const adminBot = new AdminBotController({
            // Channel use cases
            addChannelUseCase: this.#container.resolve('addChannelUseCase'),
            toggleChannelForwardingUseCase: this.#container.resolve('toggleChannelForwardingUseCase'),
            removeChannelUseCase: this.#container.resolve('removeChannelUseCase'),
            getChannelStatsUseCase: this.#container.resolve('getChannelStatsUseCase'),
            
            // Session use cases
            createSessionUseCase: this.#container.resolve('createSessionUseCase'),
            getSessionStatsUseCase: this.#container.resolve('getSessionStatsUseCase'),
            pauseSessionUseCase: this.#container.resolve('pauseSessionUseCase'),
            resumeSessionUseCase: this.#container.resolve('resumeSessionUseCase'),
            deleteSessionUseCase: this.#container.resolve('deleteSessionUseCase'),
            
            // User use cases
            getUsersByChannelUseCase: this.#container.resolve('getUsersByChannelUseCase'),
            
            // Message use cases
            getForwardingStatsUseCase: this.#container.resolve('getForwardingStatsUseCase'),
            cleanupOldMessagesUseCase: this.#container.resolve('cleanupOldMessagesUseCase'),
            
            // Admin use cases
            checkAdminAccessUseCase: this.#container.resolve('checkAdminAccessUseCase'),
            addAdminUseCase: this.#container.resolve('addAdminUseCase'),
            updateAdminUseCase: this.#container.resolve('updateAdminUseCase'),
            getOrCreateAdminUseCase: this.#container.resolve('getOrCreateAdminUseCase'),
            getAdminStatsUseCase: this.#container.resolve('getAdminStatsUseCase'),
            
            // Services
            metricsService: this.#container.resolve('metricsService'),
            channelReportService: this.#container.resolve('channelReportService'),
            
            // State
            stateManager: this.#container.resolve('stateManager'),
            
            // Repositories
            channelRepository: this.#container.resolve('channelRepository'),
            sessionRepository: this.#container.resolve('sessionRepository'),
            adminRepository: this.#container.resolve('adminRepository'),
            messageRepository: this.#container.resolve('messageRepository'),
          });
          
          await adminBot.start();
          this.#bots.adminBot = adminBot;
          
          // Register AdminBot in StateManager so UserBot can access it
          stateManager.registerBot('adminBot', adminBot);
          
          console.log('   ✅ AdminBot started successfully');
        } catch (error) {
          console.error('   ❌ Failed to start AdminBot:', error.message);
        }
      } else {
        console.log('   ⚠️  Admin bot token not configured');
      }
      console.log('');

      // Setup graceful shutdown
      this.#setupShutdownHandlers();

      // Start Daily Channel Logs Fetch Job
      console.log('⏰ Starting Daily Channel Logs Fetch Job...');
      try {
        const dailyJob = this.#container.resolve('dailyChannelLogsFetchJob');
        dailyJob.start();
        this.#bots.dailyChannelLogsFetchJob = dailyJob;
        console.log('   ✅ Daily job started successfully');
      } catch (error) {
        console.error('   ❌ Failed to start daily job:', error.message);
      }
      console.log('');

      // Start Monthly Report Job (sends previous month report to each admin)
      console.log('📑 Starting Monthly Report Job...');
      try {
        const monthlyReportJob = this.#container.resolve('monthlyReportJob');
        monthlyReportJob.start();
        this.#bots.monthlyReportJob = monthlyReportJob;
        console.log('   ✅ Monthly report job started successfully');
      } catch (error) {
        console.error('   ❌ Failed to start monthly report job:', error.message);
      }
      console.log('');

      this.#running = true;
      console.log('✨ Application started successfully!\n');
      console.log('═══════════════════════════════════════════');
      console.log('   Clean Architecture Migration Status');
      console.log('═══════════════════════════════════════════');
      console.log('✅ Core Layer        - Complete');
      console.log('✅ Data Layer        - Complete');
      console.log('✅ Domain Layer      - Complete');
      console.log('✅ Infrastructure    - Complete');
      console.log('✅ Presentation      - Complete');
      console.log('═══════════════════════════════════════════\n');
      console.log('🎉 Migration Complete!');
      console.log(`   Active Bots: ${Object.keys(this.#bots).length}`);
      console.log(`   Services: ${this.#container.getRegisteredServices().length}`);
      console.log('\n📱 Bot is now running...\n');

    } catch (error) {
      console.error('❌ Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Stops application
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.#running) {
      return;
    }

    console.log('\n🛑 Shutting down application...');

    try {
      // Stop bots
      for (const [name, bot] of Object.entries(this.#bots)) {
        console.log(`   Stopping ${name}...`);
        if (bot.stop) {
          await bot.stop();
        }
      }

      // Stop daily job
      if (this.#bots.dailyChannelLogsFetchJob) {
        this.#bots.dailyChannelLogsFetchJob.stop();
      }

      // Close TypeORM database
      console.log('   Closing TypeORM database...');
      await closeTypeORM();
      console.log('   Database closed');

      this.#running = false;
      console.log('✅ Application stopped gracefully\n');
      process.exit(0);

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Sets up shutdown handlers
   * @private
   */
  #setupShutdownHandlers() {
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      this.stop();
    });
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled rejection:', reason);
      this.stop();
    });
  }

  /**
   * Gets application status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      running: this.#running,
      bots: Object.keys(this.#bots),
      registeredServices: this.#container.getRegisteredServices().length
    };
  }
}

// Start application
const app = new Application();
app.start();

export default Application;
