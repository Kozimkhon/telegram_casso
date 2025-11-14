/**
 * @fileoverview Unit Tests for Channel Domain Entity
 * Tests channel configuration and management
 */

import Channel from '../domain/Channel.entity.js';

describe('Channel.entity', () => {
  
  const validChannelData = {
    channelId: 'test_channel_123',
    title: 'Test Channel',
    username: '@test_channel',
    membersCount: 100,
    description: 'A test channel'
  };

  describe('Constructor & Initialization', () => {
    test('should create channel with valid data', () => {
      // Act
      const channel = new Channel(validChannelData);

      // Assert
      expect(channel).toBeDefined();
      expect(channel.channelId).toBe('test_channel_123');
      expect(channel.title).toBe('Test Channel');
    });

    test('should throw error when channelId is missing', () => {
      // Arrange
      const invalidData = { ...validChannelData };
      delete invalidData.channelId;

      // Act & Assert
      expect(() => new Channel(invalidData)).toThrow();
    });

    test('should throw error when title is missing', () => {
      // Arrange
      const invalidData = { ...validChannelData };
      delete invalidData.title;

      // Act & Assert
      expect(() => new Channel(invalidData)).toThrow();
    });

    test('should set membersCount to 0 by default', () => {
      // Arrange
      const data = { ...validChannelData };
      delete data.membersCount;

      // Act
      const channel = new Channel(data);

      // Assert
      expect(channel.membersCount).toBe(0);
    });
  });

  describe('Channel Properties', () => {
    test('should store all channel data', () => {
      // Act
      const channel = new Channel(validChannelData);

      // Assert
      expect(channel.channelId).toBe('test_channel_123');
      expect(channel.title).toBe('Test Channel');
      expect(channel.username).toBe('@test_channel');
      expect(channel.membersCount).toBe(100);
    });

    test('should allow null optional fields', () => {
      // Arrange
      const data = {
        ...validChannelData,
        username: null,
        description: null
      };

      // Act
      const channel = new Channel(data);

      // Assert
      expect(channel.username).toBeNull();
      expect(channel.description).toBeNull();
    });

    test('should handle unicode in title', () => {
      // Arrange
      const data = {
        ...validChannelData,
        title: 'Канали тест'
      };

      // Act
      const channel = new Channel(data);

      // Assert
      expect(channel.title).toBe('Канали тест');
    });
  });

  describe('Validation', () => {
    test('should validate required fields', () => {
      // Arrange
      const invalidData = { title: 'Test' };

      // Act & Assert
      expect(() => new Channel(invalidData)).toThrow();
    });

    test('should validate membersCount is number', () => {
      // Arrange
      const data = {
        ...validChannelData,
        membersCount: 'invalid'
      };

      // Act & Assert
      expect(() => new Channel(data)).toThrow();
    });

    test('should accept zero members', () => {
      // Arrange
      const data = {
        ...validChannelData,
        membersCount: 0
      };

      // Act
      const channel = new Channel(data);

      // Assert
      expect(channel.membersCount).toBe(0);
    });
  });

  describe('Database Conversion', () => {
    test('should convert to database row', () => {
      // Arrange
      const channel = new Channel(validChannelData);

      // Act
      const dbRow = channel.toDatabaseRow();

      // Assert
      expect(dbRow).toBeDefined();
      expect(dbRow.channelId).toBe('test_channel_123');
    });

    test('should convert from database row', () => {
      // Arrange
      const dbRow = {
        channelId: 'test_channel_123',
        title: 'Test Channel',
        username: '@test_channel',
        membersCount: 100,
        description: 'A test channel',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Act
      const channel = Channel.fromDatabaseRow(dbRow);

      // Assert
      expect(channel.channelId).toBe('test_channel_123');
      expect(channel.title).toBe('Test Channel');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long title', () => {
      // Arrange
      const data = {
        ...validChannelData,
        title: 'A'.repeat(255)
      };

      // Act
      const channel = new Channel(data);

      // Assert
      expect(channel.title.length).toBe(255);
    });

    test('should handle very large member count', () => {
      // Arrange
      const data = {
        ...validChannelData,
        membersCount: 1000000
      };

      // Act
      const channel = new Channel(data);

      // Assert
      expect(channel.membersCount).toBe(1000000);
    });

    test('should handle special characters in channel ID', () => {
      // Arrange
      const data = {
        ...validChannelData,
        channelId: 'test-channel_123'
      };

      // Act
      const channel = new Channel(data);

      // Assert
      expect(channel.channelId).toBe('test-channel_123');
    });
  });
});
