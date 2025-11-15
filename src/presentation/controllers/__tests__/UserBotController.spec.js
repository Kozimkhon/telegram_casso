/**
 * @fileoverview Unit Tests for UserBotController
 * Tests user bot command handling and response generation
 */

import { jest } from '@jest/globals';
import UserBotController from '../UserBotController.js';

describe('UserBotController', () => {
  let controller;
  let mockUserService;
  let mockSessionService;
  let mockForwardingService;
  let mockLogger;

  beforeEach(() => {
    mockUserService = {
      getUser: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn()
    };

    mockSessionService = {
      getActiveSession: jest.fn(),
      createSession: jest.fn(),
      closeSession: jest.fn()
    };

    mockForwardingService = {
      forwardMessage: jest.fn(),
      getStats: jest.fn()
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn()
    };

    controller = new UserBotController(
      mockUserService,
      mockSessionService,
      mockForwardingService,
      mockLogger
    );
  });

  describe('Initialization', () => {
    test('should initialize with dependencies', () => {
      // Assert
      expect(controller).toBeDefined();
      expect(controller.userService).toBe(mockUserService);
    });
  });

  describe('Start Command', () => {
    test('should handle /start command', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/start',
          from: { id: 'user_123', first_name: 'John' }
        }
      };

      mockUserService.createUser.mockResolvedValue({
        userId: 'user_123',
        firstName: 'John'
      });

      // Act
      const result = await controller.handleStart(update);

      // Assert
      expect(result).toBeDefined();
      expect(mockUserService.createUser).toHaveBeenCalled();
    });

    test('should send welcome message on start', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          from: { id: 'user_123', first_name: 'John' }
        }
      };

      mockUserService.createUser.mockResolvedValue({
        userId: 'user_123'
      });

      // Act
      const result = await controller.handleStart(update);

      // Assert
      expect(result.text).toContain('Welcome');
    });

    test('should handle duplicate start command', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          from: { id: 'user_123' }
        }
      };

      mockUserService.createUser.mockRejectedValue(
        new Error('User already exists')
      );
      mockUserService.getUser.mockResolvedValue({ userId: 'user_123' });

      // Act
      const result = await controller.handleStart(update);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('Help Command', () => {
    test('should handle /help command', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/help'
        }
      };

      // Act
      const result = await controller.handleHelp(update);

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toContain('help');
    });

    test('should list available commands', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/help'
        }
      };

      // Act
      const result = await controller.handleHelp(update);

      // Assert
      expect(result.text).toMatch(/\/\w+/);
    });
  });

  describe('Status Command', () => {
    test('should handle /status command', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/status'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123',
        status: 'ACTIVE'
      });

      // Act
      const result = await controller.handleStatus(update);

      // Assert
      expect(result).toBeDefined();
    });

    test('should show session status', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/status'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        status: 'ACTIVE',
        uptime: 3600000
      });

      // Act
      const result = await controller.handleStatus(update);

      // Assert
      expect(result.text).toContain('status');
    });

    test('should handle no active session', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/status'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue(null);

      // Act
      const result = await controller.handleStatus(update);

      // Assert
      expect(result.text).toContain('No active session');
    });
  });

  describe('Stats Command', () => {
    test('should handle /stats command', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/stats'
        }
      };

      mockForwardingService.getStats.mockResolvedValue({
        messagesForwarded: 100,
        successRate: 0.95
      });

      // Act
      const result = await controller.handleStats(update);

      // Assert
      expect(result).toBeDefined();
    });

    test('should display forwarding statistics', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/stats'
        }
      };

      mockForwardingService.getStats.mockResolvedValue({
        messagesForwarded: 500,
        successRate: 0.98,
        totalErrors: 10
      });

      // Act
      const result = await controller.handleStats(update);

      // Assert
      expect(result.text).toContain('500');
      expect(result.text).toContain('98');
    });
  });

  describe('Settings Command', () => {
    test('should handle /settings command', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/settings'
        }
      };

      mockUserService.getUser.mockResolvedValue({
        userId: 'user_123',
        settings: { notifications: true }
      });

      // Act
      const result = await controller.handleSettings(update);

      // Assert
      expect(result).toBeDefined();
    });

    test('should show current settings', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/settings'
        }
      };

      mockUserService.getUser.mockResolvedValue({
        settings: { notifications: true, autoForward: false }
      });

      // Act
      const result = await controller.handleSettings(update);

      // Assert
      expect(result.text).toContain('settings');
    });
  });

  describe('Message Forwarding', () => {
    test('should forward regular user message', async () => {
      // Arrange
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: 'Forward this message',
          from: { id: 'user_123' }
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });
      mockForwardingService.forwardMessage.mockResolvedValue({
        success: true,
        messageId: 456
      });

      // Act
      const result = await controller.handleMessage(update);

      // Assert
      expect(result.success).toBe(true);
    });

    test('should skip forwarding if no active session', async () => {
      // Arrange
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: 'Message'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue(null);

      // Act
      const result = await controller.handleMessage(update);

      // Assert
      expect(result.forwarded).toBe(false);
    });

    test('should track forwarding errors', async () => {
      // Arrange
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: 'Message'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });
      mockForwardingService.forwardMessage.mockRejectedValue(
        new Error('Forwarding failed')
      );

      // Act
      const result = await controller.handleMessage(update);

      // Assert
      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Cancel/Quit Command', () => {
    test('should handle /cancel or /quit', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/cancel'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });
      mockSessionService.closeSession.mockResolvedValue(true);

      // Act
      const result = await controller.handleCancel(update);

      // Assert
      expect(result).toBeDefined();
      expect(mockSessionService.closeSession).toHaveBeenCalled();
    });

    test('should confirm session termination', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/quit'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });
      mockSessionService.closeSession.mockResolvedValue(true);

      // Act
      const result = await controller.handleCancel(update);

      // Assert
      expect(result.text).toContain('closed');
    });
  });

  describe('Error Handling', () => {
    test('should handle service errors gracefully', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/status'
        }
      };

      mockSessionService.getActiveSession.mockRejectedValue(
        new Error('Service error')
      );

      // Act
      const result = await controller.handleStatus(update);

      // Assert
      expect(result.text).toContain('error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle invalid commands', async () => {
      // Arrange
      const update = {
        message: {
          chat: { id: 'user_123' },
          text: '/unknown'
        }
      };

      // Act
      const result = await controller.handleUnknownCommand(update);

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toContain('unknown');
    });
  });

  describe('Text Message Handling', () => {
    test('should process plain text messages', async () => {
      // Arrange
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: 'Hello bot',
          from: { id: 'user_123' }
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });

      // Act
      const result = await controller.handleMessage(update);

      // Assert
      expect(result).toBeDefined();
    });

    test('should ignore bot commands in forwarding', async () => {
      // Arrange
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: '/command',
          from: { id: 'user_123' }
        }
      };

      // Act
      const result = await controller.handleMessage(update);

      // Assert
      expect(result.forwarded).not.toBe(true);
    });
  });

  describe('Callback Query Handling', () => {
    test('should handle inline button callbacks', async () => {
      // Arrange
      const callbackQuery = {
        id: 'callback_123',
        data: 'action_confirm',
        from: { id: 'user_123' }
      };

      // Act
      const result = await controller.handleCallbackQuery(callbackQuery);

      // Assert
      expect(result).toBeDefined();
    });

    test('should acknowledge callback queries', async () => {
      // Arrange
      const callbackQuery = {
        id: 'callback_123',
        data: 'action_confirm'
      };

      // Act
      const result = await controller.handleCallbackQuery(callbackQuery);

      // Assert
      expect(result.callback_query_id).toBe('callback_123');
    });
  });

  describe('Edge Cases', () => {
    test('should handle messages with unicode', async () => {
      // Arrange
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: 'Привет бот 🌍',
          from: { id: 'user_123' }
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });
      mockForwardingService.forwardMessage.mockResolvedValue({
        success: true
      });

      // Act
      const result = await controller.handleMessage(update);

      // Assert
      expect(result).toBeDefined();
    });

    test('should handle very long messages', async () => {
      // Arrange
      const longText = 'A'.repeat(4096);
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: longText,
          from: { id: 'user_123' }
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });

      // Act
      const result = await controller.handleMessage(update);

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should handle rapid message requests', async () => {
      // Arrange
      const update = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: 'Message'
        }
      };

      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });

      // Act
      const results = await Promise.all([
        controller.handleMessage(update),
        controller.handleMessage(update),
        controller.handleMessage(update)
      ]);

      // Assert
      expect(results).toHaveLength(3);
    });
  });

  describe('Integration', () => {
    test('should complete full user workflow', async () => {
      // Arrange
      const startUpdate = {
        message: {
          chat: { id: 'user_123' },
          from: { id: 'user_123', first_name: 'John' }
        }
      };

      const messageUpdate = {
        message: {
          message_id: 123,
          chat: { id: 'user_123' },
          text: 'Forward this',
          from: { id: 'user_123' }
        }
      };

      mockUserService.createUser.mockResolvedValue({ userId: 'user_123' });
      mockSessionService.getActiveSession.mockResolvedValue({
        sessionId: 'sess_123'
      });
      mockForwardingService.forwardMessage.mockResolvedValue({
        success: true
      });

      // Act
      const started = await controller.handleStart(startUpdate);
      const forwarded = await controller.handleMessage(messageUpdate);

      // Assert
      expect(started).toBeDefined();
      expect(forwarded.success).toBe(true);
    });
  });
});
