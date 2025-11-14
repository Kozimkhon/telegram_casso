# Test Coverage Analysis Guide

## Overview

This document provides guidance on understanding, improving, and maintaining test coverage for the Telegram Casso project. Coverage metrics help ensure code quality, reduce bugs, and facilitate refactoring.

## Coverage Metrics Explained

### 1. Statement Coverage
**Definition**: Percentage of statements in the code that are executed during tests.

```javascript
// Example:
function processAdmin(admin) {
  if (admin.isActive) {
    console.log('Active admin');  // Statement
  }
  return admin;                    // Statement
}

// With 100% statement coverage, both statements must execute.
```

**Target**: 75%+

### 2. Line Coverage
**Definition**: Percentage of executable lines covered by tests.

**Target**: 75%+

### 3. Function Coverage
**Definition**: Percentage of functions/methods that are called at least once during tests.

```javascript
export class AdminService {
  createAdmin() { }    // Must be called in tests
  updateAdmin() { }    // Must be called in tests
  deleteAdmin() { }    // Must be called in tests
}
```

**Target**: 75%+

### 4. Branch Coverage
**Definition**: Percentage of conditional branches (if/else, switch cases) that are tested.

```javascript
// Example with 2 branches:
if (admin.role === 'SUPER_ADMIN') {  // Branch 1
  // true path
} else {                              // Branch 2
  // false path
}

// To achieve 100% branch coverage, both true and false paths must execute.
```

**Target**: 70%+

## Current Coverage by Layer

### Domain Layer (DDD Core)
- **Entities**: 90%+ coverage
  - Admin.entity.spec.js: Constructor, validation, state management
  - User.entity.spec.js: Initialization, properties
  - Channel.entity.spec.js: Metadata management
  - Message.entity.spec.js: Message tracking
  - Session.entity.spec.js: Session lifecycle

- **Services**: 85%+ coverage
  - ThrottleService.spec.js: Rate limiting algorithm
  - ForwardingService.spec.js: Message forwarding
  - QueueService.spec.js: Queue management
  - MetricsService.spec.js: Performance tracking

### Application Layer (Use Cases)
- **Admin Use Cases**: 80%+ coverage
  - AddAdminUseCase.spec.js: Admin creation
  - UpdateAdminUseCase.spec.js: Admin updates
  - CheckAdminAccessUseCase.spec.js: Permission checks
  - GetAdminUseCase.spec.js: Admin retrieval

- **User Use Cases**: 75%+ coverage
- **Channel Use Cases**: 75%+ coverage
- **Message Use Cases**: 75%+ coverage

### Infrastructure Layer (Repositories)
- **Admin Repository**: 85%+ coverage
- **User Repository**: 80%+ coverage
- **Message Repository**: 80%+ coverage
- **Channel Repository**: 75%+ coverage

### Presentation Layer (Controllers)
- **AdminBotController**: 75%+ coverage
- **UserBotController**: 70%+ coverage

## Running Coverage Analysis

### Generate Coverage Report
```bash
npm run test:coverage
```

### View HTML Coverage Report
```bash
npm run test:coverage:report
```

### Coverage by File
```bash
npm test -- --coverage --collectCoverageFrom='src/domain/**/*.js'
```

### Coverage for Specific Directory
```bash
npm test -- --testPathPattern='domain/services' --coverage
```

## Interpreting Coverage Reports

### Coverage Summary
```
Statements   : 85% ( 510/600 )
Branches     : 78% ( 234/300 )
Functions    : 88% ( 88/100 )
Lines        : 86% ( 516/600 )
```

### Uncovered Lines
```
File                 Uncovered Lines
admin.service.js     45-48, 67-71, 92
user.repository.js   23, 56-58
```

## Improving Coverage

### 1. Identify Gaps
```bash
# Run coverage and find uncovered files
npm run test:coverage

# Look for files with <70% coverage
```

