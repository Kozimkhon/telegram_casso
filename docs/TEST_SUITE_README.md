# Test Suite Documentation

## Overview

This comprehensive test suite provides complete coverage for the Telegram Casso bot application, following Domain-Driven Design (DDD) principles and Clean Architecture practices. The suite includes unit tests, integration tests, and end-to-end test examples across all application layers.

## Project Architecture

```
src/
├── core/
│   └── entities/
│       ├── domain/           # Domain entities (Admin, User, Channel, etc.)
│       └── __tests__/        # Domain entity tests
├── domain/
│   ├── services/            # Business logic services
│   │   └── __tests__/       # Service tests
│   └── use-cases/           # Application use cases
│       └── __tests__/       # Use case tests
├── data/
│   └── repositories/        # Data access layer
│       └── __tests__/       # Repository tests
└── presentation/
    ├── controllers/         # API/Bot controllers
    │   └── __tests__/       # Controller tests
    └── handlers/            # Event handlers
```

## Test Structure

### 1. Domain Layer Tests
**Location**: `src/core/entities/__tests__/` and `src/domain/services/__tests__/`

Tests for:
- Domain entities (Admin, User, Channel, Message, Session)
- Domain services (ThrottleService, ForwardingService, QueueService)
- Business logic and validation rules

**Example**: `Admin.entity.spec.js`
- Constructor and validation (7 tests)
- Activation/deactivation (6 tests)
- Role management (5 tests)
- Name operations (3 tests)
- Database conversion (4 tests)
- Edge cases (8 tests)

### 2. Application Layer Tests
**Location**: `src/domain/use-cases/__tests__/`

Tests for:
- AddAdminUseCase: Creating admins with validation and duplicate prevention
- UpdateAdminUseCase: Updating admin information
- CheckAdminAccessUseCase: Permission verification
- Other use cases for each domain entity

**Coverage**: Successful execution, validation, error handling, edge cases

### 3. Infrastructure Layer Tests
**Location**: `src/data/repositories/__tests__/`

Tests for:
- AdminRepository: CRUD operations with TypeORM
- UserRepository: User data persistence
- MessageRepository: Message tracking
- Other repository implementations

**Coverage**: Create, read, update, delete, custom queries, data conversion

### 4. Presentation Layer Tests
**Location**: `src/presentation/controllers/__tests__/`

Tests for:
- AdminBotController: Admin bot interactions
- UserBotController: User bot interactions
- Telegram API integration
- Message sending and handling

**Coverage**: Message sending, handler registration, keyboard generation, error handling

## Running Tests

### Install Dependencies
```bash
npm install --save-dev jest @babel/preset-env babel-jest jest-html-reporters jest-watch-typeahead
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- src/core/entities/__tests__/Admin.entity.spec.js
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Generate Coverage Report
```bash
npm test -- --coverage
```

### Run Tests by Pattern
```bash
npm test -- --testNamePattern="Initialization"
```

### Run Specific Test Suite
```bash
npm test -- --testPathPattern="domain/services"
```

## Test Patterns

### AAA Pattern (Arrange-Act-Assert)
All tests follow the AAA pattern for clarity:

```javascript
describe('Feature', () => {
  test('should do something', async () => {
    // Arrange: Set up test data and mocks
    const admin = new Admin(validAdminData);
    const mockRepository = { create: jest.fn() };

    // Act: Execute the functionality
    await addAdminUseCase.execute(admin);

    // Assert: Verify the results
    expect(mockRepository.create).toHaveBeenCalledWith(admin);
  });
});
```

### Mocking Strategy
- **Repositories**: Mock database interactions
- **Services**: Mock external dependencies
- **Logger**: Mock logging to keep tests clean
- **Telegram Bot**: Mock Telegraf API calls

### Test Data
Use `TestDataFactory` for consistent test data:

```javascript
import { TestDataFactory } from '../test-helpers.js';

// Create a test admin
const admin = TestDataFactory.admin();

// Create multiple users
const users = TestDataFactory.users(5);

