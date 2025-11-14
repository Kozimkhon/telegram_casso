/**
 * @fileoverview Mock for TypeORM Database Configuration
 * Used in Jest tests to avoid import.meta issues
 * @module config/__mocks__/database
 */

// Mock DataSource
export const AppDataSource = {
  initialize: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  isInitialized: false,
  getRepository: jest.fn(),
  manager: {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
  },
};

// Mock initialization function
export const initializeDatabase = jest.fn().mockResolvedValue(AppDataSource);

export default AppDataSource;