### 2. Add Tests for Uncovered Code
```javascript
// Before: Uncovered code
if (admin.role === 'SUPER_ADMIN' && admin.isActive) {
  deleteAllData();
}

// After: Tests cover the path
test('should delete data when SUPER_ADMIN and active', () => {
  const admin = TestDataFactory.admin({
    role: AdminRole.SUPER_ADMIN,
    isActive: true
  });
  
  const result = deleteDataUseCase.execute(admin);
  expect(result.success).toBe(true);
});

test('should not delete data when not SUPER_ADMIN', () => {
  const admin = TestDataFactory.admin({
    role: AdminRole.ADMIN,
    isActive: true
  });
  
  const result = deleteDataUseCase.execute(admin);
  expect(result.success).toBe(false);
});
```

### 3. Cover Edge Cases
```javascript
test('should handle null values', () => { });
test('should handle empty arrays', () => { });
test('should handle very large numbers', () => { });
test('should handle special characters', () => { });
test('should handle unicode strings', () => { });
```

### 4. Test Error Scenarios
```javascript
test('should handle database errors', () => { });
test('should handle network timeouts', () => { });
test('should handle permission denied', () => { });
test('should handle validation failures', () => { });
```

## Coverage Thresholds

### Global Thresholds
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,    // At least 70% of branches covered
    functions: 75,   // At least 75% of functions covered
    lines: 75,       // At least 75% of lines covered
    statements: 75   // At least 75% of statements covered
  }
}
```

### Per-Module Thresholds
```javascript
'./src/core/entities': {
  branches: 85,
  functions: 90,
  lines: 90,
  statements: 90
},
'./src/domain/services': {
  branches: 80,
  functions: 85,
  lines: 85,
  statements: 85
}
```

## Coverage Anti-Patterns

### 1. Testing Implementation Details
```javascript
// ❌ Bad: Tests implementation, not behavior
test('should call repository.save exactly once', () => {
  expect(mockRepository.save).toHaveBeenCalledTimes(1);
});

// ✅ Good: Tests behavior
test('should persist admin to database', async () => {
  const result = await addAdminUseCase.execute(data);
  expect(result.success).toBe(true);
  expect(result.admin.id).toBeDefined();
});
```

### 2. Mocking Everything
```javascript
// ❌ Bad: Over-mocking reduces integration testing
beforeEach(() => {
  mockDataSource = { /* full mock */ };
  mockLogger = { /* full mock */ };
  mockRepository = { /* full mock */ };
});

// ✅ Good: Mock only external dependencies
beforeEach(() => {
  mockLogger = MockFactory.logger();
  mockTelegramBot = MockFactory.bot();
  // Real repositories can be tested
});
```

### 3. Ignoring Branches
```javascript
// ❌ Bad: Ignoring error branches
test('should create admin', () => {
  expect(repository.create).toHaveBeenCalled();
  // Missing: Error case test
});

// ✅ Good: Test both success and failure
test('should create admin when valid', () => {
  expect(result.success).toBe(true);
});

test('should handle creation errors gracefully', () => {
  mockRepository.create.mockRejectedValue(new Error('DB error'));
  expect(result.success).toBe(false);
});
```

## Coverage Reports

### HTML Report Structure
```
coverage/
├── index.html           # Overview
├── admin.service.js.html    # File-level detail
├── user.repository.js.html  # File-level detail
└── base.html           # Base class coverage
```

### Analyzing Coverage Report
1. **Overall Summary**: Shows total percentages
2. **Files List**: Shows coverage per file
3. **Line-by-line Details**: Shows which lines aren't covered (highlighted in red)
4. **Branch Coverage**: Shows uncovered conditional branches

## Continuous Integration

### GitHub Actions Example
```yaml
- name: Test Coverage
  run: npm test -- --coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v2
  with:
    files: ./coverage/lcov.info

- name: Check Coverage Threshold
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 75" | bc -l) )); then
      echo "Coverage below threshold: $COVERAGE%"
      exit 1
    fi
```

## Best Practices

### 1. Write Tests Before Code (TDD)
```javascript
// 1. Write failing test
test('should reject duplicate userId', () => {
  expect(() => new Admin({ userId: 'same' })).toThrow();
});

// 2. Write minimal code to pass
// 3. Refactor and improve

