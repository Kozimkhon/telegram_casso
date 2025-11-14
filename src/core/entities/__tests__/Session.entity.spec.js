/**
 * @fileoverview Unit Tests for Session Domain Entity
 * Tests admin session state management and lifecycle
 */

import Session from '../domain/Session.entity.js';

describe('Session.entity', () => {
  
  const validSessionData = {
    sessionId: 'session_12345',
    adminId: 'admin_98765',
    status: 'ACTIVE',
    startTime: new Date(),
    isPaused: false,
    pauseTime: null,
    lastActivity: new Date(),
    errorCount: 0
  };

  describe('Constructor & Initialization', () => {
    test('should create session with valid data', () => {
      // Act
      const session = new Session(validSessionData);

      // Assert
      expect(session).toBeDefined();
      expect(session.sessionId).toBe('session_12345');
      expect(session.adminId).toBe('admin_98765');
    });

    test('should throw error when sessionId is missing', () => {
      // Arrange
      const invalidData = { ...validSessionData };
      delete invalidData.sessionId;

      // Act & Assert
      expect(() => new Session(invalidData)).toThrow();
    });

    test('should throw error when adminId is missing', () => {
      // Arrange
      const invalidData = { ...validSessionData };
      delete invalidData.adminId;

      // Act & Assert
      expect(() => new Session(invalidData)).toThrow();
    });

    test('should initialize with default status ACTIVE', () => {
      // Arrange
      const data = { ...validSessionData };
      delete data.status;

      // Act
      const session = new Session(data);

      // Assert
      expect(session.status).toBe('ACTIVE');
    });

    test('should initialize with isPaused as false by default', () => {
      // Arrange
      const data = { ...validSessionData };
      delete data.isPaused;

      // Act
      const session = new Session(data);

      // Assert
      expect(session.isPaused).toBe(false);
    });
  });

  describe('Session Properties', () => {
    test('should store all session data correctly', () => {
      // Act
      const session = new Session(validSessionData);

      // Assert
      expect(session.sessionId).toBe('session_12345');
      expect(session.adminId).toBe('admin_98765');
      expect(session.status).toBe('ACTIVE');
      expect(session.isPaused).toBe(false);
      expect(session.errorCount).toBe(0);
    });

    test('should track last activity', () => {
      // Arrange
      const now = new Date();
      const data = {
        ...validSessionData,
        lastActivity: now
      };

      // Act
      const session = new Session(data);

      // Assert
      expect(session.lastActivity).toEqual(now);
    });
  });

  describe('Status Management', () => {
    test('should accept valid status values', () => {
      // Arrange
      const validStatuses = ['ACTIVE', 'PAUSED', 'TERMINATED', 'ERROR', 'WAITING'];

      // Act & Assert
      validStatuses.forEach(status => {
        const session = new Session({ ...validSessionData, status });
        expect(session.status).toBe(status);
      });
    });

    test('should reject invalid status', () => {
      // Arrange
      const data = {
        ...validSessionData,
        status: 'UNKNOWN_STATUS'
      };

      // Act & Assert
      expect(() => new Session(data)).toThrow();
    });

    test('should update status', () => {
      // Arrange
      const session = new Session(validSessionData);

      // Act
      session.updateStatus('PAUSED');

      // Assert
      expect(session.status).toBe('PAUSED');
    });
  });

  describe('Pause/Resume Management', () => {
    test('should pause session', () => {
      // Arrange
      const session = new Session(validSessionData);

      // Act
      session.pause();

      // Assert
      expect(session.isPaused).toBe(true);
      expect(session.pauseTime).toBeDefined();
    });

    test('should resume paused session', () => {
      // Arrange
      const session = new Session(validSessionData);
      session.pause();

      // Act
      session.resume();

      // Assert
      expect(session.isPaused).toBe(false);
      expect(session.pauseTime).toBeNull();
    });

    test('should auto-pause on error count', () => {
      // Arrange
      const data = {
        ...validSessionData,
        errorCount: 5
      };
      const session = new Session(data);

      // Act
      const shouldAutoPause = session.shouldAutoPause();

      // Assert
      expect(shouldAutoPause).toBe(true);
    });
  });

  describe('Error Tracking', () => {
    test('should increment error count', () => {
      // Arrange
      const session = new Session(validSessionData);

      // Act
      session.incrementErrorCount();
      session.incrementErrorCount();

      // Assert
      expect(session.errorCount).toBe(2);
    });

    test('should reset error count', () => {
      // Arrange
      const data = {
        ...validSessionData,
        errorCount: 5
      };
      const session = new Session(data);

      // Act
      session.resetErrorCount();

      // Assert
      expect(session.errorCount).toBe(0);
    });

    test('should indicate session health', () => {
      // Arrange
      const healthySession = new Session(validSessionData);
      const unhealthySession = new Session({
        ...validSessionData,
        errorCount: 10
      });

      // Act & Assert
      expect(healthySession.isHealthy()).toBe(true);
      expect(unhealthySession.isHealthy()).toBe(false);
    });
  });

  describe('Activity Tracking', () => {
    test('should update last activity timestamp', () => {
      // Arrange
      const session = new Session(validSessionData);
      const oldActivity = session.lastActivity;

      // Act
      session.updateActivity();
      const newActivity = session.lastActivity;

      // Assert
      expect(newActivity.getTime()).toBeGreaterThanOrEqual(oldActivity.getTime());
    });

    test('should check if session is stale', () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const session = new Session({
        ...validSessionData,
        lastActivity: pastDate
      });

      // Act
      const isStale = session.isStale(30 * 60 * 1000); // 30 min threshold

      // Assert
      expect(isStale).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should validate required fields', () => {
      // Arrange
      const invalidData = { sessionId: 'session_123' };

      // Act & Assert
      expect(() => new Session(invalidData)).toThrow();
    });

    test('should validate sessionId is string', () => {
      // Arrange
      const data = {
        ...validSessionData,
        sessionId: 12345
      };

      // Act & Assert
      expect(() => new Session(data)).toThrow();
    });

    test('should validate adminId is string', () => {
      // Arrange
      const data = {
        ...validSessionData,
        adminId: 12345
      };

      // Act & Assert
      expect(() => new Session(data)).toThrow();
    });

    test('should validate errorCount is non-negative', () => {
      // Arrange
      const data = {
        ...validSessionData,
        errorCount: -1
      };

      // Act & Assert
      expect(() => new Session(data)).toThrow();
    });
  });

  describe('Database Conversion', () => {
    test('should convert to database row', () => {
      // Arrange
      const session = new Session(validSessionData);

      // Act
      const dbRow = session.toDatabaseRow();

      // Assert
      expect(dbRow).toBeDefined();
      expect(dbRow.sessionId).toBe('session_12345');
      expect(dbRow.adminId).toBe('admin_98765');
      expect(dbRow.status).toBe('ACTIVE');
    });

    test('should convert from database row', () => {
      // Arrange
      const now = new Date();
      const dbRow = {
        sessionId: 'session_12345',
        adminId: 'admin_98765',
        status: 'ACTIVE',
        startTime: now,
        isPaused: false,
        pauseTime: null,
        lastActivity: now,
        errorCount: 0,
        created_at: now
      };

      // Act
      const session = Session.fromDatabaseRow(dbRow);

      // Assert
      expect(session.sessionId).toBe('session_12345');
      expect(session.status).toBe('ACTIVE');
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero error count', () => {
      // Arrange & Act
      const session = new Session(validSessionData);

      // Assert
      expect(session.errorCount).toBe(0);
      expect(session.isHealthy()).toBe(true);
    });

    test('should handle large error count', () => {
      // Arrange
      const data = {
        ...validSessionData,
        errorCount: 9999
      };

      // Act
      const session = new Session(data);

      // Assert
      expect(session.errorCount).toBe(9999);
      expect(session.isHealthy()).toBe(false);
    });

    test('should handle very old session', () => {
      // Arrange
      const veryOldDate = new Date('2020-01-01');
      const session = new Session({
        ...validSessionData,
        startTime: veryOldDate,
        lastActivity: veryOldDate
      });

      // Act
      const duration = session.getDuration();

      // Assert
      expect(duration).toBeGreaterThan(0);
    });

    test('should handle session duration calculation', () => {
      // Arrange
      const startTime = new Date(Date.now() - 60000); // 1 minute ago
      const session = new Session({
        ...validSessionData,
        startTime
      });

      // Act
      const duration = session.getDuration();

      // Assert
      expect(duration).toBeGreaterThanOrEqual(60000);
      expect(duration).toBeLessThanOrEqual(61000);
    });
  });
});
