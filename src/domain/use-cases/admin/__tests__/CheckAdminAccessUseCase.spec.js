/**
 * @fileoverview Tests for CheckAdminAccessUseCase
 */

import { jest } from '@jest/globals';
import CheckAdminAccessUseCase from '../CheckAdminAccessUseCase.js';

describe('CheckAdminAccessUseCase', () => {
  let mockAdminRepository;
  let useCase;

  beforeEach(() => {
    mockAdminRepository = {
      isAdmin: jest.fn().mockResolvedValue(true),
      isSuperAdmin: jest.fn().mockResolvedValue(false),
      findByUserId: jest.fn().mockResolvedValue({
        id: 1,
        telegramUserId: '100',
        role: 'admin',
        isActive: true,
        isSuperAdmin: () => false,
      }),
    };

    useCase = new CheckAdminAccessUseCase(mockAdminRepository);
  });

  describe('execute', () => {
    test('returns boolean flags from repository checks', async () => {
      mockAdminRepository.isSuperAdmin.mockResolvedValue(true);

      const result = await useCase.execute('100');

      expect(mockAdminRepository.isAdmin).toHaveBeenCalledWith('100');
      expect(result).toEqual({
        success: true,
        isAdmin: true,
        isSuperAdmin: true,
        hasAccess: true,
      });
    });

    test('marks hasAccess false when user is not admin', async () => {
      mockAdminRepository.isAdmin.mockResolvedValue(false);

      const result = await useCase.execute('200');

      expect(result.hasAccess).toBe(false);
      expect(result.isAdmin).toBe(false);
    });
  });

  describe('requireAdmin', () => {
    test('returns admin info when active admin exists', async () => {
      const result = await useCase.requireAdmin('100');

      expect(mockAdminRepository.findByUserId).toHaveBeenCalledWith('100');
      expect(result.admin).toEqual(
        expect.objectContaining({ id: 1, role: 'admin' })
      );
    });

    test('throws when admin not found or inactive', async () => {
      mockAdminRepository.findByUserId.mockResolvedValueOnce(null);
      await expect(useCase.requireAdmin('missing')).rejects.toThrow(/Access denied/);

      mockAdminRepository.findByUserId.mockResolvedValueOnce({
        isActive: false,
      });
      await expect(useCase.requireAdmin('inactive')).rejects.toThrow(/Access denied/);
    });
  });

  describe('requireSuperAdmin', () => {
    test('allows super admin', async () => {
      mockAdminRepository.findByUserId.mockResolvedValueOnce({
        id: 2,
        telegramUserId: '500',
        role: 'super_admin',
        isActive: true,
        isSuperAdmin: () => true,
      });

      const result = await useCase.requireSuperAdmin('500');
      expect(result.admin.role).toBe('super_admin');
    });

    test('throws when admin is not super admin', async () => {
      await expect(useCase.requireSuperAdmin('100')).rejects.toThrow(
        /Super admin privileges/
      );
    });
  });
});
