/**
 * @fileoverview Tests for Channel entity
 */

import Channel from '../domain/Channel.entity.js';

describe('Channel.entity', () => {
  const baseData = {
    channelId: '-100',
    title: 'Test Channel',
    username: 'test',
    memberCount: 50,
    forwardEnabled: true,
  };

  describe('constructor & validation', () => {
    test('sets defaults when optional fields missing', () => {
      const channel = new Channel({ channelId: '-1', title: 'Title' });

      expect(channel.memberCount).toBe(0);
      expect(channel.forwardEnabled).toBe(true);
      expect(channel.scheduleEnabled).toBe(false);
      expect(channel.createdAt).toBeInstanceOf(Date);
    });

    test.each([
      [{ channelId: null }, 'Channel ID is required'],
      [{ title: null }, 'Channel title is required'],
      [{ title: 'a'.repeat(201) }, 'Channel title must not exceed 200 characters'],
      [{ forwardEnabled: 'yes' }, 'forwardEnabled must be a boolean'],
    ])('throws validation error %s', (override, message) => {
      expect(() => new Channel({ ...baseData, ...override })).toThrow(message);
    });
  });

  describe('state changes', () => {
    test('toggleForwarding flips flag and updates timestamp', () => {
      const channel = new Channel(baseData);
      const prev = channel.updatedAt;

      channel.toggleForwarding();

      expect(channel.forwardEnabled).toBe(false);
      expect(channel.updatedAt.getTime()).toBeGreaterThanOrEqual(prev.getTime());
    });

    test('linkToAdmin stores admin and updates timestamp', () => {
      const channel = new Channel(baseData);
      channel.linkToAdmin('admin-1');
      expect(channel.adminId).toBe('admin-1');
      expect(channel.hasAdminSession()).toBe(true);
    });

    test('updateMemberCount enforces numeric values', () => {
      const channel = new Channel(baseData);
      channel.updateMemberCount(123);
      expect(channel.memberCount).toBe(123);
      expect(() => channel.updateMemberCount(-1)).toThrow('Member count must be a positive number');
    });
  });

  describe('conversion helpers', () => {
    test('toObject maps fields to snake_case', () => {
      const now = new Date();
      const channel = new Channel({ ...baseData, createdAt: now, updatedAt: now, adminId: 'admin' });

      const obj = channel.toObject();
      expect(obj).toMatchObject({
        channel_id: '-100',
        title: 'Test Channel',
        username: 'test',
        member_count: 50,
        forward_enabled: 1,
        admin_id: 'admin',
        created_at: now.toISOString(),
      });
    });

    test('fromDatabaseRow restores entity', () => {
      const row = {
        id: 10,
        channel_id: '-200',
        access_hash: 'hash',
        title: 'Channel',
        username: null,
        member_count: 5,
        forward_enabled: 0,
        throttle_delay_ms: 2000,
        throttle_per_member_ms: 100,
        min_delay_ms: 500,
        max_delay_ms: 1000,
        schedule_enabled: 1,
        schedule_config: '{}',
        admin_id: 'admin',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
      };

      const entity = Channel.fromDatabaseRow(row);

      expect(entity.channelId).toBe('-200');
      expect(entity.forwardEnabled).toBe(false);
      expect(entity.scheduleEnabled).toBe(true);
      expect(entity.createdAt).toBeInstanceOf(Date);
    });
  });
});
