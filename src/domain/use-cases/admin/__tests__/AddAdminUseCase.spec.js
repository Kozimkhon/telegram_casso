/**
 * @fileoverview Tests for AddAdminUseCase
 */

import AddAdminUseCase from '../AddAdminUseCase.js';
import { AdminRole } from '../../../../shared/constants/index.js';
import Admin from '../../../../core/entities/domain/Admin.entity.js';

describe('AddAdminUseCase', () => {
  let mockAdminRepository;
  let useCase;

  const baseData = {
    userId: '123',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+1234567890',
    role: AdminRole.ADMIN,
  };

  beforeEach(() => {
    mockAdminRepository = {
      findByUserId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (entity) => entity),
    };

    useCase = new AddAdminUseCase({
      adminRepository: mockAdminRepository,
      logger: { info: jest.fn(), error: jest.fn() },
    });
  });

  test('creates admin and returns success payload', async () => {
    const result = await useCase.execute(baseData);

    expect(mockAdminRepository.findByUserId).toHaveBeenCalledWith('123');
    expect(mockAdminRepository.create).toHaveBeenCalledWith(expect.any(Admin));
    expect(result).toEqual({
      success: true,
      admin: expect.any(Admin),
      message: 'Admin added successfully',
    });
  });

  test('defaults role to ADMIN and isActive to true', async () => {
    const data = { userId: '5', firstName: 'John' };
    await useCase.execute(data);

    const createdAdmin = mockAdminRepository.create.mock.calls[0][0];
    expect(createdAdmin.role).toBe(AdminRole.ADMIN);
    expect(createdAdmin.isActive).toBe(true);
  });

  test('throws when userId missing', async () => {
    await expect(useCase.execute({ ...baseData, userId: undefined })).rejects.toThrow(
      'Telegram user ID is required'
    );
    expect(mockAdminRepository.create).not.toHaveBeenCalled();
  });

  test('throws when admin already exists', async () => {
    mockAdminRepository.findByUserId.mockResolvedValueOnce({ id: 1 });

    await expect(useCase.execute(baseData)).rejects.toThrow('Admin already exists');
  });
});
