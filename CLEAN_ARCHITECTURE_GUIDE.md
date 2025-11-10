# Clean Architecture Refactoring Guide

## Overview

This document describes the Clean Architecture refactoring of the Telegram Casso project, implementing domain-driven design, SOLID principles, and dependency injection.

## Architecture Layers

### 📁 Project Structure

```
src/
├── core/                          # Core business logic (domain)
│   ├── entities/                  # Domain entities with business rules
│   │   ├── Channel.js            # Channel entity
│   │   ├── Session.js            # Session entity
│   │   ├── User.js               # User entity
│   │   ├── Message.js            # Message entity
│   │   ├── Admin.js              # Admin entity
│   │   └── index.js              # Entities export
│   ├── use-cases/                # Business use cases
│   │   ├── BaseUseCase.js        # Base use case class
│   │   ├── ManageChannelUseCase.js
│   │   ├── ManageSessionUseCase.js
│   │   └── ...
│   ├── interfaces/               # Repository interfaces
│   │   ├── IRepository.js        # Base repository interface
│   │   ├── IChannelRepository.js
│   │   ├── ISessionRepository.js
│   │   └── IUserRepository.js
│   ├── state/                    # Global state management
│   │   └── AppState.js          # Singleton state manager
│   └── di/                       # Dependency injection
│       └── Container.js          # DI container
├── data/                         # Data layer (infrastructure)
│   ├── repositories/             # Repository implementations
│   │   ├── ChannelRepository.js
│   │   ├── SessionRepository.js
│   │   └── ...
│   └── data-sources/             # Data source abstractions
│       └── SQLiteDataSource.js   # SQLite data source
├── domain/                       # Domain services (future)
├── presentation/                 # Presentation layer (controllers)
│   └── controllers/              # Bot controllers (future)
├── shared/                       # Shared utilities and types
│   ├── constants/                # Application constants
│   │   └── index.js
│   ├── types/                    # TypeScript-style type definitions
│   │   └── index.js
│   ├── errors/                   # Error handling
│   │   └── index.js
│   ├── logger.js                 # Logging utility
│   ├── helpers.js                # Helper functions
│   └── ...
├── bots/                         # Legacy bot implementations
├── services/                     # Legacy services
├── config/                       # Configuration
├── db/                           # Database setup
└── index.refactored.js          # New main entry point
```

## Key Components

### 1. Domain Entities (core/entities/)

Domain entities encapsulate business logic and validation:

```javascript
import { Channel } from './core/entities/Channel.js';

// Create channel with validation
const channel = new Channel({
  channelId: '-1001234567890',
  title: 'My Channel',
  forwardEnabled: true
});

// Business methods
channel.enableForwarding();
channel.toggleForwarding();
channel.updateTitle('New Title');
channel.linkToSession('+1234567890');
```

**Features:**
- Built-in validation
- Business rule enforcement
- Immutable timestamps
- Fluent interface (method chaining)
- Database serialization/deserialization

### 2. Global State Manager (core/state/AppState.js)

Singleton pattern for centralized state management:

```javascript
import AppState from './core/state/AppState.js';

// Access singleton instance
const state = AppState; // or AppState.getInstance()

// Manage sessions
state.setSession(phone, sessionData);
const session = state.getSession(phone);
const allSessions = state.getAllSessions();

// Manage channels
state.setChannel(channelId, channelData);
const channel = state.getChannel(channelId);

// Listen to events
state.on('session:created', ({ phone, sessionData }) => {
  console.log('New session created:', phone);
});

// Get application snapshot
const snapshot = state.getSnapshot();
```

**Features:**
- Event-driven architecture
- Type-safe state management
- Read-only configuration
- Real-time metrics
- Session/channel lifecycle tracking

### 3. Dependency Injection Container (core/di/Container.js)

Service locator pattern for dependency management:

```javascript
import Container from './core/di/Container.js';

// Initialize container with config
await Container.initialize(config);

// Resolve services
const channelRepo = Container.resolve('channelRepository');
const sessionRepo = Container.resolve('sessionRepository');
const appState = Container.resolve('appState');

// Register custom services
Container.registerSingleton('myService', new MyService());
Container.registerTransient('myFactory', (container) => {
  return new MyService(container.resolve('dependency'));
});

// Build with dependency injection
const service = Container.build(MyService, ['repository', 'logger']);
```

**Features:**
- Singleton and transient lifecycles
- Automatic dependency resolution
- Service scoping
- Type-safe service resolution

### 4. Repository Pattern (data/repositories/)

