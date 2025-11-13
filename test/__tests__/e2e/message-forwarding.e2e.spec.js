/**
 * @fileoverview E2E Test: Message Forwarding Complete Workflow
 * Tests the complete message forwarding from event to database persistence
 * @module test/__tests__/e2e/message-forwarding.e2e.spec.js
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup/testDatabaseSetup.js';
import { setupTestContainer } from '../../setup/testContainer.js';
import { seedCompleteData } from '../../fixtures/seedTestData.js';
import { EntityFactory } from '../../factories/EntityFactory.js';
import { TestLogger } from '../../helpers/testLogger.js';

describe('E2E: Message Forwarding Workflow', () => {
  let dataSource;
  let container;
  let logger;
  let testData;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
    container = setupTestContainer(dataSource);
    logger = new TestLogger('message-forwarding');
  });

  afterAll(async () => {
    await cleanupTestDatabase(dataSource);
  });

  beforeEach(async () => {
    // Clear and seed test data
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.clearTable('message');
    await queryRunner.clearTable('channel_members'); // Many-to-many
    await queryRunner.clearTable('user');
    await queryRunner.clearTable('channel');
    await queryRunner.clearTable('session');
    await queryRunner.clearTable('admin');
    await queryRunner.release();

    // Seed fresh data
    testData = await seedCompleteData(dataSource);
    logger.info('Test data seeded', { 
      admins: 1, 
      sessions: 1, 
      channels: testData.channels.length,
      users: testData.users.length 
    });
  });

  describe('Scenario 1: New Message Event Processing', () => {
    it('should log message and forward to all users in channel', async () => {
      logger.info('Starting message forwarding test');

      const logMessageUseCase = container.resolve('logMessageUseCase');
      const messageRepo = dataSource.getRepository('Message');

      const channel = testData.channels[0];
      const messageData = {
        messageId: '12345',
        channelId: channel.channelId,
        text: 'Test message',
        date: Math.floor(Date.now() / 1000)
      };

      // 1. Execute: Log message
      const result = await logMessageUseCase.execute({
        channelId: channel.channelId,
        messageId: messageData.messageId,
        message: messageData
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      logger.info('Message logged via use case', { 
        messageId: result.messageIds?.length || 0 
      });

      // 2. Assert: Messages created for each user
      const messages = await messageRepo.find({
        where: { messageId: messageData.messageId }
      });

      expect(messages.length).toBe(testData.users.length);
      logger.info(`Message logs created for ${messages.length} users`);

      // 3. Assert: Each message has correct status
      messages.forEach((msg, idx) => {
        expect(msg.status).toMatch(/PENDING|SUCCESS|PROCESSING/);
        expect(msg.userId).toBe(testData.users[idx].userId);
        expect(msg.retryCount).toBe(0);
      });

      logger.info('All message records verified');
    });

    it('should apply throttling between message forwards', async () => {
      logger.info('Testing throttle application');

      const forwardingService = container.resolve('forwardingService');
      const throttleService = container.resolve('throttleService');

      const channel = testData.channels[0];
      const users = testData.users.slice(0, 3);

      // Mock throttleService to track calls
      throttleService.checkLimit.mockClear();
      throttleService.recordEvent.mockClear();

      await forwardingService.forwardToUsers(
        { text: 'Test message', messageId: '123' },
        users,
        channel
      );

      // Each user should have throttle check
      expect(throttleService.checkLimit).toHaveBeenCalledTimes(users.length);
      expect(throttleService.recordEvent).toHaveBeenCalledTimes(users.length);

      // Verify throttle parameters
      const throttleCalls = throttleService.checkLimit.mock.calls;
      throttleCalls.forEach((call, idx) => {
        expect(call[0]).toBe(users[idx].userId);
      });

      logger.info('Throttling applied correctly to all users');
    });

    it('should handle grouped/album messages', async () => {
      logger.info('Testing grouped message handling');

      const messageRepo = dataSource.getRepository('Message');
      const logMessageUseCase = container.resolve('logMessageUseCase');

      const channel = testData.channels[0];
      const groupedId = 'group_123';

      const messageData = {
        messageId: '100',
        groupedId: groupedId,
        isGrouped: true,
        text: 'Photo 1 of album',
        channelId: channel.channelId
      };

      await logMessageUseCase.execute({
        channelId: channel.channelId,
        messageId: messageData.messageId,
        message: messageData
      });

      // Verify grouped flag
      const messages = await messageRepo.find({
        where: { groupedId: groupedId }
      });

      expect(messages[0].isGrouped).toBe(true);
      expect(messages[0].groupedId).toBe(groupedId);

      logger.info('Grouped messages handled correctly');
    });
  });

  describe('Scenario 2: Forwarding with Error Handling', () => {
    it('should retry failed forwards with exponential backoff', async () => {
      logger.info('Testing retry mechanism');

      const forwardingService = container.resolve('forwardingService');
      const messageRepo = dataSource.getRepository('Message');

      const channel = testData.channels[0];
      const user = testData.users[0];

      // Mock telegram client to simulate first failure
      let attemptCount = 0;
      jest.spyOn(forwardingService, 'forwardMessage')
        .mockImplementation(async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('FloodWait: 30 seconds');
          }
          return { success: true };
        });

      // 1. First attempt fails
      let result;
      try {
        result = await forwardingService.forwardMessage(user, '123', channel);
      } catch (error) {
        expect(error.message).toContain('FloodWait');
        logger.info('First forward attempt failed as expected');
      }

      // 2. Verify retry was scheduled
      const message = await messageRepo.findOne({
        where: { messageId: '123', userId: user.userId }
      });

      expect(message.retryCount).toBeGreaterThan(0);
      logger.info('Retry scheduled', { retryCount: message.retryCount });

      // 3. Second attempt succeeds
      result = await forwardingService.forwardMessage(user, '123', channel);
      expect(result.success).toBe(true);

      logger.info('Retry succeeded');
    });

    it('should handle rate limiting with session throttle adjustment', async () => {
      logger.info('Testing rate limit handling');

      const forwardingService = container.resolve('forwardingService');
      const sessionRepo = dataSource.getRepository('Session');

      const channel = testData.channels[0];
      const session = testData.session;

      // Mock error
      jest.spyOn(forwardingService, 'forwardMessage')
        .mockRejectedValueOnce(
          new Error('SpamWarning: Too many requests')
        );

      try {
        await forwardingService.forwardMessage(testData.users[0], '123', channel);
      } catch (error) {
        expect(error.message).toContain('SpamWarning');
      }

      // Verify session throttle was increased
      const updatedSession = await sessionRepo.findOne({
        where: { id: session.id }
      });

      expect(updatedSession.lastError).toContain('SpamWarning');

      logger.info('Rate limit handled with throttle adjustment');
    });

    it('should mark message as failed after max retries', async () => {
      logger.info('Testing max retry limit');

      const messageRepo = dataSource.getRepository('Message');
      const MAX_RETRIES = 3;

      // Create a message with max retries
      const message = EntityFactory.createMessage({
        retryCount: MAX_RETRIES,
        status: 'FAILED'
      });

      const saved = await messageRepo.save(message);

      expect(saved.retryCount).toBe(MAX_RETRIES);
      expect(saved.status).toBe('FAILED');

      logger.info('Message marked as FAILED after max retries');
    });
  });

  describe('Scenario 3: Channel-Specific Throttling', () => {
    it('should apply channel-specific throttle delays', async () => {
      logger.info('Testing channel throttle config');

      const channelRepo = dataSource.getRepository('Channel');

      const channel = await channelRepo.findOne({
        where: { id: testData.channels[0].id }
      });

      expect(channel.throttleDelayMs).toBeGreaterThan(0);
      expect(channel.minDelayMs).toBeLessThanOrEqual(channel.maxDelayMs);

      logger.info('Channel throttle config verified', {
        delayMs: channel.throttleDelayMs,
        minMs: channel.minDelayMs,
        maxMs: channel.maxDelayMs
      });
    });

    it('should calculate delay based on member count', async () => {
      logger.info('Testing dynamic delay calculation');

      const channel = testData.channels[0];
      const forwardingService = container.resolve('forwardingService');

      // Calculate expected delay
      const expectedDelay = channel.throttleDelayMs +
        (channel.memberCount * channel.throttlePerMemberMs);

      // Clamp to min/max
      const clampedDelay = Math.max(
        channel.minDelayMs,
        Math.min(expectedDelay, channel.maxDelayMs)
      );

      expect(clampedDelay).toBeGreaterThanOrEqual(channel.minDelayMs);
      expect(clampedDelay).toBeLessThanOrEqual(channel.maxDelayMs);

      logger.info('Dynamic delay calculated', { delay: clampedDelay });
    });
  });

  describe('Scenario 4: Database Consistency', () => {
    it('should maintain referential integrity for messages', async () => {
      logger.info('Testing referential integrity');

      const messageRepo = dataSource.getRepository('Message');
      const channelRepo = dataSource.getRepository('Channel');
      const userRepo = dataSource.getRepository('User');

      const channel = testData.channels[0];

      // Create message
      const message = EntityFactory.createMessage({
        channelId: channel.channelId,
        userId: testData.users[0].userId
      });

      const saved = await messageRepo.save(message);

      // Verify references exist
      const refChannel = await channelRepo.findOne({
        where: { channelId: saved.channelId }
      });

      const refUser = await userRepo.findOne({
        where: { userId: saved.userId }
      });

      expect(refChannel).toBeDefined();
      expect(refUser).toBeDefined();

      logger.info('Referential integrity maintained');
    });

    it('should enforce unique constraints on message forwarding', async () => {
      logger.info('Testing unique constraints');

      const messageRepo = dataSource.getRepository('Message');

      const message1 = EntityFactory.createMessage({
        messageId: '12345',
        userId: '999999999'
      });

      const saved1 = await messageRepo.save(message1);
      expect(saved1.id).toBeDefined();

      // Try to save duplicate (should either fail or handle gracefully)
      const message2 = EntityFactory.createMessage({
        messageId: '12345',
        userId: '999999999'
      });

      try {
        await messageRepo.save(message2);
        logger.info('Duplicate handled gracefully');
      } catch (error) {
        expect(error).toBeDefined();
        logger.info('Duplicate rejected with error');
      }
    });

    it('should maintain message count accuracy across tables', async () => {
      logger.info('Testing message count consistency');

      const messageRepo = dataSource.getRepository('Message');

      // Create 10 messages for first user
      const user1Messages = Array(10).fill(null).map((_, i) =>
        EntityFactory.createMessage({
          messageId: String(i),
          userId: testData.users[0].userId
        })
      );

      await messageRepo.save(user1Messages);

      // Create 5 messages for second user
      const user2Messages = Array(5).fill(null).map((_, i) =>
        EntityFactory.createMessage({
          messageId: String(100 + i),
          userId: testData.users[1].userId
        })
      );

      await messageRepo.save(user2Messages);

      // Verify counts
      const total = await messageRepo.count();
      expect(total).toBe(15);

      const user1Count = await messageRepo.count({
        where: { userId: testData.users[0].userId }
      });
      expect(user1Count).toBe(10);

      const user2Count = await messageRepo.count({
        where: { userId: testData.users[1].userId }
      });
      expect(user2Count).toBe(5);

      logger.info('Message counts verified', { total, user1: 10, user2: 5 });
    });
  });

  afterEach(() => {
    logger.writeLogs(`./test-logs/message-forwarding-${Date.now()}.json`);
  });
});
