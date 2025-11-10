/**
 * Example Usage of Clean Architecture Components
 * Demonstrates how to use entities, repositories, use cases, and state management
 * 
 * @module examples/usage
 */

import { config } from './config/index.js';
import { initializeDatabase } from './db/db.js';
import Container from './core/di/Container.js';
import AppState from './core/state/AppState.js';
import { Channel, Session } from './core/entities/index.js';
import { ManageChannelUseCase, ManageSessionUseCase } from './core/use-cases/index.js';
import { log } from './shared/logger.js';

/**
 * Example 1: Working with Entities
 */
async function exampleEntities() {
  console.log('\n=== Example 1: Working with Entities ===\n');

  // Create a channel entity with validation
  const channel = new Channel({
    channelId: '-1001234567890',
    title: 'Tech News Channel',
    forwardEnabled: true
  });

  console.log('Channel created:', channel.title);
  console.log('Is forwarding enabled?', channel.forwardEnabled);

  // Use business methods
  channel.disableForwarding();
  console.log('After disable:', channel.forwardEnabled);

  channel.enableForwarding();
  console.log('After enable:', channel.forwardEnabled);

  // Method chaining
  channel
    .updateTitle('Updated Tech News')
    .linkToSession('+1234567890')
    .updateThrottleSettings({ throttleDelayMs: 2000 });

  console.log('Updated channel:', channel.toObject());

  // Create a session entity
  const session = new Session({
    phone: '+1234567890',
    userId: '123456',
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe'
  });

  console.log('Session display name:', session.getDisplayName());
  console.log('Can send messages?', session.canSendMessages());

  // Simulate flood wait
  session.setFloodWait(300); // 5 minutes
  console.log('In flood wait?', session.isInFloodWait());
  console.log('Remaining seconds:', session.getFloodWaitRemaining());
}

/**
 * Example 2: Using Repositories
 */
async function exampleRepositories() {
  console.log('\n=== Example 2: Using Repositories ===\n');

  // Initialize database and container
  await initializeDatabase();
  await Container.initialize(config);

  // Resolve repositories from DI container
  const channelRepo = Container.resolve('channelRepository');
  const sessionRepo = Container.resolve('sessionRepository');

  // Create a channel
  const channel = await channelRepo.create({
    channelId: '-1001234567890',
    title: 'Demo Channel',
    forwardEnabled: true
  });
  console.log('Channel created:', channel.title);

  // Find channels
  const allChannels = await channelRepo.findAll();
  console.log('Total channels:', allChannels.length);

  const enabledChannels = await channelRepo.findEnabled();
  console.log('Enabled channels:', enabledChannels.length);

  // Update channel
  const updated = await channelRepo.update(channel.channelId, {
    title: 'Updated Demo Channel'
  });
  console.log('Updated title:', updated.title);

  // Toggle forwarding
  const toggled = await channelRepo.toggleForwarding(channel.channelId);
  console.log('Forwarding enabled?', toggled.forwardEnabled);

  // Get statistics
  const stats = await channelRepo.getStatistics();
  console.log('Channel stats:', stats);

  // Create a session
  const session = await sessionRepo.create({
    phone: '+1234567890',
    userId: '123456',
    firstName: 'Demo',
    lastName: 'User'
  });
  console.log('Session created:', session.phone);

  // Update session activity
  await sessionRepo.updateActivity(session.phone);
  console.log('Activity updated');

  // Pause session
  await sessionRepo.updateStatus(session.phone, 'paused');
  const pausedSession = await sessionRepo.findById(session.phone);
  console.log('Session status:', pausedSession.status);
}

/**
 * Example 3: Using Use Cases
 */
