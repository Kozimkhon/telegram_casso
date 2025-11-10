/**
 * @fileoverview Application Bootstrap
 * Main entry point for Clean Architecture refactor
 * @module index.new
 */

import Container from './shared/container/Container.js';
import config from './config/index.js';
import { initializeDatabase } from './db/db.js';

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

      // Initialize database
      console.log('📦 Initializing database...');
      await initializeDatabase();
      console.log('✅ Database initialized\n');

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
      const sessions = await sessionRepository.findByStatus('active');
      
      if (sessions.length > 0) {
        console.log(`   Found ${sessions.length} active session(s)`);
        // TODO: Initialize UserBotController here
        console.log('   ⚠️  UserBotController not yet implemented');
      } else {
        console.log('   ⚠️  No active sessions found');
      }
      console.log('');

      // Start AdminBot
      console.log('👤 Starting AdminBot...');
      if (config.adminBot.token) {
        // TODO: Initialize AdminBotController here
        console.log('   ⚠️  AdminBotController not yet implemented');
      } else {
        console.log('   ⚠️  Admin bot token not configured');
      }
      console.log('');

      // Setup graceful shutdown
      this.#setupShutdownHandlers();

      this.#running = true;
      console.log('✨ Application started successfully!\n');
      console.log('═══════════════════════════════════════════');
      console.log('   Clean Architecture Migration Status');
      console.log('═══════════════════════════════════════════');
      console.log('✅ Core Layer        - Complete');
      console.log('✅ Data Layer        - Complete');
      console.log('✅ Domain Layer      - Complete');
      console.log('✅ Infrastructure    - Complete');
      console.log('⚠️  Presentation     - Pending (Controllers)');
      console.log('═══════════════════════════════════════════\n');
      console.log('📝 Next steps:');
      console.log('   1. Implement UserBotController');
      console.log('   2. Implement AdminBotController');
      console.log('   3. Test end-to-end functionality');
      console.log('   4. Remove old service files\n');

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

      // Close database
      const dataSource = this.#container.resolve('dataSource');
      if (dataSource && dataSource.close) {
        await dataSource.close();
        console.log('   Database closed');
      }

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
