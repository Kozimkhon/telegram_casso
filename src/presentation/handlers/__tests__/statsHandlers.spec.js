/**
 * @fileoverview Tests for stats handlers
 */

import { Markup } from 'telegraf';
import { createStatsHandlers } from '../statsHandlers.js';

jest.mock('telegraf', () => {
  const mockInlineKeyboard = jest
    .fn()
    .mockImplementation((buttons) => ({ reply_markup: buttons }));
  const mockCallbackButton = jest
    .fn()
    .mockImplementation((text, data) => ({ text, callback_data: data }));

  return {
    Markup: {
      inlineKeyboard: mockInlineKeyboard,
      button: { callback: mockCallbackButton },
    },
  };
});

const buildCtx = () => ({
  editMessageText: jest.fn(),
  reply: jest.fn(),
});

describe('statsHandlers', () => {
  let dependencies;
  let handlers;

  beforeEach(() => {
    dependencies = {
      getForwardingStatsUseCase: {
        execute: jest.fn().mockResolvedValue({
          statistics: {
            total: 10,
            success: 7,
            failed: 2,
            skipped: 1,
            pending: 0,
            successRate: '70%',
          },
        }),
      },
      metricsService: {
        getOverallMetrics: jest.fn().mockResolvedValue({
          sessions: { active: 1, paused: 0, error: 0 },
          channels: { total: 2, enabled: 2, disabled: 0 },
          users: { total: 3, withUsername: 2 },
          messages: { total: 100, successRate: 70 },
        }),
      },
      sessionRepository: {
        findAll: jest.fn().mockResolvedValue([
          {
            adminId: '1',
            status: 'active',
            autoPaused: true,
            pauseReason: 'Flood',
            floodWaitUntil: new Date(Date.now() + 5 * 60000).toISOString(),
          },
        ]),
      },
    };

    handlers = createStatsHandlers(dependencies);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('handleForwardingStats renders statistics', async () => {
    const ctx = buildCtx();
    await handlers.handleForwardingStats(ctx);

    expect(dependencies.getForwardingStatsUseCase.execute).toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('*Total Messages:* 10'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
    expect(Markup.inlineKeyboard).toHaveBeenCalled();
  });

  test('handleForwardingStats falls back to reply on error', async () => {
    const errorCtx = buildCtx();
    dependencies.getForwardingStatsUseCase.execute.mockRejectedValueOnce(
      new Error('boom')
    );

    await handlers.handleForwardingStats(errorCtx);

    expect(errorCtx.reply).toHaveBeenCalledWith('? Error loading statistics');
  });

  test('handleSystemStats renders metrics info', async () => {
    const ctx = buildCtx();
    await handlers.handleSystemStats(ctx);

    expect(dependencies.metricsService.getOverallMetrics).toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('*System Statistics*'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  test('handleSystemStats replies on failure', async () => {
    dependencies.metricsService.getOverallMetrics.mockRejectedValueOnce(
      new Error('no metrics')
    );
    const ctx = buildCtx();

    await handlers.handleSystemStats(ctx);
    expect(ctx.reply).toHaveBeenCalledWith('? Error loading statistics');
  });

  test('handleStats delegates to system stats handler', async () => {
    const ctx = buildCtx();
    await handlers.handleStats(ctx);

    expect(dependencies.metricsService.getOverallMetrics).toHaveBeenCalledTimes(1);
  });

  test('handleQueueStatus renders per-session info and summary', async () => {
    const ctx = buildCtx();

    await handlers.handleQueueStatus(ctx);

    expect(dependencies.sessionRepository.findAll).toHaveBeenCalled();
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('*Session Summary*'),
      expect.objectContaining({ parse_mode: 'Markdown' })
    );
  });

  test('handleQueueStatus handles empty sessions and errors', async () => {
    dependencies.sessionRepository.findAll.mockResolvedValueOnce([]);
    const emptyCtx = buildCtx();
    await handlers.handleQueueStatus(emptyCtx);
    expect(emptyCtx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('No active sessions'),
      expect.any(Object)
    );

    dependencies.sessionRepository.findAll.mockRejectedValueOnce(
      new Error('db down')
    );
    const errorCtx = buildCtx();
    await handlers.handleQueueStatus(errorCtx);
    expect(errorCtx.reply).toHaveBeenCalledWith('? Error loading queue status');
  });
});
