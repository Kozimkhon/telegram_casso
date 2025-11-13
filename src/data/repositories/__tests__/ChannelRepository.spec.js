/**
 * @fileoverview Unit Tests for ChannelRepository
 * Tests channel data access and management operations
 */

import ChannelRepository from '../domain/ChannelRepository.js';

describe('ChannelRepository', () => {
  let repository;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn()
    };

    repository = new ChannelRepository(mockDatabase);
  });

  describe('Create Operations', () => {
    test('should create new channel', async () => {
      // Arrange
      const channelData = {
        channelId: 'channel_123',
        title: 'Test Channel'
      };

      mockDatabase.execute.mockResolvedValue({ id: 1, ...channelData });

      // Act
      const result = await repository.create(channelData);

      // Assert
      expect(result.channelId).toBe('channel_123');
    });

    test('should throw on duplicate channel', async () => {
      // Arrange
      mockDatabase.execute.mockRejectedValue(
        new Error('UNIQUE constraint failed')
      );

      // Act & Assert
      await expect(repository.create({ channelId: 'ch_1' }))
        .rejects.toThrow();
    });
  });

  describe('Read Operations', () => {
    test('should find channel by ID', async () => {
      // Arrange
      const mockChannel = {
        id: 1,
        channelId: 'channel_123',
        title: 'Test Channel'
      };

      mockDatabase.query.mockResolvedValue([mockChannel]);

      // Act
      const result = await repository.findById('channel_123');

      // Assert
      expect(result.channelId).toBe('channel_123');
    });

    test('should get all channels', async () => {
      // Arrange
      const mockChannels = [
        { channelId: 'ch_1', title: 'Channel 1' },
        { channelId: 'ch_2', title: 'Channel 2' }
      ];

      mockDatabase.query.mockResolvedValue(mockChannels);

      // Act
      const result = await repository.getAll();

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should find channels by admin', async () => {
      // Arrange
      const mockChannels = [
        { channelId: 'ch_1', adminId: 'admin_1' },
        { channelId: 'ch_2', adminId: 'admin_1' }
      ];

      mockDatabase.query.mockResolvedValue(mockChannels);

      // Act
      const result = await repository.findByAdminId('admin_1');

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every(ch => ch.adminId === 'admin_1')).toBe(true);
    });

    test('should get active channels', async () => {
      // Arrange
      const mockChannels = [
        { channelId: 'ch_1', isActive: true },
        { channelId: 'ch_2', isActive: true }
      ];

      mockDatabase.query.mockResolvedValue(mockChannels);

      // Act
      const result = await repository.getActive();

      // Assert
      expect(result.every(ch => ch.isActive)).toBe(true);
    });
  });

  describe('Update Operations', () => {
    test('should update channel', async () => {
      // Arrange
      const updates = { title: 'Updated Title' };

      mockDatabase.execute.mockResolvedValue({
        channelId: 'channel_123',
        ...updates
      });

      // Act
      const result = await repository.update('channel_123', updates);

      // Assert
      expect(result.title).toBe('Updated Title');
    });

    test('should update member count', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue({
        channelId: 'channel_123',
        memberCount: 150
      });

      // Act
      await repository.updateMemberCount('channel_123', 150);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should toggle channel active status', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue({
        channelId: 'channel_123',
        isActive: false
      });

      // Act
      await repository.toggleActive('channel_123');

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });
  });

  describe('Delete Operations', () => {
    test('should delete channel', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      const result = await repository.delete('channel_123');

      // Assert
      expect(result).toBe(true);
    });

    test('should delete channels by admin', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(2);

      // Act
      const result = await repository.deleteByAdminId('admin_123');

      // Assert
      expect(result).toBe(2);
    });
  });

  describe('Search Operations', () => {
    test('should search channels by title', async () => {
      // Arrange
      const mockChannels = [
        { channelId: 'ch_1', title: 'News Channel' },
        { channelId: 'ch_2', title: 'News Updates' }
      ];

      mockDatabase.query.mockResolvedValue(mockChannels);

      // Act
      const result = await repository.searchByTitle('News');

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });

    test('should search with pagination', async () => {
      // Arrange
      const mockChannels = [
        { channelId: 'ch_1' },
        { channelId: 'ch_2' }
      ];

      mockDatabase.query.mockResolvedValue(mockChannels);

      // Act
      const result = await repository.getAll({ limit: 2, offset: 0 });

      // Assert
      expect(result).toHaveLength(2);
    });
  });

  describe('Statistics', () => {
    test('should count all channels', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 50 }]);

      // Act
      const count = await repository.count();

      // Assert
      expect(count).toBe(50);
    });

    test('should count active channels', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 40 }]);

      // Act
      const count = await repository.countActive();

      // Assert
      expect(count).toBe(40);
    });

    test('should get channel statistics', async () => {
      // Arrange
      const mockStats = {
        totalChannels: 100,
        activeChannels: 80,
        totalMembers: 50000
      };

      mockDatabase.query.mockResolvedValue([mockStats]);

      // Act
      const stats = await repository.getStats();

      // Assert
      expect(stats.totalChannels).toBe(100);
    });
  });

  describe('Batch Operations', () => {
    test('should create multiple channels', async () => {
      // Arrange
      const channels = [
        { channelId: 'ch_1', title: 'Channel 1' },
        { channelId: 'ch_2', title: 'Channel 2' }
      ];

      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });
      mockDatabase.execute.mockResolvedValue({});

      // Act
      const result = await repository.createBatch(channels);

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should update multiple channels', async () => {
      // Arrange
      const updates = {
        'ch_1': { isActive: true },
        'ch_2': { isActive: false }
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

  describe('Relationship Management', () => {
    test('should link channel to admin', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      await repository.linkToAdmin('channel_123', 'admin_456');

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should unlink channel from admin', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      await repository.unlinkFromAdmin('channel_123');

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle unicode channel titles', async () => {
      // Arrange
      const mockChannel = {
        channelId: 'ch_1',
        title: 'Новостной канал'
      };

      mockDatabase.query.mockResolvedValue([mockChannel]);

      // Act
      const result = await repository.findById('ch_1');

      // Assert
      expect(result.title).toBe('Новостной канал');
    });

    test('should handle very large member counts', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue({
        channelId: 'ch_1',
        memberCount: 999999999
      });

      // Act
      await repository.updateMemberCount('ch_1', 999999999);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should handle channels with special characters', async () => {
      // Arrange
      const mockChannel = {
        channelId: 'ch_@special-123',
        title: 'Special #Channel & More'
      };

      mockDatabase.query.mockResolvedValue([mockChannel]);

      // Act
      const result = await repository.findById('ch_@special-123');

      // Assert
      expect(result.channelId).toBe('ch_@special-123');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      // Arrange
      mockDatabase.query.mockRejectedValue(
        new Error('Query failed')
      );

      // Act & Assert
      await expect(repository.getAll())
        .rejects.toThrow('Query failed');
    });
  });
});
