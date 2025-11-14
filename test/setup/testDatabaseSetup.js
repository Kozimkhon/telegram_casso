/**
 * Test Database Setup
 * Provides in-memory SQLite database for isolated testing
 */

const sqlite3 = require('sqlite3').verbose();

let testDatabase;

async function setupTestDatabase() {
  return new Promise((resolve, reject) => {
    testDatabase = new sqlite3.Database(':memory:', (err) => {
      if (err) reject(err);
      
      // Enable foreign keys
      testDatabase.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        
        // Create test tables
        const schema = `
          CREATE TABLE admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            adminId TEXT UNIQUE NOT NULL,
            userId INTEGER UNIQUE NOT NULL,
            firstName TEXT NOT NULL,
            lastName TEXT,
            phone TEXT,
            role TEXT DEFAULT 'user',
            isActive INTEGER DEFAULT 1,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            adminId TEXT NOT NULL,
            sessionString TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            autoPaused INTEGER DEFAULT 0,
            floodWaitUntil DATETIME,
            lastError TEXT,
            lastActive DATETIME,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (adminId) REFERENCES admins(adminId),
            UNIQUE(adminId, sessionString)
          );

          CREATE TABLE channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT UNIQUE NOT NULL,
            accessHash TEXT NOT NULL,
            title TEXT NOT NULL,
            username TEXT,
            memberCount INTEGER DEFAULT 0,
            forwardEnabled INTEGER DEFAULT 1,
            throttleSettings TEXT,
            scheduleConfig TEXT,
            adminId TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (adminId) REFERENCES admins(adminId)
          );

          CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            messageId INTEGER NOT NULL,
            forwardedMessageId INTEGER,
            channelId TEXT NOT NULL,
            userId INTEGER NOT NULL,
            status TEXT DEFAULT 'PENDING',
            errorMessage TEXT,
            retryCount INTEGER DEFAULT 0,
            groupedId INTEGER,
            isGrouped INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channelId) REFERENCES channels(channelId),
            FOREIGN KEY (userId) REFERENCES users(userId)
          );

          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER UNIQUE NOT NULL,
            firstName TEXT NOT NULL,
            lastName TEXT,
            username TEXT,
            isBot INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channelId TEXT NOT NULL,
            date DATE NOT NULL,
            successCount INTEGER DEFAULT 0,
            failureCount INTEGER DEFAULT 0,
            totalMessages INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channelId) REFERENCES channels(channelId),
            UNIQUE(channelId, date)
          );
        `;

        testDatabase.exec(schema, (err) => {
          if (err) reject(err);
          else resolve(testDatabase);
        });
      });
    });
  });
}

async function teardownTestDatabase() {
  return new Promise((resolve, reject) => {
    if (testDatabase) {
      testDatabase.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

async function clearAllTables() {
  return new Promise((resolve, reject) => {
    if (!testDatabase) reject(new Error('Database not initialized'));

    const tables = [
      'messages',
      'metrics',
      'channels',
      'sessions',
      'users',
      'admins'
    ];

    const clearAll = async () => {
      for (const table of tables) {
        await new Promise((res, rej) => {
          testDatabase.run(`DELETE FROM ${table}`, (err) => {
            if (err) rej(err);
            else res();
          });
        });
      }
      resolve();
    };

    clearAll().catch(reject);
  });
}

function getDatabase() {
  return testDatabase;
}

module.exports = {
  setupTestDatabase,
  teardownTestDatabase,
  clearAllTables,
  getDatabase
};
