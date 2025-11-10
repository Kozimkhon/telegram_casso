/**
 * @fileoverview TypeORM Database Configuration
 * Configures TypeORM DataSource for SQLite
 * @module config/database
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './index.js';

// ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import all entities
import {
  AdminEntity,
  SessionEntity,
  ChannelEntity,
  UserEntity,
  MessageEntity,
  MetricEntity,
} from '../core/entities/db/index.js';

/**
 * TypeORM DataSource Configuration
 * 
 * Architecture:
 * - Database: SQLite
 * - Entities: ES6 EntitySchema
 * - Synchronize: Auto-create tables in development
 * - Logging: Enabled in development
 * - Migrations: Auto-run enabled
 */
export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './data/telegram_typeorm.db', // Use new database file
  
  // Entities
  entities: [
    AdminEntity,
    SessionEntity,
    ChannelEntity,
    UserEntity,
    MessageEntity,
    MetricEntity,
  ],
  
  // Migrations
  migrations: [path.join(__dirname, '../migrations/*.js')],
  migrationsRun: true, // Auto-run migrations on startup
  
  // Schema synchronization (dev only)
  synchronize: true, // Always synchronize to create new schema
  
  // Logging
  logging: ['error', 'warn', 'schema'],
  logger: 'advanced-console',
  
  // Connection pooling (SQLite doesn't use pools, but good practice)
  maxQueryExecutionTime: 1000, // Log slow queries > 1s
  
  // Foreign key constraints
  foreignKeys: true,
  
  // Cache settings
  cache: {
    type: 'database',
    duration: 30000, // 30 seconds cache
  },
});

/**
 * Initializes TypeORM database connection
 * @returns {Promise<DataSource>} Initialized data source
 */
export async function initializeTypeORM() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✓ TypeORM DataSource initialized successfully');
      console.log(`✓ Database: ${config.database.path}`);
      console.log(`✓ Entities loaded: ${AppDataSource.entityMetadatas.length}`);
    }
    return AppDataSource;
  } catch (error) {
    console.error('✗ Error initializing TypeORM DataSource:', error);
    throw error;
  }
}

/**
 * Closes TypeORM database connection
 * @returns {Promise<void>}
 */
export async function closeTypeORM() {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('✓ TypeORM DataSource closed successfully');
    }
  } catch (error) {
    console.error('✗ Error closing TypeORM DataSource:', error);
    throw error;
  }
}

/**
 * Gets TypeORM repository for an entity
 * @template T
 * @param {Function} entity - Entity class
 * @returns {Repository<T>} Repository instance
 */
export function getRepository(entity) {
  if (!AppDataSource.isInitialized) {
    throw new Error('TypeORM DataSource not initialized');
  }
  return AppDataSource.getRepository(entity);
}

/**
 * Runs a database transaction
 * @template T
 * @param {Function} operation - Async operation to run in transaction
 * @returns {Promise<T>} Operation result
 */
export async function runInTransaction(operation) {
  return await AppDataSource.transaction(operation);
}

export default AppDataSource;
