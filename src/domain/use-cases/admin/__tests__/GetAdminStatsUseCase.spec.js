/**
 * @fileoverview Tests for GetAdminStatsUseCase
 */

import { jest } from '@jest/globals';
import GetAdminStatsUseCase from '../GetAdminStatsUseCase.js';

describe('GetAdminStatsUseCase', () => {
  let mockAdminRepository;
  let useCase;

  beforeEach(() => {
    mockAdminRepository = {
      getStatistics: jest.fn().mockResolvedValue({
        total: 5,
        active: 4,
        inactive: 1,
      }),
      findActive: jest.fn().mockResolvedValue([
        {
          id: 1,
          telegramUserId: '100',
          role: 'admin',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ]),
    };

    useCase = new GetAdminStatsUseCase(mockAdminRepository);
  });

  test('returns stats and active admin list', async () => {
    const result = await useCase.execute();

    expect(mockAdminRepository.getStatistics).toHaveBeenCalled();
    expect(mockAdminRepository.findActive).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      statistics: {
        total: 5,
        active: 4,
        inactive: 1,
      },
      activeAdmins: [
        {
          id: 1,
          telegramUserId: '100',
          role: 'admin',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    });
  });

  test('bubbles repository errors', async () => {
    mockAdminRepository.getStatistics.mockRejectedValueOnce(new Error('db down'));

    await expect(useCase.execute()).rejects.toThrow('db down');
  });
});
