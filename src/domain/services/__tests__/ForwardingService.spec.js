/**
 * @fileoverview ForwardingService tests with flow tracing
 */

import ForwardingService from '../ForwardingService.js';
import { ForwardingStatus } from '../../../shared/constants/index.js';
import Message from '../../../core/entities/domain/Message.entity.js';

describe('ForwardingService', () => {
  let mockUserRepository;
  let mockMessageRepository;
  let mockThrottleService;
  let mockStateManager;
  let mockLogger;
  let service;

  beforeEach(() => {
    mockUserRepository = {
      findByChannel: jest.fn().mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]),
    };

    mockMessageRepository = {
      create: jest.fn().mockResolvedValue(null),
      findByForwardedMessageId: jest.fn().mockResolvedValue([
        new Message({
          messageId: '10',
          channelId: '-100',
          userId: 'user-1',
          forwardedMessageId: '500',
          status: ForwardingStatus.SUCCESS,
        }),
        new Message({
          messageId: '11',
          channelId: '-100',
          userId: 'user-1',
          forwardedMessageId: '600',
          status: ForwardingStatus.SUCCESS,
        }),
        new Message({
          messageId: '12',
          channelId: '-100',
          userId: 'user-2',
          forwardedMessageId: '700',
          status: ForwardingStatus.SUCCESS,
        }),
      ]),
      markAsDeleted: jest.fn(),
    };

    mockThrottleService = {
      waitForThrottle: jest.fn().mockResolvedValue(),
      clearUserThrottle: jest.fn(),
      reset: jest.fn(),
      getStatistics: jest.fn().mockReturnValue({ tokens: 10 }),
    };

    mockStateManager = {};

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new ForwardingService({
      userRepository: mockUserRepository,
      messageRepository: mockMessageRepository,
      throttleService: mockThrottleService,
      stateManager: mockStateManager,
      logger: mockLogger,
    });
  });

  describe('forwardToChannelUsers', () => {
    test('flows through throttle → forwarder → persistence with trace logs', async () => {
      const message = { id: 1 };
      const forwarder = jest.fn().mockResolvedValue({ id: '900' });

      const summary = await service.forwardToChannelUsers('-100', message, forwarder);

      expect(mockUserRepository.findByChannel).toHaveBeenCalledWith('-100');
      expect(mockThrottleService.waitForThrottle).toHaveBeenCalledTimes(2);
      expect(forwarder).toHaveBeenCalledTimes(2);
      expect(mockMessageRepository.create).toHaveBeenCalledTimes(2);
      expect(summary).toEqual(
        expect.objectContaining({ total: 2, successful: 2, failed: 0 })
      );

      const debugMessages = mockLogger.debug.mock.calls.map((call) => call[0]);
      expect(debugMessages).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Starting batch forwarding'),
          expect.stringContaining('Waiting for throttle'),
          expect.stringContaining('Throttle granted, forwarding'),
          expect.stringContaining('Forwarded single message'),
        ])
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Batch forwarding completed'),
        expect.objectContaining({ successful: 2 })
      );
    });

    test('handles grouped forward results for flow tracing', async () => {
      const forwarder = jest.fn().mockResolvedValue({
        count: 2,
        groupedId: 'grp-1',
        result: [
          { id: '300', groupedId: 'grp-1', fwdFrom: { channelPost: 900 } },
          { id: '301', groupedId: 'grp-1', fwdFrom: { channelPost: 901 } },
        ],
      });

      await service.forwardToChannelUsers('-100', { id: 5 }, forwarder);

      expect(mockMessageRepository.create).toHaveBeenCalledTimes(4);
      const groupedCall = mockMessageRepository.create.mock.calls.find(
        ([msg]) => msg.groupedId === 'grp-1'
      );
      expect(groupedCall).toBeDefined();
    });

    test('records failures and triggers flood wait handling', async () => {
      const forwarder = jest
        .fn()
        .mockResolvedValueOnce({ id: '900' })
        .mockRejectedValueOnce(
          Object.assign(new Error('FLOOD_WAIT_30'), {
            isFloodWait: true,
            seconds: 30,
            adminId: 'admin',
          })
        );
      const floodSpy = jest.spyOn(service, 'handleFloodWait').mockResolvedValue();

      const result = await service.forwardToChannelUsers('-100', { id: 1 }, forwarder);

      expect(result.failed).toBe(1);
      expect(mockMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ForwardingStatus.FAILED })
      );
      expect(floodSpy).toHaveBeenCalledWith('admin', 30);
    });
  });

  describe('deleteForwardedMessages', () => {
    test('deletes grouped forwarded messages per user', async () => {
      const deleter = jest.fn().mockResolvedValue();

      const summary = await service.deleteForwardedMessages('-100', [111, 222], deleter);

      expect(mockMessageRepository.findByForwardedMessageId).toHaveBeenCalledWith(
        '-100',
        [111, 222]
      );
      expect(mockThrottleService.waitForThrottle).toHaveBeenCalledTimes(2);
      expect(deleter).toHaveBeenCalledWith('user-1', ['500', '600']);
      expect(mockMessageRepository.markAsDeleted).toHaveBeenCalledTimes(3);
      expect(summary).toEqual(expect.objectContaining({ deleted: 3, failed: 0 }));
    });

    test('captures deletion failures per user', async () => {
      const deleter = jest.fn().mockImplementation(() => {
        throw new Error('delete failed');
      });

      const summary = await service.deleteForwardedMessages('-100', [111], deleter);

      expect(summary.failed).toBe(3);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete message'),
        expect.objectContaining({ error: 'delete failed' })
      );
    });
  });
});
