/**
 * Test DI Container Setup
 * Provides mocked services for testing
 */

class TestContainer {
  constructor(database) {
    this.database = database;
    this.services = new Map();
    this.setupMockServices();
  }

  setupMockServices() {
    // Mock repositories
    this.services.set('adminRepository', {
      findById: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
      findAll: jest.fn().mockResolvedValue([])
    });

    this.services.set('sessionRepository', {
      findByAdminId: jest.fn().mockResolvedValue([]),
      findByStatus: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
      findAll: jest.fn().mockResolvedValue([])
    });

    this.services.set('channelRepository', {
      findByChannelId: jest.fn().mockResolvedValue(null),
      findByAdminId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
      findAll: jest.fn().mockResolvedValue([])
    });

    this.services.set('messageRepository', {
      findByChannelId: jest.fn().mockResolvedValue([]),
      findByUserId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      bulkCreate: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
      findAll: jest.fn().mockResolvedValue([])
    });

    this.services.set('userRepository', {
      findByUserId: jest.fn().mockResolvedValue(null),
      findByChannelId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      bulkCreate: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue(true),
      findAll: jest.fn().mockResolvedValue([])
    });

    // Mock services
    this.services.set('forwardingService', {
      forwardToUsers: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
      forwardMessage: jest.fn().mockResolvedValue(true),
      handleTelegramError: jest.fn().mockReturnValue('UNKNOWN'),
      retryFailedMessage: jest.fn().mockResolvedValue(true)
    });

    this.services.set('throttleService', {
      getThrottleForSession: jest.fn().mockReturnValue({ tokensPerMinute: 10 }),
      canForwardNow: jest.fn().mockReturnValue(true),
      applyThrottle: jest.fn().mockResolvedValue(true),
      recordForward: jest.fn().mockReturnValue(true)
    });

    this.services.set('metricsService', {
      recordSuccess: jest.fn().mockResolvedValue(true),
      recordFailure: jest.fn().mockResolvedValue(true),
      getChannelMetrics: jest.fn().mockResolvedValue({ success: 0, failed: 0 }),
      getAdminMetrics: jest.fn().mockResolvedValue({})
    });

    this.services.set('stateManager', {
      pauseSession: jest.fn().mockResolvedValue(true),
      resumeSession: jest.fn().mockResolvedValue(true),
      setError: jest.fn().mockResolvedValue(true),
      clearError: jest.fn().mockResolvedValue(true)
    });
  }

  resolve(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    return service;
  }

  register(serviceName, service) {
    this.services.set(serviceName, service);
  }

  static createTestContainer(database) {
    return new TestContainer(database);
  }
}

module.exports = TestContainer;
