/**
 * @fileoverview Unit Tests for RemoveAdminUseCase
 * Tests admin removal with verification and cleanup
 */

import RemoveAdminUseCase from '../RemoveAdminUseCase.js';

describe('RemoveAdminUseCase', () => {
  let useCase;
  let mockAdminRepository;
  let mockSessionRepository;
  let mockLogger;

  beforeEach(() => {
    mockAdminRepository = {
      findById: jest.fn(),
      delete: jest.fn(),
      getAll: jest.fn()
    };

    mockSessionRepository = {
      findByAdminId: jest.fn(),
      delete: jest.fn()
    };

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    useCase = new RemoveAdminUseCase(
      mockAdminRepository,
      mockSessionRepository,
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

  describe('Admin Removal', () => {
    test('should remove existing admin', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.delete.mockResolvedValue(true);
      mockSessionRepository.findByAdminId.mockResolvedValue([]);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.success).toBe(true);
      expect(mockAdminRepository.delete).toHaveBeenCalledWith(adminId);
    });

    test('should throw error when admin not found', async () => {
      // Arrange
      mockAdminRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ adminId: 'invalid' }))
        .rejects.toThrow();
    });

    test('should verify admin exists before deletion', async () => {
      // Arrange
      const adminId = 'admin_123';
      mockAdminRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ adminId }))
        .rejects.toThrow('Admin not found');
      expect(mockAdminRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('Session Cleanup', () => {
    test('should cleanup sessions for removed admin', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const sessions = [
        { sessionId: 'sess_1', adminId },
        { sessionId: 'sess_2', adminId }
      ];

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue(sessions);
      mockSessionRepository.delete.mockResolvedValue(true);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(mockSessionRepository.delete).toHaveBeenCalledTimes(2);
      expect(result.sessionsRemoved).toBe(2);
    });

    test('should handle removal with no sessions', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue([]);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.sessionsRemoved).toBe(0);
      expect(result.success).toBe(true);
    });

    test('should continue removal if session cleanup fails', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const sessions = [{ sessionId: 'sess_1', adminId }];

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue(sessions);
      mockSessionRepository.delete.mockRejectedValue(new Error('Cleanup failed'));
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Verification & Safety', () => {
    test('should require admin ID', async () => {
      // Act & Assert
      await expect(useCase.execute({}))
        .rejects.toThrow();
    });

    test('should prevent removal of last admin', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.getAll.mockResolvedValue([admin]); // Only one admin

      // Act & Assert
      await expect(useCase.execute({ adminId, confirmLastAdmin: false }))
        .rejects.toThrow();
    });

    test('should allow last admin removal with confirmation', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.getAll.mockResolvedValue([admin]);
      mockSessionRepository.findByAdminId.mockResolvedValue([]);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({
        adminId,
        confirmLastAdmin: true
      });

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('Admin Count Checks', () => {
    test('should calculate remaining admins count', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const allAdmins = [
        { adminId: 'admin_1' },
        { adminId: 'admin_2' },
        { adminId: 'admin_123' }
      ];

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.getAll.mockResolvedValue(allAdmins);
      mockSessionRepository.findByAdminId.mockResolvedValue([]);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.remainingAdmins).toBe(2);
    });

    test('should return warning when removing admin from small team', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const allAdmins = [
        { adminId: 'admin_1' },
        { adminId: 'admin_123' }
      ];

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockAdminRepository.getAll.mockResolvedValue(allAdmins);
      mockSessionRepository.findByAdminId.mockResolvedValue([]);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Cascading Changes', () => {
    test('should log removal with affected resources count', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const sessions = [
        { sessionId: 'sess_1' },
        { sessionId: 'sess_2' }
      ];

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue(sessions);
      mockSessionRepository.delete.mockResolvedValue(true);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      await useCase.execute({ adminId });

      // Assert
      expect(mockLogger.log).toHaveBeenCalled();
      const logCall = mockLogger.log.mock.calls[0][0];
      expect(logCall).toContain('removed');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Arrange
      mockAdminRepository.findById.mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(useCase.execute({ adminId: 'admin_123' }))
        .rejects.toThrow('Database error');
    });

    test('should handle deletion errors', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue([]);
      mockAdminRepository.delete.mockRejectedValue(
        new Error('Deletion failed')
      );

      // Act & Assert
      await expect(useCase.execute({ adminId }))
        .rejects.toThrow('Deletion failed');
    });
  });

  describe('Return Value', () => {
    test('should return detailed removal summary', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John Doe' };
      const sessions = [{ sessionId: 'sess_1' }];

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue(sessions);
      mockSessionRepository.delete.mockResolvedValue(true);
      mockAdminRepository.delete.mockResolvedValue(true);
      mockAdminRepository.getAll.mockResolvedValue([
        { adminId: 'admin_1' },
        { adminId: 'admin_2' }
      ]);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('adminId');
      expect(result).toHaveProperty('sessionsRemoved');
      expect(result).toHaveProperty('remainingAdmins');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('Edge Cases', () => {
    test('should handle admin ID with special characters', async () => {
      // Arrange
      const adminId = 'admin_123-abc_def';
      const admin = { adminId, name: 'John' };

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue([]);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.success).toBe(true);
    });

    test('should handle removal of admin with many sessions', async () => {
      // Arrange
      const adminId = 'admin_123';
      const admin = { adminId, name: 'John' };
      const sessions = Array.from({ length: 100 }, (_, i) => ({
        sessionId: `sess_${i}`
      }));

      mockAdminRepository.findById.mockResolvedValue(admin);
      mockSessionRepository.findByAdminId.mockResolvedValue(sessions);
      mockSessionRepository.delete.mockResolvedValue(true);
      mockAdminRepository.delete.mockResolvedValue(true);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.sessionsRemoved).toBe(100);
    });
  });

  describe('Idempotency', () => {
    test('should fail on second removal attempt', async () => {
      // Arrange
      const adminId = 'admin_123';

      mockAdminRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ adminId }))
        .rejects.toThrow();
    });
  });
});
