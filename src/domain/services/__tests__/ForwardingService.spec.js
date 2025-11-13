/**
 * @fileoverview Unit Tests for ForwardingService
 * Tests message forwarding orchestration, rate limiting, and error handling
 * @module domain/services/__tests__/ForwardingService.spec
 */

import ForwardingService from '../ForwardingService.js';
import { ForwardingStatus } from '../../../shared/constants/index.js';
import Message from '../../../core/entities/domain/Message.entity.js';

describe('ForwardingService', () => {
  
  // ==================== MOCKS & SETUP ====================
  
  let forwardingService;
  let mockUserRepository;
  let mockMessageRepository;
  let mockThrottleService;
  let mockStateManager;
  let mockLogger;

  beforeEach(() => {
    // Mock repositories
    mockUserRepository = {
      findByChannel: jest.fn().mockResolvedValue([
        { userId: 'user1', firstName: 'User', lastName: '1' },
        { userId: 'user2', firstName: 'User', lastName: '2' },
        { userId: 'user3', firstName: 'User', lastName: '3' }
      ]),
      findById: jest.fn().mockResolvedValue({ userId: 'user1' })
    };

    mockMessageRepository = {
      create: jest.fn().mockResolvedValue({ id: 1, status: ForwardingStatus.SUCCESS }),
      findOldMessages: jest.fn().mockResolvedValue({ messages: [] }),
      findByForwardedMessageId: jest.fn().mockResolvedValue(null)
    };

    mockThrottleService = {
      waitForThrottle: jest.fn().mockResolvedValue(undefined),
      getGlobalStatus: jest.fn().mockReturnValue({ tokensAvailable: 100 })
    };

    mockStateManager = {
      getBot: jest.fn().mockReturnValue(null)
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create service instance
    forwardingService = new ForwardingService({
      userRepository: mockUserRepository,
      messageRepository: mockMessageRepository,
      throttleService: mockThrottleService,
      stateManager: mockStateManager,
      logger: mockLogger
    });
  });

  // ==================== INITIALIZATION ====================

  describe('Initialization', () => {
    test('should initialize with dependencies', () => {
      // Assert
      expect(forwardingService).toBeDefined();
      expect(forwardingService.forwardToChannelUsers).toBeDefined();
      expect(forwardingService.deleteForwardedMessages).toBeDefined();
    });

    test('should use provided logger', () => {
      // Arrange
      const service = new ForwardingService({
        userRepository: mockUserRepository,
        messageRepository: mockMessageRepository,
        throttleService: mockThrottleService,
        logger: mockLogger
      });

      // Assert
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    test('should use default logger if not provided', () => {
      // Arrange & Act
      const service = new ForwardingService({
        userRepository: mockUserRepository,
        messageRepository: mockMessageRepository,
        throttleService: mockThrottleService
      });

      // Assert
      expect(service).toBeDefined();
    });
  });

  // ==================== FORWARD TO CHANNEL USERS ====================

  describe('Forward to Channel Users', () => {
    test('should forward message to all channel users', async () => {
      // Arrange
      const message = { id: 123, text: 'Test message' };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(forwarder).toHaveBeenCalledTimes(3);
    });

    test('should wait for throttle before forwarding', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(mockThrottleService.waitForThrottle).toHaveBeenCalledTimes(3);
      expect(mockThrottleService.waitForThrottle).toHaveBeenCalledWith('user1');
      expect(mockThrottleService.waitForThrottle).toHaveBeenCalledWith('user2');
      expect(mockThrottleService.waitForThrottle).toHaveBeenCalledWith('user3');
    });

    test('should handle forwarding errors gracefully', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn()
        .mockResolvedValueOnce({ id: 456 })
        .mockRejectedValueOnce(new Error('Forward failed'))
        .mockResolvedValueOnce({ id: 457 });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
    });

    test('should return empty result when no users in channel', async () => {
      // Arrange
      mockUserRepository.findByChannel.mockResolvedValueOnce([]);
      const message = { id: 123 };
      const forwarder = jest.fn();

      // Act
      const result = await forwardingService.forwardToChannelUsers('empty_channel', message, forwarder);

      // Assert
      expect(result.total).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.results).toHaveLength(0);
      expect(forwarder).not.toHaveBeenCalled();
    });

    test('should save single messages with correct status', async () => {
      // Arrange
      const message = { id: 123, peerId: { channelId: 100 } };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(mockMessageRepository.create).toHaveBeenCalledTimes(3);
      mockMessageRepository.create.mock.calls.forEach(call => {
        const messageEntity = call[0];
        expect(messageEntity.status).toBe(ForwardingStatus.SUCCESS);
      });
    });

    test('should save grouped messages with groupedId', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({
        id: 456,
        count: 2,
        groupedId: 'group1',
        result: [
          { id: 456, fwdFrom: { channelPost: '123' } },
          { id: 457, fwdFrom: { channelPost: '123' } }
        ]
      });

      // Act
      await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      mockMessageRepository.create.mock.calls.forEach(call => {
        const messageEntity = call[0];
        expect(messageEntity.isGrouped).toBe(true);
      });
    });
  });

  // ==================== DELETE FORWARDED MESSAGES ====================

  describe('Delete Forwarded Messages', () => {
    test('should delete forwarded messages for user', async () => {
      // Arrange
      const messageIds = [456, 457, 458];
      const userId = 'user1';
      const deleter = jest.fn().mockResolvedValue(true);

      // Act
      const result = await forwardingService.deleteForwardedMessages(userId, messageIds, deleter);

      // Assert
      expect(deleter).toHaveBeenCalledWith(userId, messageIds);
      expect(result.deleted).toBe(3);
    });

    test('should handle delete errors', async () => {
      // Arrange
      const messageIds = [456, 457];
      const userId = 'user1';
      const deleter = jest.fn().mockRejectedValue(new Error('Delete failed'));

      // Act
      const result = await forwardingService.deleteForwardedMessages(userId, messageIds, deleter);

      // Assert
      expect(result.failed).toBeGreaterThan(0);
    });

    test('should return empty result for empty message list', async () => {
      // Arrange
      const messageIds = [];
      const userId = 'user1';
      const deleter = jest.fn();

      // Act
      const result = await forwardingService.deleteForwardedMessages(userId, messageIds, deleter);

      // Assert
      expect(deleter).not.toHaveBeenCalled();
      expect(result.deleted).toBe(0);
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    test('should handle flood wait error', async () => {
      // Arrange
      const error = new Error('Flood wait');
      error.isFloodWait = true;
      error.adminId = 'admin1';
      error.seconds = 30;

      // Act & Assert
      expect(() => {
        forwardingService.handleFloodWait('admin1', 30);
      }).not.toThrow();
    });

    test('should handle repository errors', async () => {
      // Arrange
      mockUserRepository.findByChannel.mockRejectedValue(new Error('DB error'));
      const message = { id: 123 };
      const forwarder = jest.fn();

      // Act & Assert
      await expect(
        forwardingService.forwardToChannelUsers('channel1', message, forwarder)
      ).rejects.toThrow();
    });

    test('should continue forwarding if single user fails', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn()
        .mockResolvedValueOnce({ id: 456 })
        .mockRejectedValueOnce(new Error('User 2 failed'))
        .mockResolvedValueOnce({ id: 458 });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  // ==================== GROUPED MESSAGE HANDLING ====================

  describe('Grouped Message Handling', () => {
    test('should handle grouped messages', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({
        count: 3,
        groupedId: 'group1',
        result: [
          { id: 456, fwdFrom: { channelPost: '123' } },
          { id: 457, fwdFrom: { channelPost: '123' } },
          { id: 458, fwdFrom: { channelPost: '123' } }
        ]
      });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.successful).toBeGreaterThan(0);
      mockMessageRepository.create.mock.calls.forEach(call => {
        const messageEntity = call[0];
        if (call[0].isGrouped) {
          expect(messageEntity.groupedId).toBeDefined();
        }
      });
    });

    test('should save all messages in group', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({
        count: 2,
        groupedId: 'group1',
        result: [
          { id: 456, fwdFrom: { channelPost: '123' } },
          { id: 457, fwdFrom: { channelPost: '123' } }
        ]
      });

      // Act
      await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      // Should create 2 messages per user (for grouped) + base entries
      expect(mockMessageRepository.create).toHaveBeenCalled();
    });
  });

  // ==================== RESULT TRACKING ====================

  describe('Result Tracking', () => {
    test('should return detailed results for each user', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.results).toHaveLength(3);
      result.results.forEach(userResult => {
        expect(userResult).toHaveProperty('userId');
        expect(userResult).toHaveProperty('status');
      });
    });

    test('should track success and failure counts correctly', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn()
        .mockResolvedValueOnce({ id: 456 })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ id: 457 });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.total).toBe(3);
      expect(result.successful + result.failed).toBe(3);
    });

    test('should include error messages in failed results', async () => {
      // Arrange
      const message = { id: 123 };
      const errorMessage = 'Custom error';
      const forwarder = jest.fn()
        .mockResolvedValueOnce({ id: 456 })
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockResolvedValueOnce({ id: 457 });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      const failedResult = result.results.find(r => r.status === ForwardingStatus.FAILED);
      expect(failedResult).toBeDefined();
      expect(failedResult.error).toBe(errorMessage);
    });
  });

  // ==================== LOGGING ====================

  describe('Logging', () => {
    test('should log batch forwarding start', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('batch forwarding'),
        expect.anything()
      );
    });

    test('should log throttle wait', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('throttle'),
        expect.anything()
      );
    });

    test('should log forwarding errors', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockRejectedValue(new Error('Test error'));

      // Act
      await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle empty channel ID', async () => {
      // Arrange
      mockUserRepository.findByChannel.mockResolvedValueOnce([]);
      const message = { id: 123 };
      const forwarder = jest.fn();

      // Act
      const result = await forwardingService.forwardToChannelUsers('', message, forwarder);

      // Assert
      expect(result.total).toBe(0);
    });

    test('should handle very large number of users', async () => {
      // Arrange
      const largeUserList = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user${i}`,
        firstName: 'User',
        lastName: String(i)
      }));
      mockUserRepository.findByChannel.mockResolvedValueOnce(largeUserList);
      
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.total).toBe(1000);
      expect(forwarder).toHaveBeenCalledTimes(1000);
    });

    test('should handle message with null forwardedId', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({ id: null });

      // Act
      const result = await forwardingService.forwardToChannelUsers('channel1', message, forwarder);

      // Assert
      expect(result.successful).toBeGreaterThan(0);
    });

    test('should handle concurrent forwarding', async () => {
      // Arrange
      const message = { id: 123 };
      const forwarder = jest.fn().mockResolvedValue({ id: 456 });

      // Act
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          forwardingService.forwardToChannelUsers(`channel${i}`, message, forwarder)
        );
      }

      // Assert
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.results).toBeDefined();
      });
    });
  });
});
