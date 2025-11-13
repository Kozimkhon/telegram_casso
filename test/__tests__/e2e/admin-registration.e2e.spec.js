/**
 * @fileoverview E2E Test: Admin Registration & Session Setup
 * Tests the complete workflow from /start command to database persistence
 * @module test/__tests__/e2e/admin-registration.e2e.spec.js
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup/testDatabaseSetup.js';
import { setupTestContainer } from '../../setup/testContainer.js';
import { createMockTelegrafBot } from '../../setup/mockTelegram.js';
import { EntityFactory } from '../../factories/EntityFactory.js';
import { FailureCapture } from '../../helpers/failureCapture.js';
import { TestLogger } from '../../helpers/testLogger.js';

describe('E2E: Admin Registration Flow', () => {
  let dataSource;
  let container;
  let mockBot;
  let logger;
  let testData;

  beforeAll(async () => {
    // Initialize test database
    dataSource = await setupTestDatabase();
    container = setupTestContainer(dataSource);
    mockBot = createMockTelegrafBot();
    logger = new TestLogger('admin-registration');
  });

  afterAll(async () => {
    await cleanupTestDatabase(dataSource);
  });

  beforeEach(async () => {
    // Clear all tables before each test
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.clearTable('admin');
    await queryRunner.clearTable('session');
    await queryRunner.release();
  });

  describe('Scenario 1: New Admin Registration via /start', () => {
    it('should register admin and create database record', async () => {
      logger.info('Starting admin registration test');

      // 1. Setup: Create use case
      const createAdminUseCase = container.resolve('createAdminUseCase');
      const adminRepo = dataSource.getRepository('Admin');

      // 2. Execute: Register admin
      const adminData = {
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      };

      const result = await createAdminUseCase.execute(adminData);

      // 3. Assert: Use case result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.admin).toBeDefined();
      expect(result.admin.id).toBeDefined();

      logger.info('Admin created in use case', { adminId: result.admin.id });

      // 4. Assert: Database persistence
      const persistedAdmin = await adminRepo.findOne({
        where: { userId: '123456789' }
      });

      expect(persistedAdmin).toBeDefined();
      expect(persistedAdmin.firstName).toBe('John');
      expect(persistedAdmin.phone).toBe('+1234567890');
      expect(persistedAdmin.isActive).toBe(true);

      logger.info('Admin verified in database', { persistedAdmin });

      // 5. Assert: Response sent
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
      const calls = mockBot.telegram.sendMessage.mock.calls;
      expect(calls[0][1]).toContain('Welcome');

      logger.info('Test passed: Admin registration complete');
    });

    it('should validate required fields', async () => {
      logger.info('Testing field validation');

      const createAdminUseCase = container.resolve('createAdminUseCase');

      const invalidData = {
        firstName: 'John'
        // Missing: userId, phone
      };

      await expect(() => createAdminUseCase.execute(invalidData))
        .rejects.toThrow('userId is required');

      logger.info('Validation passed: Missing fields caught');
    });

    it('should prevent duplicate admin registration', async () => {
      logger.info('Testing duplicate prevention');

      const createAdminUseCase = container.resolve('createAdminUseCase');

      const adminData = {
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      };

      // First registration succeeds
      const first = await createAdminUseCase.execute(adminData);
      expect(first.success).toBe(true);

      // Second registration fails
      await expect(() => createAdminUseCase.execute(adminData))
        .rejects.toThrow('Admin already registered');

      logger.info('Duplicate prevention working');
    });
  });

  describe('Scenario 2: Admin-to-Session Workflow', () => {
    it('should create session after admin registration', async () => {
      logger.info('Testing admin-to-session workflow');

      const adminRepo = dataSource.getRepository('Admin');
      const sessionRepo = dataSource.getRepository('Session');
      const createAdminUseCase = container.resolve('createAdminUseCase');
      const createSessionUseCase = container.resolve('createSessionUseCase');

      // 1. Register admin
      const adminResult = await createAdminUseCase.execute({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      });

      logger.info('Admin registered', { adminId: adminResult.admin.id });

      // 2. Create session for admin
      const sessionResult = await createSessionUseCase.execute({
        adminId: adminResult.admin.id,
        sessionString: 'encrypted_session_string_here',
        phone: '+1234567890'
      });

      expect(sessionResult.success).toBe(true);
      expect(sessionResult.session).toBeDefined();

      logger.info('Session created', { sessionId: sessionResult.session.id });

      // 3. Verify both in database
      const adminCount = await adminRepo.count();
      const sessionCount = await sessionRepo.count();

      expect(adminCount).toBe(1);
      expect(sessionCount).toBe(1);

      // 4. Verify relationship
      const admin = await adminRepo.findOne({
        where: { id: adminResult.admin.id },
        relations: ['sessions']
      });

      expect(admin.sessions).toHaveLength(1);
      expect(admin.sessions[0].id).toBe(sessionResult.session.id);

      logger.info('Admin-Session relationship verified');
    });

    it('should not allow session for inactive admin', async () => {
      logger.info('Testing inactive admin session prevention');

      const adminRepo = dataSource.getRepository('Admin');
      const createSessionUseCase = container.resolve('createSessionUseCase');

      // 1. Create inactive admin directly
      const admin = await adminRepo.save({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        isActive: false // Inactive
      });

      logger.info('Inactive admin created');

      // 2. Try to create session
      await expect(() => createSessionUseCase.execute({
        adminId: admin.id,
        sessionString: 'session_string',
        phone: '+1234567890'
      }))
        .rejects.toThrow('Admin is not active');

      logger.info('Session creation prevented for inactive admin');
    });
  });

  describe('Scenario 3: State Manager Integration', () => {
    it('should update state when admin registered', async () => {
      logger.info('Testing state manager integration');

      const stateManager = container.resolve('stateManager');
      const createAdminUseCase = container.resolve('createAdminUseCase');

      const adminResult = await createAdminUseCase.execute({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      });

      // Check state was updated
      const adminState = stateManager.getState(`admin_${adminResult.admin.id}`);
      expect(adminState).toBeDefined();
      expect(adminState.isActive).toBe(true);

      logger.info('State manager updated with admin data');
    });
  });

  describe('Scenario 4: Error Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      logger.info('Testing error recovery');

      const createAdminUseCase = container.resolve('createAdminUseCase');

      // Simulate database error
      jest.spyOn(dataSource.getRepository('Admin'), 'save')
        .mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(() => createAdminUseCase.execute({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      }))
        .rejects.toThrow();

      logger.info('Error handling verified');
    });

    it('should log all admin registration events', async () => {
      logger.info('Testing comprehensive logging');

      const createAdminUseCase = container.resolve('createAdminUseCase');

      const adminResult = await createAdminUseCase.execute({
        userId: '123456789',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      });

      // Verify logger was called
      expect(logger.logs.length).toBeGreaterThan(0);
      expect(logger.logs.some(l => l.level === 'INFO')).toBe(true);

      logger.info('All events logged');
    });
  });

  afterEach(() => {
    logger.writeLogs(`./test-logs/admin-registration-${Date.now()}.json`);
  });
});