async function exampleUseCases() {
  console.log('\n=== Example 3: Using Use Cases ===\n');

  // Initialize
  await initializeDatabase();
  await Container.initialize(config);

  // Resolve repositories
  const channelRepo = Container.resolve('channelRepository');
  const sessionRepo = Container.resolve('sessionRepository');

  // Create use cases
  const channelUseCase = new ManageChannelUseCase(channelRepo, log);
  const sessionUseCase = new ManageSessionUseCase(sessionRepo, log);

  // Add a channel using use case
  const channel = await channelUseCase.addChannel({
    channelId: '-1009876543210',
    title: 'News Channel',
    adminSessionPhone: '+1234567890',
    forwardEnabled: true
  });
  console.log('Channel added via use case:', channel.title);

  // Toggle forwarding
  const toggled = await channelUseCase.toggleForwarding(channel.channelId);
  console.log('Forwarding toggled:', toggled.forwardEnabled);

  // Link to session
  await channelUseCase.linkChannelToSession(channel.channelId, '+1234567890');
  console.log('Channel linked to session');

  // Get statistics
  const channelStats = await channelUseCase.getStatistics();
  console.log('Channel statistics:', channelStats);

  // Create a session using use case
  const session = await sessionUseCase.createSession({
    phone: '+9876543210',
    userId: '654321',
    userInfo: {
      firstName: 'Jane',
      lastName: 'Smith',
      username: 'janesmith'
    }
  });
  console.log('Session created via use case:', session.phone);

  // Pause session
  await sessionUseCase.pauseSession(session.phone, 'Manual pause for testing');
  console.log('Session paused');

  // Resume session
  await sessionUseCase.resumeSession(session.phone);
  console.log('Session resumed');

  // Get session statistics
  const sessionStats = await sessionUseCase.getStatistics();
  console.log('Session statistics:', sessionStats);

  // Set flood wait
  await sessionUseCase.setFloodWait(session.phone, 300);
  console.log('Flood wait set for 5 minutes');

  // Clear flood wait
  await sessionUseCase.clearFloodWait(session.phone);
  console.log('Flood wait cleared');
}

/**
 * Example 4: Using AppState (Global State Manager)
 */
async function exampleAppState() {
  console.log('\n=== Example 4: Using AppState ===\n');

  // Initialize
  await initializeDatabase();
  await Container.initialize(config);

  // Set configuration
  AppState.setConfig(config);

  // Add session to state
  AppState.setSession('+1234567890', {
    phone: '+1234567890',
    userId: '123456',
    status: 'active',
    firstName: 'John',
    lastName: 'Doe'
  });

  // Add channel to state
  AppState.setChannel('-1001234567890', {
    channelId: '-1001234567890',
    title: 'Tech Channel',
    forwardEnabled: true
  });

  // Listen to events
  AppState.on('session:created', ({ phone, sessionData }) => {
    console.log('Event: New session created:', phone);
  });

  AppState.on('channel:added', ({ channelId, channelData }) => {
    console.log('Event: New channel added:', channelData.title);
  });

  AppState.on('session:paused', ({ phone }) => {
    console.log('Event: Session paused:', phone);
  });

  // Trigger events
  AppState.setSession('+9876543210', {
    phone: '+9876543210',
    status: 'active'
  });

  AppState.setChannel('-1009876543210', {
    channelId: '-1009876543210',
    title: 'News Channel',
    forwardEnabled: true
  });

  // Get state
  const session = AppState.getSession('+1234567890');
  console.log('Retrieved session:', session?.phone);

  const channel = AppState.getChannel('-1001234567890');
  console.log('Retrieved channel:', channel?.title);

  // Get all sessions/channels
  const allSessions = AppState.getAllSessions();
  console.log('Total sessions in state:', allSessions.length);

  const activeSessions = AppState.getAllSessions('active');
  console.log('Active sessions:', activeSessions.length);

  const allChannels = AppState.getAllChannels();
  console.log('Total channels in state:', allChannels.length);

  const enabledChannels = AppState.getAllChannels(true);
  console.log('Enabled channels:', enabledChannels.length);

  // Update session status
  AppState.updateSessionStatus('+1234567890', 'paused');

  // Toggle channel forwarding
  const newStatus = AppState.toggleChannelForwarding('-1001234567890');
  console.log('Channel forwarding toggled to:', newStatus);

  // Get application snapshot
  const snapshot = AppState.getSnapshot();
  console.log('\nApplication Snapshot:');
  console.log('- Is running:', snapshot.isRunning);
  console.log('- Total sessions:', snapshot.sessions.total);
  console.log('- Active sessions:', snapshot.sessions.active);
  console.log('- Total channels:', snapshot.channels.total);
  console.log('- Enabled channels:', snapshot.channels.enabled);
  console.log('- Environment:', snapshot.environment);

  // Increment metrics
  AppState.incrementMetric('totalMessagesSent', 10);
  AppState.incrementMetric('totalMessagesFailed', 2);

  const metrics = AppState.getMetrics();
  console.log('\nMetrics:');
  console.log('- Messages sent:', metrics.totalMessagesSent);
  console.log('- Messages failed:', metrics.totalMessagesFailed);
}