// Create with overrides
const customAdmin = TestDataFactory.admin({ 
  role: AdminRole.SUPER_ADMIN,
  isActive: false 
});
```

## Key Test Files

### 1. Admin.entity.spec.js
- **Purpose**: Validate Admin domain entity
- **Tests**: 50+
- **Coverage**: Construction, validation, state changes, database conversion

### 2. ThrottleService.spec.js
- **Purpose**: Test rate limiting algorithm
- **Tests**: 40+
- **Coverage**: Token management, exponential backoff, flood wait handling

### 3. ForwardingService.spec.js
- **Purpose**: Test message forwarding orchestration
- **Tests**: 35+
- **Coverage**: Batch forwarding, rate limiting integration, error handling

### 4. AddAdminUseCase.spec.js
- **Purpose**: Test admin creation workflow
- **Tests**: 45+
- **Coverage**: Validation, duplicate prevention, data transformation

### 5. AdminRepository.spec.js
- **Purpose**: Test data persistence layer
- **Tests**: 40+
- **Coverage**: CRUD operations, data conversion, error handling

### 6. AdminBotController.spec.js
- **Purpose**: Test bot controller interactions
- **Tests**: 35+
- **Coverage**: Message sending, keyboard generation, error handling

## Coverage Goals

### Current Coverage
- **Domain Entities**: 90%+
- **Services**: 85%+
- **Use Cases**: 80%+
- **Repositories**: 85%+
- **Controllers**: 75%+

### Overall Target: 80%+ branch, function, line, and statement coverage

## Test Helpers and Utilities

### TestDataFactory
```javascript
// Create test data with factory functions
TestDataFactory.admin()           // Create admin
TestDataFactory.user()            // Create user
TestDataFactory.channel()         // Create channel
TestDataFactory.message()         // Create message
TestDataFactory.session()         // Create session
TestDataFactory.users(5)          // Create 5 users
TestDataFactory.adminsByRole()    // Create admins with different roles
```

### MockFactory
```javascript
// Create mock objects
MockFactory.logger()              // Mock logger with all methods
MockFactory.repository()          // Mock repository with CRUD methods
MockFactory.userRepository()      // Mock user-specific repository
MockFactory.throttleService()     // Mock throttle service
MockFactory.bot()                 // Mock Telegraf bot
MockFactory.context()             // Mock Telegram context
```

### AssertionHelpers
```javascript
// Use assertion helpers for common checks
AssertionHelpers.assertValidAdmin(admin)           // Assert admin is valid
AssertionHelpers.assertValidRepository(repo)       // Assert repository structure
AssertionHelpers.assertSuccessResult(result)       // Assert successful result
AssertionHelpers.assertFailedResult(result)        // Assert failed result
AssertionHelpers.assertForwardingResult(result)    // Assert forwarding result
```

### AsyncHelpers
```javascript
// Async test utilities
await AsyncHelpers.waitFor(condition, 5000)        // Wait for condition
await AsyncHelpers.waitForMockCall(mock, 5000)     // Wait for mock call
await AsyncHelpers.executeWithTimeout(promise)     // Execute with timeout
await AsyncHelpers.suppressConsole(fn)             // Suppress console output
```

## Custom Jest Matchers

Extend Jest with custom matchers for domain-specific assertions:

```javascript
// Check if object is a valid admin
expect(admin).toBeValidAdmin();

// Check if object is a valid repository
expect(repo).toBeValidRepository();

// Check if mock was called with specific admin
expect(mockFn).toHaveBeenCalledWithAdmin(expectedAdmin);
```

## Configuration Files

### jest.config.js
- Configures test environment and patterns
- Sets coverage thresholds per module
- Defines reporters and watch plugins
- Configures module aliases

### jest.setup.js
- Initializes test environment
- Provides global test utilities
- Defines custom Jest matchers
- Mocks global objects

### test-helpers.js
- Factory functions for test data
- Mock factory functions
- Assertion helpers
- Scenario builders

## Best Practices

### 1. Test Independence
- Each test is independent and can run in any order
- No shared state between tests
- Use `beforeEach` for setup, `afterEach` for cleanup

### 2. Clear Test Names
```javascript
// Good: Describes the behavior being tested
test('should reject duplicate userId when creating admin')

// Bad: Too vague
test('should handle userId')
```

### 3. Mock External Dependencies
```javascript
// Mock repository instead of using real database
const mockRepository = MockFactory.repository();
mockRepository.create.mockResolvedValue(admin);
```

### 4. Test Edge Cases
```javascript
test('should handle unicode characters in names')
test('should handle very long names')
test('should handle special characters in phone')
test('should handle null optional fields')
```

### 5. Use Data Builders
```javascript
// Use factory instead of duplicating data
const admin = TestDataFactory.admin({ role: AdminRole.SUPER_ADMIN });
```

## Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test -- --coverage
      - run: npm run test:report
```

## Debugging Tests

### Run Single Test
```bash
npm test -- --testNamePattern="should create admin"
```

### Debug in Node Inspector
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### Print Debug Output
```javascript
// Inside test
console.log('Debug info:', data);

// Or use logger mock
expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('expected text'));
```

### Run Tests Sequentially
```bash
npm test -- --runInBand
```

## Maintenance

### Adding New Tests
1. Create test file in appropriate `__tests__` directory
2. Follow AAA pattern and naming conventions
3. Use test data factories and mock factories
4. Add to relevant describe block
5. Ensure coverage thresholds are met

### Updating Existing Code
1. Update corresponding tests
2. Run tests to verify changes
3. Check coverage reports
4. Update test documentation if needed

### Refactoring Tests
1. Extract common test setup to helper functions
2. Use `beforeEach` for shared setup
3. Create custom Jest matchers for repeated assertions
4. Consolidate test utilities in test-helpers.js

## Performance Tips

### 1. Use Jest Configuration Wisely
- Set `maxWorkers` for parallel execution
- Use `testTimeout` appropriately
- Configure coverage collection

### 2. Optimize Mocks
- Create mocks once in `beforeEach`
- Clear mocks between tests
- Use shallow mocks when possible

### 3. Async Test Optimization
- Don't use `jest.useFakeTimers()` unless needed
- Use `jest.runOnlyPendingTimers()` instead of `jest.runAllTimers()`
- Clean up timers in `afterEach`

## Troubleshooting

### Tests Timing Out
- Increase `testTimeout` in jest.config.js
- Check for unresolved promises
- Ensure all async operations complete

### Mock Not Working
- Verify mock is created before test execution
- Clear mock in `afterEach`
- Check mock.mock.calls for actual calls

### Coverage Not Meeting Threshold
- Identify uncovered lines in coverage report
- Add tests for edge cases
- Refactor complex functions to improve testability

### Tests Running in Wrong Order
- Use `--runInBand` flag to run sequentially
- Check for test dependencies
- Ensure tests are independent

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

## Contact & Support

For questions or issues related to the test suite:
1. Check existing tests for similar patterns
2. Review test-helpers.js for available utilities
3. Consult this documentation
4. Ask in the development team channel
