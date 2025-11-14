/**
 * @fileoverview Test Fixtures & Seeding
 * Database seeding functions for E2E tests
 * @module test/fixtures/seedTestData.js
 */

/**
 * Seed minimal test data (admin + session only)
 * Note: seedTestData functions are deprecated - use database directly in tests
 */
async function seedMinimalData(dataSource) {
  // Deprecated: These functions expect TypeORM DataSource but tests use SQLite
  // Use database direct inserts instead
  return {};
}

/**
 * Seed complete test data (admin, sessions, channels, users, messages)
 * Note: This is deprecated - use database direct inserts
 */
async function seedCompleteData(dataSource) {
  // Deprecated: Use database direct inserts instead
  return {};
}

/**
 * Seed forwarding test data (focused for message forwarding tests)
 * Deprecated - use direct database inserts
 */
async function seedForwardingScenario(dataSource) {
  return {};
}

/**
 * Seed error recovery test data
 * Deprecated - use direct database inserts
 */
async function seedErrorRecoveryScenario(dataSource) {
  return {};
}

/**
 * Seed multi-session load balancing test data
 * Deprecated - use direct database inserts
 */
async function seedMultiSessionScenario(dataSource) {
  return {};
}

/**
 * Clear all tables
 */
async function clearAllTables(dataSource) {
  const queryRunner = dataSource.createQueryRunner();

  const tables = [
    'message',
    'metric',
    'channel_members',
    'user',
    'channel',
    'session',
    'admin'
  ];

  for (const table of tables) {
    try {
      await queryRunner.clearTable(table);
    } catch (error) {
      // Table might not exist, continue
    }
  }

  await queryRunner.release();
}

/**
 * Default seed function (complete data set)
 */
async function seedTestData(dataSource) {
  return seedCompleteData(dataSource);
}

// CommonJS exports
module.exports = {
  seedMinimalData,
  seedCompleteData,
  seedForwardingScenario,
  seedErrorRecoveryScenario,
  seedMultiSessionScenario,
  seedTestData,
  clearAllTables
};