Clean separation between business logic and data access:

```javascript
// Repository interface (core/interfaces/)
class IChannelRepository {
  async findById(id) { throw new Error('Not implemented'); }
  async findAll(filter) { throw new Error('Not implemented'); }
  async create(data) { throw new Error('Not implemented'); }
  // ...
}

// Repository implementation (data/repositories/)
class ChannelRepository extends IChannelRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }
  
  async findById(id) {
    const row = await this.dataSource.getOne('SELECT * FROM channels WHERE id = ?', [id]);
    return row ? Channel.fromDatabaseRow(row) : null;
  }
}
```

**Benefits:**
- Testable business logic (mock repositories)
- Swappable data sources
- Clean separation of concerns

### 5. Use Cases (core/use-cases/)

Encapsulated business operations:

```javascript
import ManageChannelUseCase from './core/use-cases/ManageChannelUseCase.js';

const useCase = new ManageChannelUseCase(channelRepository, logger);

// Add channel
const channel = await useCase.addChannel({
  channelId: '-1001234567890',
  title: 'My Channel',
  adminSessionPhone: '+1234567890'
});

// Update channel
await useCase.updateChannel({
  channelId: channel.channelId,
  updates: { title: 'Updated Title' }
});

// Toggle forwarding
await useCase.toggleForwarding(channel.channelId);

// Get statistics
const stats = await useCase.getStatistics();
```

**Features:**
- Single Responsibility Principle
- Testable business logic
- Error handling and logging
- Transaction support

### 6. Enhanced Error Handling (shared/errors/)

Comprehensive error system:

```javascript
import { 
  ValidationError, 
  DatabaseError, 
  TelegramError,
  ErrorHandler 
} from './shared/errors/index.js';

// Throw typed errors
throw new ValidationError('Invalid input', ['Field is required']);
throw new DatabaseError('Query failed', originalError);
throw new TelegramError('API error', telegramError);

// Handle errors
try {
  await operation();
} catch (error) {
  ErrorHandler.handle(error, logger, { context: 'myOperation' });
}

// Retry with exponential backoff
const result = await ErrorHandler.retry(
  () => unstableOperation(),
  { maxAttempts: 3, delayMs: 1000, logger }
);

// Wrap function with error handling
const safeFunction = ErrorHandler.wrap(riskyFunction, logger);
```

**Error Types:**
- `AppError` - Base application error
- `ValidationError` - Validation failures
- `DatabaseError` - Database operations
- `AuthenticationError` - Auth failures
- `TelegramError` - Telegram API errors
- `RateLimitError` - Rate limiting
- `PermissionError` - Authorization
- `NetworkError` - Network issues

## Usage Examples

### Example 1: Using Repositories

```javascript
// Resolve repository from DI container
const channelRepo = Container.resolve('channelRepository');

// Create channel
const channel = await channelRepo.create({
  channelId: '-1001234567890',
  title: 'My Channel'
});

// Find channels
const allChannels = await channelRepo.findAll();
const enabledChannels = await channelRepo.findEnabled();
const myChannels = await channelRepo.findByAdminSession('+1234567890');

// Update channel
await channelRepo.update(channel.channelId, {
  title: 'Updated Title',
  forwardEnabled: true
});

// Delete channel
await channelRepo.delete(channel.channelId);
```

### Example 2: Using Use Cases

```javascript
// Create use case with dependencies
const channelRepo = Container.resolve('channelRepository');
const useCase = new ManageChannelUseCase(channelRepo, log);

// Perform business operations
const channel = await useCase.addChannel({
  channelId: '-1001234567890',
  title: 'My Channel'
});

await useCase.toggleForwarding(channel.channelId);
await useCase.linkChannelToSession(channel.channelId, '+1234567890');

const stats = await useCase.getStatistics();
console.log(`Total channels: ${stats.total}, Enabled: ${stats.enabled}`);
```

### Example 3: Using AppState

```javascript
import AppState from './core/state/AppState.js';

// Track sessions
AppState.setSession('+1234567890', {
  phone: '+1234567890',
  status: 'active',
  userId: '123456'
});

// Listen to events
AppState.on('session:created', ({ phone }) => {
  console.log(`New session: ${phone}`);
});

AppState.on('channel:added', ({ channelId, channelData }) => {
  console.log(`New channel: ${channelData.title}`);
});

// Get application state
const snapshot = AppState.getSnapshot();
console.log(`Active sessions: ${snapshot.sessions.active}`);
console.log(`Enabled channels: ${snapshot.channels.enabled}`);
```

