/**
 * @fileoverview Test Fixtures & Seeding
 * Database seeding functions for E2E tests
 * @module test/fixtures/seedTestData.js
 */

/**
 * Seed minimal test data (admin + session only)
 */
export async function seedMinimalData(dataSource) {
  const adminRepo = dataSource.getRepository('Admin');
  const sessionRepo = dataSource.getRepository('Session');

  const admin = await adminRepo.save({
    userId: '123456789',
    firstName: 'Test',
    lastName: 'Admin',
    phone: '+1234567890',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const session = await sessionRepo.save({
    adminId: admin.id,
    sessionString: 'encrypted_session_string_minimal',
    status: 'active',
    autoPaused: false,
    floodWaitUntil: null,
    lastError: null,
    lastActive: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return { admin, session };
}

/**
 * Seed complete test data (admin, sessions, channels, users, messages)
 */
export async function seedCompleteData(dataSource) {
  const adminRepo = dataSource.getRepository('Admin');
  const sessionRepo = dataSource.getRepository('Session');
  const channelRepo = dataSource.getRepository('Channel');
  const userRepo = dataSource.getRepository('User');
  const metricRepo = dataSource.getRepository('Metric');

  // Create admin
  const admin = await adminRepo.save({
    userId: '123456789',
    firstName: 'Test',
    lastName: 'Admin',
    phone: '+1234567890',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create session
  const session = await sessionRepo.save({
    adminId: admin.id,
    sessionString: 'encrypted_session_string_complete',
    status: 'active',
    autoPaused: false,
    floodWaitUntil: null,
    lastError: null,
    lastActive: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create channels
  const channels = [];
  for (let i = 1; i <= 3; i++) {
    const channel = await channelRepo.save({
      channelId: `-100123456${String(i).padStart(4, '0')}`,
      accessHash: `hash_${i}`,
      title: `Test Channel ${i}`,
      username: `testchannel${i}`,
      memberCount: 100 * i,
      forwardEnabled: true,
      throttleDelayMs: 1000,
      throttlePerMemberMs: 500,
      minDelayMs: 2000,
      maxDelayMs: 5000,
      scheduleEnabled: false,
      scheduleConfig: null,
      adminId: admin.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    channels.push(channel);
  }

  // Create users (20 users for testing)
  const users = [];
  for (let i = 1; i <= 20; i++) {
    const user = await userRepo.save({
      userId: `999999${String(i).padStart(3, '0')}`,
      firstName: `User${i}`,
      lastName: 'Test',
      username: `testuser${i}`,
      isBot: false,
      createdAt: new Date()
    });
    users.push(user);
  }

  // Create metrics for first channel
  const metric = await metricRepo.save({
    channelId: channels[0].channelId,
    sessionId: session.id,
    messagesSent: 100,
    messagesFailed: 5,
    floodErrors: 2,
    spamWarnings: 1,
    lastActivity: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  return {
    admin,
    session,
    channels,
    users,
    metric
  };
}

/**
 * Seed forwarding test data (focused for message forwarding tests)
 */
export async function seedForwardingScenario(dataSource) {
  const adminRepo = dataSource.getRepository('Admin');
  const sessionRepo = dataSource.getRepository('Session');
  const channelRepo = dataSource.getRepository('Channel');
  const userRepo = dataSource.getRepository('User');

  // Create admin
  const admin = await adminRepo.save({
    userId: '987654321',
    firstName: 'Forwarder',
    lastName: 'Admin',
    phone: '+9876543210',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create session
  const session = await sessionRepo.save({
    adminId: admin.id,
    sessionString: 'encrypted_forwarding_session',
    status: 'active',
    autoPaused: false,
    floodWaitUntil: null,
    lastError: null,
    lastActive: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create single channel with specific config
  const channel = await channelRepo.save({
    channelId: '-1001234567890',
    accessHash: 'forward_test_hash',
    title: 'Forwarding Test Channel',
    username: 'forwardingtest',
    memberCount: 50,
    forwardEnabled: true,
    throttleDelayMs: 1000,
    throttlePerMemberMs: 100,
    minDelayMs: 500,
    maxDelayMs: 2000,
    scheduleEnabled: false,
    scheduleConfig: null,
    adminId: admin.id,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create recipient users (10 users)
  const users = [];
  for (let i = 1; i <= 10; i++) {
    const user = await userRepo.save({
      userId: `777777${String(i).padStart(3, '0')}`,
      firstName: `Recipient${i}`,
      lastName: 'User',
      username: `recipient${i}`,
      isBot: false,
      createdAt: new Date()
    });
    users.push(user);
  }

  return {
    admin,
    session,
    channel,
    users
  };
}

/**
 * Seed error recovery test data
 */
export async function seedErrorRecoveryScenario(dataSource) {
  const adminRepo = dataSource.getRepository('Admin');
  const sessionRepo = dataSource.getRepository('Session');
  const channelRepo = dataSource.getRepository('Channel');
  const messageRepo = dataSource.getRepository('Message');

  const admin = await adminRepo.save({
    userId: '111111111',
    firstName: 'ErrorTest',
    lastName: 'Admin',
    phone: '+1111111111',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const session = await sessionRepo.save({
    adminId: admin.id,
    sessionString: 'encrypted_error_session',
    status: 'active',
    autoPaused: false,
    floodWaitUntil: null,
    lastError: 'Previous error: FloodWait',
    lastActive: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const channel = await channelRepo.save({
    channelId: '-1009999999999',
    accessHash: 'error_test_hash',
    title: 'Error Test Channel',
    username: 'errortestchannel',
    memberCount: 30,
    forwardEnabled: true,
    throttleDelayMs: 1000,
    throttlePerMemberMs: 500,
    minDelayMs: 1000,
    maxDelayMs: 5000,
    scheduleEnabled: false,
    scheduleConfig: null,
    adminId: admin.id,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Create messages with various statuses for error testing
  const messages = [];

  // Pending message
  messages.push(await messageRepo.save({
    messageId: '1001',
    forwardedMessageId: null,
    channelId: channel.channelId,
    userId: '888888001',
    status: 'PENDING',
    errorMessage: null,
    retryCount: 0,
    groupedId: null,
    isGrouped: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  // Failed with 1 retry
  messages.push(await messageRepo.save({
    messageId: '1002',
    forwardedMessageId: null,
    channelId: channel.channelId,
    userId: '888888002',
    status: 'FAILED',
    errorMessage: 'FloodWait: 30',
    retryCount: 1,
    groupedId: null,
    isGrouped: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  // Failed with max retries
  messages.push(await messageRepo.save({
    messageId: '1003',
    forwardedMessageId: null,
    channelId: channel.channelId,
    userId: '888888003',
    status: 'FAILED',
    errorMessage: 'SpamWarning: Too many requests',
    retryCount: 3,
    groupedId: null,
    isGrouped: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  // Successfully forwarded
  messages.push(await messageRepo.save({
    messageId: '1004',
    forwardedMessageId: '2001',
    channelId: channel.channelId,
    userId: '888888004',
    status: 'SUCCESS',
    errorMessage: null,
    retryCount: 0,
    groupedId: null,
    isGrouped: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }));

  return {
    admin,
    session,
    channel,
    messages
  };
}

/**
 * Seed multi-session load balancing test data
 */
export async function seedMultiSessionScenario(dataSource) {
  const adminRepo = dataSource.getRepository('Admin');
  const sessionRepo = dataSource.getRepository('Session');
  const channelRepo = dataSource.getRepository('Channel');

  // Create admins for multiple sessions
  const admins = [];
  for (let i = 1; i <= 3; i++) {
    const admin = await adminRepo.save({
      userId: `5000000${String(i).padStart(2, '0')}`,
      firstName: `SessionAdmin${i}`,
      lastName: 'Multi',
      phone: `+500000000${i}`,
      role: 'ADMIN',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    admins.push(admin);
  }

  // Create sessions (2 active, 1 paused)
  const sessions = [];
  for (let i = 0; i < 3; i++) {
    const session = await sessionRepo.save({
      adminId: admins[i].id,
      sessionString: `encrypted_multi_session_${i}`,
      status: i === 2 ? 'paused' : 'active', // Third session is paused
      autoPaused: i === 2,
      floodWaitUntil: null,
      lastError: i === 2 ? 'User paused session' : null,
      lastActive: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    sessions.push(session);
  }

  // Create shared channels
  const channels = [];
  for (let i = 1; i <= 2; i++) {
    const channel = await channelRepo.save({
      channelId: `-100444444${String(i).padStart(3, '0')}`,
      accessHash: `multi_hash_${i}`,
      title: `Multi-Session Channel ${i}`,
      username: `multisession${i}`,
      memberCount: 200,
      forwardEnabled: true,
      throttleDelayMs: 1000,
      throttlePerMemberMs: 500,
      minDelayMs: 1000,
      maxDelayMs: 5000,
      scheduleEnabled: false,
      scheduleConfig: null,
      adminId: admins[0].id, // Assigned to first admin
      createdAt: new Date(),
      updatedAt: new Date()
    });
    channels.push(channel);
  }

  return {
    admins,
    sessions,
    channels
  };
}

/**
 * Clear all tables
 */
export async function clearAllTables(dataSource) {
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
