/**
 * SQLite Data Source
 * Handles low-level database operations
 * 
 * @module data/data-sources/SQLiteDataSource
 */

import { runQuery, getAllQuery, getQuery, getDatabase } from '../../db/db.js';
import { ErrorType } from '../../shared/constants/index.js';

/**
 * @class SQLiteDataSource
 * @description Low-level database access layer
 * Provides methods for executing SQL queries with error handling
 */
export class SQLiteDataSource {
  /**
   * Creates a new SQLiteDataSource
   */
  constructor() {
    this.db = null;
  }

  /**
   * Initializes the data source
   * @returns {Promise<void>}
   * @throws {Error} If database initialization fails
   */
  async initialize() {
    try {
      this.db = getDatabase();
    } catch (error) {
      throw this.createError('Failed to initialize database', error);
    }
  }

  /**
   * Executes a query that modifies data (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Result with lastID and changes
   * @throws {Error} If query fails
   */
  async run(sql, params = []) {
    try {
      return await runQuery(sql, params);
    } catch (error) {
      throw this.createError('Query execution failed', error, { sql, params });
    }
  }

  /**
   * Executes a SELECT query and returns all results
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Array of rows
   * @throws {Error} If query fails
   */
  async getAll(sql, params = []) {
    try {
      return await getAllQuery(sql, params);
    } catch (error) {
      throw this.createError('Query execution failed', error, { sql, params });
    }
  }

  /**
   * Executes a SELECT query and returns first result
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|null>} First row or null
   * @throws {Error} If query fails
   */
  async getOne(sql, params = []) {
    try {
      return await getQuery(sql, params);
    } catch (error) {
      throw this.createError('Query execution failed', error, { sql, params });
    }
  }

  /**
   * Executes multiple queries in a transaction
   * @param {Function} callback - Callback with transaction operations
   * @returns {Promise<any>} Transaction result
   * @throws {Error} If transaction fails
   */
  async transaction(callback) {
    try {
      await this.run('BEGIN TRANSACTION');
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw this.createError('Transaction failed', error);
    }
  }

  /**
   * Creates a standardized error object
   * @param {string} message - Error message
   * @param {Error} originalError - Original error
   * @param {Object} [context] - Additional context
   * @returns {Error} Formatted error
   * @private
   */
  createError(message, originalError, context = {}) {
    const error = new Error(`${message}: ${originalError.message}`);
    error.type = ErrorType.DATABASE;
    error.originalError = originalError;
    error.context = context;
    return error;
  }

  /**
   * Checks if database is connected
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.db !== null;
  }
}

export default SQLiteDataSource;
