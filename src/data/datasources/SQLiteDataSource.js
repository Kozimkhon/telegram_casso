/**
 * @fileoverview SQLite Data Source
 * Low-level database access layer
 * @module data/datasources/SQLiteDataSource
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';

/**
 * SQLite Data Source
 * Provides async database operations
 * 
 * @class SQLiteDataSource
 */
class SQLiteDataSource {
  /**
   * Database connection
   * @private
   * @type {sqlite3.Database}
   */
  #db;

  /**
   * Creates SQLite data source
   * @param {string} dbPath - Database file path
   */
  constructor(dbPath) {
    this.#db = new sqlite3.Database(dbPath);
    
    // Promisify database methods
    this.#db.runAsync = promisify(this.#db.run.bind(this.#db));
    this.#db.getAsync = promisify(this.#db.get.bind(this.#db));
    this.#db.allAsync = promisify(this.#db.all.bind(this.#db));
  }

  /**
   * Executes a query (INSERT, UPDATE, DELETE)
   * @param {string} query - SQL query
   * @param {Array} [params] - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async execute(query, params = []) {
    try {
      return await this.#db.runAsync(query, params);
    } catch (error) {
      throw new Error(`Database execute error: ${error.message}`);
    }
  }

  /**
   * Gets a single row
   * @param {string} query - SQL query
   * @param {Array} [params] - Query parameters
   * @returns {Promise<Object|null>} Row or null
   */
  async getOne(query, params = []) {
    try {
      return await this.#db.getAsync(query, params) || null;
    } catch (error) {
      throw new Error(`Database getOne error: ${error.message}`);
    }
  }

  /**
   * Gets multiple rows
   * @param {string} query - SQL query
   * @param {Array} [params] - Query parameters
   * @returns {Promise<Array>} Rows
   */
  async getMany(query, params = []) {
    try {
      return await this.#db.allAsync(query, params);
    } catch (error) {
      throw new Error(`Database getMany error: ${error.message}`);
    }
  }

  /**
   * Begins a transaction
   * @returns {Promise<void>}
   */
  async beginTransaction() {
    return await this.execute('BEGIN TRANSACTION');
  }

  /**
   * Commits a transaction
   * @returns {Promise<void>}
   */
  async commit() {
    return await this.execute('COMMIT');
  }

  /**
   * Rolls back a transaction
   * @returns {Promise<void>}
   */
  async rollback() {
    return await this.execute('ROLLBACK');
  }

  /**
   * Closes database connection
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.#db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Gets the underlying database instance
   * @returns {sqlite3.Database} Database instance
   */
  getDatabase() {
    return this.#db;
  }
}

export default SQLiteDataSource;
