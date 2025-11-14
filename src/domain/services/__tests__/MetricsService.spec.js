/**
 * @fileoverview Tests for MetricsService
 */

import MetricsService from '../MetricsService.js';

describe('MetricsService', () => {
  let repositories;
  let service;

  beforeEach(() => {
    repositories = {
      sessionRepository: {
        getStatistics: jest.fn().mockResolvedValue({ active: 1 }),
        findByStatus: jest.fn().mockResolvedValue([{ id: 1 }]),
      },
      channelRepository: {
        getStatistics: jest.fn().mockResolvedValue({ total: 2 }),
        findById: jest.fn().mockResolvedValue({
          channelId: '-100',
          title: 'Channel',
          memberCount: 10,
          forwardEnabled: true,
          adminId: 'admin',
        }),
        findEnabled: jest.fn().mockResolvedValue([{ id: 'channel' }]),
      },
      userRepository: {
        getStatistics: jest.fn().mockResolvedValue({ total: 3 }),
        findByChannel: jest.fn().mockResolvedValue([
          { hasUsername: () => true },
          { hasUsername: () => false },
        ]),
      },
      messageRepository: {
        getForwardingStatistics: jest.fn().mockResolvedValue({ total: 4 }),
        findByChannel: jest.fn().mockResolvedValue([{ id: 1 }]),
        findAll: jest.fn().mockResolvedValue([{ id: 1 }]),
      },
      adminRepository: {
        getStatistics: jest.fn().mockResolvedValue({ total: 1 }),
      },
    };

    service = new MetricsService(repositories);
  });

  test('getOverallMetrics aggregates repository stats', async () => {
    const metrics = await service.getOverallMetrics();

    expect(repositories.sessionRepository.getStatistics).toHaveBeenCalled();
    expect(metrics).toMatchObject({
      sessions: { active: 1 },
      channels: { total: 2 },
      users: { total: 3 },
      messages: { total: 4 },
      admins: { total: 1 },
    });
    expect(metrics.timestamp).toBeDefined();
  });

  test('getSessionMetrics returns session stats directly', async () => {
    const stats = await service.getSessionMetrics();
    expect(stats).toEqual({ active: 1 });
  });

  describe('getChannelMetrics', () => {
    test('returns aggregate stats when no channelId', async () => {
      const stats = await service.getChannelMetrics();
      expect(stats).toEqual({ total: 2 });
    });

    test('returns channel-specific metrics', async () => {
      const stats = await service.getChannelMetrics('-100');

      expect(repositories.channelRepository.findById).toHaveBeenCalledWith('-100');
      expect(stats).toMatchObject({
        channel: {
          id: '-100',
          title: 'Channel',
        },
        metrics: {
          totalUsers: 2,
          totalMessages: 1,
          usersWithUsername: 1,
        },
      });
    });

    test('throws when channel not found', async () => {
      repositories.channelRepository.findById.mockResolvedValueOnce(null);
      await expect(service.getChannelMetrics('-200')).rejects.toThrow('Channel not found');
    });
  });

  test('getForwardingMetrics proxies to message repository', async () => {
    const filters = { status: 'failed' };
    await service.getForwardingMetrics(filters);
    expect(repositories.messageRepository.getForwardingStatistics).toHaveBeenCalledWith(filters);
  });

  test('daily/weekly metrics call forwarding metrics with date filters', async () => {
    await service.getDailyMetrics();
    await service.getWeeklyMetrics();

    expect(repositories.messageRepository.getForwardingStatistics).toHaveBeenCalledTimes(2);
  });

  test('getHealthStatus composes health object', async () => {
    const health = await service.getHealthStatus();

    expect(repositories.sessionRepository.findByStatus).toHaveBeenCalledWith('active');
    expect(health).toMatchObject({
      healthy: true,
      activeSessions: 1,
      enabledChannels: 1,
      recentActivity: true,
    });
  });
});
