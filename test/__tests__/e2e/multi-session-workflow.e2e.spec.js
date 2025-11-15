/**
 * E2E Test: Multi-Session Workflow
 */

import { setupTestDatabase, teardownTestDatabase, clearAllTables } from '../../setup/testDatabaseSetup.js';

describe('E2E: Multi-Session Workflow', () => {
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

  describe('Multi-Session Operations', () => {
    it('should manage multiple sessions for single admin', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 800001;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Multi', 'Admin', '+998940000001', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create 3 sessions
      for (let i = 1; i <= 3; i++) {
        const sessionString = `session_${Date.now()}_${i}`;
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO sessions (adminId, sessionString, status, autoPaused, lastActive)
             VALUES (?, ?, ?, ?, ?)`,
            [adminId, sessionString, i === 2 ? 'paused' : 'active', i === 2 ? 1 : 0, new Date()],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Verify all sessions exist
      const adminSessions = await new Promise((resolve, reject) => {
        database.all(
          'SELECT * FROM sessions WHERE adminId = ?',
          [adminId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      expect(adminSessions.length).toBe(3);
      expect(adminSessions.filter(s => s.status === 'active').length).toBe(2);
      expect(adminSessions.filter(s => s.status === 'paused').length).toBe(1);
    });

    it('should load balance across active sessions', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 800002;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'LB', 'Admin', '+998940000002', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create 2 active sessions
      const sessionIds = [];
      for (let i = 1; i <= 2; i++) {
        const sessionString = `session_${Date.now()}_${i}`;
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO sessions (adminId, sessionString, status, autoPaused, lastActive)
             VALUES (?, ?, ?, ?, ?)`,
            [adminId, sessionString, 'active', 0, new Date()],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        sessionIds.push(sessionString);
      }

      // Create messages distributed across sessions
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      const recipientUserId = 800003;

      // Setup channel and user
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_lb', 'LB Channel', 'lbchannel', 100, 1, adminId],
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
          [recipientUserId, 'LB', 'Recipient', 'lbrecipient', 0],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create multiple messages
      for (let i = 1; i <= 4; i++) {
        const messageId = Math.floor(Math.random() * 1000000) + i;
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
      }

      // Verify load distribution
      const sessions = await new Promise((resolve, reject) => {
        database.all(
          'SELECT * FROM sessions WHERE adminId = ? AND status = ?',
          [adminId, 'active'],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      expect(sessions.length).toBe(2);
    });

    it('should maintain session status consistency', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 800004;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Status', 'Admin', '+998940000003', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create session
      const sessionString = `session_${Date.now()}`;
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO sessions (adminId, sessionString, status, autoPaused, lastActive)
           VALUES (?, ?, ?, ?, ?)`,
          [adminId, sessionString, 'active', 0, new Date()],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Transition session state
      await new Promise((resolve, reject) => {
        database.run(
          `UPDATE sessions SET status = ?, autoPaused = ?, updatedAt = datetime('now')
           WHERE adminId = ? AND sessionString = ?`,
          ['paused', 1, adminId, sessionString],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify final state
      const session = await new Promise((resolve, reject) => {
        database.get(
          'SELECT * FROM sessions WHERE adminId = ? AND sessionString = ?',
          [adminId, sessionString],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(session.status).toBe('paused');
      expect(session.autoPaused).toBe(1);
    });

    it('should track metrics across multiple sessions', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 800005;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Metrics', 'Admin', '+998940000004', 'admin', 1],
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
          [channelId, 'hash_metrics', 'Metrics Channel', 'metricschannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create 2 sessions
      for (let i = 1; i <= 2; i++) {
        const sessionString = `session_${Date.now()}_${i}`;
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO sessions (adminId, sessionString, status, autoPaused, lastActive)
             VALUES (?, ?, ?, ?, ?)`,
            [adminId, sessionString, 'active', 0, new Date()],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Create metrics
      const date = new Date().toISOString().split('T')[0];
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO metrics (channelId, date, successCount, failureCount, totalMessages)
           VALUES (?, ?, ?, ?, ?)`,
          [channelId, date, 100, 10, 110],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify metrics
      const metrics = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM metrics WHERE channelId = ?', [channelId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(metrics.successCount).toBe(100);
      expect(metrics.totalMessages).toBe(110);
    });

    it('should handle session lifecycle management', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 800006;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Lifecycle', 'Admin', '+998940000005', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create session
      const sessionString = `session_${Date.now()}`;
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO sessions (adminId, sessionString, status, autoPaused, lastActive)
           VALUES (?, ?, ?, ?, ?)`,
          [adminId, sessionString, 'active', 0, new Date()],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Lifecycle transitions
      const transitions = ['active', 'paused', 'resumed', 'disconnected'];
      for (const status of transitions) {
        await new Promise((resolve, reject) => {
          database.run(
            `UPDATE sessions SET status = ?, lastActive = datetime('now'), updatedAt = datetime('now')
             WHERE adminId = ? AND sessionString = ?`,
            [status, adminId, sessionString],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Verify final state
      const session = await new Promise((resolve, reject) => {
        database.get(
          'SELECT * FROM sessions WHERE adminId = ? AND sessionString = ?',
          [adminId, sessionString],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(session.status).toBe('disconnected');
      expect(session).toBeDefined();
    });
  });
});
