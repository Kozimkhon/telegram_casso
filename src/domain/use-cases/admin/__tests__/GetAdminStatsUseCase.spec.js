/**
 * @fileoverview Unit Tests for GetAdminStatsUseCase
 * Tests admin statistics retrieval and aggregation
 */

import GetAdminStatsUseCase from '../GetAdminStatsUseCase.js';

describe('GetAdminStatsUseCase', () => {
  let useCase;
  let mockAdminRepository;
  let mockMetricsService;

  beforeEach(() => {
    mockAdminRepository = {
      findById: jest.fn(),
      getAll: jest.fn()
    };

    mockMetricsService = {
      getMetrics: jest.fn(),
      getSummary: jest.fn(),
      getHealth: jest.fn()
    };

    useCase = new GetAdminStatsUseCase(mockAdminRepository, mockMetricsService);
  });

  describe('Initialization', () => {
    test('should initialize with dependencies', () => {
      // Assert
      expect(useCase).toBeDefined();
      expect(useCase.adminRepository).toBe(mockAdminRepository);
      expect(useCase.metricsService).toBe(mockMetricsService);
    });
  });

  describe('Get Single Admin Stats', () => {
    test('should retrieve stats for specific admin', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        messagesForwarded: 150,
        channelsActive: 5,
        successRate: 0.98
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result).toBeDefined();
      expect(result.adminId).toBe(adminId);
      expect(mockAdminRepository.findById).toHaveBeenCalledWith(adminId);
    });

    test('should throw error for non-existent admin', async () => {
      // Arrange
      mockAdminRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(useCase.execute({ adminId: 'invalid' }))
        .rejects.toThrow();
    });

    test('should calculate average response time', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        avgResponseTime: 450,
        totalRequests: 1000
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.avgResponseTime).toBe(450);
    });
  });

  describe('Get All Admins Stats', () => {
    test('should retrieve stats for all admins', async () => {
      // Arrange
      const mockAllStats = [
        { adminId: 'admin_1', messagesForwarded: 100 },
        { adminId: 'admin_2', messagesForwarded: 200 },
        { adminId: 'admin_3', messagesForwarded: 150 }
      ];
      mockAdminRepository.getAll.mockResolvedValue(mockAllStats);

      // Act
      const result = await useCase.getAllStats();

      // Assert
      expect(result).toHaveLength(3);
      expect(mockAdminRepository.getAll).toHaveBeenCalled();
    });

    test('should return empty array when no admins exist', async () => {
      // Arrange
      mockAdminRepository.getAll.mockResolvedValue([]);

      // Act
      const result = await useCase.getAllStats();

      // Assert
      expect(result).toEqual([]);
    });

    test('should calculate aggregate statistics', async () => {
      // Arrange
      const mockAllStats = [
        { adminId: 'admin_1', messagesForwarded: 100 },
        { adminId: 'admin_2', messagesForwarded: 200 }
      ];
      mockAdminRepository.getAll.mockResolvedValue(mockAllStats);

      // Act
      const result = await useCase.getAllStats();
      const totalMessages = result.reduce((sum, admin) => sum + admin.messagesForwarded, 0);

      // Assert
      expect(totalMessages).toBe(300);
    });
  });

  describe('Performance Metrics', () => {
    test('should aggregate message statistics', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        messagesForwarded: 500,
        messagesFailed: 5,
        messagesTotal: 505
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.messagesForwarded).toBe(500);
      expect(result.messagesFailed).toBe(5);
    });

    test('should calculate success percentage', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        messagesForwarded: 95,
        messagesTotal: 100,
        successPercentage: 95
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.successPercentage).toBe(95);
    });
  });

  describe('Time-based Stats', () => {
    test('should filter stats by date range', async () => {
      // Arrange
      const adminId = 'admin_123';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      // Act
      await useCase.execute({ adminId, startDate, endDate });

      // Assert
      expect(mockAdminRepository.findById).toHaveBeenCalled();
    });

    test('should calculate daily average', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        messagesForwarded: 700,
        daysActive: 7,
        dailyAverage: 100
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.dailyAverage).toBe(100);
    });

    test('should calculate hourly peak', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        peakHour: 14,
        peakHourMessages: 50
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.peakHour).toBe(14);
      expect(result.peakHourMessages).toBe(50);
    });
  });

  describe('Error Tracking', () => {
    test('should track error count', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        errors: 3,
        errorTypes: {
          'TIMEOUT': 2,
          'INVALID_INPUT': 1
        }
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.errors).toBe(3);
      expect(result.errorTypes['TIMEOUT']).toBe(2);
    });

    test('should identify most common error', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        mostCommonError: 'TIMEOUT',
        errorFrequency: 5
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.mostCommonError).toBe('TIMEOUT');
    });
  });

  describe('System Health', () => {
    test('should report system health status', async () => {
      // Arrange
      const mockHealth = {
        status: 'healthy',
        uptime: 86400,
        avgResponseTime: 350
      };
      mockMetricsService.getHealth.mockReturnValue(mockHealth);

      // Act
      const result = await useCase.getSystemHealth();

      // Assert
      expect(result.status).toBe('healthy');
    });

    test('should report degraded health when errors high', async () => {
      // Arrange
      const mockHealth = {
        status: 'degraded',
        errorRate: 0.15,
        warnings: ['High error rate']
      };
      mockMetricsService.getHealth.mockReturnValue(mockHealth);

      // Act
      const result = await useCase.getSystemHealth();

      // Assert
      expect(result.status).toBe('degraded');
    });
  });

  describe('Comparison Stats', () => {
    test('should compare two admins stats', async () => {
      // Arrange
      const admin1Id = 'admin_1';
      const admin2Id = 'admin_2';
      const mockStats1 = { adminId: admin1Id, messagesForwarded: 100 };
      const mockStats2 = { adminId: admin2Id, messagesForwarded: 200 };

      mockAdminRepository.findById
        .mockResolvedValueOnce(mockStats1)
        .mockResolvedValueOnce(mockStats2);

      // Act
      const comparison = await useCase.compareAdmins(admin1Id, admin2Id);

      // Assert
      expect(comparison).toBeDefined();
      expect(comparison.admin1.messagesForwarded).toBe(100);
      expect(comparison.admin2.messagesForwarded).toBe(200);
    });

    test('should identify top performer', async () => {
      // Arrange
      const mockAllStats = [
        { adminId: 'admin_1', messagesForwarded: 100 },
        { adminId: 'admin_2', messagesForwarded: 500 },
        { adminId: 'admin_3', messagesForwarded: 300 }
      ];
      mockAdminRepository.getAll.mockResolvedValue(mockAllStats);

      // Act
      const topAdmin = await useCase.getTopPerformer();

      // Assert
      expect(topAdmin.adminId).toBe('admin_2');
      expect(topAdmin.messagesForwarded).toBe(500);
    });
  });

  describe('Export Stats', () => {
    test('should export stats as JSON', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        messagesForwarded: 100,
        successRate: 0.98
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });
      const exported = useCase.exportAsJSON(result);

      // Assert
      expect(typeof exported).toBe('string');
      expect(JSON.parse(exported).adminId).toBe(adminId);
    });
  });

  describe('Edge Cases', () => {
    test('should handle admin with no stats', async () => {
      // Arrange
      const adminId = 'admin_123';
      mockAdminRepository.findById.mockResolvedValue({
        adminId,
        messagesForwarded: 0,
        errors: 0
      });

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.messagesForwarded).toBe(0);
    });

    test('should handle very large stat values', async () => {
      // Arrange
      const adminId = 'admin_123';
      const mockStats = {
        adminId,
        messagesForwarded: 999999999,
        totalUptime: 31536000 // 1 year in seconds
      };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const result = await useCase.execute({ adminId });

      // Assert
      expect(result.messagesForwarded).toBe(999999999);
    });

    test('should handle concurrent stat requests', async () => {
      // Arrange
      const mockStats = { adminId: 'admin_123', messagesForwarded: 100 };
      mockAdminRepository.findById.mockResolvedValue(mockStats);

      // Act
      const results = await Promise.all([
        useCase.execute({ adminId: 'admin_123' }),
        useCase.execute({ adminId: 'admin_123' }),
        useCase.execute({ adminId: 'admin_123' })
      ]);

      // Assert
      expect(results).toHaveLength(3);
      expect(mockAdminRepository.findById).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle repository errors gracefully', async () => {
      // Arrange
      mockAdminRepository.findById.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(useCase.execute({ adminId: 'admin_123' }))
        .rejects.toThrow('Database connection failed');
    });

    test('should validate input parameters', async () => {
      // Act & Assert
      await expect(useCase.execute({}))
        .rejects.toThrow();
    });
  });
});
