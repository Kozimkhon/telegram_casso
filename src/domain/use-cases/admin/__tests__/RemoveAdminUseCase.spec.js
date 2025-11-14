/**
 * @fileoverview Tests for RemoveAdminUseCase
 */

import RemoveAdminUseCase from '../RemoveAdminUseCase.js';

describe('RemoveAdminUseCase', () => {
  let mockAdminRepository;
  let useCase;
  const adminEntity = {
    id: 1,
    isSuperAdmin: () => false,
  };

  beforeEach(() => {
    mockAdminRepository = {
      findByUserId: jest.fn().mockResolvedValue(adminEntity),
      getFirstSuperAdmin: jest.fn().mockResolvedValue({ id: 2 }),
      findByRole: jest.fn().mockResolvedValue([adminEntity]),
      delete: jest.fn().mockResolvedValue(true),
    };

    useCase = new RemoveAdminUseCase(mockAdminRepository);
  });

  test('removes admin by telegram ID', async () => {
    const result = await useCase.execute('100');

    expect(mockAdminRepository.findByUserId).toHaveBeenCalledWith('100');
    expect(mockAdminRepository.delete).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      success: true,
      message: 'Admin removed successfully',
    });
  });

  test('throws when admin not found', async () => {
    mockAdminRepository.findByUserId.mockResolvedValueOnce(null);

    await expect(useCase.execute('missing')).rejects.toThrow('Admin not found');
    expect(mockAdminRepository.delete).not.toHaveBeenCalled();
  });

  test('prevents deleting the last super admin', async () => {
    const superAdmin = {
      id: 2,
      isSuperAdmin: () => true,
    };
    mockAdminRepository.findByUserId.mockResolvedValueOnce(superAdmin);
    mockAdminRepository.getFirstSuperAdmin.mockResolvedValueOnce(superAdmin);
    mockAdminRepository.findByRole.mockResolvedValueOnce([superAdmin]);

    await expect(useCase.execute('200')).rejects.toThrow('last super admin');
    expect(mockAdminRepository.delete).not.toHaveBeenCalled();
  });

  test('allows deleting super admin when others exist', async () => {
    const superAdmin = {
      id: 2,
      isSuperAdmin: () => true,
    };
    mockAdminRepository.findByUserId.mockResolvedValueOnce(superAdmin);
    mockAdminRepository.getFirstSuperAdmin.mockResolvedValueOnce(superAdmin);
    mockAdminRepository.findByRole.mockResolvedValueOnce([
      superAdmin,
      { id: 3 },
    ]);

    await useCase.execute('200');
    expect(mockAdminRepository.delete).toHaveBeenCalledWith(2);
  });

  test('throws when delete operation fails', async () => {
    mockAdminRepository.delete.mockResolvedValueOnce(false);
    await expect(useCase.execute('100')).rejects.toThrow('Failed to delete admin');
  });
});
