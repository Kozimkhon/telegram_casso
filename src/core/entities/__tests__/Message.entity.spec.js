/**
 * @fileoverview Unit tests for Message entity
 */

import Message from '../domain/Message.entity.js';
import { ForwardingStatus } from '../../../shared/constants/index.js';

describe('Message.entity', () => {
  const baseData = {
    messageId: '100',
    channelId: '-1001',
    userId: '42',
    forwardedMessageId: '200',
    status: ForwardingStatus.SUCCESS,
    groupedId: 'album-1',
    isGrouped: true,
    retryCount: 2,
    errorMessage: null,
  };

  describe('constructor & validation', () => {
    test('creates entity with default values', () => {
      const message = new Message({
        messageId: '1',
        channelId: '-100',
        userId: '99',
      });

      expect(message.status).toBe(ForwardingStatus.PENDING);
      expect(message.retryCount).toBe(0);
      expect(message.forwardedMessageId).toBeNull();
      expect(message.errorMessage).toBeNull();
      expect(message.id).toBeNull();
      expect(message.createdAt).toBeInstanceOf(Date);
      expect(message.updatedAt).toBeInstanceOf(Date);
    });

    test.each([
      ['Message ID is required', { messageId: undefined }],
      ['Channel ID is required', { channelId: undefined }],
      ['User ID is required', { userId: undefined }],
    ])('throws when %s', (_, override) => {
      expect(() => new Message({ ...baseData, ...override })).toThrow();
    });

    test('rejects invalid status values', () => {
      expect(
        () => new Message({ ...baseData, status: 'INVALID' })
      ).toThrow(/Invalid status/);
    });
  });

  describe('state transitions', () => {
    test('markSuccess updates status and forwarded id', () => {
      const message = new Message(baseData);
      message.markSuccess('500');

      expect(message.status).toBe(ForwardingStatus.SUCCESS);
      expect(message.forwardedMessageId).toBe('500');
      expect(message.errorMessage).toBeNull();
    });

    test('markFailed stores error message', () => {
      const message = new Message(baseData);
      message.markFailed('boom');

      expect(message.status).toBe(ForwardingStatus.FAILED);
      expect(message.errorMessage).toBe('boom');
    });

    test('markSkipped stores skip reason', () => {
      const message = new Message(baseData);
      message.markSkipped('duplicate');

      expect(message.status).toBe(ForwardingStatus.SKIPPED);
      expect(message.errorMessage).toBe('duplicate');
    });

    test('incrementRetry increases retry count', () => {
      const message = new Message(baseData);
      message.incrementRetry();
      expect(message.retryCount).toBe(3);
    });

    test('markDeleted clears forwarded id', () => {
      const message = new Message(baseData);
      message.markDeleted();
      expect(message.forwardedMessageId).toBeNull();
    });
  });

  describe('boolean helpers', () => {
    test('isSuccessful/isFailed/isSkipped reflect status', () => {
      const success = new Message(baseData);
      expect(success.isSuccessful()).toBe(true);
      expect(success.isFailed()).toBe(false);

      const failed = new Message({ ...baseData, status: ForwardingStatus.FAILED });
      expect(failed.isFailed()).toBe(true);

      const skipped = new Message({ ...baseData, status: ForwardingStatus.SKIPPED });
      expect(skipped.isSkipped()).toBe(true);
    });

    test('isGroupedMessage requires grouped flag and id', () => {
      const grouped = new Message(baseData);
      expect(grouped.isGroupedMessage()).toBe(true);

      const withoutId = new Message({ ...baseData, groupedId: null });
      expect(withoutId.isGroupedMessage()).toBe(false);
    });
  });

  describe('conversion helpers', () => {
    test('toObject maps fields to snake_case', () => {
      const now = new Date();
      const message = new Message({ ...baseData, createdAt: now, updatedAt: now });

      const obj = message.toObject();
      expect(obj).toMatchObject({
        message_id: '100',
        channel_id: '-1001',
        user_id: '42',
        forwarded_message_id: '200',
        grouped_id: 'album-1',
        is_grouped: true,
        status: ForwardingStatus.SUCCESS,
        retry_count: 2,
        error_message: null,
      });
      expect(obj.created_at).toBe(now.toISOString());
      expect(obj.updated_at).toBe(now.toISOString());
    });

    test('fromDatabaseRow normalizes data', () => {
      const row = {
        id: 10,
        message_id: '500',
        forwarded_message_id: '900',
        status: 'non-existent',
        error_message: 'err',
        retry_count: 7,
        grouped_id: 'g1',
        is_grouped: 1,
        channel_id: '-10050',
        user_id: '77',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z',
      };

      const entity = Message.fromDatabaseRow(row);

      expect(entity.id).toBe(10);
      expect(entity.status).toBe(ForwardingStatus.PENDING);
      expect(entity.retryCount).toBe(7);
      expect(entity.forwardedMessageId).toBe('900');
      expect(entity.groupedId).toBe('g1');
      expect(Boolean(entity.isGrouped)).toBe(true);
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });
  });
});
