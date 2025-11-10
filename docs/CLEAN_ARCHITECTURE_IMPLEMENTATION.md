# Complete Clean Architecture Rewrite - Implementation Plan

## Project Status
**Current**: Legacy procedural code with services
**Target**: Enterprise Clean Architecture with DI, SOLID principles, and testability

## Architecture Overview

```
src/
├── core/                      # Inner layer - Business rules
│   ├── entities/             # Domain entities with business logic
│   │   ├── Channel.entity.js
│   │   ├── Session.entity.js
│   │   ├── User.entity.js
│   │   ├── Message.entity.js
│   │   └── Admin.entity.js
│   ├── interfaces/           # Repository contracts
│   │   ├── IRepository.js
│   │   ├── IChannelRepository.js
│   │   ├── ISessionRepository.js
│   │   ├── IUserRepository.js
│   │   ├── IMessageRepository.js
│   │   └── IAdminRepository.js
│   ├── value-objects/        # Immutable value objects
│   │   ├── PhoneNumber.vo.js
│   │   ├── ChannelId.vo.js
│   │   └── UserId.vo.js
│   └── base/                 # Base classes
│       ├── BaseEntity.js
│       └── BaseValueObject.js
│
├── data/                      # Data access layer
│   ├── repositories/         # Repository implementations
│   │   ├── ChannelRepository.js
│   │   ├── SessionRepository.js
│   │   ├── UserRepository.js
│   │   ├── MessageRepository.js
│   │   └── AdminRepository.js
│   └── datasources/          # Data sources
│       └── SQLiteDataSource.js
│
├── domain/                    # Application business logic
│   ├── use-cases/            # Use case implementations
│   │   ├── session/
│   │   │   ├── CreateSession.usecase.js
│   │   │   ├── PauseSession.usecase.js
│   │   │   └── ResumeSession.usecase.js
│   │   ├── channel/
│   │   │   ├── AddChannel.usecase.js
│   │   │   ├── ToggleForwarding.usecase.js
│   │   │   └── SyncChannels.usecase.js
│   │   ├── message/
│   │   │   ├── ForwardMessage.usecase.js
│   │   │   └── DeleteOldMessages.usecase.js
│   │   └── user/
│   │       ├── SyncUsers.usecase.js
│   │       └── BulkAddUsers.usecase.js
│   └── services/             # Domain services
│       ├── ForwardingService.js
│       ├── ThrottleService.js
│       └── MetricsService.js
│
├── presentation/              # External interfaces
│   ├── controllers/          # Controllers (not in previous setup)
│   │   ├── UserBotController.js
│   │   ├── AdminBotController.js
│   │   └── SessionManagerController.js
│   └── handlers/             # Event handlers
│       ├── MessageHandler.js
│       ├── ChannelUpdateHandler.js
│       └── AuthenticationHandler.js
│
└── shared/                    # Shared utilities
    ├── state/
    │   └── StateManager.js   ✅ CREATED
    ├── config/
    │   ├── DatabaseConfig.js
    │   └── TelegramConfig.js
    ├── di/
    │   ├── Container.js
    │   └── ServiceProvider.js
    ├── utils/
    │   ├── Logger.js
    │   ├── ErrorHandler.js
    │   └── Helpers.js
    ├── constants/
    │   └── index.js          ✅ CREATED
    ├── types/
    │   └── index.js
    └── errors/
        └── index.js
```

## Migration Strategy

### Phase 1: Foundation (COMPLETED)
✅ StateManager singleton with EventEmitter
✅ Constants and enums
✅ Folder structure

### Phase 2: Core Layer (IN PROGRESS)
Current task: Create all entity classes

#### Files to CREATE:
1. `core/base/BaseEntity.js` - Base class for all entities
2. `core/entities/Channel.entity.js` - Channel entity with validation
3. `core/entities/Session.entity.js` - Session entity
4. `core/entities/User.entity.js` - User entity
5. `core/entities/Message.entity.js` - Message entity
6. `core/entities/Admin.entity.js` - Admin entity
7. `core/interfaces/IRepository.js` - Base repository interface
8. `core/interfaces/IChannelRepository.js` - Channel repository contract
9. `core/interfaces/ISessionRepository.js` - Session repository contract
10. `core/interfaces/IUserRepository.js` - User repository contract

