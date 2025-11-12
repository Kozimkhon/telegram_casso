/**
 * @fileoverview Dependency Injection Container
 * Manages application dependencies and lifecycle
 * @module shared/container/Container
 */

/**
 * Dependency Injection Container
 * Implements Service Locator pattern
 * 
 * @class Container
 */
class Container {
  /**
   * Singleton instance
   * @private
   * @static
   */
  static #instance = null;

  /**
   * Registered services
   * @private
   */
  #services = new Map();

  /**
   * Singleton instances
   * @private
   */
  #singletons = new Map();

  /**
   * Initialization flag
   * @private
   */
  #initialized = false;

  /**
   * Creates container (private constructor)
   * @private
   */
  constructor() {
    if (Container.#instance) {
      throw new Error('Container already instantiated. Use Container.getInstance()');
    }
  }

  /**
   * Gets singleton instance
   * @returns {Container} Container instance
   */
  static getInstance() {
    if (!Container.#instance) {
      Container.#instance = new Container();
    }
    return Container.#instance;
  }

  /**
   * Registers singleton service
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @returns {Container} This container (fluent)
   */
  registerSingleton(name, factory) {
    this.#services.set(name, {
      type: 'singleton',
      factory
    });
    return this;
  }

  /**
   * Registers transient service
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @returns {Container} This container (fluent)
   */
  registerTransient(name, factory) {
    this.#services.set(name, {
      type: 'transient',
      factory
    });
    return this;
  }

  /**
   * Registers instance directly
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   * @returns {Container} This container (fluent)
   */
  registerInstance(name, instance) {
    this.#singletons.set(name, instance);
    return this;
  }

  /**
   * Resolves service
   * @param {string} name - Service name
   * @returns {*} Service instance
   * @throws {Error} If service not registered
   */
  resolve(name) {
    // Check for direct instance
    if (this.#singletons.has(name)) {
      return this.#singletons.get(name);
    }

    // Check for registered service
    const service = this.#services.get(name);
    if (!service) {
      throw new Error(`Service not registered: ${name}`);
    }

    // Handle singleton
    if (service.type === 'singleton') {
      if (!this.#singletons.has(name)) {
        const instance = service.factory(this);
        this.#singletons.set(name, instance);
      }
      return this.#singletons.get(name);
    }

    // Handle transient
    return service.factory(this);
  }

  /**
   * Checks if service is registered
   * @param {string} name - Service name
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.#services.has(name) || this.#singletons.has(name);
  }

  /**
   * Gets all registered service names
   * @returns {Array<string>} Service names
   */
  getRegisteredServices() {
    return [
      ...Array.from(this.#services.keys()),
      ...Array.from(this.#singletons.keys())
    ];
  }

  /**
   * Initializes container with default services
   * @param {Object} config - Configuration
   * @returns {Promise<void>}
   */
  async initialize(config) {
    if (this.#initialized) {
      throw new Error('Container already initialized');
    }

    // Import dependencies
    const { default: StateManager } = await import('../state/StateManager.js');
    
    // Import repositories (now using TypeORM)
    const { 
      ChannelRepository, 
      SessionRepository, 
      UserRepository, 
      MessageRepository, 
      AdminRepository 
    } = await import('../../data/repositories/index.js');

    // Import use cases
    const sessionUseCases = await import('../../domain/use-cases/session/index.js');
    const channelUseCases = await import('../../domain/use-cases/channel/index.js');
    const userUseCases = await import('../../domain/use-cases/user/index.js');
    const messageUseCases = await import('../../domain/use-cases/message/index.js');
    const adminUseCases = await import('../../domain/use-cases/admin/index.js');

    // Import services
    const { 
      ForwardingService, 
      ThrottleService, 
      MetricsService, 
      QueueService 
    } = await import('../../domain/services/index.js');

    // Register core infrastructure
    this.registerSingleton('stateManager', () => StateManager);

    // Register repositories (TypeORM - no datasource needed)
    this.registerSingleton('channelRepository', () => new ChannelRepository());
    this.registerSingleton('sessionRepository', () => new SessionRepository());
    this.registerSingleton('userRepository', () => new UserRepository());
    this.registerSingleton('messageRepository', () => new MessageRepository());
    this.registerSingleton('adminRepository', () => new AdminRepository());

    // Register domain services
    this.registerSingleton('throttleService', () => new ThrottleService({maxMessages:1000,timeWindow:75000}));
    this.registerSingleton('forwardingService', (c) => 
      new ForwardingService(
        c.resolve('userRepository'),
        c.resolve('messageRepository'),
        c.resolve('throttleService'),
        c.resolve('stateManager')
      )
    );
    this.registerSingleton('metricsService', (c) => 
      new MetricsService({
        sessionRepository: c.resolve('sessionRepository'),
        channelRepository: c.resolve('channelRepository'),
        userRepository: c.resolve('userRepository'),
        messageRepository: c.resolve('messageRepository'),
        adminRepository: c.resolve('adminRepository')
      })
    );

    // Register session use cases
    this.registerTransient('createSessionUseCase', (c) => 
      new sessionUseCases.CreateSessionUseCase(
        c.resolve('sessionRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('pauseSessionUseCase', (c) => 
      new sessionUseCases.PauseSessionUseCase(
        c.resolve('sessionRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('resumeSessionUseCase', (c) => 
      new sessionUseCases.ResumeSessionUseCase(
        c.resolve('sessionRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('deleteSessionUseCase', (c) => 
      new sessionUseCases.DeleteSessionUseCase(
        c.resolve('sessionRepository'),
        c.resolve('channelRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('getSessionStatsUseCase', (c) => 
      new sessionUseCases.GetSessionStatsUseCase(
        c.resolve('sessionRepository')
      )
    );

    // Register channel use cases
    this.registerTransient('addChannelUseCase', (c) => 
      new channelUseCases.AddChannelUseCase(
        c.resolve('channelRepository'),
        c.resolve('sessionRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('toggleChannelForwardingUseCase', (c) => 
      new channelUseCases.ToggleChannelForwardingUseCase(
        c.resolve('channelRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('linkChannelToSessionUseCase', (c) => 
      new channelUseCases.LinkChannelToSessionUseCase(
        c.resolve('channelRepository'),
        c.resolve('sessionRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('removeChannelUseCase', (c) => 
      new channelUseCases.RemoveChannelUseCase(
        c.resolve('channelRepository'),
        c.resolve('userRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('getChannelStatsUseCase', (c) => 
      new channelUseCases.GetChannelStatsUseCase(
        c.resolve('channelRepository')
      )
    );

    // Register user use cases
    this.registerTransient('addUserUseCase', (c) => 
      new userUseCases.AddUserUseCase(
        c.resolve('userRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('bulkAddUsersUseCase', (c) => 
      new userUseCases.BulkAddUsersUseCase(
        c.resolve('userRepository'),
        c.resolve('stateManager')
      )
    );
    this.registerTransient('addUserToChannelUseCase', (c) => 
      new userUseCases.AddUserToChannelUseCase(
        c.resolve('userRepository'),
        c.resolve('channelRepository')
      )
    );
    this.registerTransient('removeUserFromChannelUseCase', (c) => 
      new userUseCases.RemoveUserFromChannelUseCase(
        c.resolve('userRepository'),
        c.resolve('channelRepository')
      )
    );
    this.registerTransient('getUsersByChannelUseCase', (c) => 
      new userUseCases.GetUsersByChannelUseCase(
        c.resolve('userRepository'),
        c.resolve('channelRepository')
      )
    );

    // Register message use cases
    this.registerTransient('logMessageUseCase', (c) => 
      new messageUseCases.LogMessageUseCase(
        c.resolve('messageRepository')
      )
    );
    this.registerTransient('markMessageAsDeletedUseCase', (c) => 
      new messageUseCases.MarkMessageAsDeletedUseCase(
        c.resolve('messageRepository')
      )
    );
    this.registerTransient('getMessagesByChannelUseCase', (c) => 
      new messageUseCases.GetMessagesByChannelUseCase(
        c.resolve('messageRepository'),
        c.resolve('channelRepository')
      )
    );
    this.registerTransient('getForwardingStatsUseCase', (c) => 
      new messageUseCases.GetForwardingStatsUseCase(
        c.resolve('messageRepository')
      )
    );
    this.registerTransient('cleanupOldMessagesUseCase', (c) => 
      new messageUseCases.CleanupOldMessagesUseCase(
        c.resolve('messageRepository')
      )
    );
    this.registerTransient('findOldMessagesUseCase', (c) => 
      new messageUseCases.FindOldMessagesUseCase(
        c.resolve('messageRepository')
      )
    );

    // Register admin use cases
    this.registerTransient('addAdminUseCase', (c) => 
      new adminUseCases.AddAdminUseCase(
        c.resolve('adminRepository')
      )
    );
    this.registerTransient('updateAdminUseCase', (c) => 
      new adminUseCases.UpdateAdminUseCase(
        c.resolve('adminRepository')
      )
    );
    this.registerTransient('getOrCreateAdminUseCase', (c) => 
      new adminUseCases.GetOrCreateAdminUseCase(
        c.resolve('adminRepository')
      )
    );
    this.registerTransient('removeAdminUseCase', (c) => 
      new adminUseCases.RemoveAdminUseCase(
        c.resolve('adminRepository')
      )
    );
    this.registerTransient('checkAdminAccessUseCase', (c) => 
      new adminUseCases.CheckAdminAccessUseCase(
        c.resolve('adminRepository')
      )
    );
    this.registerTransient('getAdminStatsUseCase', (c) => 
      new adminUseCases.GetAdminStatsUseCase(
        c.resolve('adminRepository')
      )
    );

    this.#initialized = true;
  }

  /**
   * Resets container (for testing)
   * @static
   */
  static reset() {
    Container.#instance = null;
  }
}

export default Container;