/**
 * Example 5: Complete Workflow
 */
async function exampleCompleteWorkflow() {
  console.log('\n=== Example 5: Complete Workflow ===\n');

  try {
    // Step 1: Initialize system
    await initializeDatabase();
    await Container.initialize(config);
    AppState.setConfig(config);
    AppState.start();

    console.log('✅ System initialized');

    // Step 2: Create use cases
    const channelRepo = Container.resolve('channelRepository');
    const sessionRepo = Container.resolve('sessionRepository');
    const channelUseCase = new ManageChannelUseCase(channelRepo, log);
    const sessionUseCase = new ManageSessionUseCase(sessionRepo, log);

    // Step 3: Create a session
    const session = await sessionUseCase.createSession({
      phone: '+1234567890',
      userId: '123456',
      userInfo: {
        firstName: 'Admin',
        lastName: 'User',
        username: 'adminuser'
      }
    });
    console.log('✅ Session created:', session.getDisplayName());

    // Step 4: Add session to state
    AppState.setSession(session.phone, session.toObject());

    // Step 5: Create a channel
    const channel = await channelUseCase.addChannel({
      channelId: '-1001234567890',
      title: 'My Awesome Channel',
      adminSessionPhone: session.phone,
      forwardEnabled: true
    });
    console.log('✅ Channel created:', channel.title);

    // Step 6: Link channel to session
    await channelUseCase.linkChannelToSession(channel.channelId, session.phone);
    console.log('✅ Channel linked to session');

    // Step 7: Get channels for this session
    const sessionChannels = await channelUseCase.getChannelsByAdminSession(session.phone);
    console.log(`✅ Session manages ${sessionChannels.length} channel(s)`);

    // Step 8: Update channel settings
    await channelRepo.updateThrottleSettings(channel.channelId, {
      throttleDelayMs: 2000,
      minDelayMs: 3000,
      maxDelayMs: 6000
    });
    console.log('✅ Throttle settings updated');

    // Step 9: Simulate session activity
    await sessionUseCase.updateActivity(session.phone);
    console.log('✅ Session activity updated');

    // Step 10: Get system statistics
    const channelStats = await channelUseCase.getStatistics();
    const sessionStats = await sessionUseCase.getStatistics();
    const appSnapshot = AppState.getSnapshot();

    console.log('\n📊 System Statistics:');
    console.log('Channels:', channelStats);
    console.log('Sessions:', sessionStats);
    console.log('Uptime:', Math.floor(appSnapshot.uptime / 1000), 'seconds');

    console.log('\n✅ Complete workflow executed successfully!');

  } catch (error) {
    console.error('❌ Error in workflow:', error.message);
    throw error;
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  try {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║   Clean Architecture Usage Examples          ║');
    console.log('╚═══════════════════════════════════════════════╝');

    await exampleEntities();
    await exampleRepositories();
    await exampleUseCases();
    await exampleAppState();
    await exampleCompleteWorkflow();

    console.log('\n✅ All examples completed successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}

export {
  exampleEntities,
  exampleRepositories,
  exampleUseCases,
  exampleAppState,
  exampleCompleteWorkflow
};
