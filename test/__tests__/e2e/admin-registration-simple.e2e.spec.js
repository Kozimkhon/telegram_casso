/**
 * E2E Test: Admin Registration Workflow
 * Tests complete admin registration and session creation flow
 */

const { setupTestDatabase, teardownTestDatabase, clearAllTables, getDatabase } = require('../../setup/testDatabaseSetup');

describe('E2E: Admin Registration Workflow', () => {
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

  describe('Admin Registration', () => {
    it('should create admin successfully', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = Math.floor(Math.random() * 1000000);

      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'TestAdmin', 'User', '+1234567890', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Verify admin was created
      const admin = await new Promise((resolve, reject) => {
        database.get(
          'SELECT * FROM admins WHERE adminId = ?',
          [adminId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(admin).toBeDefined();
      expect(admin.adminId).toBe(adminId);
      expect(admin.userId).toBe(userId);
      expect(admin.firstName).toBe('TestAdmin');
      expect(admin.isActive).toBe(1);
    });

    it('should create session for admin', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = Math.floor(Math.random() * 1000000);

      // Create admin first
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'TestAdmin', 'User', '+1234567890', 'admin', 1],
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

      // Verify session was created
      const session = await new Promise((resolve, reject) => {
        database.get(
          'SELECT * FROM sessions WHERE adminId = ?',
          [adminId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      expect(session).toBeDefined();
      expect(session.adminId).toBe(adminId);
      expect(session.status).toBe('active');
      expect(session.sessionString).toBe(sessionString);
    });

    it('should not allow duplicate admin userId', async () => {
      const adminId1 = `admin_${Date.now()}`;
      const adminId2 = `admin_${Date.now() + 1}`;
      const userId = 12345;

      // Create first admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId1, userId, 'Admin1', 'User', '+1111111111', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Try to create second admin with same userId (should fail)
      let duplicateError = false;
      await new Promise((resolve) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId2, userId, 'Admin2', 'User', '+2222222222', 'admin', 1],
          function(err) {
            if (err && err.message.includes('UNIQUE')) {
              duplicateError = true;
            }
            resolve();
          }
        );
      });

      expect(duplicateError).toBe(true);
    });
  });

  describe('Admin Workflow Integration', () => {
    it('should complete full admin registration workflow', async () => {
      const adminId = `admin_${Date.now()}`;
      const userId = 99999;

      // Step 1: Create admin
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO admins (adminId, userId, firstName, lastName, phone, role, isActive)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [adminId, userId, 'TestAdmin', 'User', '+1234567890', 'admin', 1],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Step 2: Create session
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

      // Step 3: Create channel
      const channelId = `-100${Math.floor(Math.random() * 1000000000)}`;
      await new Promise((resolve, reject) => {
        database.run(
          `INSERT INTO channels (channelId, accessHash, title, username, memberCount, forwardEnabled, adminId)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [channelId, 'hash_123', 'TestChannel', 'testchannel', 100, 1, adminId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Step 4: Verify complete workflow
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
        database.get('SELECT * FROM channels WHERE adminId = ?', [adminId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      expect(admin).toBeDefined();
      expect(session).toBeDefined();
      expect(channel).toBeDefined();
      expect(admin.isActive).toBe(1);
      expect(session.status).toBe('active');
      expect(channel.forwardEnabled).toBe(1);
    });
  });
});
