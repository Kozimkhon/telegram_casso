/**
 * @fileoverview Queue Service - Domain Service for Message Queuing
 * 
 * Implements message queue strategy following DDD principles.
 * Handles sequential processing of messages with configurable delays and error handling.
 * 
 * @module domain/services/QueueService
 * @see {@link MessageQueue} For message queue implementation
 */

import { log } from '../../shared/logger.js';

/**
 * Queue Item Value Object
 * Represents a single item in the queue
 * 
 * @class QueueItemVO
 */
class QueueItemVO {
  #id;
  #task;
  #metadata;
  #createdAt;
  #attempts;
  #maxRetries;
  #promise;

  /**
   * Creates queue item
   * @param {Object} config - Item configuration
   * @param {Function} config.task - Async function to execute
   * @param {Object} config.metadata - Task metadata for logging
   * @param {number} config.maxRetries - Maximum retry attempts
   */
  constructor(config = {}) {
    this.#id = config.id || this.#generateId();
    this.#task = config.task;
    this.#metadata = config.metadata || {};
    this.#createdAt = Date.now();
    this.#attempts = 0;
    this.#maxRetries = config.maxRetries || 0;
    this.#promise = { resolve: null, reject: null };
  }

  /**
   * Generates unique item ID
   * @private
   * @returns {string} Unique ID
   */
  #generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets item ID
   * @returns {string} Item ID
   */
  getId() {
    return this.#id;
  }
  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  /**
   * Gets task function
   * @returns {Function} Task function
   */
  getTask() {
    return this.#task;
  }

  /**
   * Gets metadata
   * @returns {Object} Metadata
   */
  getMetadata() {
    return this.#metadata;
  }

  /**
   * Gets creation timestamp
   * @returns {number} Timestamp
   */
  getCreatedAt() {
    return this.#createdAt;
  }

  /**
   * Gets time spent in queue
   * @returns {number} Milliseconds
   */
  getWaitTime() {
    return Date.now() - this.#createdAt;
  }

  /**
   * Increments attempt count
   */
  incrementAttempts() {
    this.#attempts++;
  }

  /**
   * Gets attempt count
   * @returns {number} Attempts
   */
  getAttempts() {
    return this.#attempts;
  }

  /**
   * Checks if can retry
   * @returns {boolean} True if retries available
   */
  canRetry() {
    return this.#attempts <= this.#maxRetries;
  }

  /**
   * Sets promise handlers
   * @param {Function} resolve - Resolve handler
   * @param {Function} reject - Reject handler
   */
  setPromiseHandlers(resolve, reject) {
    this.#promise.resolve = resolve;
    this.#promise.reject = reject;
  }

  /**
   * Resolves promise with value
   * @param {*} value - Result value
   */
  resolvePromise(value) {
    if (this.#promise.resolve) {
      this.#promise.resolve(value);
    }
  }

  /**
   * Rejects promise with error
   * @param {Error} error - Error
   */
  rejectPromise(error) {
    if (this.#promise.reject) {
      this.#promise.reject(error);
    }
  }
}

/**
 * Message Queue Value Object
 * Manages individual queue for a session
 * 
 * @class MessageQueueVO
 */
class MessageQueueVO {
  #items;
  #processing;
  #sessionId;
  #minDelay;
  #maxDelay;
  #logger;

