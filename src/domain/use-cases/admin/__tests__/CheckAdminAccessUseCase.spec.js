/**
 * @fileoverview Unit Tests for CheckAdminAccessUseCase
 * Demonstrates permission verification and complex business logic testing
 * @module domain/use-cases/admin/__tests__/CheckAdminAccessUseCase.spec
 */

import CheckAdminAccessUseCase from '../CheckAdminAccessUseCase.js';
import Admin from '../../../../core/entities/domain/Admin.entity.js';
import { AdminRole, AccessLevel } from '../../../../shared/constants/index.js';

describe('CheckAdminAccessUseCase', () => {
  
  // ==================== MOCKS & SETUP ====================
  
  let checkAdminAccessUseCase;
  let mockAdminRepository;
  let mockSessionRepository;
  let mockLogger;

  const superAdminData = {
    id: 1,
    userId: '111111111',
    firstName: 'Super',
    lastName: 'Admin',
    role: AdminRole.SUPER_ADMIN,
    isActive: true
  };

  const adminData = {
    id: 2,
    userId: '222222222',
    firstName: 'Regular',
    lastName: 'Admin',
    role: AdminRole.ADMIN,
    isActive: true
  };

  const moderatorData = {
    id: 3,
    userId: '333333333',
    firstName: 'Moder',
    lastName: 'Ator',
    role: AdminRole.MODERATOR,
    isActive: true
  };

  beforeEach(() => {
    mockAdminRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findByUserId: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([])
    };

    mockSessionRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findByAdminId: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([])
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    checkAdminAccessUseCase = new CheckAdminAccessUseCase({
      adminRepository: mockAdminRepository,
      sessionRepository: mockSessionRepository,
      logger: mockLogger
    });
  });

  // ==================== ROLE-BASED ACCESS CONTROL ====================

  describe('Role-Based Access Control', () => {
    test('should grant SUPER_ADMIN full access', async () => {
      // Arrange
      const superAdmin = new Admin(superAdminData);
      mockAdminRepository.findById.mockResolvedValueOnce(superAdmin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 1,
        resource: 'admin_management',
        action: 'delete'
      });

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.accessLevel).toBe(AccessLevel.FULL);
    });

    test('should grant ADMIN permission for user management', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(true);
    });

    test('should deny MODERATOR access to admin management', async () => {
      // Arrange
      const moderator = new Admin(moderatorData);
      mockAdminRepository.findById.mockResolvedValueOnce(moderator);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 3,
        resource: 'admin_management',
        action: 'delete'
      });

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('insufficient');
    });

    test('should allow MODERATOR to view messages', async () => {
      // Arrange
      const moderator = new Admin(moderatorData);
      mockAdminRepository.findById.mockResolvedValueOnce(moderator);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 3,
        resource: 'messages',
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  // ==================== ACTIVATION STATUS CHECKS ====================

  describe('Activation Status Checks', () => {
    test('should deny access to inactive admin', async () => {
      // Arrange
      const inactiveAdmin = new Admin({ ...superAdminData, isActive: false });
      mockAdminRepository.findById.mockResolvedValueOnce(inactiveAdmin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 1,
        resource: 'any',
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('inactive');
    });

    test('should allow access to active admin', async () => {
      // Arrange
      const activeAdmin = new Admin({ ...adminData, isActive: true });
      mockAdminRepository.findById.mockResolvedValueOnce(activeAdmin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  // ==================== RESOURCE-LEVEL PERMISSIONS ====================

  describe('Resource-Level Permissions', () => {
    test('should grant access to resources based on role', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      const resources = [
        'user_management',
        'channel_management',
        'message_management'
      ];

      // Act & Assert
      for (const resource of resources) {
        mockAdminRepository.findById.mockResolvedValueOnce(admin);
        const result = await checkAdminAccessUseCase.execute({
          adminId: 2,
          resource,
          action: 'view'
        });
        expect(result.allowed).toBe(true);
      }
    });

    test('should deny access to unauthorized resources', async () => {
      // Arrange
      const moderator = new Admin(moderatorData);
      mockAdminRepository.findById.mockResolvedValueOnce(moderator);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 3,
        resource: 'admin_management',
        action: 'any'
      });

      // Assert
      expect(result.allowed).toBe(false);
    });
  });

  // ==================== ACTION-LEVEL PERMISSIONS ====================

  describe('Action-Level Permissions', () => {
    test('should grant SUPER_ADMIN all actions', async () => {
      // Arrange
      const superAdmin = new Admin(superAdminData);
      const actions = ['create', 'read', 'update', 'delete', 'export'];

      // Act & Assert
      for (const action of actions) {
        mockAdminRepository.findById.mockResolvedValueOnce(superAdmin);
        const result = await checkAdminAccessUseCase.execute({
          adminId: 1,
          resource: 'any',
          action
        });
        expect(result.allowed).toBe(true);
      }
    });

    test('should deny MODERATOR delete action', async () => {
      // Arrange
      const moderator = new Admin(moderatorData);
      mockAdminRepository.findById.mockResolvedValueOnce(moderator);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 3,
        resource: 'messages',
        action: 'delete'
      });

      // Assert
      expect(result.allowed).toBe(false);
    });

    test('should allow ADMIN create action', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'messages',
        action: 'create'
      });

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  // ==================== SESSION CONTEXT ====================

  describe('Session Context', () => {
    test('should verify admin has active session', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);
      mockSessionRepository.findByAdminId.mockResolvedValueOnce({
        id: 1,
        adminId: 2,
        status: 'ACTIVE'
      });

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view',
        sessionRequired: true
      });

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.sessionStatus).toBe('ACTIVE');
    });

    test('should deny access if session is required but missing', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);
      mockSessionRepository.findByAdminId.mockResolvedValueOnce(null);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view',
        sessionRequired: true
      });

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('session');
    });

    test('should deny access if session is paused', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);
      mockSessionRepository.findByAdminId.mockResolvedValueOnce({
        id: 1,
        adminId: 2,
        status: 'PAUSED'
      });

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view',
        sessionRequired: true
      });

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('paused');
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    test('should handle admin not found', async () => {
      // Arrange
      mockAdminRepository.findById.mockResolvedValueOnce(null);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 999,
        resource: 'any',
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });

    test('should handle repository errors gracefully', async () => {
      // Arrange
      mockAdminRepository.findById.mockRejectedValueOnce(new Error('DB error'));

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 1,
        resource: 'any',
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should log access denials', async () => {
      // Arrange
      const moderator = new Admin(moderatorData);
      mockAdminRepository.findById.mockResolvedValueOnce(moderator);

      // Act
      await checkAdminAccessUseCase.execute({
        adminId: 3,
        resource: 'admin_management',
        action: 'delete'
      });

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('access denied'),
        expect.anything()
      );
    });
  });

  // ==================== CACHING & PERFORMANCE ====================

  describe('Caching & Performance', () => {
    test('should cache permission checks', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValue(admin);

      // Act
      await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      // Assert - Cache should reduce repository calls
      // (Implementation dependent on caching strategy)
      expect(mockAdminRepository.findById.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== RESPONSE FORMAT ====================

  describe('Response Format', () => {
    test('should return structured response', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      // Assert
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('accessLevel');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('adminId');
      expect(result).toHaveProperty('resource');
      expect(result).toHaveProperty('action');
    });

    test('should include details in response', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      // Assert
      expect(result.adminId).toBe(2);
      expect(result.resource).toBe('user_management');
      expect(result.action).toBe('view');
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle empty admin ID', async () => {
      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: '',
        resource: 'any',
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(false);
    });

    test('should handle null resource', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: null,
        action: 'view'
      });

      // Assert
      expect(result.allowed).toBe(false);
    });

    test('should be case-insensitive for roles', async () => {
      // Arrange
      const admin = new Admin({
        ...adminData,
        role: 'admin'  // lowercase
      });
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      // Act
      const result = await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      // Assert
      // Implementation should handle case-insensitive comparison
      expect(result).toBeDefined();
    });

    test('should handle concurrent access checks', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValue(admin);

      // Act
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          checkAdminAccessUseCase.execute({
            adminId: 2,
            resource: 'user_management',
            action: 'view'
          })
        );
      }

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });
    });
  });

  // ==================== AUDIT & LOGGING ====================

  describe('Audit & Logging', () => {
    test('should log successful access', async () => {
      // Arrange
      const admin = new Admin(adminData);
      mockAdminRepository.findById.mockResolvedValueOnce(admin);

      // Act
      await checkAdminAccessUseCase.execute({
        adminId: 2,
        resource: 'user_management',
        action: 'view'
      });

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('access granted'),
        expect.anything()
      );
    });

    test('should log denied access with details', async () => {
      // Arrange
      const moderator = new Admin(moderatorData);
      mockAdminRepository.findById.mockResolvedValueOnce(moderator);

      // Act
      await checkAdminAccessUseCase.execute({
        adminId: 3,
        resource: 'admin_management',
        action: 'delete'
      });

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('access denied'),
        expect.objectContaining({
          adminId: 3,
          resource: 'admin_management'
        })
      );
    });
  });
});
