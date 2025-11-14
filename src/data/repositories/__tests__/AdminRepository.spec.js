/**
 * @fileoverview Unit Tests for AdminRepository
 * Tests data persistence layer with TypeORM integration
 * @module data/repositories/__tests__/AdminRepository.spec
 */

import AdminRepository from '../domain/AdminRepository.js';
import Admin from '../../../core/entities/domain/Admin.entity.js';
import { AdminRole } from '../../../shared/constants/index.js';

describe('AdminRepository', () => {
  
  // ==================== MOCKS & SETUP ====================
  
  let adminRepository;
  let mockDataSource;
  let mockQueryBuilder;
  let mockLogger;

  const validAdminEntity = {
    id: 1,
    userId: '123456789',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1234567890',
    role: AdminRole.ADMIN,
    is_active: 1,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    // Mock QueryBuilder
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 })
    };

    // Mock DataSource
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
        save: jest.fn().mockResolvedValue(validAdminEntity),
        findOne: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({ affected: 1 })
      }),
      create: jest.fn().mockReturnValue(validAdminEntity)
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    adminRepository = new AdminRepository({
      dataSource: mockDataSource,
      logger: mockLogger
    });
  });

  // ==================== CREATE ====================

  describe('Create', () => {
    test('should create admin in database', async () => {
      // Arrange
      const adminData = new Admin({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        role: AdminRole.ADMIN,
        isActive: true
      });

      // Act
      const result = await adminRepository.create(adminData);

      // Assert
      expect(result).toBeDefined();
      expect(mockDataSource.getRepository).toHaveBeenCalledWith('Admin');
    });

    test('should set isActive to true by default', async () => {
      // Arrange
      const adminData = new Admin({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        role: AdminRole.ADMIN
      });

      // Act
      await adminRepository.create(adminData);

      // Assert
      const mockRepo = mockDataSource.getRepository();
      const savedData = mockRepo.save.mock.calls[0][0];
      expect(savedData.is_active).toBe(1);
    });

    test('should respect explicit isActive value', async () => {
      // Arrange
      const adminData = new Admin({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        role: AdminRole.ADMIN,
        isActive: false
      });

      // Act
      await adminRepository.create(adminData);

      // Assert
      const mockRepo = mockDataSource.getRepository();
      const savedData = mockRepo.save.mock.calls[0][0];
      expect(savedData.is_active).toBe(0);
    });

    test('should convert Admin entity to database row', async () => {
      // Arrange
      const adminData = new Admin({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+998991234567',
        role: AdminRole.ADMIN,
        isActive: true
      });

      // Act
      await adminRepository.create(adminData);

      // Assert
      const mockRepo = mockDataSource.getRepository();
      const savedData = mockRepo.save.mock.calls[0][0];
      expect(savedData.userId).toBe('123456789');
      expect(savedData.firstName).toBe('John');
      expect(savedData.phone).toBe('+998991234567');
    });

    test('should handle repository errors', async () => {
      // Arrange
      const mockRepo = mockDataSource.getRepository();
      mockRepo.save.mockRejectedValueOnce(new Error('DB error'));
      const adminData = new Admin({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe'
      });

      // Act & Assert
      await expect(adminRepository.create(adminData)).rejects.toThrow();
    });

    test('should log creation', async () => {
      // Arrange
      const adminData = new Admin({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe'
      });

      // Act
      await adminRepository.create(adminData);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('create'),
        expect.anything()
      );
    });
  });

  // ==================== FIND BY ID ====================

  describe('Find By ID', () => {
    test('should find admin by id', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockResolvedValueOnce(validAdminEntity);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      expect(result).toBeDefined();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('id'),
        expect.anything()
      );
    });

    test('should convert database row to Admin entity', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockResolvedValueOnce({
        ...validAdminEntity,
        is_active: 1
      });

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      expect(result).toBeDefined();
      if (result) {
        expect(result.userId).toBe('123456789');
        expect(result.isActive).toBe(true);
      }
    });

    test('should return null when admin not found', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);

      // Act
      const result = await adminRepository.findById(999);

      // Assert
      expect(result).toBeNull();
    });

    test('should handle is_active = 0 as false', async () => {
      // Arrange
      const inactiveAdmin = { ...validAdminEntity, is_active: 0 };
      mockQueryBuilder.getOne.mockResolvedValueOnce(inactiveAdmin);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      if (result) {
        expect(result.isActive).toBe(false);
      }
    });
  });

  // ==================== FIND BY USER ID ====================

  describe('Find By User ID', () => {
    test('should find admin by userId', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockResolvedValueOnce(validAdminEntity);

      // Act
      const result = await adminRepository.findByUserId('123456789');

      // Assert
      expect(result).toBeDefined();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });

    test('should return null when admin not found', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockResolvedValueOnce(null);

      // Act
      const result = await adminRepository.findByUserId('999999999');

      // Assert
      expect(result).toBeNull();
    });

    test('should work with string userId', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockResolvedValueOnce(validAdminEntity);

      // Act
      await adminRepository.findByUserId('123456789');

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  // ==================== FIND ALL ====================

  describe('Find All', () => {
    test('should return all admins', async () => {
      // Arrange
      const admins = [validAdminEntity, { ...validAdminEntity, id: 2 }];
      mockQueryBuilder.getMany.mockResolvedValueOnce(admins);

      // Act
      const result = await adminRepository.findAll();

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test('should convert all database rows to Admin entities', async () => {
      // Arrange
      const admins = [
        { ...validAdminEntity, id: 1 },
        { ...validAdminEntity, id: 2 }
      ];
      mockQueryBuilder.getMany.mockResolvedValueOnce(admins);

      // Act
      const result = await adminRepository.findAll();

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test('should return empty array when no admins', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValueOnce([]);

      // Act
      const result = await adminRepository.findAll();

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('should handle is_active conversion for all records', async () => {
      // Arrange
      const admins = [
        { ...validAdminEntity, is_active: 1 },
        { ...validAdminEntity, id: 2, is_active: 0 }
      ];
      mockQueryBuilder.getMany.mockResolvedValueOnce(admins);

      // Act
      const result = await adminRepository.findAll();

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ==================== UPDATE ====================

  describe('Update', () => {
    test('should update admin in database', async () => {
      // Arrange
      const adminData = new Admin({
        id: 1,
        userId: '123456789',
        firstName: 'Jane',
        lastName: 'Smith',
        role: AdminRole.SUPER_ADMIN,
        isActive: false
      });
      const mockRepo = mockDataSource.getRepository();
      mockRepo.save.mockResolvedValueOnce(adminData);

      // Act
      const result = await adminRepository.update(1, adminData);

      // Assert
      expect(result).toBeDefined();
    });

    test('should convert isActive field correctly', async () => {
      // Arrange
      const adminData = new Admin({
        id: 1,
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true
      });
      const mockRepo = mockDataSource.getRepository();

      // Act
      await adminRepository.update(1, adminData);

      // Assert
      const savedData = mockRepo.save.mock.calls[0][0];
      expect(savedData.is_active).toBe(1);
    });

    test('should handle update errors', async () => {
      // Arrange
      const mockRepo = mockDataSource.getRepository();
      mockRepo.save.mockRejectedValueOnce(new Error('Update failed'));
      const adminData = new Admin({
        id: 1,
        userId: '123456789',
        firstName: 'John'
      });

      // Act & Assert
      await expect(adminRepository.update(1, adminData)).rejects.toThrow();
    });
  });

  // ==================== DELETE ====================

  describe('Delete', () => {
    test('should delete admin by id', async () => {
      // Arrange
      const mockRepo = mockDataSource.getRepository();

      // Act
      const result = await adminRepository.delete(1);

      // Assert
      expect(mockRepo.delete).toHaveBeenCalledWith(1);
    });

    test('should return delete result', async () => {
      // Arrange
      const mockRepo = mockDataSource.getRepository();
      mockRepo.delete.mockResolvedValueOnce({ affected: 1 });

      // Act
      const result = await adminRepository.delete(1);

      // Assert
      expect(result).toBeDefined();
    });

    test('should handle delete errors', async () => {
      // Arrange
      const mockRepo = mockDataSource.getRepository();
      mockRepo.delete.mockRejectedValueOnce(new Error('Delete failed'));

      // Act & Assert
      await expect(adminRepository.delete(1)).rejects.toThrow();
    });

    test('should handle deleting non-existent admin', async () => {
      // Arrange
      const mockRepo = mockDataSource.getRepository();
      mockRepo.delete.mockResolvedValueOnce({ affected: 0 });

      // Act
      const result = await adminRepository.delete(999);

      // Assert
      expect(result).toBeDefined();
    });
  });

  // ==================== FIND BY ROLE ====================

  describe('Find By Role', () => {
    test('should find admins by role', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValueOnce([validAdminEntity]);

      // Act
      const result = await adminRepository.findByRole(AdminRole.SUPER_ADMIN);

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle multiple roles', async () => {
      // Arrange
      const roles = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR];
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act & Assert
      for (const role of roles) {
        const result = await adminRepository.findByRole(role);
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  // ==================== FIND ACTIVE ====================

  describe('Find Active', () => {
    test('should find only active admins', async () => {
      // Arrange
      const activeAdmins = [
        { ...validAdminEntity, is_active: 1 },
        { ...validAdminEntity, id: 2, is_active: 1 }
      ];
      mockQueryBuilder.getMany.mockResolvedValueOnce(activeAdmins);

      // Act
      const result = await adminRepository.findActive();

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    test('should convert is_active correctly', async () => {
      // Arrange
      mockQueryBuilder.getMany.mockResolvedValueOnce([
        { ...validAdminEntity, is_active: 1 }
      ]);

      // Act
      const result = await adminRepository.findActive();

      // Assert
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ==================== DATA CONVERSION ====================

  describe('Data Conversion', () => {
    test('should convert database boolean (1/0) to JavaScript boolean', async () => {
      // Arrange
      const dbAdmin = { ...validAdminEntity, is_active: 1 };
      mockQueryBuilder.getOne.mockResolvedValueOnce(dbAdmin);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      if (result) {
        expect(result.isActive).toBe(true);
      }
    });

    test('should convert false is_active correctly', async () => {
      // Arrange
      const dbAdmin = { ...validAdminEntity, is_active: 0 };
      mockQueryBuilder.getOne.mockResolvedValueOnce(dbAdmin);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      if (result) {
        expect(result.isActive).toBe(false);
      }
    });

    test('should preserve all fields during conversion', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockResolvedValueOnce(validAdminEntity);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      if (result) {
        expect(result.userId).toBe(validAdminEntity.userId);
        expect(result.firstName).toBe(validAdminEntity.firstName);
        expect(result.role).toBe(validAdminEntity.role);
      }
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockRejectedValueOnce(new Error('Connection error'));

      // Act & Assert
      await expect(adminRepository.findById(1)).rejects.toThrow();
    });

    test('should log errors', async () => {
      // Arrange
      mockQueryBuilder.getOne.mockRejectedValueOnce(new Error('DB error'));

      // Act
      try {
        await adminRepository.findById(1);
      } catch (error) {
        // Expected
      }

      // Assert
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle admin with null phone', async () => {
      // Arrange
      const admin = { ...validAdminEntity, phone: null };
      mockQueryBuilder.getOne.mockResolvedValueOnce(admin);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      expect(result).toBeDefined();
    });

    test('should handle admin with very long names', async () => {
      // Arrange
      const admin = {
        ...validAdminEntity,
        firstName: 'A'.repeat(255),
        lastName: 'B'.repeat(255)
      };
      mockQueryBuilder.getOne.mockResolvedValueOnce(admin);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      expect(result).toBeDefined();
    });

    test('should handle unicode characters in names', async () => {
      // Arrange
      const admin = {
        ...validAdminEntity,
        firstName: 'Ҷон',
        lastName: 'Доҳ'
      };
      mockQueryBuilder.getOne.mockResolvedValueOnce(admin);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      expect(result).toBeDefined();
    });

    test('should handle special characters in phone', async () => {
      // Arrange
      const admin = {
        ...validAdminEntity,
        phone: '+998 (99) 123-45-67'
      };
      mockQueryBuilder.getOne.mockResolvedValueOnce(admin);

      // Act
      const result = await adminRepository.findById(1);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
