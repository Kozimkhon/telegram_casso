/**
 * @fileoverview Unit Tests for Admin Use Cases
 * Tests application-layer logic for admin domain operations
 * @module domain/use-cases/admin/__tests__/AddAdminUseCase.spec
 */

import AddAdminUseCase from '../AddAdminUseCase.js';
import Admin from '../../../../core/entities/domain/Admin.entity.js';
import { AdminRole } from '../../../../shared/constants/index.js';

describe('AddAdminUseCase', () => {
  
  // ==================== MOCKS & SETUP ====================
  
  let addAdminUseCase;
  let mockAdminRepository;
  let mockLogger;

  const validAdminData = {
    userId: '123456789',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    role: AdminRole.ADMIN
  };

  beforeEach(() => {
    mockAdminRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1, ...validAdminData, isActive: true }),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    addAdminUseCase = new AddAdminUseCase({
      adminRepository: mockAdminRepository,
      logger: mockLogger
    });
  });

  // ==================== SUCCESSFUL EXECUTION ====================

  describe('Successful Execution', () => {
    test('should create admin with valid data', async () => {
      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.admin).toBeDefined();
      expect(result.message).toContain('successfully');
      expect(mockAdminRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: validAdminData.userId,
          firstName: validAdminData.firstName
        })
      );
    });

    test('should set isActive to true by default', async () => {
      // Arrange
      const dataWithoutIsActive = { ...validAdminData };
      delete dataWithoutIsActive.isActive;

      // Act
      await addAdminUseCase.execute(dataWithoutIsActive);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs.isActive).toBe(true);
    });

    test('should respect explicit isActive value', async () => {
      // Arrange
      const dataWithIsActive = { ...validAdminData, isActive: false };

      // Act
      await addAdminUseCase.execute(dataWithIsActive);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs.isActive).toBe(false);
    });

    test('should default to ADMIN role when not specified', async () => {
      // Arrange
      const dataWithoutRole = { ...validAdminData };
      delete dataWithoutRole.role;

      // Act
      await addAdminUseCase.execute(dataWithoutRole);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs.role).toBe(AdminRole.ADMIN);
    });

    test('should return created admin entity', async () => {
      // Arrange
      const expectedAdmin = new Admin({ ...validAdminData, isActive: true });
      mockAdminRepository.create.mockResolvedValueOnce(expectedAdmin);

      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result.admin).toBe(expectedAdmin);
    });

    test('should log successful admin creation', async () => {
      // Act
      await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Admin added'),
        expect.anything()
      );
    });
  });

  // ==================== VALIDATION ====================

  describe('Validation', () => {
    test('should reject missing userId', async () => {
      // Arrange
      const invalidData = { ...validAdminData };
      delete invalidData.userId;

      // Act
      const result = await addAdminUseCase.execute(invalidData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('userId');
      expect(mockAdminRepository.create).not.toHaveBeenCalled();
    });

    test('should reject missing firstName', async () => {
      // Arrange
      const invalidData = { ...validAdminData };
      delete invalidData.firstName;

      // Act
      const result = await addAdminUseCase.execute(invalidData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('firstName');
    });

    test('should reject non-numeric userId', async () => {
      // Arrange
      const invalidData = { ...validAdminData, userId: 'invalid' };

      // Act
      const result = await addAdminUseCase.execute(invalidData);

      // Assert
      expect(result.success).toBe(false);
    });

    test('should accept valid phone number formats', async () => {
      // Arrange
      const validPhones = [
        '+1234567890',
        '1234567890',
        '+998 99 123 45 67'
      ];

      // Act & Assert
      for (const phone of validPhones) {
        mockAdminRepository.create.mockClear();
        const data = { ...validAdminData, phone };
        const result = await addAdminUseCase.execute(data);
        expect(result.success).toBe(true);
      }
    });

    test('should reject invalid role values', async () => {
      // Arrange
      const invalidData = { ...validAdminData, role: 'INVALID_ROLE' };

      // Act
      const result = await addAdminUseCase.execute(invalidData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('role');
    });
  });

  // ==================== DUPLICATE PREVENTION ====================

  describe('Duplicate Prevention', () => {
    test('should reject duplicate userId', async () => {
      // Arrange
      const existingAdmin = new Admin(validAdminData);
      mockAdminRepository.findByUserId.mockResolvedValueOnce(existingAdmin);

      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(mockAdminRepository.create).not.toHaveBeenCalled();
    });

    test('should check repository for duplicate before creating', async () => {
      // Act
      await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(mockAdminRepository.findByUserId).toHaveBeenCalledWith(validAdminData.userId);
    });

    test('should allow new userId if not in repository', async () => {
      // Arrange
      mockAdminRepository.findByUserId.mockResolvedValueOnce(null);

      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result.success).toBe(true);
      expect(mockAdminRepository.create).toHaveBeenCalled();
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    test('should handle repository errors', async () => {
      // Arrange
      mockAdminRepository.create.mockRejectedValueOnce(new Error('DB error'));

      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('error');
    });

    test('should log errors', async () => {
      // Arrange
      const error = new Error('DB error');
      mockAdminRepository.create.mockRejectedValueOnce(error);

      // Act
      await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should return null admin on error', async () => {
      // Arrange
      mockAdminRepository.create.mockRejectedValueOnce(new Error('DB error'));

      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result.admin).toBeNull();
    });

    test('should not throw exceptions', async () => {
      // Arrange
      mockAdminRepository.create.mockRejectedValueOnce(new Error('Catastrophic error'));

      // Act & Assert
      await expect(addAdminUseCase.execute(validAdminData)).resolves.toBeDefined();
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle unicode characters in names', async () => {
      // Arrange
      const data = {
        ...validAdminData,
        firstName: 'Ҷон',
        lastName: 'Доҳ'
      };

      // Act
      const result = await addAdminUseCase.execute(data);

      // Assert
      expect(result.success).toBe(true);
    });

    test('should handle very long names', async () => {
      // Arrange
      const data = {
        ...validAdminData,
        firstName: 'A'.repeat(255),
        lastName: 'B'.repeat(255)
      };

      // Act
      const result = await addAdminUseCase.execute(data);

      // Assert
      expect(result.success).toBe(true);
    });

    test('should trim whitespace from strings', async () => {
      // Arrange
      const data = {
        ...validAdminData,
        firstName: '  John  ',
        lastName: '  Doe  '
      };

      // Act
      await addAdminUseCase.execute(data);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs.firstName).toBe('John');
      expect(callArgs.lastName).toBe('Doe');
    });

    test('should handle special characters in phone', async () => {
      // Arrange
      const data = {
        ...validAdminData,
        phone: '+998 (99) 123-45-67'
      };

      // Act
      const result = await addAdminUseCase.execute(data);

      // Assert
      expect(result.success).toBe(true);
    });

    test('should accept null optional fields', async () => {
      // Arrange
      const data = {
        ...validAdminData,
        phone: null,
        lastName: null
      };

      // Act
      const result = await addAdminUseCase.execute(data);

      // Assert
      expect(result.success).toBe(true);
    });

    test('should handle very large userId numbers', async () => {
      // Arrange
      const data = {
        ...validAdminData,
        userId: '999999999999999999'
      };

      // Act
      const result = await addAdminUseCase.execute(data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ==================== DATA TRANSFORMATION ====================

  describe('Data Transformation', () => {
    test('should create Admin entity from input data', async () => {
      // Act
      await addAdminUseCase.execute(validAdminData);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs).toBeInstanceOf(Admin);
    });

    test('should preserve all input fields', async () => {
      // Arrange
      const inputData = {
        ...validAdminData,
        extraField: 'should be ignored'
      };

      // Act
      await addAdminUseCase.execute(inputData);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs.userId).toBe(inputData.userId);
      expect(callArgs.firstName).toBe(inputData.firstName);
    });

    test('should set timestamps on creation', async () => {
      // Act
      await addAdminUseCase.execute(validAdminData);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs.createdAt).toBeDefined();
    });
  });

  // ==================== RESPONSE FORMAT ====================

  describe('Response Format', () => {
    test('should return object with success flag', async () => {
      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    test('should include message in response', async () => {
      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result).toHaveProperty('message');
      expect(typeof result.message).toBe('string');
    });

    test('should include admin in response on success', async () => {
      // Act
      const result = await addAdminUseCase.execute(validAdminData);

      // Assert
      expect(result).toHaveProperty('admin');
      expect(result.admin).toBeDefined();
    });

    test('should have null admin on failure', async () => {
      // Arrange
      const invalidData = { ...validAdminData };
      delete invalidData.userId;

      // Act
      const result = await addAdminUseCase.execute(invalidData);

      // Assert
      expect(result.admin).toBeNull();
    });
  });

  // ==================== ROLE MANAGEMENT ====================

  describe('Role Management', () => {
    test('should accept all valid admin roles', async () => {
      // Arrange
      const roles = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR];

      // Act & Assert
      for (const role of roles) {
        mockAdminRepository.create.mockClear();
        const data = { ...validAdminData, role };
        const result = await addAdminUseCase.execute(data);
        expect(result.success).toBe(true);
      }
    });

    test('should use ADMIN role as default', async () => {
      // Arrange
      const dataWithoutRole = { ...validAdminData };
      delete dataWithoutRole.role;

      // Act
      await addAdminUseCase.execute(dataWithoutRole);

      // Assert
      const callArgs = mockAdminRepository.create.mock.calls[0][0];
      expect(callArgs.role).toBe(AdminRole.ADMIN);
    });
  });
});
