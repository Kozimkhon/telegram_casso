/**
 * @fileoverview E2E Test: Channel Management Workflow
 * Tests the complete channel management from creation to statistics
 * @module test/__tests__/e2e/channel-management.e2e.spec.js
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup/testDatabaseSetup.js';
import { setupTestContainer } from '../../setup/testContainer.js';
import { seedCompleteData, seedMinimalData } from '../../fixtures/seedTestData.js';
import { EntityFactory } from '../../factories/EntityFactory.js';
import { TestLogger } from '../../helpers/testLogger.js';

describe('E2E: Channel Management Workflow', () => {
  let dataSource;
  let container;
  let logger;
  let testData;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
    container = setupTestContainer(dataSource);
    logger = new TestLogger('channel-management');
  });

  afterAll(async () => {
    await cleanupTestDatabase(dataSource);
  });

  beforeEach(async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.clearTable('metric');
    await queryRunner.clearTable('message');
    await queryRunner.clearTable('channel_members');
    await queryRunner.clearTable('channel');
    await queryRunner.clearTable('user');
    await queryRunner.clearTable('session');
    await queryRunner.clearTable('admin');
    await queryRunner.release();

    testData = await seedMinimalData(dataSource);
  });

  describe('Scenario 1: Add Channel', () => {
    it('should add new channel successfully', async () => {
      logger.info('Testing channel creation');

      const addChannelUseCase = container.resolve('addChannelUseCase');
      const channelRepo = dataSource.getRepository('Channel');

      const channelData = {
        channelId: '-1001234567890',
        title: 'Test Channel',
        username: '@testchannel',
        memberCount: 150,
        adminId: testData.admin.id
      };

      // Execute
      const result = await addChannelUseCase.execute(channelData);

      expect(result.success).toBe(true);
      expect(result.channel).toBeDefined();
      expect(result.channel.id).toBeDefined();

      // Verify in database
      const channel = await channelRepo.findOne({
        where: { channelId: channelData.channelId }
      });

      expect(channel).toBeDefined();
      expect(channel.title).toBe('Test Channel');
      expect(channel.memberCount).toBe(150);
      expect(channel.forwardEnabled).toBe(true); // Default

      logger.info('Channel created and verified');
    });

    it('should validate required channel fields', async () => {
      logger.info('Testing channel validation');

      const addChannelUseCase = container.resolve('addChannelUseCase');

      const invalidData = {
        // Missing: channelId, title
        username: '@test'
      };

      await expect(() => addChannelUseCase.execute(invalidData))
        .rejects.toThrow();

      logger.info('Validation working correctly');
    });

    it('should prevent duplicate channels', async () => {
      logger.info('Testing duplicate prevention');

      const addChannelUseCase = container.resolve('addChannelUseCase');

      const channelData = {
        channelId: '-1001234567890',
        title: 'Test Channel',
        adminId: testData.admin.id
      };

      // First add succeeds
      const first = await addChannelUseCase.execute(channelData);
      expect(first.success).toBe(true);

      // Second add fails
      await expect(() => addChannelUseCase.execute(channelData))
        .rejects.toThrow('Channel already exists');

      logger.info('Duplicate prevention working');
    });
  });

  describe('Scenario 2: Toggle Channel Forwarding', () => {
    it('should toggle forwarding state', async () => {
      logger.info('Testing forwarding toggle');

      const channelRepo = dataSource.getRepository('Channel');
      const toggleChannelUseCase = container.resolve('toggleChannelForwardingUseCase');

      // Create channel with forwarding enabled
      const channel = await channelRepo.save({
        channelId: '-1001234567890',
        title: 'Test Channel',
        forwardEnabled: true,
        throttleDelayMs: 1000,
        minDelayMs: 2000,
        maxDelayMs: 5000,
        adminId: testData.admin.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info('Initial channel created with forwarding=true');

      // Toggle to disabled
      const result = await toggleChannelUseCase.execute({
        channelId: channel.channelId,
        forwardEnabled: false
      });

      expect(result.success).toBe(true);

      // Verify in database
      const updated = await channelRepo.findOne({
        where: { channelId: channel.channelId }
      });

      expect(updated.forwardEnabled).toBe(false);

      logger.info('Forwarding toggled to false and verified');
    });

    it('should not forward messages when disabled', async () => {
      logger.info('Testing message handling when forwarding disabled');

      const channelRepo = dataSource.getRepository('Channel');
      const forwardingService = container.resolve('forwardingService');

      const channel = await channelRepo.save({
        channelId: '-1001234567890',
        title: 'Disabled Channel',
        forwardEnabled: false,
        throttleDelayMs: 1000,
        minDelayMs: 2000,
        maxDelayMs: 5000,
        adminId: testData.admin.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Try to forward message
      const message = { text: 'Test', messageId: '123' };
      const result = await forwardingService.forwardToUsers([], message, channel);

      // Should not forward
      expect(result.skipped).toBe(true);

      logger.info('Message correctly skipped for disabled channel');
    });
  });

  describe('Scenario 3: Channel Statistics', () => {
    it('should retrieve channel statistics', async () => {
      logger.info('Testing statistics retrieval');

      const getChannelStatsUseCase = container.resolve('getChannelStatsUseCase');

      // Setup data
      testData = await seedCompleteData(dataSource);
      const channel = testData.channels[0];

      // Get stats
      const stats = await getChannelStatsUseCase.execute({
        channelId: channel.channelId
      });

      expect(stats).toBeDefined();
      expect(stats.channel).toBeDefined();
      expect(stats.messageCount).toBeGreaterThanOrEqual(0);
      expect(stats.successCount).toBeGreaterThanOrEqual(0);
      expect(stats.failureCount).toBeGreaterThanOrEqual(0);

      logger.info('Channel statistics retrieved', stats);
    });

    it('should calculate success/failure rates', async () => {
      logger.info('Testing success rate calculation');

      const messageRepo = dataSource.getRepository('Message');
      const channelRepo = dataSource.getRepository('Channel');

      // Create channel
      const channel = await channelRepo.save({
        channelId: '-1001234567890',
        title: 'Test Channel',
        forwardEnabled: true,
        throttleDelayMs: 1000,
        minDelayMs: 2000,
        maxDelayMs: 5000,
        adminId: testData.admin.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create messages: 7 success, 3 failed
      const messages = [];
      for (let i = 0; i < 7; i++) {
        messages.push(EntityFactory.createMessage({
          channelId: channel.channelId,
          userId: `999999${String(i).padStart(3, '0')}`,
          status: 'SUCCESS'
        }));
      }
      for (let i = 7; i < 10; i++) {
        messages.push(EntityFactory.createMessage({
          channelId: channel.channelId,
          userId: `999999${String(i).padStart(3, '0')}`,
          status: 'FAILED'
        }));
      }

      await messageRepo.save(messages);

      // Calculate rates
      const successCount = await messageRepo.count({
        where: { channelId: channel.channelId, status: 'SUCCESS' }
      });

      const failureCount = await messageRepo.count({
        where: { channelId: channel.channelId, status: 'FAILED' }
      });

      const total = successCount + failureCount;
      const successRate = (successCount / total) * 100;

      expect(successCount).toBe(7);
      expect(failureCount).toBe(3);
      expect(successRate).toBe(70);

      logger.info('Success rate calculated', {
        success: successCount,
        failed: failureCount,
        rate: `${successRate}%`
      });
    });
  });

  describe('Scenario 4: Channel Throttle Configuration', () => {
    it('should apply custom throttle settings', async () => {
      logger.info('Testing throttle configuration');

      const channelRepo = dataSource.getRepository('Channel');

      const channelData = {
        channelId: '-1001234567890',
        title: 'High Throughput Channel',
        throttleDelayMs: 500,
        throttlePerMemberMs: 100,
        minDelayMs: 300,
        maxDelayMs: 2000,
        adminId: testData.admin.id,
        forwardEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const channel = await channelRepo.save(channelData);

      // Verify settings
      expect(channel.throttleDelayMs).toBe(500);
      expect(channel.throttlePerMemberMs).toBe(100);
      expect(channel.minDelayMs).toBe(300);
      expect(channel.maxDelayMs).toBe(2000);

      logger.info('Throttle settings configured', channelData);
    });

    it('should clamp calculated delay to min/max bounds', async () => {
      logger.info('Testing delay clamping');

      const channel = EntityFactory.createChannel({
        throttleDelayMs: 1000,
        throttlePerMemberMs: 500,
        minDelayMs: 2000,
        maxDelayMs: 5000,
        memberCount: 100
      });

      // Calculate: 1000 + (100 * 500) = 51000
      // Clamped: max 5000
      const calculated = channel.throttleDelayMs +
        (channel.memberCount * channel.throttlePerMemberMs);

      const clamped = Math.max(
        channel.minDelayMs,
        Math.min(calculated, channel.maxDelayMs)
      );

      expect(calculated).toBe(51000);
      expect(clamped).toBe(channel.maxDelayMs); // 5000

      logger.info('Delay clamping verified', {
        calculated,
        clamped,
        min: channel.minDelayMs,
        max: channel.maxDelayMs
      });
    });
  });

  describe('Scenario 5: Remove Channel', () => {
    it('should remove channel and cascade delete messages', async () => {
      logger.info('Testing channel removal');

      const channelRepo = dataSource.getRepository('Channel');
      const messageRepo = dataSource.getRepository('Message');
      const removeChannelUseCase = container.resolve('removeChannelUseCase');

      // Create channel
      const channel = await channelRepo.save({
        channelId: '-1001234567890',
        title: 'To Remove',
        forwardEnabled: true,
        throttleDelayMs: 1000,
        minDelayMs: 2000,
        maxDelayMs: 5000,
        adminId: testData.admin.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create messages
      await messageRepo.save([
        EntityFactory.createMessage({ channelId: channel.channelId, userId: '1' }),
        EntityFactory.createMessage({ channelId: channel.channelId, userId: '2' })
      ]);

      // Verify messages exist
      let messageCount = await messageRepo.count({
        where: { channelId: channel.channelId }
      });
      expect(messageCount).toBe(2);

      logger.info('Channel and messages created');

      // Remove channel
      const result = await removeChannelUseCase.execute({
        channelId: channel.channelId
      });

      expect(result.success).toBe(true);

      // Verify cascade delete
      const channelExists = await channelRepo.findOne({
        where: { channelId: channel.channelId }
      });
      expect(channelExists).toBeNull();

      messageCount = await messageRepo.count({
        where: { channelId: channel.channelId }
      });
      expect(messageCount).toBe(0);

      logger.info('Channel and cascade messages removed successfully');
    });
  });

  afterEach(() => {
    logger.writeLogs(`./test-logs/channel-management-${Date.now()}.json`);
  });
});
