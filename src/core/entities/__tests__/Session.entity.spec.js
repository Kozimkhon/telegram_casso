/**
 * @fileoverview Tests for Session entity
 */

import Session from '../domain/Session.entity.js';
import { SessionStatus } from '../../../shared/constants/index.js';

describe('Session.entity', () => {
  const baseData = {
    adminId: 'admin-1',
    sessionString: 'string',
    status: SessionStatus.ACTIVE,
  };

  describe('constructor & validation', () => {
    test('creates session with defaults', () => {
      const session = new Session({ adminId: 'a', sessionString: 's' });
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.autoPaused).toBe(false);
      expect(session.lastActive).toBeInstanceOf(Date);
    });

    test.each([
      [{ adminId: null }, 'Admin ID is required'],
      [{ status: 'INVALID' }, 'Invalid status'],
    ])('throws when %s', (override, message) => {
      expect(() => new Session({ ...baseData, ...override })).toThrow(message);
    });
  });

  describe('status management', () => {
    test('pause and resume update flags', () => {
      const session = new Session(baseData);
      session.pause('Maintenance');
      expect(session.status).toBe(SessionStatus.PAUSED);
      expect(session.pauseReason).toBe('Maintenance');

      session.resume();
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.pauseReason).toBeNull();
    });

    test('markError sets status and error', () => {
      const session = new Session(baseData);
      session.markError('Failure');
      expect(session.status).toBe(SessionStatus.ERROR);
      expect(session.lastError).toBe('Failure');
    });

    test('setFloodWait auto pauses and sets expiration', () => {
      const session = new Session(baseData);
      session.setFloodWait(30);
      expect(session.autoPaused).toBe(true);
      expect(session.isFloodWaitExpired()).toBe(false);
    });
  });

  describe('activity tracking', () => {
    test('updateActivity refreshes timestamps', () => {
      const session = new Session(baseData);
      const prev = session.updatedAt;
      session.updateActivity();
      expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(prev.getTime());
    });

    test('isReadyToResume only true when auto paused and flood wait expired', () => {
      const session = new Session(baseData);
      session.autoPause('Flood', new Date(Date.now() - 1000));
      expect(session.isReadyToResume()).toBe(true);
    });
  });

  describe('conversion', () => {
    test('toObject maps to snake_case', () => {
      const now = new Date();
      const session = new Session({ ...baseData, lastActive: now, floodWaitUntil: now });

      const obj = session.toObject();
      expect(obj).toMatchObject({
        admin_id: 'admin-1',
        session_string: 'string',
        status: SessionStatus.ACTIVE,
        auto_paused: 0,
      });
      expect(obj.last_active).toBe(now.toISOString());
    });

    test('fromDatabaseRow restores entity', () => {
      const row = {
        id: 1,
        admin_id: 'a',
        session_string: 's',
        status: 'paused',
        auto_paused: 1,
        pause_reason: 'Flood',
        flood_wait_until: '2024-01-01T00:00:00.000Z',
        last_error: 'err',
        last_active: '2024-01-01T00:00:00.000Z',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
      };

      const entity = Session.fromDatabaseRow(row);
      expect(entity.status).toBe(SessionStatus.PAUSED);
      expect(entity.autoPaused).toBe(true);
      expect(entity.floodWaitUntil).toBeInstanceOf(Date);
    });
  });
});
