/**
 * E2E Test: Message Forwarding Workflow
 */

import { setupTestDatabase, teardownTestDatabase, clearAllTables } from '../../setup/testDatabaseSetup.js';

describe('E2E: Message Forwarding', () => {
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

  describe('Message Forwarding Operations', () => {
    it('should create message for forwarding', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 600001;
      const recipientUserId = 600002;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Forward', 'Admin', '+998920000001', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create channel
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_forward', 'Forward Channel', 'forwardchannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create recipient user
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO users (userId, firstName, lastName, username, isBot)
           VALUES (?, ?, ?, ?, ?)`,
          [recipientUserId, 'Recipient', 'User', 'recipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create message
      const messageId = Math.floor(Math.random() * 1000000);
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO messages (messageId, channelId, userId, status, retryCount, isGrouped)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [messageId, channelId, recipientUserId, 'PENDING', 0, 0],
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

      expect(message.status).toBe('PENDING');
      expect(message.retryCount).toBe(0);
    });

    it('should mark message as successfully forwarded', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 600003;
      const recipientUserId = 600004;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      const messageId = Math.floor(Math.random() * 1000000);
      const forwardedMessageId = Math.floor(Math.random() * 1000000);

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Success', 'Admin', '+998920000002', 'admin', 1],
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
          [channelId, 'hash_success', 'Success Channel', 'successchannel', 100, 1, adminId],
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
          [recipientUserId, 'Success', 'Recipient', 'successrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO messages (messageId, channelId, userId, status, retryCount, isGrouped)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [messageId, channelId, recipientUserId, 'PENDING', 0, 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Mark as success
      await new Promise((resolve, reject) => {
        database.run(
          `UPDATE messages SET status = ?, forwardedMessageId = ?, updatedAt = datetime('now')
           WHERE messageId = ?`,
          ['SUCCESS', forwardedMessageId, messageId],
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

      expect(message.status).toBe('SUCCESS');
      expect(message.forwardedMessageId).toBe(forwardedMessageId);
    });

    it('should mark message as failed with error', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 600005;
      const recipientUserId = 600006;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      const messageId = Math.floor(Math.random() * 1000000);

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Fail', 'Admin', '+998920000003', 'admin', 1],
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
          [channelId, 'hash_fail', 'Fail Channel', 'failchannel', 100, 1, adminId],
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
          [recipientUserId, 'Fail', 'Recipient', 'failrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO messages (messageId, channelId, userId, status, retryCount, isGrouped)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [messageId, channelId, recipientUserId, 'PENDING', 0, 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Mark as failed
      const errorMessage = 'User not found';
      await new Promise((resolve, reject) => {
        database.run(
          `UPDATE messages SET status = ?, errorMessage = ?, retryCount = ?, updatedAt = datetime('now')
           WHERE messageId = ?`,
          ['FAILED', errorMessage, 1, messageId],
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
      expect(message.errorMessage).toBe(errorMessage);
      expect(message.retryCount).toBe(1);
    });

    it('should list pending messages for retry', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 600007;
      const recipientUserId = 600008;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Pending', 'Admin', '+998920000004', 'admin', 1],
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
          [channelId, 'hash_pending', 'Pending Channel', 'pendingchannel', 100, 1, adminId],
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
          [recipientUserId, 'Pending', 'Recipient', 'pendingrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create messages with different statuses
      for (let i = 0; i < 3; i++) {
        const messageId = Math.floor(Math.random() * 1000000) + i;
        const status = i === 0 ? 'PENDING' : (i === 1 ? 'SUCCESS' : 'FAILED');
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO messages (messageId, channelId, userId, status, retryCount, isGrouped)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [messageId, channelId, recipientUserId, status, 0, 0],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Get pending messages
      const pending = await new Promise((resolve, reject) => {
        database.all(
          'SELECT * FROM messages WHERE status = ? ORDER BY createdAt',
          ['PENDING'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending.every(m => m.status === 'PENDING')).toBe(true);
    });

    it('should record message metrics', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 600009;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Metrics', 'Admin', '+998920000005', 'admin', 1],
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
          [channelId, 'hash_metrics', 'Metrics Channel', 'metricschannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create metrics
      const date = new Date().toISOString().split('T')[0];
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO metrics (channelId, date, successCount, failureCount, totalMessages)
           VALUES (?, ?, ?, ?, ?)`,
          [channelId, date, 50, 5, 55],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify
      const metrics = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM metrics WHERE channelId = ?', [channelId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(metrics).toBeDefined();
      expect(metrics.successCount).toBe(50);
      expect(metrics.failureCount).toBe(5);
      expect(metrics.totalMessages).toBe(55);
    });
  });
});
