/**
 * Base Use Case
 * Abstract base class for all use cases
 * 
 * @module core/use-cases/BaseUseCase
 */

/**
 * @abstract
 * @class BaseUseCase
 * @template TRequest
 * @template TResponse
 * @description Base class for implementing use cases following the Command pattern
 * Each use case represents a single business operation
 */
export class BaseUseCase {
  /**
   * Creates a new use case
   * @param {Object} logger - Logger instance
   */
  constructor(logger) {
    if (new.target === BaseUseCase) {
      throw new Error('BaseUseCase is abstract and cannot be instantiated directly');
    }
    this.logger = logger;
  }

  /**
   * Executes the use case
   * @param {TRequest} request - Use case request
   * @returns {Promise<TResponse>} Use case response
   * @abstract
   */
  async execute(request) {
    throw new Error('Method execute() must be implemented');
  }

  /**
   * Validates use case request
   * @param {TRequest} request - Request to validate
   * @throws {Error} If validation fails
   * @protected
   */
  validate(request) {
    if (!request) {
      throw new Error('Request is required');
    }
  }

  /**
   * Logs use case execution
   * @param {string} message - Log message
   * @param {Object} [context] - Additional context
   * @protected
   */
  log(message, context = {}) {
    if (this.logger) {
      this.logger.info(message, { useCase: this.constructor.name, ...context });
    }
  }

  /**
   * Logs use case error
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {Object} [context] - Additional context
   * @protected
   */
  logError(message, error, context = {}) {
    if (this.logger) {
      this.logger.error(message, { 
        useCase: this.constructor.name, 
        error: error.message,
        stack: error.stack,
        ...context 
      });
    }
  }
}

export default BaseUseCase;
