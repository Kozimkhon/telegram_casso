/**
 * @fileoverview Unit tests for MessageRepository facade
 */

import MessageRepository from '../domain/MessageRepository.js';
import { Message } from '../../../core/entities/index.js';
import RepositoryFactory from '../domain/RepositoryFactory.js';

const buildOrmEntity = (overrides = {}) => ({
  id: 1,
  messageId: '10',
  forwardedMessageId: '20',
  status: 'success',
  errorMessage: null,
  retryCount: 0,
  groupedId: null,
  isGrouped: false,
  channelId: '-100',
  userId: '7',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MessageRepository (TypeORM facade)', () => {
  let repository;
  let mockOrmRepo;
  let getRepoSpy;

  beforeEach(() => {
    mockOrmRepo = {
      findAll: jest.fn().mockResolvedValue([
        buildOrmEntity({ status: 'success', channelId: '-100' }),
        buildOrmEntity({ id: 2, status: 'failed', channelId: '-200' }),
      ]),
      findById: jest.fn().mockResolvedValue(buildOrmEntity()),
      findByChannel: jest.fn().mockResolvedValue([
        buildOrmEntity({ messageId: '111' }),
        buildOrmEntity({ messageId: '222' }),
      ]),
      create: jest.fn().mockImplementation(async (data) => buildOrmEntity(data)),
      update: jest.fn().mockImplementation(async (id, data) =>
        buildOrmEntity({ id, ...data })
      ),
      delete: jest.fn().mockResolvedValue(true),
      markAsSent: jest.fn().mockResolvedValue(),
      markAsFailed: jest.fn().mockResolvedValue(),
      markAsDeleted: jest.fn().mockResolvedValue(),
      findByGroupedId: jest.fn().mockResolvedValue([
        buildOrmEntity({ groupedId: 'grp', isGrouped: true }),
      ]),
      findOldGroupedMessages: jest.fn().mockResolvedValue(
        new Map([
          [
            '7:grp',
            [buildOrmEntity({ groupedId: 'grp', isGrouped: true, userId: '7' })],
          ],
        ])
      ),
      findOldMessages: jest.fn().mockResolvedValue([
        buildOrmEntity({ id: 3 }),
      ]),
    };

    getRepoSpy = jest
      .spyOn(RepositoryFactory, 'getMessageRepository')
      .mockReturnValue(mockOrmRepo);

    repository = new MessageRepository();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('findAll applies filters and maps to domain entities', async () => {
    const result = await repository.findAll({
      status: 'success',
      channelId: '-100',
      limit: 1,
    });

    expect(mockOrmRepo.findAll).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(Message);
    expect(result[0].status).toBe('success');
  });

  test('create converts entity to ORM shape', async () => {
    const entity = new Message({
      messageId: '300',
      channelId: '-100',
      userId: '7',
      forwardedMessageId: '400',
      status: 'success',
    });

    const created = await repository.create(entity);

    expect(mockOrmRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: '300',
        forwardedMessageId: '400',
        channelId: '-100',
        userId: '7',
        status: 'success',
      })
    );
    expect(created).toBeInstanceOf(Message);
    expect(created.messageId).toBe('300');
  });

  test('update maps snake_case payload to camelCase', async () => {
    await repository.update(1, {
      forwarded_message_id: '9',
      status: 'failed',
      error_message: 'err',
      retry_count: 3,
    });

    expect(mockOrmRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        forwardedMessageId: '9',
        status: 'failed',
        errorMessage: 'err',
        retryCount: 3,
      })
    );
  });

  test('markAsSent / markAsFailed delegate to ORM and return domain entity', async () => {
    await repository.markAsSent(5);
    await repository.markAsFailed(5, 'boom');

    expect(mockOrmRepo.markAsSent).toHaveBeenCalledWith(5);
    expect(mockOrmRepo.markAsFailed).toHaveBeenCalledWith(5, 'boom');
    expect(mockOrmRepo.findById).toHaveBeenCalledTimes(2);
  });

  test('getForwardingStatistics aggregates counts and success rate', async () => {
    const stats = await repository.getForwardingStatistics();

    expect(stats).toEqual({
      total: 2,
      success: 1,
      failed: 1,
      skipped: 0,
      pending: 0,
      successRate: '50.00%',
    });
  });

  test('findByForwardedMessageId filters by provided IDs and maps results', async () => {
    mockOrmRepo.findByChannel.mockResolvedValue([
      buildOrmEntity({ messageId: '100' }),
      buildOrmEntity({ messageId: '200' }),
      buildOrmEntity({ messageId: '300' }),
    ]);

    const messages = await repository.findByForwardedMessageId('-100', [100, 300]);

    expect(mockOrmRepo.findByChannel).toHaveBeenCalledWith('-100');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeInstanceOf(Message);
  });

  test('findOldGroupedMessages converts Map values to domain entities', async () => {
    const results = await repository.findOldGroupedMessages();

    expect(mockOrmRepo.findOldGroupedMessages).toHaveBeenCalledWith(7);
    expect(results).toBeInstanceOf(Map);
    const [firstKey, value] = results.entries().next().value;
    expect(firstKey).toBe('7:grp');
    expect(value[0]).toBeInstanceOf(Message);
  });

  test('markAsDeleted proxies to ORM repo', async () => {
    await repository.markAsDeleted('7', '500');
    expect(mockOrmRepo.markAsDeleted).toHaveBeenCalledWith('7', '500');
  });

  test('exists checks via findById', async () => {
    mockOrmRepo.findById.mockResolvedValue(null);
    const result = await repository.exists(99);
    expect(result).toBe(false);
  });
});