  /**
   * Creates message queue
   * @param {Object} config - Configuration
   * @param {string} config.sessionId - Session identifier
   * @param {number} config.minDelay - Minimum delay between messages (ms)
   * @param {number} config.maxDelay - Maximum delay between messages (ms)
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.#items = [];
    this.#processing = false;
    this.#sessionId = config.sessionId;
    this.#minDelay = config.minDelay || 2000;
    this.#maxDelay = config.maxDelay || 5000;
    this.#logger = config.logger || log;
  }

  /**
   * Adds item to queue
   * @param {QueueItemVO} item - Item to add
   */
  enqueue(item) {
    this.#items.push(item);
    this.#logger.debug('[MessageQueue] Item enqueued', {
      sessionId: this.#sessionId,
      itemId: item.getId(),
      queueLength: this.#items.length,
      metadata: item.getMetadata()
    });
  }

  /**
   * Removes first item from queue
   * @returns {QueueItemVO|null} First item or null
   */
  dequeue() {
    return this.#items.shift() || null;
  }

  /**
   * Gets queue length
   * @returns {number} Number of items
   */
  getLength() {
    return this.#items.length;
  }

  /**
   * Checks if queue is empty
   * @returns {boolean} True if empty
   */
  isEmpty() {
    return this.#items.length === 0;
  }

  /**
   * Checks if currently processing
   * @returns {boolean} True if processing
   */
  isProcessing() {
    return this.#processing;
  }

  /**
   * Sets processing flag
   * @param {boolean} value - Processing state
   */
  setProcessing(value) {
    this.#processing = value;
  }

  /**
   * Gets random delay between min and max
   * @private
   * @returns {number} Delay in milliseconds
   */
  #getRandomDelay() {
    return Math.floor(
      this.#minDelay + Math.random() * (this.#maxDelay - this.#minDelay)
    );
  }

  /**
   * Waits for delay between messages
   * @async
   * @returns {Promise<void>}
   */
  async waitForDelay() {
    const delay = this.#getRandomDelay();
    await sleep(delay);
  }

  /**
   * Clears all items from queue
   * @returns {number} Number of items cleared
   */
  clear() {
    const count = this.#items.length;
    this.#items.forEach(item => {
      item.rejectPromise(new Error('Queue cleared'));
    });
    this.#items = [];
    this.#logger.info('[MessageQueue] Queue cleared', {
      sessionId: this.#sessionId,
      itemsCleared: count
    });
    return count;
  }

  /**
   * Gets queue statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const now = Date.now();
    const avgWaitTime = this.#items.length > 0
      ? this.#items.reduce((sum, item) => sum + item.getWaitTime(), 0) / this.#items.length
      : 0;

    return {
      length: this.#items.length,
      processing: this.#processing,
      averageWaitTimeMs: Math.round(avgWaitTime),
      oldestItemAgeMs: this.#items.length > 0 ? this.#items[0].getWaitTime() : 0,
      sessionId: this.#sessionId
    };
  }
}

/**
 * Queue Service - Domain Service
 * 
 * Manages message queuing for sequential processing.
 * Ensures reliable message delivery with error handling and retry logic.
 * 
 * Responsibilities:
 * - Queue management per session
 * - Sequential message processing
 * - Error handling and recovery
 * - Delay management between messages
 * - Queue monitoring and statistics
 * 
 * @class QueueService
 */
class QueueService {
  #queues;
  #logger;
  #onError;

  /**
   * Creates queue service instance
   * @param {Object} options - Configuration options
   * @param {Function} options.onError - Error handler callback
   * @param {Object} options.logger - Logger instance (default: log)
   */
  constructor(options = {}) {
    this.#queues = new Map(); // sessionId -> MessageQueueVO
    this.#logger = options.logger || log;
    this.#onError = options.onError || null;

    this.#logger.debug('[QueueService] Initialized');
  }

  /**
   * Gets or creates queue for session
   * @private
   * @param {string} sessionId - Session identifier
   * @param {Object} config - Queue configuration
   * @returns {MessageQueueVO} Message queue
   */
  #getQueue(sessionId, config = {}) {
    if (!this.#queues.has(sessionId)) {
      const queue = new MessageQueueVO({
        sessionId,
        minDelay: config.minDelay || 2000,
        maxDelay: config.maxDelay || 5000,
        logger: this.#logger
      });
      this.#queues.set(sessionId, queue);

      this.#logger.info('[QueueService] Created queue', { sessionId });
    }

