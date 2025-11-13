/**
 * @fileoverview Unit Tests for Message Domain Entity
 * Tests message tracking and state management
 */

import Message from '../domain/Message.entity.js';

describe('Message.entity', () => {
  
  const validMessageData = {
    messageId: 123456,
    userId: '987654321',
    forwardedMessageId: 789012,
    text: 'Test message content',
    status: 'SUCCESS'
  };

  describe('Constructor & Initialization', () => {
    test('should create message with valid data', () => {
      // Act
      const message = new Message(validMessageData);

      // Assert
      expect(message).toBeDefined();
      expect(message.messageId).toBe(123456);
      expect(message.userId).toBe('987654321');
    });

    test('should throw error when messageId is missing', () => {
      // Arrange
      const invalidData = { ...validMessageData };
      delete invalidData.messageId;

      // Act & Assert
      expect(() => new Message(invalidData)).toThrow();
    });

    test('should throw error when userId is missing', () => {
      // Arrange
      const invalidData = { ...validMessageData };
      delete invalidData.userId;

      // Act & Assert
      expect(() => new Message(invalidData)).toThrow();
    });

    test('should set status to PENDING by default', () => {
      // Arrange
      const data = { ...validMessageData };
      delete data.status;

      // Act
      const message = new Message(data);

      // Assert
      expect(message.status).toBe('PENDING');
    });
  });

  describe('Message Properties', () => {
    test('should store all message data', () => {
      // Act
      const message = new Message(validMessageData);

      // Assert
      expect(message.messageId).toBe(123456);
      expect(message.userId).toBe('987654321');
      expect(message.forwardedMessageId).toBe(789012);
      expect(message.text).toBe('Test message content');
      expect(message.status).toBe('SUCCESS');
    });

    test('should allow null optional fields', () => {
      // Arrange
      const data = {
        ...validMessageData,
        text: null,
        forwardedMessageId: null
      };

      // Act
      const message = new Message(data);

      // Assert
      expect(message.text).toBeNull();
      expect(message.forwardedMessageId).toBeNull();
    });

    test('should handle unicode in text', () => {
      // Arrange
      const data = {
        ...validMessageData,
        text: 'Салом дунё! 🌍'
      };

      // Act
      const message = new Message(data);

      // Assert
      expect(message.text).toBe('Салом дунё! 🌍');
    });
  });

  describe('Status Management', () => {
    test('should accept valid status values', () => {
      // Arrange
      const validStatuses = ['SUCCESS', 'FAILED', 'PENDING', 'PROCESSING'];

      // Act & Assert
      validStatuses.forEach(status => {
        const message = new Message({ ...validMessageData, status });
        expect(message.status).toBe(status);
      });
    });

    test('should reject invalid status', () => {
      // Arrange
      const data = {
        ...validMessageData,
        status: 'INVALID_STATUS'
      };

      // Act & Assert
      expect(() => new Message(data)).toThrow();
    });

    test('should be able to update status', () => {
      // Arrange
      const message = new Message(validMessageData);

      // Act
      message.updateStatus('FAILED');

      // Assert
      expect(message.status).toBe('FAILED');
    });
  });

  describe('Grouped Messages', () => {
    test('should mark message as grouped', () => {
      // Arrange
      const message = new Message(validMessageData);

      // Act
      message.markAsGrouped('group_123');

      // Assert
      expect(message.isGrouped).toBe(true);
      expect(message.groupedId).toBe('group_123');
    });

    test('should handle message without grouping', () => {
      // Arrange
      const message = new Message(validMessageData);

      // Act
      const isGrouped = message.isGrouped;

      // Assert
      expect(isGrouped).toBe(false);
    });
  });

  describe('Validation', () => {
    test('should validate required fields', () => {
      // Arrange
      const invalidData = { text: 'Test' };

      // Act & Assert
      expect(() => new Message(invalidData)).toThrow();
    });

    test('should validate messageId is number', () => {
      // Arrange
      const data = {
        ...validMessageData,
        messageId: 'invalid'
      };

      // Act & Assert
      expect(() => new Message(data)).toThrow();
    });

    test('should validate userId is string', () => {
      // Arrange
      const data = {
        ...validMessageData,
        userId: 123456
      };

      // Act & Assert
      expect(() => new Message(data)).toThrow();
    });
  });

  describe('Database Conversion', () => {
    test('should convert to database row', () => {
      // Arrange
      const message = new Message(validMessageData);

      // Act
      const dbRow = message.toDatabaseRow();

      // Assert
      expect(dbRow).toBeDefined();
      expect(dbRow.messageId).toBe(123456);
      expect(dbRow.userId).toBe('987654321');
    });

    test('should convert from database row', () => {
      // Arrange
      const dbRow = {
        messageId: 123456,
        userId: '987654321',
        forwardedMessageId: 789012,
        text: 'Test message',
        status: 'SUCCESS',
        isGrouped: false,
        groupedId: null,
        created_at: new Date()
      };

      // Act
      const message = Message.fromDatabaseRow(dbRow);

      // Assert
      expect(message.messageId).toBe(123456);
      expect(message.text).toBe('Test message');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long text', () => {
      // Arrange
      const data = {
        ...validMessageData,
        text: 'A'.repeat(4096)
      };

      // Act
      const message = new Message(data);

      // Assert
      expect(message.text.length).toBe(4096);
    });

    test('should handle empty text', () => {
      // Arrange
      const data = {
        ...validMessageData,
        text: ''
      };

      // Act
      const message = new Message(data);

      // Assert
      expect(message.text).toBe('');
    });

    test('should handle special characters in text', () => {
      // Arrange
      const data = {
        ...validMessageData,
        text: '<b>Bold</b> <i>italic</i> @mention #hashtag'
      };

      // Act
      const message = new Message(data);

      // Assert
      expect(message.text).toBe('<b>Bold</b> <i>italic</i> @mention #hashtag');
    });
  });
});
