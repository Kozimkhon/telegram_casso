/**
 * Dependency Injection Container
 * Manages application dependencies following SOLID principles
 * 
 * @module core/di/Container
 */

import { SQLiteDataSource } from '../../data/data-sources/SQLiteDataSource.js';
import { ChannelRepository } from '../../data/repositories/ChannelRepository.js';
import { SessionRepository } from '../../data/repositories/SessionRepository.js';
import AppState from '../state/AppState.js';

/**
 * @class Container
 * @description Dependency injection container implementing the Service Locator pattern
 * Manages singleton instances and resolves dependencies
 */
export class Container {
  /**
   * @private
   * @static
   * @type {Container|null}
   */
  static #instance = null;

  /**
   * Private constructor to enforce singleton pattern
   * @private
   */
  constructor() {
    if (Container.#instance) {
      throw new Error('Container is a singleton. Use Container.getInstance() instead.');
    }

    /**
     * @private
     * @type {Map<string, any>}
     */
    this.#services = new Map();

    /**
     * @private
     * @type {Map<string, Function>}
     */
    this.#factories = new Map();

    /**
     * @private
     * @type {boolean}
     */
    this.#initialized = false;

    Container.#instance = this;
  }

  /**
   * Gets the singleton instance of Container
   * @static
   * @returns {Container} The singleton instance
   */
  static getInstance() {
    if (!Container.#instance) {
      new Container();
    }
    return Container.#instance;
  }

  /**
   * Initializes the container and registers all services
   * @param {Object} config - Application configuration
   * @returns {Promise<void>}
   * @throws {Error} If already initialized
   */
  async initialize(config) {
    if (this.#initialized) {
      throw new Error('Container already initialized');
    }

    // Register configuration
    this.registerSingleton('config', config);

    // Register AppState singleton
    this.registerSingleton('appState', AppState);

    // Register data source
    await this.#registerDataSource();

    // Register repositories
    this.#registerRepositories();

    // Register use cases
    this.#registerUseCases();

    this.#initialized = true;
  }

  /**
   * Registers and initializes data source
   * @private
   * @returns {Promise<void>}
   */
  async #registerDataSource() {
    const dataSource = new SQLiteDataSource();
    await dataSource.initialize();
    this.registerSingleton('dataSource', dataSource);
  }

  /**
   * Registers all repositories
   * @private
   */
  #registerRepositories() {
    const dataSource = this.resolve('dataSource');

    this.registerSingleton('channelRepository', new ChannelRepository(dataSource));
    this.registerSingleton('sessionRepository', new SessionRepository(dataSource));
    // Add more repositories as needed
  }

  /**
   * Registers all use cases
   * @private
   */
  #registerUseCases() {
    // Use cases will be registered here
    // Example: this.registerTransient('forwardMessageUseCase', () => new ForwardMessageUseCase(...deps));
  }

  /**
   * Registers a singleton service
   * @param {string} name - Service name
   * @param {any} instance - Service instance
   * @throws {Error} If service already registered
   */
  registerSingleton(name, instance) {
    if (this.#services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }
    this.#services.set(name, instance);
  }

  /**
   * Registers a transient service factory
   * @param {string} name - Service name
   * @param {Function} factory - Factory function
   * @throws {Error} If factory already registered
   */
  registerTransient(name, factory) {
    if (this.#factories.has(name)) {
      throw new Error(`Factory '${name}' is already registered`);
    }
    this.#factories.set(name, factory);
  }

  /**
   * Resolves a service by name
   * @param {string} name - Service name
   * @returns {any} Service instance
   * @throws {Error} If service not found
   */
  resolve(name) {
    // Check for singleton
    if (this.#services.has(name)) {
      return this.#services.get(name);
    }

    // Check for transient factory
    if (this.#factories.has(name)) {
      const factory = this.#factories.get(name);
      return factory(this);
    }

    throw new Error(`Service '${name}' not found in container`);
  }

  /**
   * Checks if service is registered
   * @param {string} name - Service name
   * @returns {boolean} True if registered
   */
  has(name) {
    return this.#services.has(name) || this.#factories.has(name);
  }

  /**
   * Gets all registered service names
   * @returns {Array<string>} Array of service names
   */
  getServiceNames() {
    return [
      ...Array.from(this.#services.keys()),
      ...Array.from(this.#factories.keys())
    ];
  }

  /**
   * Clears all services (for testing purposes)
   * @private
   */
  clear() {
    this.#services.clear();
    this.#factories.clear();
    this.#initialized = false;
  }

  /**
   * Checks if container is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * Creates a scoped container (child container)
   * Inherits parent services but can override them
   * @returns {Container} Scoped container
   */
  createScope() {
    const scope = Object.create(this);
    scope.#services = new Map(this.#services);
    scope.#factories = new Map(this.#factories);
    return scope;
  }

  /**
   * Builds an object with dependency injection
   * @template T
   * @param {Function} Class - Class constructor
   * @param {Array<string>} dependencies - Dependency names
   * @returns {T} Instance with injected dependencies
   * @example
   * const service = container.build(MyService, ['repository', 'logger']);
   */
  build(Class, dependencies = []) {
    const resolvedDeps = dependencies.map(dep => this.resolve(dep));
    return new Class(...resolvedDeps);
  }

  /**
   * Injects dependencies into a function
   * @param {Function} fn - Function to inject
   * @param {Array<string>} dependencies - Dependency names
   * @returns {any} Function result
   * @example
   * const result = container.inject(myFunction, ['repository', 'config']);
   */
  inject(fn, dependencies = []) {
    const resolvedDeps = dependencies.map(dep => this.resolve(dep));
    return fn(...resolvedDeps);
  }
}

/**
 * Decorator for dependency injection
 * @param {Array<string>} dependencies - Dependency names
 * @returns {Function} Decorator function
 * @example
 * @injectable(['repository', 'logger'])
 * class MyService {
 *   constructor(repository, logger) {
 *     this.repository = repository;
 *     this.logger = logger;
 *   }
 * }
 */
export function injectable(dependencies) {
  return function(target) {
    target.$inject = dependencies;
    return target;
  };
}

// Export singleton instance
export default Container.getInstance();
