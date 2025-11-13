/**
 * @fileoverview Test Utilities and Helpers
 * Reusable test data builders, mocks, and assertion helpers
 * @module __tests__/test-helpers
 */

import { AdminRole } from '../../shared/constants/index.js';

/**
 * Factory functions for creating test data
 */

export const TestDataFactory = {
  /**
   * Create test admin with optional overrides
   */
  admin: (overrides = {}) => ({
    id: 1,
    userId: '123456789',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    role: AdminRole.ADMIN,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),

  /**
   * Create test user
   */
  user: (overrides = {}) => ({
    id: 1,
    userId: '999999999',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    isBot: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),

  /**
   * Create test channel
   */
  channel: (overrides = {}) => ({
    id: 1,
    channelId: 'test_channel',
    title: 'Test Channel',
    username: '@test_channel',
    membersCount: 100,
    description: 'Test channel',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),

  /**
   * Create test message
   */
  message: (overrides = {}) => ({
    id: 1,
    messageId: 123,
    userId: '999999999',
    forwardedMessageId: 456,
    text: 'Test message',
    status: 'SUCCESS',
    isGrouped: false,
    createdAt: new Date('2024-01-01'),
    ...overrides
  }),

  /**
   * Create test session
   */
  session: (overrides = {}) => ({
    id: 1,
    adminId: 1,
    sessionId: 'test_session',
    apiId: 123456,
    apiHash: 'test_hash',
    phoneNumber: '+1234567890',
    status: 'ACTIVE',
    autoPaused: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides
  }),

  /**
   * Create bulk users
   */
  users: (count = 5, baseOverrides = {}) =>
    Array.from({ length: count }, (_, i) => ({
      ...TestDataFactory.user({
        id: i + 1,
        userId: String(1000000000 + i),
        ...baseOverrides
      })
    })),

  /**
   * Create bulk admins with different roles
   */
  adminsByRole: () => [
    TestDataFactory.admin({ role: AdminRole.SUPER_ADMIN, id: 1 }),
    TestDataFactory.admin({ role: AdminRole.ADMIN, id: 2 }),
    TestDataFactory.admin({ role: AdminRole.MODERATOR, id: 3 })
  ]
};

/**
 * Mock factories
 */

export const MockFactory = {
  /**
   * Create mock logger
   */
  logger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn()
  }),

  /**
   * Create mock repository
   */
  repository: () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByRole: jest.fn(),
    findActive: jest.fn()
  }),

  /**
   * Create mock user repository
   */
  userRepository: () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByChannel: jest.fn().mockResolvedValue([]),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }),

  /**
   * Create mock message repository
   */
  messageRepository: () => ({
    create: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByChannel: jest.fn(),
    findOldMessages: jest.fn().mockResolvedValue({ messages: [] }),
    findByForwardedMessageId: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }),

  /**
   * Create mock throttle service
   */
  throttleService: () => ({
    waitForThrottle: jest.fn().mockResolvedValue(undefined),
    getGlobalStatus: jest.fn().mockReturnValue({
      tokensAvailable: 100,
      refillRate: 10,
      lastRefillTime: Date.now()
    }),
    getPerUserStatus: jest.fn().mockReturnValue({
      tokensAvailable: 10,
      refillRate: 1
    }),
    handleFloodWait: jest.fn()
  }),

  /**
   * Create mock Telegraf bot
   */
  bot: () => ({
    launch: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
    command: jest.fn().mockReturnThis(),
    action: jest.fn().mockReturnThis(),
    hears: jest.fn().mockReturnThis(),
    middleware: jest.fn().mockReturnThis(),
    catch: jest.fn().mockReturnThis(),
    telegram: {
      sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
      editMessageText: jest.fn().mockResolvedValue(true),
      deleteMessage: jest.fn().mockResolvedValue(true),
      sendPhoto: jest.fn().mockResolvedValue({ message_id: 1 })
    }
  }),

  /**
   * Create mock context
   */
  context: (overrides = {}) => ({
    from: {
      id: '123456789',
      first_name: 'Test',
      is_bot: false,
      ...overrides.from
    },
    chat: {
      id: '123456789',
      type: 'private',
      ...overrides.chat
    },
    message: {
      message_id: 1,
      text: '/start',
      date: Math.floor(Date.now() / 1000),
      ...overrides.message
    },
    callbackQuery: overrides.callbackQuery || undefined,
    reply: jest.fn().mockResolvedValue({ message_id: 1 }),
    sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
    editMessageText: jest.fn().mockResolvedValue(true),
    deleteMessage: jest.fn().mockResolvedValue(true),
    answerCallbackQuery: jest.fn().mockResolvedValue(true),
    ...overrides
  }),

  /**
   * Create mock data source
   */
  dataSource: () => ({
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getMany: jest.fn(),
        delete: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 })
      }),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn()
    }),
    create: jest.fn()
  })
};