#### Migration Rules:
- Each entity MUST have validation logic
- Each entity MUST have toObject() and fromDatabaseRow() methods
- Fluent interface for entity methods (method chaining)
- NO direct database calls in entities

### Phase 3: Data Layer
Current task: Implement repository pattern

#### Files to CREATE:
1. `data/datasources/SQLiteDataSource.js` - Database connection wrapper
2. `data/repositories/ChannelRepository.js` - Implements IChannelRepository
3. `data/repositories/SessionRepository.js` - Implements ISessionRepository
4. `data/repositories/UserRepository.js` - Implements IUserRepository
5. `data/repositories/MessageRepository.js` - Implements IMessageRepository
6. `data/repositories/AdminRepository.js` - Implements IAdminRepository

#### Migration from services:
```javascript
// OLD: src/services/channelService.js
export async function addChannel(channelData) {
  return await runQuery('INSERT...');
}

// NEW: data/repositories/ChannelRepository.js
class ChannelRepository {
  async create(channelEntity) {
    const data = channelEntity.toObject();
    const result = await this.dataSource.execute('INSERT...', data);
    return Channel.fromDatabaseRow(result);
  }
}
```

### Phase 4: Domain Layer
Current task: Convert services to use cases

#### Files to CREATE:
1. `domain/use-cases/session/CreateSession.usecase.js`
2. `domain/use-cases/channel/AddChannel.usecase.js`
3. `domain/use-cases/message/ForwardMessage.usecase.js`

#### Migration from services:
```javascript
// OLD: Direct service call
await channelService.addChannel(data);

// NEW: Use case with DI
class AddChannelUseCase {
  constructor(channelRepository, stateManager, logger) {
    this.channelRepository = channelRepository;
    this.stateManager = stateManager;
    this.logger = logger;
  }

  async execute(request) {
    // Validation
    // Business logic
    // Repository call
    // State update
    // Return DTO
  }
}
```

### Phase 5: Presentation Layer
Current task: Rewrite bot controllers

#### Files to REWRITE:
1. `presentation/controllers/UserBotController.js` - Replace `src/bots/userBot.js`
2. `presentation/controllers/AdminBotController.js` - Replace `src/bots/adminBot.js`
3. `presentation/controllers/SessionManagerController.js` - Replace `src/bots/userBotManager.js`

#### Migration rules:
- Controllers should NOT have business logic
- Use dependency injection for all services
- Delegate to use cases
- Handle only presentation concerns (menus, keyboards, messages)

### Phase 6: Dependency Injection
Current task: Create DI container

#### Files to CREATE:
1. `shared/di/Container.js` - Service locator pattern
2. `shared/di/ServiceProvider.js` - Service registration

```javascript
// Container usage
const container = Container.getInstance();

// Register repositories
container.registerSingleton('channelRepository', () => 
  new ChannelRepository(dataSource)
);

// Register use cases
container.registerTransient('addChannelUseCase', () => 
  new AddChannelUseCase(
    container.resolve('channelRepository'),
    container.resolve('stateManager'),
    container.resolve('logger')
  )
);

// Resolve in controllers
const useCase = container.resolve('addChannelUseCase');
```

### Phase 7: Shared Infrastructure
Current task: Refactor utilities

#### Files to MIGRATE:
1. `src/utils/logger.js` → `shared/utils/Logger.js` (injectable service)
2. `src/utils/errorHandler.js` → `shared/errors/ErrorHandler.js`
3. `src/utils/helpers.js` → `shared/utils/Helpers.js`
4. `src/config/index.js` → `shared/config/*Config.js`

### Phase 8: Entry Point
Current task: Rewrite main application

#### Files to REWRITE:
1. `src/index.js` - Complete rewrite using DI

```javascript
// NEW index.js structure
import Container from './shared/di/Container.js';
import StateManager from './shared/state/StateManager.js';

class Application {
  async start() {
    // 1. Initialize DI container
    await this.initializeContainer();
    
    // 2. Initialize state manager
    await this.initializeState();
    
    // 3. Start bot controllers
    await this.startBots();
    
    // 4. Setup graceful shutdown
    this.setupShutdown();
  }
}
```

