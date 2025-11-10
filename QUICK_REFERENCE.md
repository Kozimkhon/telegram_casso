# Clean Architecture Quick Reference

## 🚀 Quick Start

```javascript
// Initialize system
import { config } from './config/index.js';
import { initializeDatabase } from './db/db.js';
import Container from './core/di/Container.js';
import AppState from './core/state/AppState.js';

await initializeDatabase();
await Container.initialize(config);
AppState.setConfig(config);
AppState.start();
```

## 📦 Core Components

### Entities

```javascript
import { Channel, Session, User, Message, Admin } from './core/entities/index.js';

// Create with validation
const channel = new Channel({ channelId, title, forwardEnabled });
const session = new Session({ phone, userId, status });

// Business methods
channel.enableForwarding().linkToSession(phone).updateTitle('New');
session.pause('reason').setFloodWait(300).activate();

// Convert to/from database
const obj = channel.toObject();
const channel2 = Channel.fromDatabaseRow(row);
```

### Repositories

```javascript
// Resolve from container
const channelRepo = Container.resolve('channelRepository');
const sessionRepo = Container.resolve('sessionRepository');

// CRUD operations
const channel = await channelRepo.create(data);
const found = await channelRepo.findById(id);
const all = await channelRepo.findAll();
await channelRepo.update(id, updates);
await channelRepo.delete(id);

// Custom operations
const enabled = await channelRepo.findEnabled();
await channelRepo.toggleForwarding(id);
const stats = await channelRepo.getStatistics();
```

### Use Cases

```javascript
import { ManageChannelUseCase, ManageSessionUseCase } from './core/use-cases/index.js';

const channelUseCase = new ManageChannelUseCase(channelRepo, logger);
const sessionUseCase = new ManageSessionUseCase(sessionRepo, logger);

// Channel operations
const channel = await channelUseCase.addChannel({ channelId, title });
await channelUseCase.toggleForwarding(channelId);
await channelUseCase.linkChannelToSession(channelId, phone);
const stats = await channelUseCase.getStatistics();

// Session operations
const session = await sessionUseCase.createSession({ phone, userId });
await sessionUseCase.pauseSession(phone, reason);
await sessionUseCase.resumeSession(phone);
await sessionUseCase.setFloodWait(phone, seconds);
```

### AppState (Global State)

```javascript
import AppState from './core/state/AppState.js';

// Manage sessions
AppState.setSession(phone, sessionData);
const session = AppState.getSession(phone);
const all = AppState.getAllSessions();
const active = AppState.getAllSessions('active');
AppState.removeSession(phone);

// Manage channels
AppState.setChannel(channelId, channelData);
const channel = AppState.getChannel(channelId);
const enabled = AppState.getAllChannels(true);
AppState.toggleChannelForwarding(channelId);

// Events
AppState.on('session:created', handler);
AppState.on('channel:added', handler);
AppState.on('session:paused', handler);

// Snapshot
const snapshot = AppState.getSnapshot();
// { isRunning, sessions: { total, active }, channels: { total, enabled }, ... }

// Metrics
AppState.incrementMetric('totalMessagesSent', 10);
const metrics = AppState.getMetrics();
```

### DI Container

```javascript
import Container from './core/di/Container.js';

// Initialize
await Container.initialize(config);

// Resolve services
const service = Container.resolve('serviceName');

// Register custom services
Container.registerSingleton('myService', instance);
Container.registerTransient('myFactory', (container) => new Service());

// Build with dependencies
const obj = Container.build(MyClass, ['dep1', 'dep2']);

// Check services
Container.has('serviceName'); // true/false
Container.getServiceNames(); // ['service1', 'service2', ...]
```

### Error Handling

```javascript
import { 
  ValidationError, 
  DatabaseError, 
  TelegramError,
  RateLimitError,
  ErrorHandler 
} from './shared/errors/index.js';

// Throw typed errors
throw new ValidationError('Invalid input', ['Field required']);
throw new DatabaseError('Query failed', originalError);
throw new TelegramError('API error', telegramError);
throw new RateLimitError('Too many requests', 60);

// Handle errors
try {
  await operation();
} catch (error) {
  ErrorHandler.handle(error, logger, { context });
}

// Retry with backoff
const result = await ErrorHandler.retry(
  () => unstableOperation(),
  { maxAttempts: 3, delayMs: 1000, logger }
);

// Wrap function
const safeFunc = ErrorHandler.wrap(riskyFunc, logger);
```

## 📐 Architecture Layers