/**
 * Assertion helpers
 */

export const AssertionHelpers = {
  /**
   * Assert admin is valid
   */
  assertValidAdmin: (admin) => {
    expect(admin).toBeDefined();
    expect(admin.userId).toBeDefined();
    expect(admin.firstName).toBeDefined();
    expect(admin.isActive).toBeDefined();
  },

  /**
   * Assert repository is valid
   */
  assertValidRepository: (repository) => {
    const requiredMethods = ['create', 'findById', 'findAll', 'update', 'delete'];
    requiredMethods.forEach(method => {
      expect(repository[method]).toBeDefined();
      expect(typeof repository[method]).toBe('function');
    });
  },

  /**
   * Assert successful result
   */
  assertSuccessResult: (result) => {
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
  },

  /**
   * Assert failed result
   */
  assertFailedResult: (result) => {
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  },

  /**
   * Assert forwarding result
   */
  assertForwardingResult: (result) => {
    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.successful).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);
    expect(result.results).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  },

  /**
   * Assert throttle status
   */
  assertThrottleStatus: (status) => {
    expect(status).toBeDefined();
    expect(typeof status.tokensAvailable).toBe('number');
    expect(typeof status.refillRate).toBe('number');
  }
};

/**
 * Test scenario builders
 */

export const ScenarioBuilder = {
  /**
   * Build admin creation scenario
   */
  createAdminScenario: () => ({
    input: TestDataFactory.admin(),
    expectedRoles: [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR],
    expectedResult: {
      success: true,
      admin: TestDataFactory.admin()
    }
  }),

  /**
   * Build message forwarding scenario
   */
  messageForwardingScenario: () => ({
    channel: 'test_channel',
    users: TestDataFactory.users(3),
    message: TestDataFactory.message(),
    expectedResult: {
      total: 3,
      successful: 3,
      failed: 0
    }
  }),

  /**
   * Build throttling scenario
   */
  throttlingScenario: () => ({
    initialTokens: 100,
    requestsToMake: 150,
    refillRate: 10,
    refillInterval: 1000
  }),

  /**
   * Build session error scenario
   */
  sessionErrorScenario: () => ({
    errorType: 'AUTH_KEY_UNREGISTERED',
    errorMessage: 'Session authentication failed',
    expectedAdminNotification: true,
    expectedSessionPause: true
  })
};

/**
 * Async test helpers
 */

export const AsyncHelpers = {
  /**
   * Wait for condition to be true
   */
  waitFor: async (condition, timeout = 5000, interval = 100) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (condition()) return true;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },

  /**
   * Wait for mock to be called
   */
  waitForMockCall: async (mock, timeout = 5000) => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (mock.mock.calls.length > 0) return mock;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Mock not called within ${timeout}ms`);
  },

  /**
   * Execute with timeout
   */
  executeWithTimeout: async (promise, timeout = 5000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  },

  /**
   * Suppress console during execution
   */
  suppressConsole: async (fn) => {
    const originalLog = console.log;
    const originalError = console.error;
    console.log = jest.fn();
    console.error = jest.fn();
    try {
      return await fn();
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  }
};

/**
 * Expectation builders
 */

export const ExpectationBuilder = {
  /**
   * Build success expectation
   */
  expectSuccess: (result, expectedMessage = '') => {
    expect(result.success).toBe(true);
    if (expectedMessage) {
      expect(result.message).toContain(expectedMessage);
    }
  },

  /**
   * Build error expectation
   */
  expectError: (result, expectedMessage = '') => {
    expect(result.success).toBe(false);
    if (expectedMessage) {
      expect(result.message).toContain(expectedMessage);
    }
  },

  /**
   * Build mock call expectation
   */
  expectMockCalledWith: (mock, ...args) => {
    expect(mock).toHaveBeenCalledWith(...args);
  },

  /**
   * Build mock not called expectation
   */
  expectMockNotCalled: (mock) => {
    expect(mock).not.toHaveBeenCalled();
  },

  /**
   * Build throw expectation
   */
  expectToThrow: async (fn, errorPattern = '') => {
    try {
      await fn();
      throw new Error('Expected function to throw');
    } catch (error) {
      if (errorPattern) {
        expect(error.message).toMatch(new RegExp(errorPattern));
      }
    }
  }
};

export default {
  TestDataFactory,
  MockFactory,
  AssertionHelpers,
  ScenarioBuilder,
  AsyncHelpers,
  ExpectationBuilder
};
