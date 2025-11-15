/**
 * E2E Test: Error Recovery Workflows
 */

import { setupTestDatabase, teardownTestDatabase, clearAllTables } from '../../setup/testDatabaseSetup.js';

describe('E2E: Error Recovery', () => {
  let database;

  beforeAll(async () => {
    database = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearAllTables();
  });

  describe('Error Handling and Recovery', () => {
    it('should record failed message for retry', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 700001;
      const recipientUserId = 700002;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      const messageId = Math.floor(Math.random() * 1000000);

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Error', 'Admin', '+998930000001', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_error', 'Error Channel', 'errorchannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO users (userId, firstName, lastName, username, isBot)
           VALUES (?, ?, ?, ?, ?)`,
          [recipientUserId, 'Error', 'Recipient', 'errorrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create failed message
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO messages (messageId, channelId, userId, status, errorMessage, retryCount, isGrouped)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [messageId, channelId, recipientUserId, 'FAILED', 'Network timeout', 1, 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify
      const message = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM messages WHERE messageId = ?', [messageId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(message.status).toBe('FAILED');
      expect(message.errorMessage).toBe('Network timeout');
      expect(message.retryCount).toBe(1);
    });

    it('should track message retry attempts', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 700003;
      const recipientUserId = 700004;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      const messageId = Math.floor(Math.random() * 1000000);

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Retry', 'Admin', '+998930000002', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_retry', 'Retry Channel', 'retrychannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO users (userId, firstName, lastName, username, isBot)
           VALUES (?, ?, ?, ?, ?)`,
          [recipientUserId, 'Retry', 'Recipient', 'retryrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO messages (messageId, channelId, userId, status, errorMessage, retryCount, isGrouped)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [messageId, channelId, recipientUserId, 'FAILED', 'Initial error', 0, 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Simulate retries
      for (let i = 1; i <= 3; i++) {
        await new Promise((resolve, reject) => {
          database.run(
            `UPDATE messages SET retryCount = ?, status = ?, errorMessage = ?, updatedAt = datetime('now')
             WHERE messageId = ?`,
            [i, i < 3 ? 'FAILED' : 'SUCCESS', i < 3 ? `Retry ${i} failed` : 'Success after retry', messageId],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Verify
      const message = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM messages WHERE messageId = ?', [messageId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(message.retryCount).toBe(3);
      expect(message.status).toBe('SUCCESS');
    });

    it('should stop retrying after max attempts', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 700005;
      const recipientUserId = 700006;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      const messageId = Math.floor(Math.random() * 1000000);
      const MAX_RETRIES = 5;

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'MaxRetry', 'Admin', '+998930000003', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_maxretry', 'MaxRetry Channel', 'maxretrychannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO users (userId, firstName, lastName, username, isBot)
           VALUES (?, ?, ?, ?, ?)`,
          [recipientUserId, 'MaxRetry', 'Recipient', 'maxretryrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO messages (messageId, channelId, userId, status, errorMessage, retryCount, isGrouped)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [messageId, channelId, recipientUserId, 'FAILED', 'Persistent error', 0, 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Exceed max retries
      for (let i = 1; i <= MAX_RETRIES + 2; i++) {
        const shouldStop = i > MAX_RETRIES;
        const newStatus = shouldStop ? 'ABANDONED' : 'FAILED';
        const newRetryCount = Math.min(i, MAX_RETRIES);

        await new Promise((resolve, reject) => {
          database.run(
            `UPDATE messages SET retryCount = ?, status = ?, errorMessage = ?, updatedAt = datetime('now')
             WHERE messageId = ?`,
            [
              newRetryCount,
              newStatus,
              shouldStop ? 'Max retries exceeded' : `Retry ${i} failed`,
              messageId
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Verify
      const message = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM messages WHERE messageId = ?', [messageId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(message.status).toBe('ABANDONED');
      expect(message.retryCount).toBeLessThanOrEqual(MAX_RETRIES);
    });

    it('should handle errors with context information', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 700007;
      const recipientUserId = 700008;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      const messageId = Math.floor(Math.random() * 1000000);

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Context', 'Admin', '+998930000004', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_context', 'Context Channel', 'contextchannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO users (userId, firstName, lastName, username, isBot)
           VALUES (?, ?, ?, ?, ?)`,
          [recipientUserId, 'Context', 'Recipient', 'contextrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create message with comprehensive error info
      const contextError = JSON.stringify({
        code: 'USER_BLOCKED',
        timestamp: new Date().toISOString(),
        attemptedAt: new Date().toISOString(),
        failureReason: 'User has blocked the bot'
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO messages (messageId, channelId, userId, status, errorMessage, retryCount, isGrouped)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [messageId, channelId, recipientUserId, 'FAILED', contextError, 1, 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify
      const message = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM messages WHERE messageId = ?', [messageId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(message.errorMessage).toContain('USER_BLOCKED');
      expect(message.status).toBe('FAILED');
    });

    it('should manage recovery workflow', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 700009;
      const recipientUserId = 700010;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Recovery', 'Admin', '+998930000005', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_recovery', 'Recovery Channel', 'recoverychannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO users (userId, firstName, lastName, username, isBot)
           VALUES (?, ?, ?, ?, ?)`,
          [recipientUserId, 'Recovery', 'Recipient', 'recoveryrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create multiple messages in different recovery states
      const states = [
        { status: 'FAILED', errorMessage: 'Temporary network error', retryCount: 2 },
        { status: 'PENDING', errorMessage: null, retryCount: 0 },
        { status: 'SUCCESS', errorMessage: null, retryCount: 3 }
      ];

      for (let i = 0; i < states.length; i++) {
        const messageId = Math.floor(Math.random() * 1000000) + i * 1000;
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO messages (messageId, channelId, userId, status, errorMessage, retryCount, isGrouped)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [messageId, channelId, recipientUserId, states[i].status, states[i].errorMessage, states[i].retryCount, 0],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Get all messages
      const messages = await new Promise((resolve, reject) => {
        database.all(
          'SELECT * FROM messages WHERE channelId = ?',
          [channelId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(messages.length).toBe(3);
      expect(messages.some(m => m.status === 'FAILED')).toBe(true);
      expect(messages.some(m => m.status === 'SUCCESS')).toBe(true);
      expect(messages.some(m => m.status === 'PENDING')).toBe(true);
    });
  });
});
