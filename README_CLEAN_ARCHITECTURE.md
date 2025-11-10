# Telegram Casso - Clean Architecture Edition

Advanced Telegram UserBot + AdminBot system built with **Clean Architecture**, **Domain-Driven Design**, and **SOLID Principles**.

## 🏗️ Architecture

This project follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────┐
│   Presentation Layer (Bots)        │  ← User interface
├─────────────────────────────────────┤
│   Use Cases (Business Logic)       │  ← Application rules
├─────────────────────────────────────┤
│   Domain Entities                  │  ← Business rules
├─────────────────────────────────────┤
│   Data Layer (Repositories)        │  ← Data access
└─────────────────────────────────────┘
```

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```env
API_ID=your_telegram_api_id
API_HASH=your_telegram_api_hash
ADMIN_BOT_TOKEN=your_bot_token
PHONE_NUMBER=+1234567890
ADMIN_USER_ID=your_telegram_user_id
```

### Running

```bash
# Original implementation
npm start

# Clean Architecture implementation
node src/index.refactored.js

# Examples
node examples/clean-architecture-usage.js
```

## 📚 Documentation

- **[Clean Architecture Guide](./CLEAN_ARCHITECTURE_GUIDE.md)** - Complete architecture overview
- **[Quick Reference](./QUICK_REFERENCE.md)** - Quick API reference
- **[Refactoring Summary](./REFACTORING_SUMMARY.md)** - Refactoring details
- **[Checklist](./CHECKLIST.md)** - Implementation checklist

## 🎯 Key Features

### Clean Architecture
- ✅ **Domain Entities** - Rich models with validation
- ✅ **Use Cases** - Encapsulated business logic
- ✅ **Repository Pattern** - Clean data access
- ✅ **Dependency Injection** - Testable components
- ✅ **Global State Management** - Centralized state
- ✅ **Event-Driven** - Reactive updates

### SOLID Principles
- ✅ **Single Responsibility** - Each class has one job
- ✅ **Open/Closed** - Open for extension, closed for modification
- ✅ **Liskov Substitution** - Polymorphic behavior
- ✅ **Interface Segregation** - Focused interfaces
- ✅ **Dependency Inversion** - Depend on abstractions

### Developer Experience
- ✅ **JSDoc Types** - Full type definitions
- ✅ **Comprehensive Error Handling** - Typed errors
- ✅ **Easy Testing** - Mock-friendly design
- ✅ **Event System** - Observable state changes
- ✅ **Fluent API** - Method chaining

## 📦 Project Structure

```
src/
├── core/                       # Core business logic
│   ├── entities/              # Domain entities (Channel, Session, User, etc.)
│   ├── use-cases/             # Business operations
│   ├── interfaces/            # Repository interfaces
│   ├── state/                 # Global state manager
│   └── di/                    # Dependency injection
├── data/                      # Data access layer
│   ├── repositories/          # Repository implementations
│   └── data-sources/          # Data source abstractions
├── domain/                    # Domain services
├── presentation/              # Presentation layer
│   └── controllers/           # Bot controllers
├── shared/                    # Shared utilities
│   ├── constants/             # Application constants
│   ├── types/                 # Type definitions
│   ├── errors/                # Error handling
│   └── ...                    # Utilities
├── bots/                      # Bot implementations
├── services/                  # Business services
├── config/                    # Configuration
└── db/                        # Database
```

## 💡 Usage Examples

### Using Entities

```javascript
import { Channel, Session } from './core/entities/index.js';

// Create with validation
const channel = new Channel({
  channelId: '-1001234567890',
  title: 'My Channel',
  forwardEnabled: true
});

// Business methods with method chaining
channel
  .enableForwarding()
  .linkToSession('+1234567890')
  .updateTitle('Updated Channel');
```

### Using Repositories

```javascript
import Container from './core/di/Container.js';

// Resolve from DI container
const channelRepo = Container.resolve('channelRepository');

// CRUD operations
const channel = await channelRepo.create(data);
const found = await channelRepo.findById(id);
const all = await channelRepo.findEnabled();
await channelRepo.update(id, updates);
```

### Using Use Cases

```javascript
import { ManageChannelUseCase } from './core/use-cases/index.js';

const useCase = new ManageChannelUseCase(channelRepo, logger);

// Business operations
const channel = await useCase.addChannel({
  channelId: '-1001234567890',
  title: 'My Channel'
});

await useCase.toggleForwarding(channel.channelId);
const stats = await useCase.getStatistics();
```

### Using Global State

```javascript
import AppState from './core/state/AppState.js';

// Manage state
AppState.setSession(phone, sessionData);
AppState.setChannel(channelId, channelData);

// Listen to events
AppState.on('session:created', ({ phone }) => {
  console.log('New session:', phone);
});

// Get snapshot
const snapshot = AppState.getSnapshot();
console.log(`Active sessions: ${snapshot.sessions.active}`);
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run specific test
node --test test/channelService.test.js
```

### Testing with Clean Architecture

```javascript
// Mock repository for testing
class MockChannelRepository {
  async findById(id) {
    return new Channel({ channelId: id, title: 'Mock' });
  }
}

// Test use case without database
const mockRepo = new MockChannelRepository();
const useCase = new ManageChannelUseCase(mockRepo, console);
const channel = await useCase.addChannel({ channelId: '123', title: 'Test' });
```

## 🎨 Design Patterns

- **Singleton** - AppState, DI Container
- **Repository** - Data access abstraction
- **Command** - Use cases
- **Factory** - Entity creation
- **Observer** - Event-driven updates
- **Service Locator** - DI Container
- **Template Method** - BaseUseCase

## 🔧 Development

### Adding a New Entity

1. Create entity in `core/entities/`
2. Add validation rules
3. Implement business methods
4. Add database conversion methods
5. Export from `core/entities/index.js`

### Adding a New Use Case

1. Create use case in `core/use-cases/`
2. Extend `BaseUseCase`
3. Inject required repositories
4. Implement business operations
5. Integrate with AppState

### Adding a New Repository

1. Define interface in `core/interfaces/`
2. Implement in `data/repositories/`
3. Register in DI Container
4. Use in use cases

## 📊 Benefits

### For Development
- **Testable** - Easy to mock and test
- **Maintainable** - Clear structure
- **Scalable** - Easy to extend
- **Type-Safe** - JSDoc types

### For Business
- **Reliable** - Comprehensive error handling
- **Performant** - Optimized data access
- **Observable** - Event-driven updates
- **Auditable** - Logging throughout

## 🚀 Migration Path

The project maintains backward compatibility while introducing Clean Architecture:

1. ✅ **Phase 1**: Core layer (entities, use cases, interfaces)
2. ✅ **Phase 2**: Data layer (repositories, data sources)
3. 🔄 **Phase 3**: Integration (migrate services)
4. 📋 **Phase 4**: Presentation layer (refactor bots)
5. 📋 **Phase 5**: Testing (comprehensive tests)

## 🤝 Contributing

1. Follow Clean Architecture principles
2. Add JSDoc comments
3. Write tests for new features
4. Update documentation
5. Follow SOLID principles

## 📖 Resources

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection)

## 📝 License

MIT

## 👨‍💻 Author

Refactored by Senior Node.js Engineer with Clean Architecture expertise.

---

**Architecture**: Clean Architecture + Domain-Driven Design  
**Principles**: SOLID, DRY, KISS  
**Patterns**: Repository, Singleton, DI, Command, Observer  
**Version**: 1.0.0 (Clean Architecture Edition)
