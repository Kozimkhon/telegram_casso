/**
 * Message Queue - Sequential message processing per session
 * Ensures messages are sent one at a time with configurable delays
 */

import { log } from '../utils/logger.js';
import { sleep } from '../utils/throttle.js';

/**
 * Queue for processing messages sequentially
 */
export class MessageQueue {
  constructor(sessionPhone, options = {}) {
    this.sessionPhone = sessionPhone;
    this.queue = [];
    this.processing = false;
    this.minDelay = options.minDelay || 2000; // 2 seconds
    this.maxDelay = options.maxDelay || 5000; // 5 seconds
    this.onError = options.onError || null; // Error callback
    this.logger = log;
  }

  /**
   * Adds a message task to the queue
   * @param {Function} task - Async function to execute
   * @param {Object} metadata - Task metadata for logging
   * @returns {Promise<any>} Task result
   */
  async enqueue(task, metadata = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        metadata,
        resolve,
        reject
      });

      this.logger.debug('[MessageQueue] Task enqueued', {
        sessionPhone: this.sessionPhone,
        queueLength: this.queue.length,
        metadata
      });

      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Processes the queue sequentially
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      const { task, metadata, resolve, reject } = item;

      try {
        this.logger.debug('[MessageQueue] Processing task', {
          sessionPhone: this.sessionPhone,
          remaining: this.queue.length,
          metadata
        });

        // Execute the task
        const result = await task();

        // Random delay between messages
        const delay = Math.floor(
          this.minDelay + Math.random() * (this.maxDelay - this.minDelay)
        );

        this.logger.debug('[MessageQueue] Task completed, delaying', {
          sessionPhone: this.sessionPhone,
          delay,
          metadata
        });

        await sleep(delay);

        resolve(result);
      } catch (error) {
        this.logger.error('[MessageQueue] Task failed', {
          sessionPhone: this.sessionPhone,
          error: error.message,
          metadata
        });

        // Call error handler if provided
        if (this.onError) {
          try {
            await this.onError(error, metadata);
          } catch (handlerError) {
            this.logger.error('[MessageQueue] Error handler failed', {
              error: handlerError.message
            });
          }
        }

        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Gets the current queue length
   * @returns {number} Number of pending tasks
   */
  getQueueLength() {
    return this.queue.length;
  }

  /**
   * Checks if queue is currently processing
   * @returns {boolean} True if processing
   */
  isProcessing() {
    return this.processing;
  }

  /**
   * Clears the queue
   */
  clear() {
    this.logger.info('[MessageQueue] Clearing queue', {
      sessionPhone: this.sessionPhone,
      clearedTasks: this.queue.length
    });

    // Reject all pending tasks
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      item.reject(new Error('Queue cleared'));
    }

    this.processing = false;
  }

  /**
   * Updates queue configuration
   * @param {Object} options - New options
   */
  updateConfig(options) {
    if (options.minDelay !== undefined) {
      this.minDelay = options.minDelay;
    }
    if (options.maxDelay !== undefined) {
      this.maxDelay = options.maxDelay;
    }

    this.logger.info('[MessageQueue] Configuration updated', {
      sessionPhone: this.sessionPhone,
      minDelay: this.minDelay,
      maxDelay: this.maxDelay
    });
  }
}

/**
 * Queue manager for all sessions
 */
export class QueueManager {
  constructor() {
    this.queues = new Map(); // sessionPhone -> MessageQueue
    this.logger = log;
  }

  /**
   * Gets or creates a queue for a session
   * @param {string} sessionPhone - Session phone number
   * @param {Object} options - Queue options
   * @returns {MessageQueue} Message queue
   */
  getQueue(sessionPhone, options = {}) {
    if (!this.queues.has(sessionPhone)) {
      const queue = new MessageQueue(sessionPhone, options);
      this.queues.set(sessionPhone, queue);

      this.logger.info('[QueueManager] Created queue', {
        sessionPhone,
        options
      });
    }

    return this.queues.get(sessionPhone);
  }

  /**
   * Enqueues a task for a session
   * @param {string} sessionPhone - Session phone number
   * @param {Function} task - Task to execute
   * @param {Object} metadata - Task metadata
   * @returns {Promise<any>} Task result
   */
  async enqueue(sessionPhone, task, metadata = {}) {
    const queue = this.getQueue(sessionPhone);
    return await queue.enqueue(task, metadata);
  }

  /**
   * Updates queue configuration for a session
   * @param {string} sessionPhone - Session phone number
   * @param {Object} options - New options
   */
  updateQueueConfig(sessionPhone, options) {
    const queue = this.getQueue(sessionPhone);
    queue.updateConfig(options);
  }

  /**
   * Clears a queue
   * @param {string} sessionPhone - Session phone number
   */
  clearQueue(sessionPhone) {
    const queue = this.queues.get(sessionPhone);
    if (queue) {
      queue.clear();
    }
  }

  /**
   * Removes a queue
   * @param {string} sessionPhone - Session phone number
   */
  removeQueue(sessionPhone) {
    const queue = this.queues.get(sessionPhone);
    if (queue) {
      queue.clear();
      this.queues.delete(sessionPhone);

      this.logger.info('[QueueManager] Removed queue', { sessionPhone });
    }
  }

  /**
   * Gets status of all queues
   * @returns {Object} Queue status
   */
  getStatus() {
    const status = {};

    for (const [sessionPhone, queue] of this.queues) {
      status[sessionPhone] = {
        queueLength: queue.getQueueLength(),
        processing: queue.isProcessing(),
        minDelay: queue.minDelay,
        maxDelay: queue.maxDelay
      };
    }

    return status;
  }
}

// Export singleton instance
export const queueManager = new QueueManager();

export default {
  MessageQueue,
  QueueManager,
  queueManager
};
