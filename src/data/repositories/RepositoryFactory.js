/**
 * @fileoverview Repository Factory
 * Factory for creating repository instances
 * @module repositories/RepositoryFactory
 */

import {
  AdminRepository,
  SessionRepository,
  ChannelRepository,
  UserRepository,
  MessageRepository as TypeORMMessageRepository,
  MetricRepository,
} from './typeorm/index.js';

/**
 * Repository Factory
 * Creates and manages repository instances
 * 
 * @class RepositoryFactory
 */
class RepositoryFactory {
  /**
   * Repository instances cache
   * @private
   */
  static #repositories = new Map();

  /**
   * Gets Admin repository
   * @returns {AdminRepository} Admin repository instance
   */
  static getAdminRepository() {
    if (!this.#repositories.has('admin')) {
      this.#repositories.set('admin', new AdminRepository());
    }
    return this.#repositories.get('admin');
  }

  /**
   * Gets Session repository
   * @returns {SessionRepository} Session repository instance
   */
  static getSessionRepository() {
    if (!this.#repositories.has('session')) {
      this.#repositories.set('session', new SessionRepository());
    }
    return this.#repositories.get('session');
  }

  /**
   * Gets Channel repository
   * @returns {ChannelRepository} Channel repository instance
   */
  static getChannelRepository() {
    if (!this.#repositories.has('channel')) {
      this.#repositories.set('channel', new ChannelRepository());
    }
    return this.#repositories.get('channel');
  }

  /**
   * Gets User repository
   * @returns {UserRepository} User repository instance
   */
  static getUserRepository() {
    if (!this.#repositories.has('user')) {
      this.#repositories.set('user', new UserRepository());
    }
    return this.#repositories.get('user');
  }

  /**
   * Gets Message repository
   * @returns {TypeORMMessageRepository} Message repository instance
   */
  static getMessageRepository() {
    if (!this.#repositories.has('message')) {
      this.#repositories.set('message', new TypeORMMessageRepository());
    }
    return this.#repositories.get('message');
  }

  /**
   * Gets Metric repository
   * @returns {MetricRepository} Metric repository instance
   */
  static getMetricRepository() {
    if (!this.#repositories.has('metric')) {
      this.#repositories.set('metric', new MetricRepository());
    }
    return this.#repositories.get('metric');
  }

  /**
   * Gets all repositories
   * @returns {Object} All repository instances
   */
  static getAllRepositories() {
    return {
      adminRepository: this.getAdminRepository(),
      sessionRepository: this.getSessionRepository(),
      channelRepository: this.getChannelRepository(),
      userRepository: this.getUserRepository(),
      messageRepository: this.getMessageRepository(),
      metricRepository: this.getMetricRepository(),
    };
  }

  /**
   * Clears repository cache
   * @returns {void}
   */
  static clearCache() {
    this.#repositories.clear();
  }
}

export default RepositoryFactory;
