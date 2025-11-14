/**
 * @fileoverview Unit Tests for UserRepository
 * Tests user data access and retrieval operations
 */

import { jest } from '@jest/globals';
import UserRepository from '../domain/UserRepository.js';

describe('UserRepository', () => {
  let repository;
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn()
    };

    repository = new UserRepository(mockDatabase);
  });

  describe('Initialization', () => {
    test('should initialize with database connection', () => {
      // Assert
      expect(repository).toBeDefined();
      expect(repository.database).toBe(mockDatabase);
    });
  });

  describe('Create Operations', () => {
    test('should create new user', async () => {
      // Arrange
      const userData = {
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      };

      mockDatabase.execute.mockResolvedValue({ id: 1, ...userData });

      // Act
      const result = await repository.create(userData);

      // Assert
      expect(result.userId).toBe('123456789');
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should throw error on duplicate userId', async () => {
      // Arrange
      const userData = {
        userId: '123456789',
        firstName: 'John'
      };

      mockDatabase.execute.mockRejectedValue(
        new Error('UNIQUE constraint failed')
      );

      // Act & Assert
      await expect(repository.create(userData))
        .rejects.toThrow();
    });

    test('should validate required fields before creation', async () => {
      // Arrange
      const invalidData = { firstName: 'John' };

      // Act & Assert
      await expect(repository.create(invalidData))
        .rejects.toThrow();
    });
  });

  describe('Read Operations', () => {
    test('should find user by ID', async () => {
      // Arrange
      const userId = '123456789';
      const mockUser = {
        id: 1,
        userId,
        firstName: 'John',
        lastName: 'Doe'
      };

      mockDatabase.query.mockResolvedValue([mockUser]);

      // Act
      const result = await repository.findById(userId);

      // Assert
      expect(result.userId).toBe(userId);
      expect(mockDatabase.query).toHaveBeenCalled();
    });

    test('should return null for non-existent user', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([]);

      // Act
      const result = await repository.findById('nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    test('should find user by username', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        userId: '123456789',
        username: 'johndoe'
      };

      mockDatabase.query.mockResolvedValue([mockUser]);

      // Act
      const result = await repository.findByUsername('johndoe');

      // Assert
      expect(result.username).toBe('johndoe');
    });

    test('should get all users', async () => {
      // Arrange
      const mockUsers = [
        { userId: '111', firstName: 'John' },
        { userId: '222', firstName: 'Jane' },
        { userId: '333', firstName: 'Bob' }
      ];

      mockDatabase.query.mockResolvedValue(mockUsers);

      // Act
      const result = await repository.getAll();

      // Assert
      expect(result).toHaveLength(3);
    });

    test('should get users with pagination', async () => {
      // Arrange
      const mockUsers = [
        { userId: '111' },
        { userId: '222' }
      ];

      mockDatabase.query.mockResolvedValue(mockUsers);

      // Act
      const result = await repository.getAll({ limit: 2, offset: 0 });

      // Assert
      expect(result).toHaveLength(2);
    });
  });

  describe('Update Operations', () => {
    test('should update user profile', async () => {
      // Arrange
      const userId = '123456789';
      const updates = { firstName: 'Jane', lastName: 'Smith' };

      mockDatabase.execute.mockResolvedValue({
        userId,
        ...updates
      });

      // Act
      const result = await repository.update(userId, updates);

      // Assert
      expect(result.firstName).toBe('Jane');
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should not update userId', async () => {
      // Arrange
      const userId = '123456789';
      const updates = { userId: 'newid' };

      // Act & Assert
      await expect(repository.update(userId, updates))
        .rejects.toThrow();
    });

    test('should update partial fields', async () => {
      // Arrange
      const userId = '123456789';
      const updates = { firstName: 'Jane' };

      mockDatabase.execute.mockResolvedValue({
        userId,
        firstName: 'Jane',
        lastName: 'Doe'
      });

      // Act
      const result = await repository.update(userId, updates);

      // Assert
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('Delete Operations', () => {
    test('should delete user', async () => {
      // Arrange
      const userId = '123456789';
      mockDatabase.execute.mockResolvedValue(true);

      // Act
      const result = await repository.delete(userId);

      // Assert
      expect(result).toBe(true);
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should throw error when deleting non-existent user', async () => {
      // Arrange
      mockDatabase.execute.mockRejectedValue(
        new Error('User not found')
      );

      // Act & Assert
      await expect(repository.delete('nonexistent'))
        .rejects.toThrow();
    });
  });

  describe('Search Operations', () => {
    test('should search users by name', async () => {
      // Arrange
      const mockUsers = [
        { userId: '111', firstName: 'John' },
        { userId: '222', firstName: 'Jonathan' }
      ];

      mockDatabase.query.mockResolvedValue(mockUsers);

      // Act
      const result = await repository.searchByName('John');

      // Assert
      expect(result.length).toBeGreaterThan(0);
    });

    test('should search with multiple filters', async () => {
      // Arrange
      const mockUsers = [
        { userId: '111', firstName: 'John', username: 'johndoe' }
      ];

      mockDatabase.query.mockResolvedValue(mockUsers);

      // Act
      const result = await repository.search({
        firstName: 'John',
        username: 'johndoe'
      });

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  describe('Counting', () => {
    test('should count all users', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 100 }]);

      // Act
      const count = await repository.count();

      // Assert
      expect(count).toBe(100);
    });

    test('should count users by criteria', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ count: 25 }]);

      // Act
      const count = await repository.countBy({ active: true });

      // Assert
      expect(count).toBe(25);
    });
  });

  describe('Existence Checks', () => {
    test('should check if user exists', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([{ exists: true }]);

      // Act
      const exists = await repository.exists('123456789');

      // Assert
      expect(exists).toBe(true);
    });

    test('should return false for non-existent user', async () => {
      // Arrange
      mockDatabase.query.mockResolvedValue([]);

      // Act
      const exists = await repository.exists('nonexistent');

      // Assert
      expect(exists).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    test('should create multiple users', async () => {
      // Arrange
      const users = [
        { userId: '111', firstName: 'John' },
        { userId: '222', firstName: 'Jane' }
      ];

      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });
      mockDatabase.execute.mockResolvedValue({});

      // Act
      const result = await repository.createBatch(users);

      // Assert
      expect(result).toHaveLength(2);
    });

    test('should update multiple users', async () => {
      // Arrange
      const updates = {
        '111': { firstName: 'John' },
        '222': { firstName: 'Jane' }
      };

      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });
      mockDatabase.execute.mockResolvedValue({});

      // Act
      await repository.updateBatch(updates);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    test('should delete multiple users', async () => {
      // Arrange
      const userIds = ['111', '222', '333'];

      mockDatabase.execute.mockResolvedValue(true);

      // Act
      await repository.deleteBatch(userIds);

      // Assert
      expect(mockDatabase.execute).toHaveBeenCalled();
    });
  });

  describe('Transaction Handling', () => {
    test('should execute operations in transaction', async () => {
      // Arrange
      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });

      // Act
      await repository.inTransaction(async () => {
        return 'success';
      });

      // Assert
      expect(mockDatabase.transaction).toHaveBeenCalled();
    });

    test('should rollback on error in transaction', async () => {
      // Arrange
      mockDatabase.transaction.mockImplementation(async (fn) => {
        try {
          return await fn();
        } catch (e) {
          throw new Error('Transaction rolled back');
        }
      });

      // Act & Assert
      await expect(
        repository.inTransaction(async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      // Arrange
      mockDatabase.query.mockRejectedValue(
        new Error('Connection failed')
      );

      // Act & Assert
      await expect(repository.findById('123'))
        .rejects.toThrow('Connection failed');
    });

    test('should handle query errors gracefully', async () => {
      // Arrange
      mockDatabase.query.mockRejectedValue(
        new Error('Query error')
      );

      // Act & Assert
      await expect(repository.getAll())
        .rejects.toThrow('Query error');
    });
  });

  describe('Caching', () => {
    test('should cache user lookups', async () => {
      // Arrange
      const userId = '123456789';
      const mockUser = { userId, firstName: 'John' };

      mockDatabase.query.mockResolvedValue([mockUser]);

      // Act
      const result1 = await repository.findById(userId);
      const result2 = await repository.findById(userId);

      // Assert
      expect(result1).toEqual(result2);
      expect(mockDatabase.query).toHaveBeenCalledTimes(1);
    });

    test('should invalidate cache on update', async () => {
      // Arrange
      const userId = '123456789';
      mockDatabase.query.mockResolvedValue([{ userId }]);
      mockDatabase.execute.mockResolvedValue({ userId, firstName: 'Jane' });

      // Act
      await repository.findById(userId);
      await repository.update(userId, { firstName: 'Jane' });
      const result = await repository.findById(userId);

      // Assert
      expect(mockDatabase.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long username', async () => {
      // Arrange
      const longUsername = 'a'.repeat(500);
      const mockUser = { userId: '123', username: longUsername };

      mockDatabase.query.mockResolvedValue([mockUser]);

      // Act
      const result = await repository.findByUsername(longUsername);

      // Assert
      expect(result.username).toBe(longUsername);
    });

    test('should handle unicode in names', async () => {
      // Arrange
      const mockUser = {
        userId: '123',
        firstName: 'Иван',
        lastName: 'Петров'
      };

      mockDatabase.query.mockResolvedValue([mockUser]);

      // Act
      const result = await repository.findById('123');

      // Assert
      expect(result.firstName).toBe('Иван');
    });

    test('should handle large batch operations', async () => {
      // Arrange
      const users = Array.from({ length: 1000 }, (_, i) => ({
        userId: `${i}`,
        firstName: `User${i}`
      }));

      mockDatabase.transaction.mockImplementation(async (fn) => {
        return fn();
      });
      mockDatabase.execute.mockResolvedValue({});

      // Act
      const result = await repository.createBatch(users);

      // Assert
      expect(result.length).toBe(1000);
    });
  });

  describe('Integration', () => {
    test('should work with complete CRUD workflow', async () => {
      // Arrange
      const userData = { userId: '123', firstName: 'John' };

      mockDatabase.execute.mockResolvedValue({ id: 1, ...userData });
      mockDatabase.query.mockResolvedValue([{ id: 1, ...userData }]);

      // Act
      const created = await repository.create(userData);
      const found = await repository.findById('123');

      // Assert
      expect(created.userId).toBe('123');
      expect(found.userId).toBe('123');
    });
  });
});
