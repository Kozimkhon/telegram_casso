/**
 * @fileoverview Jest Setup File
 * Initializes test environment with global utilities and mocks
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Suppress console errors in tests (optional)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  // Suppress specific error messages
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('WARN') || args[0].includes('Mock'))
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('WARN') || args[0].includes('Mock'))
  ) {
    return;
  }
  originalConsoleWarn.call(console, ...args);
};

// Global test timeout
jest.setTimeout(10000);

// Mock timers utility
global.mockTimers = () => {
  jest.useFakeTimers();
};

global.restoreTimers = () => {
  jest.useRealTimers();
};

// Helper for advancing timers
global.advanceTimersByTime = (ms) => {
  jest.advanceTimersByTime(ms);
};

// Helper for running pending timers
global.runAllTimers = () => {
  jest.runAllTimers();
};

// Mock logger factory
global.createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn()
});

// Mock repository factory
global.createMockRepository = () => ({
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByRole: jest.fn(),
  findActive: jest.fn()
});

// Mock data builder utilities
global.createTestAdmin = (overrides = {}) => ({
  id: 1,
  userId: '123456789',
  firstName: 'Test',
  lastName: 'Admin',
  phone: '+1234567890',
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

global.createTestUser = (overrides = {}) => ({
  id: 1,
  userId: '999999999',
  firstName: 'Test',
  lastName: 'User',
  username: 'testuser',
  isBot: false,
  createdAt: new Date(),
  ...overrides
});

global.createTestChannel = (overrides = {}) => ({
  id: 1,
  channelId: 'test_channel',
  title: 'Test Channel',
  username: '@test_channel',
  membersCount: 100,
  description: 'Test channel description',
  createdAt: new Date(),
  ...overrides
});

global.createTestMessage = (overrides = {}) => ({
  id: 1,
  messageId: 123,
  userId: '999999999',
  forwardedMessageId: 456,
  text: 'Test message',
  status: 'SUCCESS',
  createdAt: new Date(),
  ...overrides
});

global.createTestSession = (overrides = {}) => ({
  id: 1,
  adminId: 1,
  sessionId: 'test_session',
  apiId: 123456,
  apiHash: 'test_hash',
  phoneNumber: '+1234567890',
  status: 'ACTIVE',
  autoPaused: false,
  createdAt: new Date(),
  ...overrides
});

// Test utilities
global.expectToThrowError = async (fn, errorMessage) => {
  try {
    await fn();
    throw new Error('Function did not throw error');
  } catch (error) {
    if (errorMessage) {
      expect(error.message).toContain(errorMessage);
    }
    expect(error).toBeDefined();
  }
};

global.createMockTelegramContext = (overrides = {}) => ({
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
  reply: jest.fn().mockResolvedValue({ message_id: 1 }),
  sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
  editMessageText: jest.fn().mockResolvedValue(true),
  deleteMessage: jest.fn().mockResolvedValue(true),
  answerCallbackQuery: jest.fn().mockResolvedValue(true),
  ...overrides
});

// After all tests cleanup
afterAll(() => {
  // Restore console
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Extend expect matchers
expect.extend({
  toBeValidAdmin(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.userId === 'string' &&
      typeof received.firstName === 'string' &&
      typeof received.isActive === 'boolean';

    return {
      pass,
      message: () =>
        pass ? 'expected not to be a valid admin' : 'expected to be a valid admin'
    };
  },

  toBeValidRepository(received) {
    const methods = [
      'create',
      'findById',
      'findAll',
      'update',
      'delete'
    ];

    const pass = methods.every(method => typeof received[method] === 'function');

    return {
      pass,
      message: () =>
        pass ? 'expected not to be a valid repository' : 'expected to be a valid repository'
    };
  },

  toHaveBeenCalledWithAdmin(received, expectedAdmin) {
    const calls = received.mock.calls;
    const pass = calls.some(call => {
      const arg = call[0];
      return (
        arg &&
        arg.userId === expectedAdmin.userId &&
        arg.firstName === expectedAdmin.firstName
      );
    });

    return {
      pass,
      message: () =>
        pass
          ? 'expected not to have been called with admin'
          : 'expected to have been called with admin'
    };
  }
});
