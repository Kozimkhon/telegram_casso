/**
 * @fileoverview Unit Tests for MessageRepository
 * Tests message data access and tracking operations
 */

import MessageRepository from '../domain/MessageRepository.js';

describe('MessageRepository', () => {
  let repository;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn()
    };

    repository = new MessageRepository(mockDatabase);
  });

  describe('Create Operations', () => {
    test('should create new message record', async () => {
      // Arrange
      const messageData = {
        messageId: 123456,
        userId: 'user_123',
        text: 'Test message',
        status: 'SUCCESS'
      };

      mockDatabase.execute.mockResolvedValue({ id: 1, ...messageData });

      // Act
      const result = await repository.create(messageData);

      // Assert
      expect(result.messageId).toBe(123456);
    });
  });

  describe('Read Operations', () => {
    test('should find message by ID', async () => {
      // Arrange
      const mockMessage = {
        id: 1,
        messageId: 123456,
        userId: 'user_123'
      };

      mockDatabase.query.mockResolvedValue([mockMessage]);

      // Act
      const result = await repository.findById(123456);

      // Assert
      expect(result.messageId).toBe(123456);
    });

    test('should get messages by user', async () => {
      // Arrange
      const mockMessages = [
        { messageId: 111, userId: 'user_1' },
        { messageId: 222, userId: 'user_1' }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.findByUserId('user_1');

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should get messages by channel', async () => {
      // Arrange
      const mockMessages = [
        { messageId: 111, channelId: 'ch_1' },
        { messageId: 222, channelId: 'ch_1' }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.findByChannelId('ch_1');

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should get messages by status', async () => {
      // Arrange
      const mockMessages = [
        { messageId: 111, status: 'SUCCESS' },
        { messageId: 222, status: 'SUCCESS' }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.findByStatus('SUCCESS');

      // Assert
      expect(result.every(m => m.status === 'SUCCESS')).toBe(true);
    });
  });

  describe('Update Operations', () => {
    test('should update message status', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue({
        messageId: 123456,
        status: 'FAILED'
      });

      // Act
      await repository.updateStatus(123456, 'FAILED');

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should update message details', async () => {
      // Arrange
      const updates = { text: 'Updated text' };

      mockDatabase.execute.mockResolvedValue({
        messageId: 123456,
        ...updates
      });

      // Act
      await repository.update(123456, updates);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });
  });

  describe('Delete Operations', () => {
    test('should delete message', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      const result = await repository.delete(123456);

      // Assert
      expect(result).toBe(true);
    });

    test('should delete messages by user', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(10);

      // Act
      const result = await repository.deleteByUserId('user_123');

      // Assert
      expect(result).toBe(10);
    });
  });

  describe('Search Operations', () => {
    test('should search messages by text', async () => {
      // Arrange
      const mockMessages = [
        { messageId: 111, text: 'Hello world' },
        { messageId: 222, text: 'Hello everyone' }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.searchByText('Hello');

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });

    test('should search with date range', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockMessages = [
        { messageId: 111, createdAt: new Date('2024-01-15') }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.searchByDateRange(startDate, endDate);

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    test('should count messages by status', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([
        { status: 'SUCCESS', count: 950 },
        { status: 'FAILED', count: 50 }
      ]);

      // Act
      const stats = await repository.getStatusStats();

      // Assert
      expect(stats.SUCCESS).toBe(950);
      expect(stats.FAILED).toBe(50);
    });

    test('should get forwarded messages count', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 500 }]);

      // Act
      const count = await repository.countForwarded();

      // Assert
      expect(count).toBe(500);
    });

    test('should get failed messages count', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 25 }]);

      // Act
      const count = await repository.countFailed();

      // Assert
      expect(count).toBe(25);
    });

    test('should calculate success rate', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([
        { total: 1000 },
        { failed: 50 }
      ]);

      // Act
      const rate = await repository.getSuccessRate();

      // Assert
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });
  });

  describe('Pagination', () => {
    test('should get paginated results', async () => {
      // Arrange
      const mockMessages = [
        { messageId: 111 },
        { messageId: 222 }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.getPaginated({ limit: 2, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(2);
    });

    test('should calculate pagination metadata', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 100 }]);

      // Act
      const result = await repository.getPaginated({
        limit: 10,
        offset: 0
      });

      // Assert
      expect(result.total).toBeDefined();
      expect(result.pages).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    test('should create multiple messages', async () => {
      // Arrange
      const messages = [
        { messageId: 111, text: 'Message 1' },
        { messageId: 222, text: 'Message 2' }
      ];

      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });
      mockDatabase.execute.mockResolvedValue({});

      // Act
      const result = await repository.createBatch(messages);

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should update multiple messages', async () => {
      // Arrange
      const updates = {
        111: { status: 'FAILED' },
        222: { status: 'SUCCESS' }
      };

      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });
      mockDatabase.execute.mockResolvedValue({});

      // Act
      await repository.updateBatch(updates);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });
  });

  describe('Grouped Messages', () => {
    test('should find grouped messages', async () => {
      // Arrange
      const mockMessages = [
        { messageId: 111, groupId: 'group_1' },
        { messageId: 222, groupId: 'group_1' }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.findByGroupId('group_1');

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should get ungrouped messages', async () => {
      // Arrange
      const mockMessages = [
        { messageId: 111, groupId: null }
      ];

      mockDatabase.query.mockResolvedValue(mockMessages);

      // Act
      const result = await repository.getUngrouped();

      // Assert
      expect(result.every(m => !m.groupId)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle unicode in message text', async () => {
      // Arrange
      const mockMessage = {
        messageId: 123456,
        text: 'Привет мир! 🌍'
      };

      mockDatabase.query.mockResolvedValue([mockMessage]);

      // Act
      const result = await repository.findById(123456);

      // Assert
      expect(result.text).toBe('Привет мир! 🌍');
    });

    test('should handle very long messages', async () => {
      // Arrange
      const longText = 'A'.repeat(4096);
      const mockMessage = {
        messageId: 123456,
        text: longText
      };

      mockDatabase.query.mockResolvedValue([mockMessage]);

      // Act
      const result = await repository.findById(123456);

      // Assert
      expect(result.text.length).toBe(4096);
    });

    test('should handle empty message text', async () => {
      // Arrange
      const mockMessage = {
        messageId: 123456,
        text: ''
      };

      mockDatabase.query.mockResolvedValue([mockMessage]);

      // Act
      const result = await repository.findById(123456);

      // Assert
      expect(result.text).toBe('');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      // Arrange
      mockDatabase.query.mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(repository.getStatusStats())
        .rejects.toThrow('Database error');
    });
  });
});
