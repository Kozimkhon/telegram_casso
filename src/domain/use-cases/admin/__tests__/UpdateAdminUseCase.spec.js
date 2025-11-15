/**
 * @fileoverview Unit Tests for UpdateAdminUseCase
 * Tests admin profile and settings updates
 */

import { jest } from '@jest/globals';
import UpdateAdminUseCase from '../UpdateAdminUseCase.js';

describe('UpdateAdminUseCase', () => {
  let useCase;
  let mockAdminRepository;
  let mockValidator;
  let mockLogger;

  beforeEach(() => {
    mockAdminRepository = {
      findById: jest.fn(),
      update: jest.fn(),
      save: jest.fn()
    };

    mockValidator = {
      validateEmail: jest.fn().mockReturnValue(true),
      validateName: jest.fn().mockReturnValue(true),
      validatePhoneNumber: jest.fn().mockReturnValue(true)
    };

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    useCase = new UpdateAdminUseCase(
      mockAdminRepository,
      mockValidator,
      mockLogger
    );
  });

  describe('Initialization', () => {
    test('should initialize with dependencies', () => {
      // Assert
      expect(useCase).toBeDefined();
      expect(useCase.adminRepository).toBe(mockAdminRepository);
    });
  });

  describe('Update Admin Profile', () => {
    test('should update admin name', async () => {
      // Arrange
      const adminId = 'admin_123';
      const existingAdmin = { adminId, name: 'Old Name' };
      const updates = { name: 'New Name' };

      mockAdminRepository.findById.mockResolvedValue(existingAdmin);
      mockValidator.validateName.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({
        ...existingAdmin,
        ...updates
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.name).toBe('New Name');
      expect(mockAdminRepository.update).toHaveBeenCalled();
    });

    test('should update multiple fields', async () => {
      // Arrange
      const adminId = 'admin_123';
      const existingAdmin = {
        adminId,
        name: 'John',
        email: 'old@example.com',
        phone: '1234567890'
      };
      const updates = {
        name: 'Jane',
        email: 'new@example.com',
        phone: '9876543210'
      };

      mockAdminRepository.findById.mockResolvedValue(existingAdmin);
      mockValidator.validateName.mockReturnValue(true);
      mockValidator.validateEmail.mockReturnValue(true);
      mockValidator.validatePhoneNumber.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({
        ...existingAdmin,
        ...updates
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.name).toBe('Jane');
      expect(result.email).toBe('new@example.com');
      expect(result.phone).toBe('9876543210');
    });

    test('should throw error if admin not found', async () => {
      // Arrange
      mockAdminRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ adminId: 'invalid', updates: {} }))
        .rejects.toThrow();
    });
  });

  describe('Validation', () => {
    test('should validate name format', async () => {
      // Arrange
      const adminId = 'admin_123';
      const updates = { name: '' };
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(false);

      // Act & Assert
      await expect(useCase.execute({ adminId, updates }))
        .rejects.toThrow();
    });

    test('should validate email format', async () => {
      // Arrange
      const adminId = 'admin_123';
      const updates = { email: 'invalid-email' };
      const admin = { adminId, email: 'old@example.com' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateEmail.mockReturnValue(false);

      // Act & Assert
      await expect(useCase.execute({ adminId, updates }))
        .rejects.toThrow();
    });

    test('should validate phone number format', async () => {
      // Arrange
      const adminId = 'admin_123';
      const updates = { phone: '123' };
      const admin = { adminId, phone: '1234567890' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validatePhoneNumber.mockReturnValue(false);

      // Act & Assert
      await expect(useCase.execute({ adminId, updates }))
        .rejects.toThrow();
    });

    test('should allow partial updates', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John', email: 'john@example.com' };
      const updates = { name: 'Jane' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        name: 'Jane'
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.name).toBe('Jane');
      expect(result.email).toBe('john@example.com');
    });
  });

  describe('Status Updates', () => {
    test('should update admin status', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, isActive: true };
      const updates = { isActive: false };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        ...updates
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.isActive).toBe(false);
    });

    test('should update admin role', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, role: 'USER' };
      const updates = { role: 'ADMIN' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        ...updates
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.role).toBe('ADMIN');
    });

    test('should validate role value', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, role: 'USER' };
      const invalidUpdates = { role: 'INVALID_ROLE' };

      mockAdminRepository.findById.mockResolvedValue(admin);

      // Act & Assert
      await expect(useCase.execute({ adminId, updates: invalidUpdates }))
        .rejects.toThrow();
    });
  });

  describe('Settings Updates', () => {
    test('should update admin settings', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = {
        adminId,
        settings: { notifications: true, autoForward: false }
      };
      const updates = { settings: { notifications: false } };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        settings: { notifications: false, autoForward: false }
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.settings.notifications).toBe(false);
      expect(result.settings.autoForward).toBe(false);
    });

    test('should merge nested settings', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = {
        adminId,
        settings: { a: 1, b: 2, c: 3 }
      };
      const updates = { settings: { b: 20 } };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        settings: { a: 1, b: 20, c: 3 }
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.settings.a).toBe(1);
      expect(result.settings.b).toBe(20);
      expect(result.settings.c).toBe(3);
    });
  });

  describe('Tracking Changes', () => {
    test('should track update timestamp', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const updates = { name: 'Jane' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);

      const updatedAdmin = {
        ...admin,
        ...updates,
        updatedAt: new Date()
      };
      mockAdminRepository.update.mockResolvedValue(updatedAdmin);

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.updatedAt).toBeDefined();
    });

    test('should log update changes', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const updates = { name: 'Jane' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({ ...admin, ...updates });

      // Act
      await useCase.execute({ adminId, updates });

      // Assert
      expect(mockLogger.log).toHaveBeenCalled();
    });

    test('should return change summary', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John', email: 'john@test.com' };
      const updates = { name: 'Jane', email: 'jane@test.com' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockValidator.validateEmail.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({ ...admin, ...updates });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.changedFields).toBeDefined();
      expect(result.changedFields).toContain('name');
      expect(result.changedFields).toContain('email');
    });
  });

  describe('Concurrent Updates', () => {
    test('should handle concurrent updates safely', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John', version: 1 };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        name: 'Jane',
        version: 2
      });

      // Act
      const result = await useCase.execute({
        adminId,
        updates: { name: 'Jane' }
      });

      // Assert
      expect(result.version).toBe(2);
    });

    test('should detect concurrent modification conflicts', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John', version: 1 };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.update.mockRejectedValue(
        new Error('Version conflict')
      );

      // Act & Assert
      await expect(
        useCase.execute({
          adminId,
          updates: { name: 'Jane' },
          expectedVersion: 2
        })
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors', async () => {
      // Arrange
      mockAdminRepository.findById.mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(useCase.execute({ adminId: 'admin_123', updates: {} }))
        .rejects.toThrow('Database error');
    });

    test('should handle update errors', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockAdminRepository.update.mockRejectedValue(
        new Error('Update failed')
      );

      // Act & Assert
      await expect(
        useCase.execute({ adminId, updates: { name: 'Jane' } })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty updates object', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.update.mockResolvedValue(admin);

      // Act
      const result = await useCase.execute({ adminId, updates: {} });

      // Assert
      expect(result).toEqual(admin);
    });

    test('should handle unicode in updated name', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const updates = { name: 'Иван Петров' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        name: 'Иван Петров'
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.name).toBe('Иван Петров');
    });

    test('should handle null in optional fields', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = {
        adminId,
        name: 'John',
        phone: '1234567890'
      };
      const updates = { phone: null };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        phone: null
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.phone).toBeNull();
    });

    test('should handle very long field values', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId };
      const longName = 'A'.repeat(1000);
      const updates = { name: longName };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockAdminRepository.update.mockResolvedValue({
        ...admin,
        name: longName
      });

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.name.length).toBe(1000);
    });
  });

  describe('Integration', () => {
    test('should work with complete update workflow', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = {
        adminId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'USER'
      };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockValidator.validateName.mockReturnValue(true);
      mockValidator.validateEmail.mockReturnValue(true);

      const updates = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'ADMIN'
      };

      const updatedAdmin = { ...admin, ...updates };
      mockAdminRepository.update.mockResolvedValue(updatedAdmin);

      // Act
      const result = await useCase.execute({ adminId, updates });

      // Assert
      expect(result.name).toBe('Jane Smith');
      expect(result.email).toBe('jane@example.com');
      expect(result.role).toBe('ADMIN');
    });
  });
});
