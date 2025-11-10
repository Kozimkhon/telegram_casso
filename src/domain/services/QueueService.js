/**
 * @fileoverview Message Queue Service
 * Manages message queuing for forwarding
 * @module domain/services/QueueService
 */

/**
 * Queue Service
 * Handles message queuing
 * 
 * @class QueueService
 */
class QueueService {
  /**
   * Message queue
   * @private
   */
  #queue = [];

  /**
   * Processing flag
   * @private
   */
  #processing = false;

  /**
   * Processor function
   * @private
   */
  #processor;

  /**
   * Delay between messages (ms)
   * @private
   */
  #delay;

  /**
   * Creates queue service
   * @param {Function} processor - Message processor
   * @param {number} delay - Delay between messages
   */
  constructor(processor, delay = 1000) {
    this.#processor = processor;
    this.#delay = delay;
  }

  /**
   * Adds message to queue
   * @param {Object} message - Message
   * @returns {void}
   */
  enqueue(message) {
    this.#queue.push({
      ...message,
      addedAt: Date.now()
    });

    if (!this.#processing) {
      this.#startProcessing();
    }
  }

  /**
   * Adds multiple messages to queue
   * @param {Array<Object>} messages - Messages
   * @returns {void}
   */
  enqueueBulk(messages) {
    const timestamp = Date.now();
    messages.forEach(msg => {
      this.#queue.push({
        ...msg,
        addedAt: timestamp
      });
    });

    if (!this.#processing) {
      this.#startProcessing();
    }
  }

  /**
   * Starts processing queue
   * @private
   */
  async #startProcessing() {
    this.#processing = true;

    while (this.#queue.length > 0) {
      const message = this.#queue.shift();

      try {
        await this.#processor(message);
      } catch (error) {
        console.error('Queue processing error:', error);
      }

      // Delay between messages
      if (this.#queue.length > 0) {
        await this.#sleep(this.#delay);
      }
    }

    this.#processing = false;
  }

  /**
   * Sleep utility
   * @private
   * @param {number} ms - Milliseconds
   * @returns {Promise<void>}
   */
  #sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets queue size
   * @returns {number} Size
   */
  getSize() {
    return this.#queue.length;
  }

  /**
   * Checks if processing
   * @returns {boolean} True if processing
   */
  isProcessing() {
    return this.#processing;
  }

  /**
   * Clears queue
   * @returns {void}
   */
  clear() {
    this.#queue = [];
  }

  /**
   * Gets queue statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const now = Date.now();
    const avgWaitTime = this.#queue.length > 0
      ? this.#queue.reduce((sum, msg) => sum + (now - msg.addedAt), 0) / this.#queue.length
      : 0;

    return {
      size: this.#queue.length,
      processing: this.#processing,
      averageWaitTimeMs: avgWaitTime.toFixed(0),
      oldestMessageAge: this.#queue.length > 0 
        ? now - this.#queue[0].addedAt 
        : 0
    };
  }
}

export default QueueService;
