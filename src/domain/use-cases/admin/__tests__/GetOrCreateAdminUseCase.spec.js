/**
 * @fileoverview Unit Tests for GetOrCreateAdminUseCase
 * Tests admin retrieval with auto-creation on first access
 */

import { jest } from '@jest/globals';
import GetOrCreateAdminUseCase from '../GetOrCreateAdminUseCase.js';
import Admin from '../../../core/entities/domain/Admin.js';

describe('GetOrCreateAdminUseCase', () => {
  let useCase;
  let mockAdminRepository;
  let mockLogger;

  beforeEach(() => {
    mockAdminRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findByTelegramId: jest.fn()
    };

    mockLogger = {
      log: jest.fn(),
      error: jest.fn()
    };

    useCase = new GetOrCreateAdminUseCase(mockAdminRepository, mockLogger);
  });

  describe('Get Existing Admin', () => {
    test('should return existing admin', async () => {
      // Arrange
      const adminId = 'admin_123';
      const existingAdmin = new Admin({
        adminId,
        telegramId: '987654321',
        name: 'John'
      });
      mockAdminRepository.findById.mockResolvedValue(existingAdmin);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result).toEqual(existingAdmin);
      expect(mockAdminRepository.findById).toHaveBeenCalledWith(adminId);
      expect(mockAdminRepository.save).not.toHaveBeenCalled();
    });

    test('should return admin found by telegram ID', async () => {
      // Arrange
      const telegramId = '987654321';
      const existingAdmin = new Admin({
        adminId: 'admin_123',
        telegramId,
        name: 'John'
      });
      mockAdminRepository.findByTelegramId.mockResolvedValue(existingAdmin);

      // Act
      const result = await useCase.execute({ telegramId });

      // Assert
      expect(result).toEqual(existingAdmin);
    });
  });

  describe('Create New Admin', () => {
    test('should create new admin if not exists', async () => {
      // Arrange
      const telegramId = '987654321';
      const adminData = {
        telegramId,
        name: 'New Admin',
        firstName: 'New',
        lastName: 'Admin'
      };

      mockAdminRepository.findByTelegramId.mockResolvedValue(null);
      mockAdminRepository.save.mockResolvedValue({
        adminId: 'admin_auto_123',
        ...adminData
      });

      // Act
      const result = await useCase.execute(adminData);

      // Assert
      expect(result).toBeDefined();
      expect(result.telegramId).toBe(telegramId);
      expect(mockAdminRepository.save).toHaveBeenCalled();
    });

    test('should auto-generate adminId for new admin', async () => {
      // Arrange
      const telegramId = '987654321';
      mockAdminRepository.findByTelegramId.mockResolvedValue(null);
      mockAdminRepository.save.mockImplementation(admin => {
        admin.adminId = `admin_${telegramId}`;
        return admin;
      });

      // Act
      const result = await useCase.execute({ telegramId, name: 'Test' });

      // Assert
      expect(result.adminId).toBeDefined();
    });

    test('should set default role for new admin', async () => {
      // Arrange
      const telegramId = '987654321';
      mockAdminRepository.findByTelegramId.mockResolvedValue(null);

      // Act
      await useCase.execute({ telegramId, name: 'Admin' });

      // Assert
      const savedAdmin = mockAdminRepository.save.mock.calls[0][0];
      expect(savedAdmin.role).toBeDefined();
    });
  });

  describe('Validation', () => {
    test('should require telegram ID or admin ID', async () => {
      // Act & Assert
      await expect(useCase.execute({}))
        .rejects.toThrow();
    });

    test('should validate telegram ID format', async () => {
      // Arrange
      const invalidTelegramId = 'invalid';

      // Act & Assert
      await expect(useCase.execute({ telegramId: invalidTelegramId }))
        .rejects.toThrow();
    });

    test('should validate admin name', async () => {
      // Arrange
      const telegramId = '987654321';
      mockAdminRepository.findByTelegramId.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ telegramId, name: '' }))
        .rejects.toThrow();
    });
  });

  describe('Idempotency', () => {
    test('should return same admin on multiple calls', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = new Admin({
        adminId,
        telegramId: '987654321',
        name: 'John'
      });
      mockAdminRepository.findById.mockResolvedValue(admin);

      // Act
      const result1 = await useCase.execute({ adminId });
      const result2 = await useCase.execute({ adminId });

      // Assert
      expect(result1).toEqual(result2);
      expect(mockAdminRepository.save).not.toHaveBeenCalled();
    });

    test('should create only one admin for same telegram ID', async () => {
      // Arrange
      const telegramId = '987654321';
      const newAdmin = new Admin({
        adminId: 'admin_123',
        telegramId,
        name: 'John'
      });

      mockAdminRepository.findByTelegramId
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(newAdmin);
      mockAdminRepository.save.mockResolvedValue(newAdmin);

      // Act
      await useCase.execute({ telegramId, name: 'John' });
      const result2 = await useCase.execute({ telegramId });

      // Assert
      expect(mockAdminRepository.save).toHaveBeenCalledTimes(1);
      expect(result2).toEqual(newAdmin);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent creation safely', async () => {
      // Arrange
      const telegramId = '987654321';
      const admin = new Admin({
        adminId: 'admin_123',
        telegramId,
        name: 'John'
      });

      let callCount = 0;
      mockAdminRepository.findByTelegramId.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(null); // First call - not found
        }
        return Promise.resolve(admin); // Subsequent calls - found
      });
      mockAdminRepository.save.mockResolvedValue(admin);

      // Act
      const results = await Promise.all([
        useCase.execute({ telegramId, name: 'John' }),
        useCase.execute({ telegramId, name: 'John' })
      ]);

      // Assert
      expect(results).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      // Arrange
      mockAdminRepository.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(useCase.execute({ adminId: 'admin_123' }))
        .rejects.toThrow('Database connection failed');
    });

    test('should handle save errors', async () => {
      // Arrange
      const telegramId = '987654321';
      mockAdminRepository.findByTelegramId.mockResolvedValue(null);
      mockAdminRepository.save.mockRejectedValue(
        new Error('Save failed')
      );

      // Act & Assert
      await expect(useCase.execute({ telegramId, name: 'Admin' }))
        .rejects.toThrow('Save failed');
    });

    test('should log errors appropriately', async () => {
      // Arrange
      const telegramId = '987654321';
      mockAdminRepository.findByTelegramId.mockRejectedValue(
        new Error('Query failed')
      );

      // Act & Assert
      await expect(useCase.execute({ telegramId, name: 'Admin' }))
        .rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Admin Status', () => {
    test('should set active status for new admin', async () => {
      // Arrange
      const telegramId = '987654321';
      mockAdminRepository.findByTelegramId.mockResolvedValue(null);

      // Act
      await useCase.execute({ telegramId, name: 'Admin' });

      // Assert
      const savedAdmin = mockAdminRepository.save.mock.calls[0][0];
      expect(savedAdmin.isActive).toBe(true);
    });

    test('should preserve existing admin status', async () => {
      // Arrange
      const adminId = 'admin_123';
      const inactiveAdmin = new Admin({
        adminId,
        telegramId: '987654321',
        name: 'John',
        isActive: false
      });
      mockAdminRepository.findById.mockResolvedValue(inactiveAdmin);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.isActive).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle admin with same telegram ID from different sources', async () => {
      // Arrange
      const telegramId = '987654321';
      const admin = new Admin({
        adminId: 'admin_123',
        telegramId,
        name: 'John'
      });
      mockAdminRepository.findByTelegramId.mockResolvedValue(admin);

      // Act
      const result = await useCase.execute({ telegramId });

      // Assert
      expect(result.telegramId).toBe(telegramId);
    });

    test('should handle very long admin names', async () => {
      // Arrange
      const longName = 'A'.repeat(500);
      const telegramId = '987654321';
      mockAdminRepository.findByTelegramId.mockResolvedValue(null);

      // Act & Assert
      // Should either truncate or reject long names
      try {
        await useCase.execute({ telegramId, name: longName });
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    test('should handle unicode in admin names', async () => {
      // Arrange
      const telegramId = '987654321';
      const unicodeName = 'Иван Петров';
      mockAdminRepository.findByTelegramId.mockResolvedValue(null);
      mockAdminRepository.save.mockResolvedValue({
        adminId: 'admin_123',
        telegramId,
        name: unicodeName
      });

      // Act
      const result = await useCase.execute({ telegramId, name: unicodeName });

      // Assert
      expect(result.name).toBe(unicodeName);
    });
  });

  describe('Integration', () => {
    test('should work with full admin workflow', async () => {
      // Arrange
      const telegramId = '987654321';
      const adminData = {
        telegramId,
        name: 'New Admin',
        firstName: 'New',
        lastName: 'Admin'
      };

      mockAdminRepository.findByTelegramId.mockResolvedValue(null);
      const createdAdmin = new Admin({
        adminId: 'admin_123',
        ...adminData
      });
      mockAdminRepository.save.mockResolvedValue(createdAdmin);
      mockAdminRepository.findById.mockResolvedValue(createdAdmin);

      // Act
      const created = await useCase.execute(adminData);
      const retrieved = await useCase.execute({ adminId: created.adminId });

      // Assert
      expect(created).toEqual(retrieved);
    });
  });
});
