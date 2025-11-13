# E2E Test Execution Guide - Telegram Casso

**Quick Reference for Running E2E Tests**

---

## 🚀 Quick Start

### 1. Install Test Dependencies

```bash
# Install all testing tools
npm install --save-dev \
  jest \
  @jest/globals \
  jest-mock-extended \
  jest-junit \
  jest-html-reporters

# Verify installation
npm test -- --version
```

### 2. Run All E2E Tests

```bash
# Run complete E2E test suite
npm run test:e2e

# Expected output:
# PASS test/__tests__/e2e/admin-registration.e2e.spec.js
# PASS test/__tests__/e2e/message-forwarding.e2e.spec.js
# PASS test/__tests__/e2e/channel-management.e2e.spec.js
# ...
# Tests: X passed, Y failed
# Coverage: XX% statements, XX% branches
```

### 3. View Test Reports

```bash
# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html

# Open report in browser
start coverage/index.html  # Windows
open coverage/index.html   # macOS
xdg-open coverage/index.html # Linux
```

---

## 📊 Test Organization

### Test Structure

```
test/
├── __tests__/
│   ├── e2e/                           # End-to-end workflow tests
│   │   ├── admin-registration.e2e.spec.js
│   │   ├── channel-management.e2e.spec.js
│   │   ├── message-forwarding.e2e.spec.js
│   │   ├── error-recovery.e2e.spec.js
│   │   └── multi-session-workflow.e2e.spec.js
│   ├── domain/                        # Domain layer unit tests
│   │   ├── entities/
│   │   ├── services/
│   │   └── use-cases/
│   └── data/                          # Data layer tests
│       ├── repositories/
│       └── orm/
├── setup/
│   ├── testDatabaseSetup.js          # SQLite in-memory DB setup
│   ├── testContainer.js              # DI container for tests
│   ├── mockTelegram.js               # Telegram client mocks
│   └── e2e-setup.js                  # Global E2E setup
├── fixtures/
│   ├── seedTestData.js               # Database seeding
│   └── EntityFactory.js              # Test data factories
└── helpers/
    ├── assertions.js                 # Custom assertions
    ├── database-helpers.js           # DB helpers
    └── testLogger.js                 # Test logging
```

---

## 🎯 Running Specific Tests

### Run Single Test File

```bash
# Run admin registration tests only
npm run test:e2e -- admin-registration.e2e.spec.js

# Run message forwarding tests only
npm run test:e2e -- message-forwarding.e2e.spec.js

# Run with full path
npm run test:e2e -- test/__tests__/e2e/admin-registration.e2e.spec.js
```

### Run Tests by Pattern

```bash
# Run tests matching "Admin Registration"
npm run test:e2e -- --testNamePattern="Admin Registration"

# Run tests matching "should"
npm run test:e2e -- --testNamePattern="should"

# Run tests matching "database"
npm run test:e2e -- --testNamePattern="database"
```

### Run Tests by Suite

```bash
# Run only domain tests
npm run test:domain

# Run only repository tests
npm run test:data

# Run only E2E tests
npm run test:e2e
```

---

## 🔍 Debugging Tests

### Run Single Test in Debug Mode

```bash
# Start Jest debugger
npm run test:debug

# Connect to chrome://inspect in Chrome DevTools
```

### Run with Verbose Output

```bash
# Show detailed test output
npm run test:e2e -- --verbose

# Show even more details
npm run test:e2e -- --verbose --verbose
```

### Print Debug Logs

```bash
# Run with console output
npm run test:e2e -- --verbose --no-coverage

# With specific log level
LOG_LEVEL=debug npm run test:e2e
```

### Save Test Logs

```bash
# Logs are automatically saved to test-logs/
# Find failure logs
ls -la test-logs/

# View specific test log
cat test-logs/admin-registration-*.json
```

---

## 📈 Coverage Reporting

### Generate Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# Generate with specific format
npm test -- --coverage --coverageReporters=html --coverageReporters=text

# View coverage by file
npm test -- --coverage --coverageReporters=text-summary
```

### Coverage Thresholds

Current thresholds (from `jest.config.js`):

```
Global:
  - Lines: 75%
  - Statements: 75%
  - Functions: 75%
  - Branches: 70%

Core/Entities:
  - Lines: 90%
  - Statements: 90%
  - Functions: 90%
  - Branches: 85%

Domain/Services:
  - Lines: 85%
  - Statements: 85%
  - Functions: 85%
  - Branches: 80%