    return this.#queues.get(sessionId);
  }

  /**
   * Enqueues task for a session
   * @async
   * @param {string} sessionId - Session identifier
   * @param {Function} task - Async task to execute
   * @param {Object} options - Enqueue options
   * @returns {Promise<*>} Task result
   */
  async enqueue(sessionId, task, options = {}) {
    return new Promise((resolve, reject) => {
      const queue = this.#getQueue(sessionId, options);

      const item = new QueueItemVO({
        task,
        metadata: options.metadata || {},
        maxRetries: options.maxRetries || 0
      });

      item.setPromiseHandlers(resolve, reject);
      queue.enqueue(item);

      // Start processing if not already processing
      if (!queue.isProcessing()) {
        this.#processQueue(sessionId);
      }
    });
  }

  /**
   * Processes queue for session sequentially
   * @private
   * @async
   * @param {string} sessionId - Session identifier
   */
  async #processQueue(sessionId) {
    const queue = this.#getQueue(sessionId);

    if (queue.isProcessing() || queue.isEmpty()) {
      return;
    }

    queue.setProcessing(true);

    try {
      while (!queue.isEmpty()) {
        const item = queue.dequeue();

        try {
          this.#logger.debug('[QueueService] Processing item', {
            sessionId,
            itemId: item.getId(),
            attempt: item.getAttempts() + 1,
            queueLength: queue.getLength(),
            metadata: item.getMetadata()
          });

          item.incrementAttempts();

          // Execute the task
          const result = await item.getTask();

          this.#logger.debug('[QueueService] Item completed', {
            sessionId,
            itemId: item.getId(),
            metadata: item.getMetadata()
          });

          // Wait for delay before next message
          if (!queue.isEmpty()) {
            await queue.waitForDelay();
          }

          item.resolvePromise(result);
        } catch (error) {
          this.#logger.error('[QueueService] Item processing failed', {
            sessionId,
            itemId: item.getId(),
            attempt: item.getAttempts(),
            error: error.message,
            metadata: item.getMetadata()
          });

          // Call error handler if provided
          if (this.#onError) {
            try {
              await this.#onError(error, item.getMetadata(), sessionId);
            } catch (handlerError) {
              this.#logger.error('[QueueService] Error handler failed', {
                error: handlerError.message
              });
            }
          }

          item.rejectPromise(error);
        }
      }
    } finally {
      queue.setProcessing(false);
    }
  }

  /**
   * Enqueues multiple tasks for a session
   * @async
   * @param {string} sessionId - Session identifier
   * @param {Array<Function>} tasks - Array of async tasks
   * @param {Object} options - Options
   * @returns {Promise<Array>} Array of results
   */
  async enqueueBulk(sessionId, tasks, options = {}) {
    const promises = tasks.map(task =>
      this.enqueue(sessionId, task, options)
    );
    return Promise.all(promises);
  }

  /**
   * Gets queue status for session
   * @param {string} sessionId - Session identifier
   * @returns {Object} Queue status
   */
  getQueueStatus(sessionId) {
    const queue = this.#queues.get(sessionId);
    if (!queue) {
      return {
        sessionId,
        exists: false,
        length: 0,
        processing: false
      };
    }

    return {
      sessionId,
      exists: true,
      ...queue.getStatistics()
    };
  }

  /**
   * Gets status of all queues
   * @returns {Object} Status map
   */
  getAllQueuesStatus() {
    const status = {};
    for (const [sessionId, queue] of this.#queues) {
      status[sessionId] = queue.getStatistics();
    }
    return status;
  }

  /**
   * Clears queue for session
   * @param {string} sessionId - Session identifier
   * @returns {number} Number of items cleared
   */
  clearQueue(sessionId) {
    const queue = this.#queues.get(sessionId);
    if (queue) {
      return queue.clear();
    }
    return 0;
  }

  /**
   * Removes queue entirely
   * @param {string} sessionId - Session identifier
   */
  removeQueue(sessionId) {
    const queue = this.#queues.get(sessionId);
    if (queue) {
      queue.clear();
      this.#queues.delete(sessionId);
      this.#logger.info('[QueueService] Queue removed', { sessionId });
    }
  }

  /**
   * Stops service and cleanup resources
   */
  stop() {
    for (const [sessionId, queue] of this.#queues) {
      queue.clear();
    }
    this.#queues.clear();
    this.#logger.info('[QueueService] Service stopped');
  }
}

export default QueueService;
