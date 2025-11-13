/**
 * @fileoverview Unit Tests for Admin Entity
 * Tests domain logic for Admin entity including validation, role management, and state changes
 * @module core/entities/__tests__/Admin.entity.spec
 */

import Admin from '../domain/Admin.entity.js';
import { AdminRole } from '../../../shared/constants/index.js';

describe('Admin Entity', () => {
  
  // ==================== SETUP ====================
  const validAdminData = {
    userId: '123456789',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    phone: '+1234567890',
    role: AdminRole.ADMIN,
    isActive: true
  };

  // ==================== CONSTRUCTOR & VALIDATION ====================
  
  describe('Constructor & Validation', () => {
    test('should create admin with valid data', () => {
      // Arrange & Act
      const admin = new Admin(validAdminData);

      // Assert
      expect(admin.userId).toBe('123456789');
      expect(admin.firstName).toBe('John');
      expect(admin.lastName).toBe('Doe');
      expect(admin.username).toBe('johndoe');
      expect(admin.phone).toBe('+1234567890');
      expect(admin.role).toBe(AdminRole.ADMIN);
      expect(admin.isActive).toBe(true);
    });

    test('should use default role (ADMIN) when not specified', () => {
      // Arrange
      const data = { ...validAdminData, role: undefined };

      // Act
      const admin = new Admin(data);

      // Assert
      expect(admin.role).toBe(AdminRole.ADMIN);
    });

    test('should default isActive to true when not specified', () => {
      // Arrange
      const data = { ...validAdminData, isActive: undefined };

      // Act
      const admin = new Admin(data);

      // Assert
      expect(admin.isActive).toBe(true);
    });

    test('should set lastName to null when not provided', () => {
      // Arrange
      const data = { ...validAdminData, lastName: undefined };

      // Act
      const admin = new Admin(data);

      // Assert
      expect(admin.lastName).toBeNull();
    });

    test('should throw error when userId is missing', () => {
      // Arrange
      const data = { ...validAdminData, userId: undefined };

      // Act & Assert
      expect(() => new Admin(data)).toThrow('User ID is required');
    });

    test('should throw error when firstName is missing', () => {
      // Arrange
      const data = { ...validAdminData, firstName: undefined };

      // Act & Assert
      expect(() => new Admin(data)).toThrow('First name is required');
    });

    test('should throw error when role is invalid', () => {
      // Arrange
      const data = { ...validAdminData, role: 'INVALID_ROLE' };

      // Act & Assert
      expect(() => new Admin(data)).toThrow(/Invalid role/);
    });

    test('should accept all valid roles', () => {
      // Arrange, Act & Assert
      const validRoles = [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR];
      
      validRoles.forEach(role => {
        const admin = new Admin({ ...validAdminData, role });
        expect(admin.role).toBe(role);
      });
    });
  });

  // ==================== ACTIVATION/DEACTIVATION ====================

  describe('Activation & Deactivation', () => {
    test('should activate admin', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, isActive: false });

      // Act
      const result = admin.activate();

      // Assert
      expect(admin.isActive).toBe(true);
      expect(result).toBe(admin); // Should return self for chaining
    });

    test('should deactivate admin', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, isActive: true });

      // Act
      const result = admin.deactivate();

      // Assert
      expect(admin.isActive).toBe(false);
      expect(result).toBe(admin); // Should return self for chaining
    });

    test('should update updatedAt timestamp on activation', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, isActive: false });
      const originalTime = admin.updatedAt;
      
      // Small delay to ensure time difference
      const startTime = Date.now();

      // Act
      admin.activate();
      const newTime = admin.updatedAt;

      // Assert
      expect(newTime.getTime()).toBeGreaterThan(originalTime.getTime());
      expect(newTime.getTime()).toBeGreaterThanOrEqual(startTime);
    });

    test('should support method chaining', () => {
      // Arrange & Act
      const admin = new Admin(validAdminData)
        .deactivate()
        .activate();

      // Assert
      expect(admin.isActive).toBe(true);
    });
  });

  // ==================== ROLE MANAGEMENT ====================

  describe('Role Management', () => {
    test('should change role', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, role: AdminRole.ADMIN });

      // Act
      admin.changeRole(AdminRole.SUPER_ADMIN);

      // Assert
      expect(admin.role).toBe(AdminRole.SUPER_ADMIN);
    });

    test('should throw error when changing to invalid role', () => {
      // Arrange
      const admin = new Admin(validAdminData);

      // Act & Assert
      expect(() => admin.changeRole('INVALID_ROLE')).toThrow('Invalid role');
    });

    test('should update updatedAt when role changes', () => {
      // Arrange
      const admin = new Admin(validAdminData);
      const originalTime = admin.updatedAt;

      // Act
      admin.changeRole(AdminRole.MODERATOR);

      // Assert
      expect(admin.updatedAt.getTime()).toBeGreaterThan(originalTime.getTime());
    });

    test('should identify super admin correctly', () => {
      // Arrange & Act
      const superAdmin = new Admin({ ...validAdminData, role: AdminRole.SUPER_ADMIN });
      const regularAdmin = new Admin({ ...validAdminData, role: AdminRole.ADMIN });

      // Assert
      expect(superAdmin.isSuperAdmin()).toBe(true);
      expect(regularAdmin.isSuperAdmin()).toBe(false);
    });

    test('should identify moderator correctly', () => {
      // Arrange & Act
      const moderator = new Admin({ ...validAdminData, role: AdminRole.MODERATOR });
      const regularAdmin = new Admin({ ...validAdminData, role: AdminRole.ADMIN });

      // Assert
      expect(moderator.isModerator()).toBe(true);
      expect(regularAdmin.isModerator()).toBe(false);
    });
  });

  // ==================== NAME OPERATIONS ====================

  describe('Name Operations', () => {
    test('should get full name with both first and last name', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, firstName: 'John', lastName: 'Doe' });

      // Act
      const fullName = admin.getFullName();

      // Assert
      expect(fullName).toBe('John Doe');
    });

    test('should get full name with only first name', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, firstName: 'John', lastName: null });

      // Act
      const fullName = admin.getFullName();

      // Assert
      expect(fullName).toBe('John');
    });

    test('should get full name with only last name', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, firstName: 'John', lastName: 'Doe' });
      admin.firstName = '';

      // Act
      const fullName = admin.getFullName();

      // Assert
      expect(fullName).toBe('Doe');
    });

    test('should return empty string when both names are missing', () => {
      // Arrange
      const admin = new Admin({ ...validAdminData, firstName: '', lastName: null });

      // Act
      const fullName = admin.getFullName();

      // Assert
      expect(fullName).toBe('');
    });
  });

  // ==================== DATABASE CONVERSION ====================

  describe('Database Conversion', () => {
    test('should convert to database row format', () => {
      // Arrange
      const admin = new Admin(validAdminData);

      // Act
      const dbRow = Admin.toDatabaseRow(admin);

      // Assert
      expect(dbRow.user_id).toBe('123456789');
      expect(dbRow.first_name).toBe('John');
      expect(dbRow.last_name).toBe('Doe');
      expect(dbRow.username).toBe('johndoe');
      expect(dbRow.phone).toBe('+1234567890');
      expect(dbRow.role).toBe(AdminRole.ADMIN);
      expect(dbRow.is_active).toBe(1); // true converts to 1
    });

    test('should convert boolean to integer in database row', () => {
      // Arrange
      const activeAdmin = new Admin({ ...validAdminData, isActive: true });
      const inactiveAdmin = new Admin({ ...validAdminData, isActive: false });

      // Act
      const activeRow = Admin.toDatabaseRow(activeAdmin);
      const inactiveRow = Admin.toDatabaseRow(inactiveAdmin);

      // Assert
      expect(activeRow.is_active).toBe(1);
      expect(inactiveRow.is_active).toBe(0);
    });

    test('should convert from database row', () => {
      // Arrange
      const dbRow = {
        id: 1,
        user_id: '123456789',
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        phone: '+1234567890',
        role: AdminRole.ADMIN,
        is_active: 1,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z'
      };

      // Act
      const admin = Admin.fromDatabaseRow(dbRow);

      // Assert
      expect(admin.id).toBe(1);
      expect(admin.userId).toBe('123456789');
      expect(admin.firstName).toBe('John');
      expect(admin.lastName).toBe('Doe');
      expect(admin.isActive).toBe(true);
    });

    test('should handle database row with camelCase fields', () => {
      // Arrange
      const dbRow = {
        id: 1,
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        phone: '+1234567890',
        role: AdminRole.ADMIN,
        isActive: true
      };

      // Act
      const admin = Admin.fromDatabaseRow(dbRow);

      // Assert
      expect(admin.userId).toBe('123456789');
      expect(admin.firstName).toBe('John');
      expect(admin.isActive).toBe(true);
    });

    test('should default isActive to true when reading from database', () => {
      // Arrange
      const dbRow = {
        user_id: '123456789',
        first_name: 'John',
        // is_active field missing
      };

      // Act
      const admin = Admin.fromDatabaseRow(dbRow);

      // Assert
      expect(admin.isActive).toBe(true);
    });
  });

  // ==================== TIMESTAMPS ====================

  describe('Timestamps', () => {
    test('should set createdAt and updatedAt on construction', () => {
      // Arrange
      const beforeCreation = new Date();

      // Act
      const admin = new Admin(validAdminData);
      const afterCreation = new Date();

      // Assert
      expect(admin.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(admin.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
      expect(admin.updatedAt).toEqual(admin.createdAt);
    });

    test('should accept custom timestamps', () => {
      // Arrange
      const customDate = new Date('2025-01-01T00:00:00Z');
      const data = { ...validAdminData, createdAt: customDate, updatedAt: customDate };

      // Act
      const admin = new Admin(data);

      // Assert
      expect(admin.createdAt).toEqual(customDate);
      expect(admin.updatedAt).toEqual(customDate);
    });
  });

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    test('should handle numeric userId', () => {
      // Arrange & Act
      const admin = new Admin({ ...validAdminData, userId: 123456789 });

      // Assert
      expect(admin.userId).toBe(123456789);
    });

    test('should handle empty string lastName', () => {
      // Arrange & Act
      const admin = new Admin({ ...validAdminData, lastName: '' });

      // Assert
      expect(admin.lastName).toBe('');
    });

    test('should handle special characters in names', () => {
      // Arrange & Act
      const admin = new Admin({
        ...validAdminData,
        firstName: 'José',
        lastName: "O'Brien",
        username: 'josé_o_brien'
      });

      // Assert
      expect(admin.firstName).toBe('José');
      expect(admin.lastName).toBe("O'Brien");
      expect(admin.getFullName()).toBe("José O'Brien");
    });

    test('should handle very long names', () => {
      // Arrange
      const longName = 'A'.repeat(100);

      // Act
      const admin = new Admin({
        ...validAdminData,
        firstName: longName,
        lastName: longName
      });

      // Assert
      expect(admin.firstName).toBe(longName);
      expect(admin.lastName).toBe(longName);
    });

    test('should preserve id when provided', () => {
      // Arrange & Act
      const admin = new Admin({ ...validAdminData, id: 42 });

      // Assert
      expect(admin.id).toBe(42);
    });

    test('should set id to null when not provided', () => {
      // Arrange & Act
      const admin = new Admin(validAdminData);

      // Assert
      expect(admin.id).toBeNull();
    });
  });
});
