/**
 * @fileoverview Unit Tests for User Domain Entity
 * Tests user domain entity validation and state management
 */

import User from '../User.entity.js';

describe('User.entity', () => {
  
  // ==================== MOCKS & SETUP ====================
  
  const validUserData = {
    userId: '987654321',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    isBot: false
  };

  // ==================== INITIALIZATION ====================

  describe('Constructor & Initialization', () => {
    test('should create user with valid data', () => {
      // Act
      const user = new User(validUserData);

      // Assert
      expect(user).toBeDefined();
      expect(user.userId).toBe('987654321');
      expect(user.firstName).toBe('Test');
    });

    test('should throw error when userId is missing', () => {
      // Arrange
      const invalidData = { ...validUserData };
      delete invalidData.userId;

      // Act & Assert
      expect(() => new User(invalidData)).toThrow();
    });

    test('should throw error when firstName is missing', () => {
      // Arrange
      const invalidData = { ...validUserData };
      delete invalidData.firstName;

      // Act & Assert
      expect(() => new User(invalidData)).toThrow();
    });

    test('should accept valid numeric userId', () => {
      // Act
      const user = new User(validUserData);

      // Assert
      expect(user.userId).toBe('987654321');
    });

    test('should set isBot to false by default', () => {
      // Arrange
      const data = { ...validUserData };
      delete data.isBot;

      // Act
      const user = new User(data);

      // Assert
      expect(user.isBot).toBe(false);
    });
  });

  // ==================== PROPERTIES ====================

  describe('User Properties', () => {
    test('should store all user data', () => {
      // Act
      const user = new User(validUserData);

      // Assert
      expect(user.userId).toBe(validUserData.userId);
      expect(user.firstName).toBe(validUserData.firstName);
      expect(user.lastName).toBe(validUserData.lastName);
      expect(user.username).toBe(validUserData.username);
    });

    test('should allow null optional fields', () => {
      // Arrange
      const data = {
        ...validUserData,
        username: null,
        lastName: null
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.username).toBeNull();
      expect(user.lastName).toBeNull();
    });

    test('should handle unicode names', () => {
      // Arrange
      const data = {
        ...validUserData,
        firstName: 'Ҷон',
        lastName: 'Доҳ'
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.firstName).toBe('Ҷон');
      expect(user.lastName).toBe('Доҳ');
    });
  });

  // ==================== GETTERS & SETTERS ====================

  describe('Getters & Setters', () => {
    test('should get userId', () => {
      // Arrange
      const user = new User(validUserData);

      // Act
      const userId = user.userId;

      // Assert
      expect(userId).toBe('987654321');
    });

    test('should get firstName', () => {
      // Arrange
      const user = new User(validUserData);

      // Act
      const firstName = user.firstName;

      // Assert
      expect(firstName).toBe('Test');
    });

    test('should get full name', () => {
      // Arrange
      const user = new User(validUserData);

      // Act
      const fullName = user.getFullName();

      // Assert
      expect(fullName).toBe('Test User');
    });

    test('should handle empty lastName in full name', () => {
      // Arrange
      const user = new User({ ...validUserData, lastName: null });

      // Act
      const fullName = user.getFullName();

      // Assert
      expect(fullName).toBe('Test');
    });
  });

  // ==================== VALIDATION ====================

  describe('Validation', () => {
    test('should validate required fields', () => {
      // Arrange
      const invalidData = { firstName: 'Test' };

      // Act & Assert
      expect(() => new User(invalidData)).toThrow();
    });

    test('should validate userId format', () => {
      // Arrange
      const invalidData = { ...validUserData, userId: '' };

      // Act & Assert
      expect(() => new User(invalidData)).toThrow();
    });

    test('should validate firstName format', () => {
      // Arrange
      const invalidData = { ...validUserData, firstName: '' };

      // Act & Assert
      expect(() => new User(invalidData)).toThrow();
    });

    test('should accept long usernames', () => {
      // Arrange
      const data = {
        ...validUserData,
        username: 'a'.repeat(100)
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.username.length).toBe(100);
    });
  });

  // ==================== DATABASE CONVERSION ====================

  describe('Database Conversion', () => {
    test('should convert to database row', () => {
      // Arrange
      const user = new User(validUserData);

      // Act
      const dbRow = user.toDatabaseRow();

      // Assert
      expect(dbRow).toBeDefined();
      expect(dbRow.userId).toBe('987654321');
      expect(dbRow.firstName).toBe('Test');
    });

    test('should convert from database row', () => {
      // Arrange
      const dbRow = {
        userId: '987654321',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        isBot: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Act
      const user = User.fromDatabaseRow(dbRow);

      // Assert
      expect(user.userId).toBe('987654321');
      expect(user.firstName).toBe('Test');
    });

    test('should preserve timestamps', () => {
      // Arrange
      const now = new Date();
      const user = new User({
        ...validUserData,
        createdAt: now,
        updatedAt: now
      });

      // Act
      const dbRow = user.toDatabaseRow();

      // Assert
      expect(dbRow.created_at).toBe(now);
      expect(dbRow.updated_at).toBe(now);
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle very long firstName', () => {
      // Arrange
      const data = {
        ...validUserData,
        firstName: 'A'.repeat(255)
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.firstName.length).toBe(255);
    });

    test('should handle special characters in names', () => {
      // Arrange
      const data = {
        ...validUserData,
        firstName: "O'Brien-Smith",
        lastName: "Müller"
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.firstName).toBe("O'Brien-Smith");
      expect(user.lastName).toBe("Müller");
    });

    test('should handle very large userId numbers', () => {
      // Arrange
      const data = {
        ...validUserData,
        userId: '999999999999999999'
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.userId).toBe('999999999999999999');
    });

    test('should handle username with special characters', () => {
      // Arrange
      const data = {
        ...validUserData,
        username: 'user_name-123'
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.username).toBe('user_name-123');
    });

    test('should handle bot user', () => {
      // Arrange
      const data = {
        ...validUserData,
        isBot: true
      };

      // Act
      const user = new User(data);

      // Assert
      expect(user.isBot).toBe(true);
    });
  });
});