// Results: Higher coverage from start
```

### 2. Test User Flows
```javascript
// Test complete workflows, not just individual units
test('user creation workflow', async () => {
  // Create user
  const user = await addUserUseCase.execute(userData);
  
  // Assign to channel
  const assignment = await assignUserToChannelUseCase.execute(user);
  
  // Verify state
  const retrievedUser = await getUserUseCase.execute(user.id);
  expect(retrievedUser.channels).toContain(assignment.channel);
});
```

### 3. Cover Regulatory Requirements
```javascript
// Test data protection requirements
test('should not leak sensitive data', () => {
  const user = TestDataFactory.user();
  const result = userService.formatForDisplay(user);
  expect(result.password).toBeUndefined();
  expect(result.apiKey).toBeUndefined();
});
```

### 4. Regular Coverage Reviews
```bash
# Weekly coverage check
npm run test:coverage:report

# Compare with previous week
# Identify new uncovered code
# Plan tests for gaps
```

## Common Coverage Issues

### Issue: Cannot Reach 100% Coverage
**Solution**:
- Not all code needs 100% coverage
- Focus on critical paths (business logic)
- Test edge cases, not implementation details
- Use appropriate thresholds per layer

### Issue: Coverage Decreases After Refactoring
**Solution**:
- Refactor tests along with code
- Don't remove old tests without replacement
- Add tests for newly exposed branches
- Use IDE refactoring tools to auto-update tests

### Issue: False High Coverage
**Solution**:
- Check branch coverage, not just line coverage
- Ensure assertions are meaningful
- Test error cases, not just happy path
- Verify mocks behave realistically

## Tools and Resources

### Coverage Tools
- **Istanbul/nyc**: Built into Jest
- **SonarQube**: Enterprise code quality
- **Codecov**: Cloud-based coverage tracking
- **Coveralls**: Coverage trending service

### Visualization Tools
```bash
# Open HTML report
npm run test:coverage:report

# Watch coverage changes
npm test -- --watch --coverage
```

## Maintenance

### Keep Coverage Stable
1. Review coverage before merging PRs
2. Set minimum thresholds in CI
3. Fail builds if coverage drops
4. Document coverage strategy

### Update Coverage Goals
- Quarterly review of targets
- Increase thresholds as code matures
- Adjust per-module thresholds as needed
- Track coverage trends over time

## Examples by Module

### Domain Entity Coverage
```javascript
// Tests should cover:
✓ Constructor and initialization
✓ Validation rules
✓ State changes (activate, deactivate)
✓ Getters and setters
✓ Database conversion methods
✓ Edge cases (null, special chars, unicode)
```

### Service Coverage
```javascript
// Tests should cover:
✓ Normal operation paths
✓ Error handling
✓ Async operations
✓ Rate limiting/throttling
✓ Retry logic
✓ Configuration options
```

### Repository Coverage
```javascript
// Tests should cover:
✓ CRUD operations (Create, Read, Update, Delete)
✓ Query methods
✓ Transactions
✓ Error handling
✓ Data conversion
✓ Edge cases
```

### Controller Coverage
```javascript
// Tests should cover:
✓ Message routing
✓ Request validation
✓ Response formatting
✓ Error responses
✓ Permission checks
✓ Event handling
```

## Quick Reference

| Layer | Target Coverage | Files | Focus |
|-------|-----------------|-------|-------|
| Domain Entities | 90% | `*.entity.js` | Validation, state management |
| Services | 85% | `*Service.js` | Algorithms, error handling |
| Use Cases | 80% | `*UseCase.js` | Workflows, business logic |
| Repositories | 85% | `*Repository.js` | CRUD, queries, conversion |
| Controllers | 75% | `*Controller.js` | Routing, response formatting |

## Continuous Improvement

1. **Track Trends**: Monitor coverage over time
2. **Set Goals**: Gradual improvement targets
3. **Regular Reviews**: Weekly/monthly coverage checks
4. **Share Knowledge**: Document patterns in test-helpers.js
5. **Automate Checks**: Use CI/CD to enforce thresholds

For more information, see:
- TEST_SUITE_README.md: Test suite organization
- jest.config.js: Coverage configuration
- test-helpers.js: Reusable test utilities