## Critical Patterns

### 1. Entity Pattern
```javascript
class Channel extends BaseEntity {
  constructor(data) {
    super();
    this.validate(data);
    Object.assign(this, data);
  }

  validate(data) {
    if (!data.channelId) throw new ValidationError('channelId required');
    if (!data.title) throw new ValidationError('title required');
  }

  enableForwarding() {
    this.forwardEnabled = true;
    return this; // Fluent interface
  }

  static fromDatabaseRow(row) {
    return new Channel({
      channelId: row.channel_id,
      title: row.title,
      forwardEnabled: Boolean(row.forward_enabled)
    });
  }

  toObject() {
    return {
      channel_id: this.channelId,
      title: this.title,
      forward_enabled: this.forwardEnabled ? 1 : 0
    };
  }
}
```

### 2. Repository Pattern
```javascript
class ChannelRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async findById(channelId) {
    const row = await this.dataSource.getOne(
      'SELECT * FROM channels WHERE channel_id = ?',
      [channelId]
    );
    return row ? Channel.fromDatabaseRow(row) : null;
  }

  async create(channel) {
    const data = channel.toObject();
    await this.dataSource.execute(
      'INSERT INTO channels (...) VALUES (...)',
      Object.values(data)
    );
    return channel;
  }
}
```

### 3. Use Case Pattern
```javascript
class AddChannelUseCase {
  constructor(channelRepository, stateManager, logger) {
    this.channelRepository = channelRepository;
    this.stateManager = stateManager;
    this.logger = logger;
  }

  async execute(request) {
    // 1. Validate request
    this.validateRequest(request);

    // 2. Create entity
    const channel = new Channel(request);

    // 3. Business logic
    if (request.enableForwarding) {
      channel.enableForwarding();
    }

    // 4. Persist
    const savedChannel = await this.channelRepository.create(channel);

    // 5. Update state
    this.stateManager.addChannel(savedChannel);

    // 6. Log
    this.logger.info('Channel added', { channelId: savedChannel.channelId });

    // 7. Return DTO
    return savedChannel.toObject();
  }

  validateRequest(request) {
    if (!request.channelId) {
      throw new ValidationError('channelId is required');
    }
  }
}
```

## Files to DELETE (After Migration)
- `src/services/channelService.js`
- `src/services/userService.js`
- `src/services/messageService.js`
- `src/services/sessionService.js`
- `src/services/adminService.js`
- `src/services/metricsService.js`
- `src/bots/userBot.js`
- `src/bots/adminBot.js`
- `src/bots/userBotManager.js`
- `src/bots/adminBotAuth.js`
- `src/bots/adminBotSessions.js`

## Testing Strategy
Each layer should be independently testable:

```javascript
// Test entity
const channel = new Channel({ channelId: '123', title: 'Test' });
assert(channel.channelId === '123');

// Test repository with mock
const mockDataSource = { execute: jest.fn() };
const repo = new ChannelRepository(mockDataSource);
await repo.create(channel);
assert(mockDataSource.execute.called);

// Test use case with mocks
const mockRepo = { create: jest.fn() };
const mockState = { addChannel: jest.fn() };
const useCase = new AddChannelUseCase(mockRepo, mockState, console);
await useCase.execute({ channelId: '123', title: 'Test' });
```

## Next Steps
1. Complete core entities (5 files)
2. Implement repositories (5 files)
3. Create use cases (10+ files)
4. Rewrite controllers (3 files)
5. Build DI container (2 files)
6. Migrate utilities (5 files)
7. Rewrite index.js
8. Test entire system
9. Delete old files
10. Document changes

## Estimated Effort
- **Core Layer**: 4 hours
- **Data Layer**: 3 hours
- **Domain Layer**: 6 hours
- **Presentation Layer**: 5 hours
- **Infrastructure**: 3 hours
- **Testing & Debugging**: 4 hours
**Total**: ~25 hours of focused development

## Success Criteria
✅ No direct database calls outside repositories
✅ All business logic in use cases or entities
✅ Controllers only handle presentation
✅ 100% dependency injection
✅ StateManager used for runtime state
✅ All services converted to classes
✅ SOLID principles applied
✅ Testable architecture
