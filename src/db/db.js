/**
 * Database module - responsible for SQLite database connection and table management
 * Provides initialization, migration, and connection management functionality
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';

// Enable verbose mode for debugging in development
const sqlite = sqlite3.verbose();

let db = null;

/**
 * SQL schemas for database tables
 */
const schemas = {
  channels: `
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      forward_enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
  
  settings: `
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  message_logs: `
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
};

/**
 * Creates the data directory if it doesn't exist
 */
async function ensureDataDirectory() {
  try {
    const dataDir = path.dirname(config.database.path);
    await fs.mkdir(dataDir, { recursive: true });
    console.log(`✓ Data directory ensured: ${dataDir}`);
  } catch (error) {
    console.error('✗ Failed to create data directory:', error.message);
    throw error;
  }
}

/**
 * Initializes the database connection and creates tables
 * @returns {Promise<sqlite3.Database>} The database connection
 */
export async function initializeDatabase() {
  try {
    // Ensure data directory exists
    await ensureDataDirectory();

    return new Promise((resolve, reject) => {
      db = new sqlite.Database(config.database.path, (err) => {
        if (err) {
          console.error('✗ Failed to connect to database:', err.message);
          reject(err);
          return;
        }
        
        console.log(`✓ Connected to SQLite database: ${config.database.path}`);
        
        // Enable foreign key constraints
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            console.error('✗ Failed to enable foreign keys:', err.message);
            reject(err);
            return;
          }
          
          createTables()
            .then(() => {
              insertDefaultSettings()
                .then(() => resolve(db))
                .catch(reject);
            })
            .catch(reject);
        });
      });
    });
  } catch (error) {
    console.error('✗ Database initialization failed:', error.message);
    throw error;
  }
}

/**
 * Creates all required tables
 * @returns {Promise<void>}
 */
async function createTables() {
  return new Promise((resolve, reject) => {
    const tableNames = Object.keys(schemas);
    let completed = 0;
    
    for (const [tableName, schema] of Object.entries(schemas)) {
      db.run(schema, (err) => {
        if (err) {
          console.error(`✗ Failed to create table ${tableName}:`, err.message);
          reject(err);
          return;
        }
        
        console.log(`✓ Table ${tableName} created/verified`);
        completed++;
        
        if (completed === tableNames.length) {
          resolve();
        }
      });
    }
  });
}

/**
 * Inserts default settings into the database
 * @returns {Promise<void>}
 */
async function insertDefaultSettings() {
  const defaultSettings = [
    { key: 'app_version', value: config.app.version, description: 'Application version' },
    { key: 'auto_forward_enabled', value: 'true', description: 'Global auto-forwarding toggle' },
    { key: 'max_retry_attempts', value: '3', description: 'Maximum retry attempts for failed messages' },
    { key: 'retry_delay_ms', value: '5000', description: 'Delay between retry attempts in milliseconds' }
  ];

  return new Promise((resolve, reject) => {
    let completed = 0;
    
    for (const setting of defaultSettings) {
      db.run(
        'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)',
        [setting.key, setting.value, setting.description],
        (err) => {
          if (err) {
            console.error(`✗ Failed to insert setting ${setting.key}:`, err.message);
            reject(err);
            return;
          }
          
          completed++;
          if (completed === defaultSettings.length) {
            console.log('✓ Default settings initialized');
            resolve();
          }
        }
      );
    }
  });
}

/**
 * Gets the current database connection
 * @returns {sqlite3.Database|null} The database connection or null if not initialized
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Closes the database connection
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (!db) {
    return;
  }

  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('✗ Error closing database:', err.message);
        reject(err);
        return;
      }
      
      console.log('✓ Database connection closed');
      db = null;
      resolve();
    });
  });
}

/**
 * Executes a database query with parameters
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<any>} Query result
 */
export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.run(sql, params, function(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Executes a SELECT query and returns all results
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
export function getAllQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

/**
 * Executes a SELECT query and returns the first result
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|undefined>} Query result
 */
export function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

export default {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  runQuery,
  getAllQuery,
  getQuery
};