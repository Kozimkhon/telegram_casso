/**
 * @fileoverview Unit Tests for SessionRepository
 * Tests session data access and lifecycle management
 */

import SessionRepository from '../SessionRepository.js';

describe('SessionRepository', () => {
  let repository;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn()
    };

    repository = new SessionRepository(mockDatabase);
  });

  describe('Create Operations', () => {
    test('should create new session', async () => {
      // Arrange
      const sessionData = {
        sessionId: 'session_123',
        adminId: 'admin_456',
        status: 'ACTIVE'
      };

      mockDatabase.execute.mockResolvedValue({ id: 1, ...sessionData });

      // Act
      const result = await repository.create(sessionData);

      // Assert
      expect(result.sessionId).toBe('session_123');
    });
  });

  describe('Read Operations', () => {
    test('should find session by ID', async () => {
      // Arrange
      const mockSession = {
        id: 1,
        sessionId: 'session_123',
        adminId: 'admin_456'
      };

      mockDatabase.query.mockResolvedValue([mockSession]);

      // Act
      const result = await repository.findById('session_123');

      // Assert
      expect(result.sessionId).toBe('session_123');
    });

    test('should get sessions by admin', async () => {
      // Arrange
      const mockSessions = [
        { sessionId: 'sess_1', adminId: 'admin_1' },
        { sessionId: 'sess_2', adminId: 'admin_1' }
      ];

      mockDatabase.query.mockResolvedValue(mockSessions);

      // Act
      const result = await repository.findByAdminId('admin_1');

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every(s => s.adminId === 'admin_1')).toBe(true);
    });

    test('should get active sessions', async () => {
      // Arrange
      const mockSessions = [
        { sessionId: 'sess_1', status: 'ACTIVE' },
        { sessionId: 'sess_2', status: 'ACTIVE' }
      ];

      mockDatabase.query.mockResolvedValue(mockSessions);

      // Act
      const result = await repository.getActive();

      // Assert
      expect(result.every(s => s.status === 'ACTIVE')).toBe(true);
    });

    test('should get paused sessions', async () => {
      // Arrange
      const mockSessions = [
        { sessionId: 'sess_1', status: 'PAUSED' },
        { sessionId: 'sess_2', status: 'PAUSED' }
      ];

      mockDatabase.query.mockResolvedValue(mockSessions);

      // Act
      const result = await repository.getPaused();

      // Assert
      expect(result.every(s => s.status === 'PAUSED')).toBe(true);
    });

    test('should get all sessions', async () => {
      // Arrange
      const mockSessions = [
        { sessionId: 'sess_1' },
        { sessionId: 'sess_2' },
        { sessionId: 'sess_3' }
      ];

      mockDatabase.query.mockResolvedValue(mockSessions);

      // Act
      const result = await repository.getAll();

      // Assert
      expect(result).toHaveLength(3);
    });
  });

  describe('Update Operations', () => {
    test('should update session status', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue({
        sessionId: 'session_123',
        status: 'PAUSED'
      });

      // Act
      await repository.updateStatus('session_123', 'PAUSED');

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should update session', async () => {
      // Arrange
      const updates = { errorCount: 5 };

      mockDatabase.execute.mockResolvedValue({
        sessionId: 'session_123',
        ...updates
      });

      // Act
      await repository.update('session_123', updates);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should increment error count', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      await repository.incrementErrorCount('session_123');

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should update last activity', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      await repository.updateLastActivity('session_123');

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });
  });

  describe('Delete Operations', () => {
    test('should delete session', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      const result = await repository.delete('session_123');

      // Assert
      expect(result).toBe(true);
    });

    test('should delete sessions by admin', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(3);

      // Act
      const result = await repository.deleteByAdminId('admin_456');

      // Assert
      expect(result).toBe(3);
    });

    test('should delete stale sessions', async () => {
      // Arrange
      const threshold = 60 * 60 * 1000; // 1 hour

      mockDatabase.execute.mockResolvedValue(5);

      // Act
      const result = await repository.deleteStale(threshold);

      // Assert
      expect(result).toBe(5);
    });
  });

  describe('Status Management', () => {
    test('should get sessions by status', async () => {
      // Arrange
      const mockSessions = [
        { sessionId: 'sess_1', status: 'ERROR' }
      ];

      mockDatabase.query.mockResolvedValue(mockSessions);

      // Act
      const result = await repository.findByStatus('ERROR');

      // Assert
      expect(result.every(s => s.status === 'ERROR')).toBe(true);
    });

    test('should get sessions with errors', async () => {
      // Arrange
      const mockSessions = [
        { sessionId: 'sess_1', errorCount: 3 },
        { sessionId: 'sess_2', errorCount: 5 }
      ];

      mockDatabase.query.mockResolvedValue(mockSessions);

      // Act
      const result = await repository.getWithErrors();

      // Assert
      expect(result.every(s => s.errorCount > 0)).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should count all sessions', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 100 }]);

      // Act
      const count = await repository.count();

      // Assert
      expect(count).toBe(100);
    });

    test('should count active sessions', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 75 }]);

      // Act
      const count = await repository.countActive();

      // Assert
      expect(count).toBe(75);
    });

    test('should count sessions by admin', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 3 }]);

      // Act
      const count = await repository.countByAdminId('admin_456');

      // Assert
      expect(count).toBe(3);
    });

    test('should get session statistics', async () => {
      // Arrange
      const mockStats = {
        totalSessions: 100,
        activeSessions: 75,
        pausedSessions: 20,
        errorSessions: 5
      };

      mockDatabase.query.mockResolvedValue([mockStats]);

      // Act
      const stats = await repository.getStats();

      // Assert
      expect(stats.totalSessions).toBe(100);
    });
  });

  describe('Bulk Operations', () => {
    test('should create multiple sessions', async () => {
      // Arrange
      const sessions = [
        { sessionId: 'sess_1', adminId: 'admin_1' },
        { sessionId: 'sess_2', adminId: 'admin_1' }
      ];

      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });
      mockDatabase.execute.mockResolvedValue({});

      // Act
      const result = await repository.createBatch(sessions);

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should update multiple sessions', async () => {
      // Arrange
      const updates = {
        'sess_1': { status: 'PAUSED' },
        'sess_2': { status: 'ACTIVE' }
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

  describe('Duration Calculation', () => {
    test('should get session duration', async () => {
      // Arrange
      const mockSession = {
        sessionId: 'session_123',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date()
      };

      mockDatabase.query.mockResolvedValue([mockSession]);

      // Act
      const result = await repository.findById('session_123');
      const duration = result.endTime - result.startTime;

      // Assert
      expect(duration).toBeGreaterThanOrEqual(3600000);
    });

    test('should calculate average session duration', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([
        { avgDuration: 7200000 }
      ]);

      // Act
      const avgDuration = await repository.getAverageDuration();

      // Assert
      expect(avgDuration).toBe(7200000);
    });
  });

  describe('Cleanup Operations', () => {
    test('should clean old terminated sessions', async () => {
      // Arrange
      const daysOld = 30;

      mockDatabase.execute.mockResolvedValue(10);

      // Act
      const deleted = await repository.cleanupOldTerminated(daysOld);

      // Assert
      expect(deleted).toBe(10);
    });

    test('should clean orphaned sessions', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(5);

      // Act
      const deleted = await repository.cleanupOrphaned();

      // Assert
      expect(deleted).toBe(5);
    });
  });

  describe('Pagination', () => {
    test('should get paginated sessions', async () => {
      // Arrange
      const mockSessions = [
        { sessionId: 'sess_1' },
        { sessionId: 'sess_2' }
      ];

      mockDatabase.query.mockResolvedValue(mockSessions);

      // Act
      const result = await repository.getPaginated({ limit: 2, offset: 0 });

      // Assert
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle sessions with very long durations', async () => {
      // Arrange
      const mockSession = {
        sessionId: 'session_123',
        startTime: new Date('2020-01-01'),
        endTime: new Date('2024-01-01')
      };

      mockDatabase.query.mockResolvedValue([mockSession]);

      // Act
      const result = await repository.findById('session_123');

      // Assert
      expect(result.startTime).toBeDefined();
    });

    test('should handle sessions with many errors', async () => {
      // Arrange
      const mockSession = {
        sessionId: 'session_123',
        errorCount: 9999
      };

      mockDatabase.query.mockResolvedValue([mockSession]);

      // Act
      const result = await repository.findById('session_123');

      // Assert
      expect(result.errorCount).toBe(9999);
    });

    test('should handle concurrent session updates', async () => {
      // Arrange
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      const updates = [
        repository.updateLastActivity('session_1'),
        repository.updateLastActivity('session_2'),
        repository.updateLastActivity('session_3')
      ];

      await Promise.all(updates);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      // Arrange
      mockDatabase.query.mockRejectedValue(
        new Error('Connection failed')
      );

      // Act & Assert
      await expect(repository.getAll())
        .rejects.toThrow('Connection failed');
    });

    test('should handle transaction errors', async () => {
      // Arrange
      mockDatabase.transaction.mockImplementation(async (fn) => {
        throw new Error('Transaction failed');
      });

      // Act & Assert
      await expect(repository.createBatch([]))
        .rejects.toThrow('Transaction failed');
    });
  });

  describe('Integration', () => {
    test('should work with complete session lifecycle', async () => {
      // Arrange
      const sessionData = {
        sessionId: 'session_123',
        adminId: 'admin_456',
        status: 'ACTIVE'
      };

      mockDatabase.execute.mockResolvedValue(sessionData);
      mockDatabase.query.mockResolvedValue([sessionData]);

      // Act
      const created = await repository.create(sessionData);
      const found = await repository.findById('session_123');

      // Assert
      expect(created.sessionId).toBe('session_123');
      expect(found.sessionId).toBe('session_123');
    });
  });
});
