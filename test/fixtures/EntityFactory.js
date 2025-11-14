/**
 * Entity Factories
 * Generates test data objects
 */

const EntityFactory = {
  createAdmin: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000000),
    adminId: `admin_${Date.now()}`,
    userId: Math.floor(Math.random() * 1000000),
    firstName: 'TestAdmin',
    lastName: 'User',
    phone: '+1234567890',
    role: 'admin',
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createSession: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000000),
    adminId: `admin_${Date.now()}`,
    sessionString: `session_string_${Date.now()}`,
    status: 'active',
    autoPaused: 0,
    floodWaitUntil: null,
    lastError: null,
    lastActive: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createChannel: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000000),
    channelId: `-100${Math.floor(Math.random() * 1000000000)}`,
    accessHash: Math.random().toString(36).substring(7),
    title: 'TestChannel',
    username: 'testchannel',
    memberCount: 100,
    forwardEnabled: 1,
    throttleSettings: JSON.stringify({ tokensPerMinute: 10 }),
    scheduleConfig: null,
    adminId: `admin_${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createMessage: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000000),
    messageId: Math.floor(Math.random() * 1000000),
    forwardedMessageId: null,
    channelId: `-100${Math.floor(Math.random() * 1000000000)}`,
    userId: Math.floor(Math.random() * 1000000),
    status: 'PENDING',
    errorMessage: null,
    retryCount: 0,
    groupedId: null,
    isGrouped: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  createUser: (overrides = {}) => ({
    id: Math.floor(Math.random() * 1000000),
    userId: Math.floor(Math.random() * 1000000),
    firstName: 'TestUser',
    lastName: 'Name',
    username: 'testuser',
    isBot: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
};

module.exports = { EntityFactory };
