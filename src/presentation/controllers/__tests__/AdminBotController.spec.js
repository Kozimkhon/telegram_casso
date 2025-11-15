/**
 * @fileoverview Unit Tests for AdminBotController
 * Tests presentation layer controller for admin bot interactions
 * @module presentation/controllers/__tests__/AdminBotController.spec
 */

import { jest } from '@jest/globals';
import AdminBotController from '../AdminBotController.js';

describe('AdminBotController', () => {
  
  // ==================== MOCKS & SETUP ====================
  
  let adminBotController;
  let mockTelegraf;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    // Mock Telegraf bot
    mockTelegraf = {
      launch: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
      command: jest.fn().mockReturnThis(),
      action: jest.fn().mockReturnThis(),
      hears: jest.fn().mockReturnThis(),
      middleware: jest.fn().mockReturnThis()
    };

    // Mock Telegraf context
    mockContext = {
      from: {
        id: '123456789',
        first_name: 'Admin',
        is_bot: false
      },
      chat: {
        id: '123456789'
      },
      message: {
        message_id: 1,
        text: '/start'
      },
      reply: jest.fn().mockResolvedValue({ message_id: 1 }),
      sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
      editMessageText: jest.fn().mockResolvedValue(true),
      deleteMessage: jest.fn().mockResolvedValue(true),
      answerCallbackQuery: jest.fn().mockResolvedValue(true)
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    adminBotController = new AdminBotController({
      bot: mockTelegraf,
      logger: mockLogger
    });
  });

  // ==================== INITIALIZATION ====================

  describe('Initialization', () => {
    test('should initialize with bot and logger', () => {
      // Assert
      expect(adminBotController).toBeDefined();
      expect(adminBotController.getBot).toBeDefined();
    });

    test('should get bot instance', () => {
      // Act
      const bot = adminBotController.getBot();

      // Assert
      expect(bot).toBe(mockTelegraf);
    });

    test('should launch bot on startup', async () => {
      // Act
      await adminBotController.start();

      // Assert
      expect(mockTelegraf.launch).toHaveBeenCalled();
    });

    test('should stop bot on shutdown', async () => {
      // Act
      await adminBotController.stop();

      // Assert
      expect(mockTelegraf.stop).toHaveBeenCalled();
    });
  });

  // ==================== SEND MESSAGE TO ADMIN ====================

  describe('Send Message to Admin', () => {
    test('should send message to admin', async () => {
      // Arrange
      const adminId = '123456789';
      const message = 'Test message';

      // Act
      const result = await adminBotController.sendMessageToAdmin(adminId, message);

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalledWith(
        adminId,
        message,
        expect.any(Object)
      );
    });

    test('should include message options if provided', async () => {
      // Arrange
      const adminId = '123456789';
      const message = 'Test message';
      const options = { parse_mode: 'HTML' };

      // Act
      await adminBotController.sendMessageToAdmin(adminId, message, options);

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalledWith(
        adminId,
        message,
        expect.objectContaining(options)
      );
    });

    test('should handle HTML formatting', async () => {
      // Arrange
      const adminId = '123456789';
      const message = '<b>Bold</b> message';

      // Act
      await adminBotController.sendMessageToAdmin(adminId, message, { parse_mode: 'HTML' });

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();
    });

    test('should handle sending to multiple admins', async () => {
      // Arrange
      const adminIds = ['123456789', '987654321', '555555555'];
      const message = 'Broadcast message';

      // Act
      for (const adminId of adminIds) {
        await adminBotController.sendMessageToAdmin(adminId, message);
      }

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalledTimes(3);
    });

    test('should return message result', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockResolvedValue({
          message_id: 123,
          chat: { id: '123456789' },
          text: 'Test message'
        })
      };
      const adminId = '123456789';
      const message = 'Test message';

      // Act
      const result = await adminBotController.sendMessageToAdmin(adminId, message);

      // Assert
      expect(result).toBeDefined();
      expect(result.message_id).toBe(123);
    });

    test('should handle send errors', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockRejectedValue(new Error('Send failed'))
      };

      // Act & Assert
      await expect(
        adminBotController.sendMessageToAdmin('123456789', 'Test')
      ).rejects.toThrow();
    });

    test('should log message sending', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 })
      };

      // Act
      await adminBotController.sendMessageToAdmin('123456789', 'Test');

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('send'),
        expect.anything()
      );
    });
  });

  // ==================== MESSAGE HANDLING ====================

  describe('Message Handling', () => {
    test('should register message handlers', () => {
      // Act
      adminBotController.registerHandlers({
        onStart: jest.fn(),
        onCommand: jest.fn()
      });

      // Assert
      expect(mockTelegraf.command).toHaveBeenCalled();
    });

    test('should handle text messages', async () => {
      // Arrange
      const handler = jest.fn();
      adminBotController.registerHandlers({
        onMessage: handler
      });

      // Act
      await mockTelegraf.hears.mock.calls[0][1](mockContext);

      // Assert
      expect(handler).toHaveBeenCalledWith(mockContext);
    });

    test('should handle callback queries', async () => {
      // Arrange
      const handler = jest.fn();
      adminBotController.registerHandlers({
        onCallback: handler
      });

      // Act
      mockContext.callbackQuery = { data: 'action' };
      await mockTelegraf.action.mock.calls[0][1](mockContext);

      // Assert
      expect(handler).toHaveBeenCalledWith(mockContext);
    });
  });

  // ==================== REPLY FUNCTIONALITY ====================

  describe('Reply Functionality', () => {
    test('should reply to message with text', async () => {
      // Arrange
      const replyText = 'Reply message';

      // Act
      await adminBotController.reply(mockContext, replyText);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(replyText, expect.any(Object));
    });

    test('should include keyboard in reply', async () => {
      // Arrange
      const keyboard = {
        inline_keyboard: [[{ text: 'Button', callback_data: 'action' }]]
      };

      // Act
      await adminBotController.reply(mockContext, 'Text', keyboard);

      // Assert
      expect(mockContext.reply).toHaveBeenCalledWith(
        'Text',
        expect.objectContaining({
          reply_markup: keyboard
        })
      );
    });

    test('should handle reply errors', async () => {
      // Arrange
      mockContext.reply.mockRejectedValueOnce(new Error('Reply failed'));

      // Act & Assert
      await expect(
        adminBotController.reply(mockContext, 'Text')
      ).rejects.toThrow();
    });
  });

  // ==================== MIDDLEWARE ====================

  describe('Middleware', () => {
    test('should register middleware', () => {
      // Arrange
      const middleware = jest.fn();

      // Act
      adminBotController.registerMiddleware(middleware);

      // Assert
      expect(mockTelegraf.middleware).toHaveBeenCalledWith(middleware);
    });

    test('should use error handler middleware', () => {
      // Arrange & Act
      adminBotController.registerErrorHandler((err, ctx) => {
        mockLogger.error('Error:', err);
      });

      // Assert
      expect(mockTelegraf.catch).toBeDefined() || expect(mockLogger.error).toBeDefined();
    });
  });

  // ==================== KEYBOARD GENERATION ====================

  describe('Keyboard Generation', () => {
    test('should generate inline keyboard', () => {
      // Arrange
      const buttons = [
        { text: 'Yes', data: 'yes' },
        { text: 'No', data: 'no' }
      ];

      // Act
      const keyboard = adminBotController.generateInlineKeyboard(buttons);

      // Assert
      expect(keyboard).toBeDefined();
      expect(keyboard.inline_keyboard).toBeDefined();
      expect(keyboard.inline_keyboard.length).toBeGreaterThan(0);
    });

    test('should generate reply keyboard', () => {
      // Arrange
      const buttons = [['Button 1', 'Button 2'], ['Button 3']];

      // Act
      const keyboard = adminBotController.generateReplyKeyboard(buttons);

      // Assert
      expect(keyboard).toBeDefined();
      expect(keyboard.keyboard).toBeDefined();
    });
  });

  // ==================== MESSAGE FORMATTING ====================

  describe('Message Formatting', () => {
    test('should format error message with HTML', async () => {
      // Arrange
      const errorType = 'AUTH_ERROR';
      const errorMessage = 'Authentication failed';
      const formattedMessage = adminBotController.formatErrorMessage(errorType, errorMessage);

      // Assert
      expect(formattedMessage).toContain(errorType);
      expect(formattedMessage).toContain(errorMessage);
    });

    test('should format success message', () => {
      // Arrange
      const successMessage = 'Operation completed successfully';

      // Act
      const formatted = adminBotController.formatSuccessMessage(successMessage);

      // Assert
      expect(formatted).toBeDefined();
      expect(formatted).toContain(successMessage);
    });

    test('should escape special characters', () => {
      // Arrange
      const text = '<script>alert("xss")</script>';

      // Act
      const escaped = adminBotController.escapeHtml(text);

      // Assert
      expect(escaped).not.toContain('<script>');
    });
  });

  // ==================== STATE MANAGEMENT ====================

  describe('State Management', () => {
    test('should store user state', () => {
      // Arrange
      const userId = '123456789';
      const state = { step: 'awaitingInput' };

      // Act
      adminBotController.setUserState(userId, state);
      const retrievedState = adminBotController.getUserState(userId);

      // Assert
      expect(retrievedState).toEqual(state);
    });

    test('should clear user state', () => {
      // Arrange
      const userId = '123456789';
      adminBotController.setUserState(userId, { step: 'test' });

      // Act
      adminBotController.clearUserState(userId);
      const retrievedState = adminBotController.getUserState(userId);

      // Assert
      expect(retrievedState).toBeUndefined();
    });
  });

  // ==================== BROADCAST ====================

  describe('Broadcast', () => {
    test('should broadcast message to multiple admins', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 })
      };
      const adminIds = ['123456789', '987654321'];
      const message = 'Broadcast message';

      // Act
      const results = await adminBotController.broadcastMessage(adminIds, message);

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });

    test('should handle partial broadcast failures', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn()
          .mockResolvedValueOnce({ message_id: 1 })
          .mockRejectedValueOnce(new Error('Failed'))
          .mockResolvedValueOnce({ message_id: 2 })
      };
      const adminIds = ['123456789', '987654321', '555555555'];

      // Act
      const results = await adminBotController.broadcastMessage(adminIds, 'Test');

      // Assert
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    test('should handle invalid admin ID', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockRejectedValue(new Error('Invalid admin ID'))
      };

      // Act & Assert
      await expect(
        adminBotController.sendMessageToAdmin('invalid', 'Test')
      ).rejects.toThrow();
    });

    test('should handle network errors', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      // Act & Assert
      await expect(
        adminBotController.sendMessageToAdmin('123456789', 'Test')
      ).rejects.toThrow();
    });

    test('should log errors', async () => {
      // Arrange
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockRejectedValue(new Error('Test error'))
      };

      // Act
      try {
        await adminBotController.sendMessageToAdmin('123456789', 'Test');
      } catch (error) {
        // Expected
      }

      // Assert
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle very long messages', async () => {
      // Arrange
      const longMessage = 'A'.repeat(4096);
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 })
      };

      // Act
      await adminBotController.sendMessageToAdmin('123456789', longMessage);

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();
    });

    test('should handle unicode characters', async () => {
      // Arrange
      const message = 'Ҳабари тестӣ: тест 🎉';
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 })
      };

      // Act
      await adminBotController.sendMessageToAdmin('123456789', message);

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();
    });

    test('should handle messages with HTML tags', async () => {
      // Arrange
      const message = '<b>Bold</b> <i>italic</i> <code>code</code>';
      mockTelegraf.telegram = {
        sendMessage: jest.fn().mockResolvedValue({ message_id: 1 })
      };

      // Act
      await adminBotController.sendMessageToAdmin(
        '123456789',
        message,
        { parse_mode: 'HTML' }
      );

      // Assert
      expect(mockTelegraf.telegram.sendMessage).toHaveBeenCalled();
    });

    test('should handle empty message list in broadcast', async () => {
      // Act
      const results = await adminBotController.broadcastMessage([], 'Test');

      // Assert
      expect(results).toHaveLength(0);
    });
  });
});
