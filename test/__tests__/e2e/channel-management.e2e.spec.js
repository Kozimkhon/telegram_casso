/**
 * E2E Test: Channel Management Operations
 */

import { setupTestDatabase, teardownTestDatabase, clearAllTables } from '../../setup/testDatabaseSetup.js';

describe('E2E: Channel Management', () => {
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

  describe('Channel CRUD Operations', () => {
    it('should create a channel', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 111111;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Create admin first
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Channel', 'Admin', '+998911111111', 'admin', 1],
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
          [channelId, 'hash_123', 'Test Channel', 'testchannel', 500, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify
      const channel = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM channels WHERE channelId = ?', [channelId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(channel.title).toBe('Test Channel');
      expect(channel.memberCount).toBe(500);
      expect(channel.forwardEnabled).toBe(1);
    });

    it('should read channel details', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 222222;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Read', 'Test', '+998912222222', 'admin', 1],
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
          [channelId, 'hash_read', 'Read Test Channel', 'readchannel', 1000, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Read
      const channel = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM channels WHERE channelId = ?', [channelId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(channel).toBeDefined();
      expect(channel.username).toBe('readchannel');
      expect(channel.title).toBe('Read Test Channel');
    });

    it('should update channel information', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 333333;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Update', 'Test', '+998913333333', 'admin', 1],
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
          [channelId, 'hash_update', 'Original Title', 'updatechannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update
      await new Promise((resolve, reject) => {
        database.run(
          `UPDATE channels SET title = ?, memberCount = ?, forwardEnabled = ?, updatedAt = datetime('now')
           WHERE channelId = ?`,
          ['Updated Title', 2000, 0, channelId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify
      const updated = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM channels WHERE channelId = ?', [channelId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.memberCount).toBe(2000);
      expect(updated.forwardEnabled).toBe(0);
    });

    it('should delete a channel', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 444444;
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;

      // Setup
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Delete', 'Test', '+998914444444', 'admin', 1],
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
          [channelId, 'hash_delete', 'To Delete', 'deletechannel', 50, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Delete
      await new Promise((resolve, reject) => {
        database.run(
          `DELETE FROM channels WHERE channelId = ?`,
          [channelId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify deletion
      const deleted = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM channels WHERE channelId = ?', [channelId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(deleted).toBeUndefined();
    });

    it('should manage multiple channels per admin', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 555555;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Multi', 'Channel', '+998915555555', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create multiple channels
      for (let i = 0; i < 3; i++) {
        const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [channelId, `hash_${i}`, `Channel ${i}`, `channel${i}`, 100 * (i + 1), 1, adminId],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Get all channels
      const channels = await new Promise((resolve, reject) => {
        database.all('SELECT * FROM channels WHERE adminId = ?', [adminId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(channels.length).toBe(3);
      expect(channels[0].title).toMatch(/Channel \d/);
    });
  });
});
