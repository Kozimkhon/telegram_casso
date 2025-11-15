/**
 * @fileoverview Unit tests for ChannelRepository facade
 */

import { jest } from '@jest/globals';
import ChannelRepository from '../domain/ChannelRepository.js';
import { Channel } from '../../../core/entities/index.js';
import RepositoryFactory from '../domain/RepositoryFactory.js';

const buildOrmChannel = (overrides = {}) => ({
  id: 1,
  channelId: '-100',
  accessHash: 'hash',
  title: 'Channel',
  username: 'channel',
  memberCount: 10,
  forwardEnabled: true,
  throttleDelayMs: 1000,
  throttlePerMemberMs: 10,
  minDelayMs: 500,
  maxDelayMs: 1500,
  scheduleEnabled: false,
  scheduleConfig: null,
  adminId: 'admin',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ChannelRepository', () => {
  let repository;
  let mockOrmRepo;

  beforeEach(() => {
    mockOrmRepo = {
      findAll: jest.fn().mockResolvedValue([
        buildOrmChannel({ channelId: '-100', forwardEnabled: true }),
        buildOrmChannel({ id: 2, channelId: '-200', forwardEnabled: false }),
      ]),
      findWithForwardingEnabled: jest
        .fn()
        .mockResolvedValue([buildOrmChannel({ forwardEnabled: true })]),
      findById: jest.fn().mockResolvedValue(buildOrmChannel()),
      findByChannelId: jest.fn().mockResolvedValue(buildOrmChannel()),
      create: jest.fn().mockImplementation(async (data) => buildOrmChannel(data)),
      update: jest
        .fn()
        .mockImplementation(async (id, data) => buildOrmChannel({ id, ...data })),
      delete: jest.fn().mockResolvedValue(true),
      toggleForwarding: jest.fn().mockResolvedValue(),
      findByAdmin: jest.fn().mockResolvedValue([buildOrmChannel({ adminId: 'a1' })]),
    };

    jest
      .spyOn(RepositoryFactory, 'getChannelRepository')
      .mockReturnValue(mockOrmRepo);

    repository = new ChannelRepository();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('findAll chooses correct ORM method based on filters', async () => {
    const enabled = await repository.findAll({ enabled: true });
    expect(mockOrmRepo.findWithForwardingEnabled).toHaveBeenCalled();
    expect(enabled[0]).toBeInstanceOf(Channel);

    const all = await repository.findAll();
    expect(mockOrmRepo.findAll).toHaveBeenCalled();
    expect(all).toHaveLength(2);
  });

  test('create maps entity to ORM shape', async () => {
    const channel = {
      toObject: () => ({
        channel_id: '-500',
        title: 'Test',
        username: 'test',
        member_count: 1,
        forward_enabled: 0,
        throttle_delay_ms: 500,
        throttle_per_member_ms: 20,
        min_delay_ms: 100,
        max_delay_ms: 200,
        schedule_enabled: 1,
        schedule_config: { tz: 'UTC' },
        admin_id: 'admin',
        access_hash: 'hash',
      }),
    };

    const created = await repository.create(channel);

    expect(mockOrmRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: '-500',
        memberCount: 1,
        forwardEnabled: false,
        scheduleEnabled: true,
        scheduleConfig: { tz: 'UTC' },
        accessHash: 'hash',
      })
    );
    expect(created).toBeInstanceOf(Channel);
    expect(created.channelId).toBe('-500');
  });

  test('update converts snake_case fields to camelCase', async () => {
    await repository.update(7, {
      title: 'New',
      username: 'new',
      member_count: 25,
      forward_enabled: false,
      throttle_delay_ms: 700,
      throttle_per_member_ms: 30,
      min_delay_ms: 50,
      max_delay_ms: 400,
      schedule_enabled: true,
      schedule_config: { cron: '*' },
      admin_id: 'a2',
      access_hash: 'hash2',
    });

    expect(mockOrmRepo.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        title: 'New',
        username: 'new',
        memberCount: 25,
        forwardEnabled: false,
        throttleDelayMs: 700,
        throttlePerMemberMs: 30,
        minDelayMs: 50,
        maxDelayMs: 400,
        scheduleEnabled: true,
        scheduleConfig: { cron: '*' },
        adminId: 'a2',
        accessHash: 'hash2',
      })
    );
  });

  test('toggleForwarding throws when channel missing', async () => {
    mockOrmRepo.findByChannelId.mockResolvedValue(null);
    await expect(repository.toggleForwarding('-999')).rejects.toThrow(
      'Channel not found: -999'
    );
  });

  test('toggleForwarding toggles and reloads entity', async () => {
    await repository.toggleForwarding('-100');

    expect(mockOrmRepo.toggleForwarding).toHaveBeenCalledWith('-100');
    expect(mockOrmRepo.findById).toHaveBeenCalled();
  });

  test('getStatistics aggregates counts', async () => {
    const stats = await repository.getStatistics();
    expect(stats).toEqual({
      total: 2,
      enabled: 1,
      disabled: 1,
      totalMembers: 20,
    });
  });

  test('findByAdminSession maps results to domain entities', async () => {
    const channels = await repository.findByAdminSession('a1');
    expect(mockOrmRepo.findByAdmin).toHaveBeenCalledWith('a1');
    expect(channels[0]).toBeInstanceOf(Channel);
  });
});