### Example 4: Working with Entities

```javascript
import { Session } from './core/entities/Session.js';

// Create session with validation
const session = new Session({
  phone: '+1234567890',
  userId: '123456',
  status: 'active',
  firstName: 'John',
  lastName: 'Doe'
});

// Business methods
session.pause('Manual pause');
session.activate();
session.setFloodWait(300); // 5 minutes
session.updateActivity();

// Query methods
console.log(session.isActive());           // true/false
console.log(session.canSendMessages());    // true/false
console.log(session.getDisplayName());     // '@username' or 'John Doe'
console.log(session.getFloodWaitRemaining()); // seconds

// Serialization
const obj = session.toObject(); // For database storage
const json = JSON.stringify(session.toObject());
```

## Migration Guide

### From Legacy to Clean Architecture

#### Before (Legacy):
```javascript
import { addChannel } from './services/channelService.js';

const channel = await addChannel(channelData, adminSessionPhone);
```

#### After (Clean Architecture):
```javascript
import Container from './core/di/Container.js';
import ManageChannelUseCase from './core/use-cases/ManageChannelUseCase.js';

const channelRepo = Container.resolve('channelRepository');
const useCase = new ManageChannelUseCase(channelRepo, log);

const channel = await useCase.addChannel({
  channelId: channelData.channelId,
  title: channelData.title,
  adminSessionPhone
});
```

### Gradual Migration Strategy

1. **Phase 1: Core Layer** ✅ Complete
   - Domain entities
   - Repository interfaces
   - Use cases
   - DI Container
   - AppState

2. **Phase 2: Data Layer** ✅ Complete
   - Data sources
   - Repository implementations

3. **Phase 3: Integration** (Current)
   - Update existing services to use repositories
   - Migrate bot logic to use cases
   - Replace direct DB calls with repository calls

4. **Phase 4: Presentation Layer** (Future)
   - Refactor bots as controllers
   - Implement command handlers
   - Add middleware pattern

5. **Phase 5: Testing** (Future)
   - Unit tests for entities
   - Use case tests with mocked repositories
   - Integration tests

## SOLID Principles Applied

### Single Responsibility Principle (SRP)
- Each entity handles one domain concept
- Each use case handles one business operation
- Each repository handles one entity's persistence

### Open/Closed Principle (OCP)
- Entities are open for extension (inheritance)
- Repositories implement interfaces (closed for modification)

### Liskov Substitution Principle (LSP)
- All repositories can replace `IRepository`
- All use cases extend `BaseUseCase`

### Interface Segregation Principle (ISP)
- Specific repository interfaces (IChannelRepository)
- Focused use case interfaces

### Dependency Inversion Principle (DIP)
- High-level modules depend on abstractions (interfaces)
- Low-level modules (repositories) implement interfaces
- DI Container manages dependencies

## Benefits

1. **Testability**
   - Mock repositories for unit tests
   - Test use cases without database
   - Test entities in isolation

2. **Maintainability**
   - Clear separation of concerns
   - Easy to locate and modify code
   - Self-documenting structure

3. **Scalability**
   - Easy to add new features
   - Swap implementations
   - Add new data sources

4. **Type Safety**
   - JSDoc type definitions
   - Validation in entities
   - Compile-time checks (with TypeScript migration path)

5. **Developer Experience**
   - Intuitive API
   - Comprehensive error messages
   - Event-driven updates

## Running the Refactored Code

### Development
```bash
# Use refactored entry point
node src/index.refactored.js

# Or update package.json to use it by default
npm start
```

### Testing Repository Pattern
```javascript
// Create test script
import Container from './src/core/di/Container.js';
import { config } from './src/config/index.js';
import { initializeDatabase } from './src/db/db.js';

await initializeDatabase();
await Container.initialize(config);

const channelRepo = Container.resolve('channelRepository');
const channels = await channelRepo.findAll();
console.log('Channels:', channels);
```

## Next Steps

1. **Complete Migration**
   - Migrate remaining services
   - Update bot implementations
   - Remove legacy code

2. **Add Testing**
   - Unit tests for entities
   - Use case tests
   - Integration tests

3. **Documentation**
   - API documentation
   - Architecture decision records
   - Code examples

4. **TypeScript Migration** (Optional)
   - Convert JSDoc to TypeScript
   - Add strict type checking
   - Improve IDE support

## Resources

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Dependency Injection Pattern](https://en.wikipedia.org/wiki/Dependency_injection)

## Author

Refactored by Senior Node.js Engineer
Date: 2025-01-10