```
┌─────────────────────────────────────┐
│     Presentation Layer              │  (Bots, Controllers)
│  - UserBot, AdminBot controllers    │
│  - UI logic, Input validation       │
└─────────────────────────────────────┘
              ▼
┌─────────────────────────────────────┐
│     Use Cases Layer                 │  (Business logic)
│  - ManageChannelUseCase             │
│  - ManageSessionUseCase             │
│  - Application-specific operations  │
└─────────────────────────────────────┘
              ▼
┌─────────────────────────────────────┐
│     Core/Domain Layer               │  (Entities, Rules)
│  - Channel, Session, User entities  │
│  - Business rules and validation    │
│  - Domain logic                     │
└─────────────────────────────────────┘
              ▼
┌─────────────────────────────────────┐
│     Data Layer                      │  (Persistence)
│  - Repositories                     │
│  - Data sources (SQLite)            │
│  - Database operations              │
└─────────────────────────────────────┘
```

## 🎯 Common Patterns

### Creating and Persisting Entity

```javascript
// Create entity with validation
const channel = new Channel({ channelId, title, forwardEnabled: true });

// Persist using repository
const channelRepo = Container.resolve('channelRepository');
const saved = await channelRepo.create(channel.toObject());

// Update state
AppState.setChannel(saved.channelId, saved.toObject());
```

### Business Operation with Use Case

```javascript
// Resolve dependencies
const repo = Container.resolve('channelRepository');
const useCase = new ManageChannelUseCase(repo, log);

// Execute business operation
const channel = await useCase.addChannel({
  channelId: '-1001234567890',
  title: 'My Channel'
});

// State automatically updated by use case
```

### Event-Driven Updates

```javascript
// Listen to state changes
AppState.on('channel:added', ({ channelId, channelData }) => {
  console.log('New channel added:', channelData.title);
  // Trigger UI update, notifications, etc.
});

// Perform operation (triggers event)
AppState.setChannel(channelId, channelData);
```

### Error Recovery

```javascript
try {
  const result = await ErrorHandler.retry(
    async () => {
      const repo = Container.resolve('channelRepository');
      return await repo.findById(channelId);
    },
    { 
      maxAttempts: 3, 
      delayMs: 1000, 
      backoffMultiplier: 2,
      logger: log 
    }
  );
} catch (error) {
  ErrorHandler.handle(error, log);
}
```

## 📊 Status Monitoring

```javascript
// Get complete system status
const status = AppState.getSnapshot();

console.log('System Status:');
console.log(`Running: ${status.isRunning}`);
console.log(`Sessions: ${status.sessions.total} (${status.sessions.active} active)`);
console.log(`Channels: ${status.channels.total} (${status.channels.enabled} enabled)`);
console.log(`Uptime: ${Math.floor(status.uptime / 1000)}s`);
console.log(`Environment: ${status.environment}`);

// Get metrics
const metrics = AppState.getMetrics();
console.log(`Messages sent: ${metrics.totalMessagesSent}`);
console.log(`Messages failed: ${metrics.totalMessagesFailed}`);
```

## 🔧 Configuration

```javascript
// Access config via AppState
const config = AppState.getConfig();

// Or via Container
const config = Container.resolve('config');

// Config is immutable (frozen)
config.telegram.apiId; // Read-only
```

## 🧪 Testing Helpers

```javascript
// Mock repository for testing
class MockChannelRepository {
  async findById(id) {
    return new Channel({ channelId: id, title: 'Mock' });
  }
  async create(data) {
    return new Channel(data);
  }
}

// Use in tests
const mockRepo = new MockChannelRepository();
const useCase = new ManageChannelUseCase(mockRepo, console);

// Test use case without database
const channel = await useCase.addChannel({ channelId: '123', title: 'Test' });
```

## 🚨 Common Gotchas

1. **Always initialize Container before resolving**
   ```javascript
   await Container.initialize(config); // Do this first!
   const repo = Container.resolve('channelRepository'); // Then resolve
   ```

2. **Entities are immutable after validation**
   ```javascript
   const channel = new Channel(data); // Validates on construction
   channel.channelId = 'new'; // ✅ Allowed (but use methods instead)
   channel.updateTitle('New Title'); // ✅ Preferred way
   ```

3. **AppState events are synchronous**
   ```javascript
   AppState.on('event', () => {
     // This runs synchronously
   });
   ```

4. **Repository methods return entities, not plain objects**
   ```javascript
   const channel = await channelRepo.findById(id);
   channel.enableForwarding(); // ✅ Entity methods available
   ```

## 📚 Further Reading

- `CLEAN_ARCHITECTURE_GUIDE.md` - Complete architecture guide
- `REFACTORING_SUMMARY.md` - Refactoring details
- `examples/clean-architecture-usage.js` - Working examples

---

**Version:** 1.0.0  
**Date:** January 10, 2025
