/**
 * @fileoverview Unit tests for User entity
 */

import User from '../domain/User.entity.js';

describe('User.entity', () => {
  const baseData = {
    userId: '700',
    firstName: 'Alice',
    lastName: 'Smith',
    username: 'alice',
    phone: '+1234567890',
    isBot: false,
    isPremium: true,
    isActive: true,
  };

  describe('constructor & validation', () => {
    test('creates user with defaults', () => {
      const user = new User({
        userId: '1',
        firstName: 'John',
      });

      expect(user.lastName).toBeNull();
      expect(user.username).toBeNull();
      expect(user.isBot).toBe(false);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    test.each([
      ['User ID is required and must be a string', { userId: null }],
      ['First name is required and must be a string', { firstName: null }],
      ['First name must not exceed 100 characters', { firstName: 'A'.repeat(101) }],
      ['Username must not exceed 50 characters', { username: 'a'.repeat(51) }],
    ])('throws when %s', (_, override) => {
      expect(() => new User({ ...baseData, ...override })).toThrow();
    });
  });

  describe('state updates', () => {
    test('updateFirstName mutates value and timestamp', () => {
      const user = new User(baseData);
      const prev = user.updatedAt;

      user.updateFirstName('Bob');

      expect(user.firstName).toBe('Bob');
      expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(prev.getTime());
    });

    test('updateLastName/username/phone adjust fields', () => {
      const user = new User(baseData);

      user.updateLastName(null).updateUsername('new_user').updatePhone(null);

      expect(user.lastName).toBeNull();
      expect(user.username).toBe('new_user');
      expect(user.phone).toBeNull();
    });
  });

  describe('helpers', () => {
    test('getFullName and display helpers', () => {
      const user = new User(baseData);
      expect(user.getFullName()).toBe('Alice Smith');
      expect(user.getDisplayName()).toBe('@alice');
      expect(user.hasUsername()).toBe(true);
      expect(user.hasPhone()).toBe(true);
    });

    test('display name falls back to full name', () => {
      const user = new User({ ...baseData, username: null, lastName: null });
      expect(user.getDisplayName()).toBe('Alice');
    });
  });

  describe('conversion', () => {
    test('toObject maps fields to snake_case', () => {
      const now = new Date();
      const user = new User({ ...baseData, createdAt: now, updatedAt: now });

      const obj = user.toObject();

      expect(obj).toMatchObject({
        user_id: '700',
        first_name: 'Alice',
        last_name: 'Smith',
        username: 'alice',
        phone: '+1234567890',
        is_bot: 0,
        is_premium: 1,
        is_active: 1,
      });
      expect(obj.created_at).toBe(now.toISOString());
    });

    test('fromDatabaseRow restores entity', () => {
      const row = {
        id: 5,
        user_id: '10',
        first_name: 'Jane',
        last_name: null,
        username: null,
        phone: null,
        is_bot: 1,
        is_premium: 0,
        is_active: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
      };

      const entity = User.fromDatabaseRow(row);

      expect(entity.userId).toBe('10');
      expect(entity.isBot).toBe(true);
      expect(entity.isActive).toBe(false);
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.id).toBe(5);
    });
  });

  describe('factory helpers', () => {
    test('fromTelegramEntity normalizes fields', () => {
      const telegramUser = {
        id: BigInt(555),
        firstName: 'First',
        lastName: 'Last',
        username: 'telegram_user',
        phone: '123',
        bot: true,
        premium: true,
      };

      const entity = User.fromTelegramEntity(telegramUser);

      expect(entity.userId).toBe('555');
      expect(entity.username).toBe('telegram_user');
      expect(entity.isBot).toBe(false);
    });
  });
});
