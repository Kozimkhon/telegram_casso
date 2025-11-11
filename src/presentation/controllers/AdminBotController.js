/**
 * @fileoverview AdminBot Controller
 * Presentation layer controller for AdminBot functionality
 * Refactored from src/bots/adminBot.js with Clean Architecture
 * @module presentation/controllers/AdminBotController
 */

import { Telegraf, Markup } from "telegraf";
import { config } from "../../config/index.js";
import { createChildLogger } from "../../shared/logger.js";
import { asyncErrorHandler } from "../../shared/errorHandler.js";
import { setupCommands } from "../middleware/commands.js";
import { setupCallbacks } from "../middleware/callbacks.js";
import {
  handleStart,
  handleHelp,
  handleContactSupport,
} from "../handlers/menuHandlers.js";
import { createChannelHandlers } from "../handlers/channelHandlers.js";
import { createSessionHandlers } from "../handlers/sessionHandlers.js";
import { createStatsHandlers } from "../handlers/statsHandlers.js";
import { createAdminHandlers } from "../handlers/adminHandlers.js";
import { handleAdminNotRegistered } from "../services/admin-bot.js";
/**
 * AdminBot Controller
 * Handles Telegram admin bot with Clean Architecture
 *
 * @class AdminBotController
 */
class AdminBotController {
  /**
   * Telegraf bot instance
   * @private
   */
  #bot;

  /**
   * Use cases (injected)
   * @private
   */
  #useCases;

  /**
   * Domain services (injected)
   * @private
   */
  #services;

  /**
   * State manager (injected)
   * @private
   */
  #stateManager;

  /**
   * Logger
   * @private
   */
  #logger;

  /**
   * Running state
   * @private
   */
  #isRunning = false;

  /**
   * UserBot manager reference
   * @private
   */
  #userBotManager;

  /**
   * Creates AdminBot controller
   * @param {Object} dependencies - Injected dependencies
   * @param {Object} userBotManager - UserBot manager
   */
  constructor(dependencies, userBotManager = null) {
    // Inject use cases
    this.#useCases = {
      // Channel use cases
      addChannel: dependencies.addChannelUseCase,
      toggleChannelForwarding: dependencies.toggleChannelForwardingUseCase,
      removeChannel: dependencies.removeChannelUseCase,
      getChannelStats: dependencies.getChannelStatsUseCase,

      // Session use cases
      getSessionStats: dependencies.getSessionStatsUseCase,
      pauseSession: dependencies.pauseSessionUseCase,
      resumeSession: dependencies.resumeSessionUseCase,
      deleteSession: dependencies.deleteSessionUseCase,

      // User use cases
      getUsersByChannel: dependencies.getUsersByChannelUseCase,

      // Message use cases
      getForwardingStats: dependencies.getForwardingStatsUseCase,
      cleanupOldMessages: dependencies.cleanupOldMessagesUseCase,

      // Admin use cases
      checkAdminAccess: dependencies.checkAdminAccessUseCase,
      addAdmin: dependencies.addAdminUseCase,
      getAdminStats: dependencies.getAdminStatsUseCase,
    };

    // Inject domain services
    this.#services = {
      metrics: dependencies.metricsService,
    };

    // Inject state manager
    this.#stateManager = dependencies.stateManager;

    // Inject repositories (for direct queries)
    this.channelRepository = dependencies.channelRepository;
    this.sessionRepository = dependencies.sessionRepository;

    // UserBot manager
    this.#userBotManager = userBotManager;

    // Logger
    this.#logger = createChildLogger({ component: "AdminBotController" });

    // Create Telegraf bot
    this.#bot = new Telegraf(config.telegram.adminBotToken, {
      handlerTimeout: 90000,
    });

    // Setup bot
    this.#setupMiddleware();
    this.#setupHandlers();
  }

  /**
   * Starts AdminBot
   * @returns {Promise<void>}
   */
  async start() {
    try {
      this.#logger.info("Starting AdminBot...");

      await this.#bot.launch();

      this.#isRunning = true;
      this.#logger.info("AdminBot started successfully");
    } catch (error) {
      this.#logger.error("Failed to start AdminBot", error);
      throw error;
    }
  }

  /**
   * Stops AdminBot
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.#logger.info("Stopping AdminBot...");

      await this.#bot.stop();

      this.#isRunning = false;
      this.#logger.info("AdminBot stopped");
    } catch (error) {
      this.#logger.error("Error stopping AdminBot", error);
    }
  }

  /**
   * Sets up middleware
   * @private
   */
  #setupMiddleware() {
    // Admin authentication middleware
    this.#bot.use(
      asyncErrorHandler(async (ctx, next) => {
        const userId = ctx.from?.id?.toString();
        // Allow certain callbacks for non-admin users (registration process)
        const allowedCallbacks = ["register_admin", "contact_support"];
        const callbackData = ctx.callbackQuery?.data;

        if (callbackData && allowedCallbacks.includes(callbackData)) {
          // Allow registration callbacks for non-admin users
          return next();
        }
        if (!userId) {
          return;
        }

        try {
          // Check admin access using use case
          const access = await this.#useCases.checkAdminAccess.execute(userId);

          if (!access.hasAccess) {
            handleAdminNotRegistered(ctx);
            return;
          }

          // Store admin info in context
          ctx.state.admin = access;
          await next();
        } catch (error) {
          this.#logger.error("Middleware error", error);
          await ctx.reply("❌ Error checking permissions");
        }
      })
    );
  }

  /**
   * Sets up handlers, commands, and callbacks
   * @private
   */
  #setupHandlers() {
    // Create handler functions with dependencies
    const channelHandlers = createChannelHandlers({
      channelRepository: this.channelRepository,
      toggleChannelForwardingUseCase: this.#useCases.toggleChannelForwarding,
      getChannelStatsUseCase: this.#useCases.getChannelStats,
      getUsersByChannelUseCase: this.#useCases.getUsersByChannel,
    });

    const sessionHandlers = createSessionHandlers({
      sessionRepository: this.sessionRepository,
    });

    const statsHandlers = createStatsHandlers({
      getForwardingStatsUseCase: this.#useCases.getForwardingStats,
      metricsService: this.#services.metrics,
    });

    const adminHandlers = createAdminHandlers({
      addAdminUseCase: this.#useCases.addAdmin,
    });

    // Combine all handlers
    const handlers = {
      handleStart,
      handleHelp,
      handleContactSupport,
      ...channelHandlers,
      ...sessionHandlers,
      ...statsHandlers,
      ...adminHandlers,
    };

    // Setup commands and callbacks using middleware
    setupCommands(this.#bot, handlers);
    setupCallbacks(this.#bot, handlers);
  }

  /**
   * Gets status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      isRunning: this.#isRunning,
    };
  }
}

export default AdminBotController;
