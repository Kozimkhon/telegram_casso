/**
 * @fileoverview Unit Tests for QueueService
 * Tests message queue management and processing
 */

import QueueService from '../QueueService.js';

describe('QueueService', () => {
  let queueService;

  beforeEach(() => {
    queueService = new QueueService();
  });

  describe('Initialization', () => {
    test('should initialize with empty queue', () => {
      // Assert
      expect(queueService).toBeDefined();
      expect(queueService.getSize()).toBe(0);
    });

    test('should initialize with FIFO order', () => {
      // Assert
      expect(queueService.getOrder()).toBe('FIFO');
    });

    test('should initialize with max size limit', () => {
      // Assert
      expect(queueService.maxSize).toBeDefined();
      expect(queueService.maxSize).toBeGreaterThan(0);
    });
  });

  describe('Enqueue Operations', () => {
    test('should add item to queue', () => {
      // Arrange
      const item = { id: 1, message: 'test' };

      // Act
      queueService.enqueue(item);

      // Assert
      expect(queueService.getSize()).toBe(1);
    });

    test('should add multiple items in order', () => {
      // Act
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });
      queueService.enqueue({ id: 3 });

      // Assert
      expect(queueService.getSize()).toBe(3);
    });

    test('should maintain FIFO order', () => {
      // Act
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });
      queueService.enqueue({ id: 3 });

      // Assert
      expect(queueService.peek().id).toBe(1);
    });

    test('should reject item when queue is full', () => {
      // Arrange
      const maxSize = queueService.maxSize;
      for (let i = 0; i < maxSize; i++) {
        queueService.enqueue({ id: i });
      }

      // Act & Assert
      expect(() => {
        queueService.enqueue({ id: 'overflow' });
      }).toThrow();
    });

    test('should throw error when enqueuing null', () => {
      // Act & Assert
      expect(() => queueService.enqueue(null)).toThrow();
    });
  });

  describe('Dequeue Operations', () => {
    test('should remove and return first item', () => {
      // Arrange
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });

      // Act
      const item = queueService.dequeue();

      // Assert
      expect(item.id).toBe(1);
      expect(queueService.getSize()).toBe(1);
    });

    test('should dequeue in FIFO order', () => {
      // Arrange
      queueService.enqueue({ order: 'first' });
      queueService.enqueue({ order: 'second' });
      queueService.enqueue({ order: 'third' });

      // Act & Assert
      expect(queueService.dequeue().order).toBe('first');
      expect(queueService.dequeue().order).toBe('second');
      expect(queueService.dequeue().order).toBe('third');
    });

    test('should throw error when dequeuing empty queue', () => {
      // Act & Assert
      expect(() => queueService.dequeue()).toThrow();
    });

    test('should handle dequeue until empty', () => {
      // Arrange
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });

      // Act
      queueService.dequeue();
      queueService.dequeue();

      // Assert
      expect(queueService.getSize()).toBe(0);
      expect(() => queueService.dequeue()).toThrow();
    });
  });

  describe('Peek Operations', () => {
    test('should return first item without removing', () => {
      // Arrange
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });

      // Act
      const item = queueService.peek();

      // Assert
      expect(item.id).toBe(1);
      expect(queueService.getSize()).toBe(2);
    });

    test('should throw error when peeking empty queue', () => {
      // Act & Assert
      expect(() => queueService.peek()).toThrow();
    });

    test('should return same item on multiple peeks', () => {
      // Arrange
      queueService.enqueue({ id: 1 });

      // Act & Assert
      expect(queueService.peek().id).toBe(1);
      expect(queueService.peek().id).toBe(1);
    });
  });

  describe('Priority Queue', () => {
    test('should support priority items', () => {
      // Arrange
      queueService.enqueue({ id: 1, priority: 2 });
      queueService.enqueue({ id: 2, priority: 1 }); // Higher priority
      queueService.enqueue({ id: 3, priority: 3 });

      // Act
      const first = queueService.dequeue();

      // Assert
      expect(first.id).toBe(2); // Higher priority item first
    });

    test('should handle same priority in FIFO order', () => {
      // Arrange
      queueService.enqueue({ id: 1, priority: 1 });
      queueService.enqueue({ id: 2, priority: 1 });
      queueService.enqueue({ id: 3, priority: 1 });

      // Act & Assert
      expect(queueService.dequeue().id).toBe(1);
      expect(queueService.dequeue().id).toBe(2);
      expect(queueService.dequeue().id).toBe(3);
    });
  });

  describe('Queue Statistics', () => {
    test('should return queue size', () => {
      // Act
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });

      // Assert
      expect(queueService.getSize()).toBe(2);
    });

    test('should report if queue is empty', () => {
      // Assert
      expect(queueService.isEmpty()).toBe(true);

      // Arrange
      queueService.enqueue({ id: 1 });

      // Assert
      expect(queueService.isEmpty()).toBe(false);
    });

    test('should report if queue is full', () => {
      // Arrange
      const maxSize = queueService.maxSize;
      for (let i = 0; i < maxSize; i++) {
        queueService.enqueue({ id: i });
      }

      // Assert
      expect(queueService.isFull()).toBe(true);
    });

    test('should get queue statistics', () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        queueService.enqueue({ id: i });
      }

      // Act
      const stats = queueService.getStats();

      // Assert
      expect(stats.size).toBe(5);
      expect(stats.maxSize).toBe(queueService.maxSize);
      expect(stats.utilization).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    test('should enqueue batch of items', () => {
      // Arrange
      const items = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];

      // Act
      queueService.enqueueBatch(items);

      // Assert
      expect(queueService.getSize()).toBe(3);
    });

    test('should dequeueBatch multiple items', () => {
      // Arrange
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });
      queueService.enqueue({ id: 3 });

      // Act
      const items = queueService.dequeueBatch(2);

      // Assert
      expect(items.length).toBe(2);
      expect(items[0].id).toBe(1);
      expect(items[1].id).toBe(2);
      expect(queueService.getSize()).toBe(1);
    });

    test('should handle dequeueBatch with insufficient items', () => {
      // Arrange
      queueService.enqueue({ id: 1 });

      // Act
      const items = queueService.dequeueBatch(5);

      // Assert
      expect(items.length).toBe(1);
    });
  });

  describe('Clear Operations', () => {
    test('should clear entire queue', () => {
      // Arrange
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });
      queueService.enqueue({ id: 3 });

      // Act
      queueService.clear();

      // Assert
      expect(queueService.getSize()).toBe(0);
    });

    test('should be able to reuse after clear', () => {
      // Arrange
      queueService.enqueue({ id: 1 });
      queueService.clear();

      // Act
      queueService.enqueue({ id: 2 });

      // Assert
      expect(queueService.getSize()).toBe(1);
      expect(queueService.peek().id).toBe(2);
    });
  });

  describe('Timeout Handling', () => {
    test('should remove expired items', () => {
      // Arrange
      const pastTime = Date.now() - 60000; // 1 minute ago
      queueService.enqueue({ id: 1, expiry: pastTime });
      queueService.enqueue({ id: 2, expiry: Date.now() + 60000 });

      // Act
      queueService.removeExpired();

      // Assert
      expect(queueService.getSize()).toBe(1);
      expect(queueService.peek().id).toBe(2);
    });

    test('should handle TTL for items', () => {
      // Act
      queueService.enqueue({ id: 1 }, 60000); // 60 second TTL

      // Assert
      expect(queueService.hasValidItem(0)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle large queue', () => {
      // Act
      for (let i = 0; i < 1000; i++) {
        if (!queueService.isFull()) {
          queueService.enqueue({ id: i });
        }
      }

      // Assert
      expect(queueService.getSize()).toBeGreaterThan(0);
    });

    test('should handle rapid enqueue/dequeue', () => {
      // Act
      for (let i = 0; i < 100; i++) {
        queueService.enqueue({ id: i });
        if (i % 2 === 0) {
          queueService.dequeue();
        }
      }

      // Assert
      expect(queueService.getSize()).toBeGreaterThan(0);
    });

    test('should handle complex item objects', () => {
      // Arrange
      const complexItem = {
        id: 1,
        data: {
          nested: {
            deep: 'value'
          }
        },
        array: [1, 2, 3]
      };

      // Act
      queueService.enqueue(complexItem);

      // Assert
      expect(queueService.peek()).toEqual(complexItem);
    });
  });

  describe('Integration', () => {
    test('should work as message queue', () => {
      // Act
      queueService.enqueue({ type: 'MESSAGE', text: 'Hello' });
      queueService.enqueue({ type: 'MESSAGE', text: 'World' });

      // Assert
      const msg1 = queueService.dequeue();
      const msg2 = queueService.dequeue();
      expect(msg1.text).toBe('Hello');
      expect(msg2.text).toBe('World');
    });

    test('should handle mixed operations', () => {
      // Act
      queueService.enqueue({ id: 1 });
      queueService.enqueue({ id: 2 });
      expect(queueService.peek().id).toBe(1);
      queueService.dequeue();
      queueService.enqueue({ id: 3 });
      const result = queueService.dequeue();

      // Assert
      expect(result.id).toBe(2);
      expect(queueService.peek().id).toBe(3);
    });
  });
});
