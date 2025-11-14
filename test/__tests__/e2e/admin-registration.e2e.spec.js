/**
 * E2E Test: Admin Registration with Extended Validation
 */

const { setupTestDatabase, teardownTestDatabase, clearAllTables } = require('../../setup/testDatabaseSetup');

describe('E2E: Admin Registration Extended', () => {
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

  describe('Admin Registration and Sessions', () => {
    it('should validate admin registration fields', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = Math.floor(Math.random() * 1000000);

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'John', 'Doe', '+998901234567', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      const admin = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM admins WHERE adminId = ?', [adminId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(admin.firstName).toBe('John');
      expect(admin.lastName).toBe('Doe');
      expect(admin.phone).toBe('+998901234567');
      expect(admin.role).toBe('admin');
    });

    it('should prevent duplicate admin registrations', async () => {
      const adminId1 = `admin_${Date.now()}`;
      const adminId2 = `admin_${Date.now() + 1}`;
      const userId = 55555;

      // Register first admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId1, userId, 'Admin', 'One', '+998901111111', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Try to register with same userId
      let error = null;
      await new Promise((resolve) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId2, userId, 'Admin', 'Two', '+998902222222', 'admin', 1],
          function(err) {
            error = err;
            resolve();
          }
        );
      });

      expect(error).not.toBeNull();
      expect(error.message).toContain('UNIQUE');
    });

    it('should create session for registered admin', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 77777;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Session', 'Test', '+998903333333', 'admin', 1],
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

      const session = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM sessions WHERE adminId = ?', [adminId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(session.sessionString).toBe(sessionString);
      expect(session.status).toBe('active');
    });

    it('should handle multiple sessions per admin', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 88888;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Multi', 'Session', '+998904444444', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Create multiple sessions
      for (let i = 0; i < 3; i++) {
        const sessionString = `session_${Date.now()}_${i}`;
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO sessions (adminId, sessionString, status, autoPaused, lastActive)
             VALUES (?, ?, ?, ?, ?)`,
            [adminId, sessionString, i === 0 ? 'active' : 'paused', 0, new Date()],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      const sessions = await new Promise((resolve, reject) => {
        database.all('SELECT * FROM sessions WHERE adminId = ?', [adminId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(sessions.length).toBe(3);
      expect(sessions.filter(s => s.status === 'active').length).toBe(1);
      expect(sessions.filter(s => s.status === 'paused').length).toBe(2);
    });

    it('should complete full admin registration workflow', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 99999;

      // Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'Full', 'Workflow', '+998905555555', 'admin', 1],
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

      // Create channel
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_123', 'Workflow Channel', 'workflowchannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify all created
      const admin = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM admins WHERE adminId = ?', [adminId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const session = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM sessions WHERE adminId = ?', [adminId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const channel = await new Promise((resolve, reject) => {
        database.get('SELECT * FROM channels WHERE channelId = ?', [channelId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(admin).toBeDefined();
      expect(session).toBeDefined();
      expect(channel).toBeDefined();
      expect(channel.title).toBe('Workflow Channel');
    });
  });
});