```

### Increase Coverage

```bash
# Run only uncovered files
npm test -- --coverage --collectCoverageFrom='src/domain/**/*.js'

# Generate coverage for specific folder
npm test -- --coverage src/domain/services/
```

---

## 🔧 Common Commands

### Create `package.json` Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:e2e": "jest test/__tests__/e2e --runInBand --detectOpenHandles",
    "test:e2e:watch": "jest test/__tests__/e2e --watch",
    "test:e2e:coverage": "jest test/__tests__/e2e --coverage",
    "test:domain": "jest test/__tests__/domain",
    "test:data": "jest test/__tests__/data",
    "test:all": "jest --coverage",
    "test:watch": "jest --watch",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
    "test:report": "jest --coverage && open coverage/index.html",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

### Common Test Commands

```bash
# Watch mode (re-run on file changes)
npm run test:e2e:watch

# With coverage
npm run test:e2e:coverage

# Generate report
npm run test:report

# CI/CD mode
npm run test:ci
```

---

## 🚨 Troubleshooting

### "Cannot find module" Errors

```bash
# Clear Jest cache
npm test -- --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database Lock Issues

```bash
# Use --detectOpenHandles flag
npm run test:e2e -- --detectOpenHandles

# Run tests sequentially (slower but safer)
npm run test:e2e -- --runInBand
```

### Timeout Errors

```bash
# Increase Jest timeout
npm test -- --testTimeout=30000

# Or set in jest.config.js:
# testTimeout: 30000
```

### Memory Issues

```bash
# Run with limited workers
npm test -- --maxWorkers=2

# Or use sequential execution
npm test -- --runInBand
```

### Test Isolation Issues

```bash
# Clear database between tests
npm test -- --clearCache --runInBand

# Check test-failures directory for snapshots
ls -la test-failures/
```

---

## 📝 Writing New E2E Tests

### Test Template

```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup/testDatabaseSetup.js';
import { setupTestContainer } from '../../setup/testContainer.js';
import { seedCompleteData } from '../../fixtures/seedTestData.js';
import { TestLogger } from '../../helpers/testLogger.js';

describe('E2E: New Feature', () => {
  let dataSource;
  let container;
  let logger;
  let testData;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
    container = setupTestContainer(dataSource);
    logger = new TestLogger('new-feature');
  });

  afterAll(async () => {
    await cleanupTestDatabase(dataSource);
  });

  beforeEach(async () => {
    // Clear tables
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.clearTable('table_name');
    await queryRunner.release();

    // Seed data
    testData = await seedCompleteData(dataSource);
  });

  describe('Feature Scenario', () => {
    it('should complete workflow', async () => {
      logger.info('Starting test');

      // 1. Setup
      const useCase = container.resolve('useCaseName');

      // 2. Execute
      const result = await useCase.execute(testData);

      // 3. Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      logger.info('Test passed');
    });
  });

  afterEach(() => {
    logger.writeLogs(`./test-logs/new-feature-${Date.now()}.json`);
  });
});
```

---

## 📊 Test Metrics

### Coverage Goals

```
Ideal Coverage:
- Lines of Code: 85%+
- Branch Coverage: 80%+
- Function Coverage: 90%+
- Statement Coverage: 85%+
```

### Performance Benchmarks

```
Ideal Times:
- Single test: < 100ms
- Test suite: < 5 seconds
- Full E2E suite: < 30 seconds
- Coverage collection: < 60 seconds
```

### Check Metrics

```bash
# Run with timing
npm test -- --verbose

# Generate metrics report
npm test -- --coverage --coverageReporters=json

# Parse coverage
node scripts/parseCoverage.js
```

---

## 🔄 Continuous Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - run: npm ci
      - run: npm run test:ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 📚 Resources

### Jest Documentation
- https://jestjs.io/docs/getting-started
- https://jestjs.io/docs/api

### TypeORM Testing
- https://typeorm.io/
- https://typeorm.io/migrations

### Testing Best Practices
- Unit Tests: Fast, isolated, one function
- Integration Tests: Multiple components, real database
- E2E Tests: Complete workflows, user perspective

---

## 🎓 Next Steps

1. **Run tests locally**: `npm run test:e2e`
2. **Review coverage**: `npm run test:report`
3. **Add more scenarios**: Create tests in `test/__tests__/e2e/`
4. **Integrate CI/CD**: Add to your pipeline
5. **Monitor metrics**: Track coverage over time

---

**Last Updated**: November 13, 2025  
**For Issues**: Check test-logs/ and test-failures/ directories
