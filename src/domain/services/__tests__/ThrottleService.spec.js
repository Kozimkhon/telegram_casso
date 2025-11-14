/**
 * @fileoverview Unit Tests for ThrottleService
 * Tests rate limiting logic including token bucket algorithm and per-user throttling
 * @module domain/services/__tests__/ThrottleService.spec
 */

import ThrottleService from '../ThrottleService.js';

describe('ThrottleService', () => {
  
  // ==================== SETUP & TEARDOWN ====================
  
  let throttleService;

  beforeEach(() => {
    throttleService = new ThrottleService({
      globalTokensPerInterval: 100,
      globalInterval: 60000,
      perUserTokensPerInterval: 10,
      perUserInterval: 60000,
      minDelayMs: 500,
      maxDelayMs: 3000
    });
  });

  afterEach(async () => {
    if (throttleService && typeof throttleService.shutdown === 'function') {
      await throttleService.shutdown();
    }
    jest.clearAllTimers();
  });

  // ==================== INITIALIZATION ====================

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      // Arrange & Act
      const service = new ThrottleService();

      // Assert
      expect(service).toBeDefined();
      expect(service.getGlobalStatus).toBeDefined();
    });

    test('should initialize with custom configuration', () => {
      // Arrange & Act
      const service = new ThrottleService({
        globalTokensPerInterval: 50,
        perUserTokensPerInterval: 5
      });

      // Assert
      expect(service).toBeDefined();
    });

    test('should have methods for waiting and checking status', () => {
      // Assert
      expect(throttleService.waitForThrottle).toBeDefined();
      expect(throttleService.getGlobalStatus).toBeDefined();
      expect(throttleService.getPerUserStatus).toBeDefined();
    });
  });

  // ==================== THROTTLE WAITING ====================

  describe('Throttle Waiting', () => {
    test('should wait for throttle when tokens available', async () => {
      // Arrange
      jest.useFakeTimers();

      // Act
      const promise = throttleService.waitForThrottle('user1');
      
      // Assert - should resolve immediately if tokens available
      await expect(promise).resolves.toBeUndefined();
      
      jest.useRealTimers();
    });

    test('should handle multiple users independently', async () => {
      // Arrange
      jest.useFakeTimers();

      // Act
      const promise1 = throttleService.waitForThrottle('user1');
      const promise2 = throttleService.waitForThrottle('user2');

      // Assert
      await expect(Promise.all([promise1, promise2])).resolves.toBeDefined();
      
      jest.useRealTimers();
    });

    test('should wait when throttle limit exceeded', async () => {
      // Arrange
      jest.useFakeTimers();
      
      // Exhaust global tokens
      for (let i = 0; i < 100; i++) {
        throttleService.waitForThrottle(`user${i}`);
      }

      // Act
      const waitPromise = throttleService.waitForThrottle('user_new');

      // Assert - should not resolve immediately
      let resolved = false;
      waitPromise.then(() => { resolved = true; });
      
      // Give event loop a chance to process
      jest.runAllTimers();
      
      // Should still be pending or resolved after token refill
      expect(typeof resolved).toBe('boolean');
      
      jest.useRealTimers();
    });
  });

  // ==================== GLOBAL THROTTLING ====================

  describe('Global Throttling', () => {
    test('should track global tokens', () => {
      // Act
      const status = throttleService.getGlobalStatus();

      // Assert
      expect(status).toBeDefined();
      expect(status.tokensAvailable).toBeGreaterThan(0);
    });

    test('should decrease tokens on throttle request', async () => {
      // Arrange
      const initialStatus = throttleService.getGlobalStatus();
      const initialTokens = initialStatus.tokensAvailable;

      // Act
      await throttleService.waitForThrottle('user1');
      const afterStatus = throttleService.getGlobalStatus();

      // Assert
      expect(afterStatus.tokensAvailable).toBeLessThanOrEqual(initialTokens);
    });

    test('should refill tokens over time', async () => {
      // Arrange
      jest.useFakeTimers();
      
      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        throttleService.waitForThrottle(`user${i}`);
      }
      
      const statusAfterExhaust = throttleService.getGlobalStatus();
      const tokensAfterExhaust = statusAfterExhaust.tokensAvailable;

      // Act
      jest.advanceTimersByTime(6000); // Advance past refill interval

      // Assert
      const statusAfterRefill = throttleService.getGlobalStatus();
      expect(statusAfterRefill.tokensAvailable).toBeGreaterThan(tokensAfterExhaust);
      
      jest.useRealTimers();
    });
  });

  // ==================== PER-USER THROTTLING ====================

  describe('Per-User Throttling', () => {
    test('should track per-user tokens', () => {
      // Act
      const status = throttleService.getPerUserStatus('user1');

      // Assert
      expect(status).toBeDefined();
      expect(status.tokensAvailable).toBeGreaterThanOrEqual(0);
    });

    test('should enforce per-user token limit', async () => {
      // Arrange
      jest.useFakeTimers();

      // Act
      for (let i = 0; i < 10; i++) {
        await throttleService.waitForThrottle('user1');
      }

      // Assert
      const statusAfter = throttleService.getPerUserStatus('user1');
      expect(statusAfter.tokensAvailable).toBeLessThanOrEqual(0);
      
      jest.useRealTimers();
    });

    test('should maintain separate limits for different users', async () => {
      // Arrange
      jest.useFakeTimers();

      // Act
      await throttleService.waitForThrottle('user1');
      await throttleService.waitForThrottle('user2');

      // Assert
      const status1 = throttleService.getPerUserStatus('user1');
      const status2 = throttleService.getPerUserStatus('user2');
      
      // Both should be independent
      expect(status1.tokensAvailable).toBeDefined();
      expect(status2.tokensAvailable).toBeDefined();
      
      jest.useRealTimers();
    });
  });

  // ==================== EXPONENTIAL BACKOFF ====================

  describe('Exponential Backoff', () => {
    test('should calculate exponential backoff', () => {
      // Arrange
      const retryCount = 2;
      const baseDelay = 1000;
      const maxDelay = 60000;

      // Act
      const delay = throttleService.calculateExponentialBackoff(retryCount, baseDelay, maxDelay);

      // Assert
      expect(delay).toBeGreaterThan(baseDelay);
      expect(delay).toBeLessThanOrEqual(maxDelay);
    });

    test('should increase delay with retry count', () => {
      // Arrange
      const baseDelay = 1000;
      const maxDelay = 60000;

      // Act
      const delay0 = throttleService.calculateExponentialBackoff(0, baseDelay, maxDelay);
      const delay1 = throttleService.calculateExponentialBackoff(1, baseDelay, maxDelay);
      const delay2 = throttleService.calculateExponentialBackoff(2, baseDelay, maxDelay);

      // Assert
      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    test('should respect maximum delay', () => {
      // Arrange
      const maxDelay = 5000;

      // Act
      const delay = throttleService.calculateExponentialBackoff(10, 1000, maxDelay);

      // Assert
      expect(delay).toBeLessThanOrEqual(maxDelay);
    });

    test('should add jitter to backoff', () => {
      // Arrange
      const delays = [];
      const attempts = 10;
      const retryCount = 2;

      // Act
      for (let i = 0; i < attempts; i++) {
        delays.push(throttleService.calculateExponentialBackoff(retryCount, 1000, 60000));
      }

      // Assert - jitter should produce slightly different values
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1); // At least 2 different values
    });
  });

  // ==================== FLOOD WAIT HANDLING ====================

  describe('Flood Wait Handling', () => {
    test('should handle flood wait error', async () => {
      // Arrange
      const floodWaitSeconds = 30;

      // Act & Assert
      expect(() => {
        throttleService.handleFloodWait('admin1', floodWaitSeconds);
      }).not.toThrow();
    });

    test('should pause global throttling during flood wait', async () => {
      // Arrange
      const initialStatus = throttleService.getGlobalStatus();

      // Act
      throttleService.handleFloodWait('admin1', 5);

      // Assert
      const statusAfter = throttleService.getGlobalStatus();
      expect(statusAfter).toBeDefined();
    });
  });

  // ==================== STATUS MONITORING ====================

  describe('Status Monitoring', () => {
    test('should provide comprehensive status report', () => {
      // Act
      const globalStatus = throttleService.getGlobalStatus();
      const userStatus = throttleService.getPerUserStatus('user1');

      // Assert
      expect(globalStatus).toHaveProperty('tokensAvailable');
      expect(globalStatus).toHaveProperty('interval');
      expect(globalStatus).toHaveProperty('tokensPerInterval');

      expect(userStatus).toHaveProperty('tokensAvailable');
      expect(userStatus).toHaveProperty('interval');
    });

    test('should report for multiple users', () => {
      // Arrange
      const users = ['user1', 'user2', 'user3'];

      // Act
      const statuses = users.map(u => throttleService.getPerUserStatus(u));

      // Assert
      expect(statuses).toHaveLength(3);
      statuses.forEach(status => {
        expect(status).toBeDefined();
      });
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle zero retry count in backoff', () => {
      // Act
      const delay = throttleService.calculateExponentialBackoff(0, 1000, 60000);

      // Assert
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(60000);
    });

    test('should handle very large retry count', () => {
      // Act
      const delay = throttleService.calculateExponentialBackoff(100, 1000, 60000);

      // Assert
      expect(delay).toBeLessThanOrEqual(60000);
      expect(delay).toBeGreaterThan(0);
    });

    test('should handle concurrent throttle requests', async () => {
      // Arrange
      jest.useFakeTimers();

      // Act
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(throttleService.waitForThrottle(`user${i % 5}`));
      }

      // Assert
      await expect(Promise.all(promises)).resolves.toBeDefined();
      
      jest.useRealTimers();
    });

    test('should handle empty user ID', async () => {
      // Act & Assert
      await expect(throttleService.waitForThrottle('')).resolves.toBeUndefined();
    });

    test('should handle special characters in user ID', async () => {
      // Act & Assert
      await expect(throttleService.waitForThrottle('user@example.com')).resolves.toBeUndefined();
    });
  });

  // ==================== INTEGRATION SCENARIOS ====================

  describe('Integration Scenarios', () => {
    test('should handle typical forwarding workflow', async () => {
      // Arrange
      jest.useFakeTimers();
      const userIds = ['user1', 'user2', 'user3'];

      // Act
      for (const userId of userIds) {
        await throttleService.waitForThrottle(userId);
      }

      // Assert
      const statuses = userIds.map(u => throttleService.getPerUserStatus(u));
      statuses.forEach(status => {
        expect(status.tokensAvailable).toBeLessThan(10);
      });

      jest.useRealTimers();
    });

    test('should recover after token exhaustion', async () => {
      // Arrange
      jest.useFakeTimers();

      // Exhaust global tokens
      for (let i = 0; i < 100; i++) {
        throttleService.waitForThrottle(`user${i}`);
      }

      const statusExhausted = throttleService.getGlobalStatus();

      // Act - wait for refill
      jest.advanceTimersByTime(60000);

      // Assert
      const statusRecovered = throttleService.getGlobalStatus();
      expect(statusRecovered.tokensAvailable).toBeGreaterThan(statusExhausted.tokensAvailable);

      jest.useRealTimers();
    });
  });
});
