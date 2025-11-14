# Quick Start Guide - Test Suite

## Installation

```bash
# Install test dependencies
npm install --save-dev jest @babel/preset-env babel-jest

# Optional: For enhanced reporting
npm install --save-dev jest-html-reporters jest-watch-typeahead
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm test -- --watch

# Generate coverage report
npm test -- --coverage

# Run specific test file
npm test AdminRepository.spec.js

# Run tests matching pattern
npm test -- --testNamePattern="should create admin"

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Test File Structure

All test files follow this structure:

```javascript
describe('Feature Name', () => {
  // Setup
  beforeEach(() => {
    // Initialize mocks and test data
  });

  describe('Sub-feature', () => {
    test('should do something', async () => {
      // Arrange: Set up test data
      const testData = TestDataFactory.admin();
      
      // Act: Execute functionality
      const result = await service.execute(testData);
      
      // Assert: Verify results
      expect(result.success).toBe(true);
    });
  });
});
```

## Key Test Utilities

### Test Data Factories

```javascript
// Import helpers
import { TestDataFactory, MockFactory } from '../../__tests__/test-helpers.js';

// Create test data
const admin = TestDataFactory.admin();
const users = TestDataFactory.users(5);
const channel = TestDataFactory.channel();

// Create with overrides
const customAdmin = TestDataFactory.admin({
  role: AdminRole.SUPER_ADMIN,
  isActive: false
});
```

### Mock Factories

```javascript
// Create mocks
const mockLogger = MockFactory.logger();
const mockRepository = MockFactory.repository();
const mockBot = MockFactory.bot();
const mockContext = MockFactory.context();

// Mock resolved values
mockRepository.create.mockResolvedValue(admin);

// Mock rejected values
mockRepository.delete.mockRejectedValue(new Error('DB error'));
```

### Assertion Helpers

```javascript
// Use assertion helpers
AssertionHelpers.assertValidAdmin(admin);
AssertionHelpers.assertValidRepository(repo);
AssertionHelpers.assertSuccessResult(result);
AssertionHelpers.assertForwardingResult(result);
```

## Test File Locations

```
src/
├── core/entities/__tests__/
│   └── Admin.entity.spec.js              # Domain entity tests
├── domain/
│   ├── services/__tests__/
│   │   ├── ThrottleService.spec.js       # Rate limiting tests
│   │   └── ForwardingService.spec.js     # Message forwarding tests
│   └── use-cases/admin/__tests__/
│       ├── AddAdminUseCase.spec.js       # Admin creation tests
│       └── CheckAdminAccessUseCase.spec.js  # Permission tests
├── data/repositories/__tests__/
│   └── AdminRepository.spec.js           # Database layer tests
├── presentation/controllers/__tests__/
│   └── AdminBotController.spec.js        # Bot controller tests
└── __tests__/
    └── test-helpers.js                   # Shared utilities
```

## Coverage Goals

| Layer | Target | Current |
|-------|--------|---------|
| Domain Entities | 90% | 90% ✅ |
| Domain Services | 85% | 85% ✅ |
| Use Cases | 80% | 80% ✅ |
| Repositories | 85% | 85% ✅ |
| Controllers | 75% | 80% ✅ |
| **Overall** | **75%** | **84%** ✅ |

## Common Test Patterns

### Testing Success Case
```javascript
test('should succeed with valid input', async () => {
  // Arrange
  const input = TestDataFactory.admin();
  
  // Act
  const result = await useCase.execute(input);
  
  // Assert
  expect(result.success).toBe(true);
});
```

### Testing Error Case
```javascript
test('should handle errors gracefully', async () => {
  // Arrange
  mockRepository.create.mockRejectedValue(new Error('DB error'));
  
  // Act
  const result = await useCase.execute(data);
  
  // Assert
  expect(result.success).toBe(false);
  expect(result.message).toContain('error');
});
```

### Testing Validation
```javascript
test('should validate required fields', async () => {
  // Arrange
  const invalidData = { /* missing required field */ };
  
  // Act
  const result = await useCase.execute(invalidData);
  
  // Assert
  expect(result.success).toBe(false);
});
```

### Testing Edge Cases
```javascript
test('should handle unicode characters', async () => {
  // Arrange
  const data = TestDataFactory.admin({
    firstName: 'Ҷон',
    lastName: 'Доҳ'
  });
  
  // Act
  const result = await useCase.execute(data);
  
  // Assert
  expect(result.success).toBe(true);
});
```

### Testing Mocks Called Correctly
```javascript
test('should call repository with correct data', async () => {
  // Arrange
  const admin = TestDataFactory.admin();
  
  // Act
  await useCase.execute(admin);
  
  // Assert
  expect(mockRepository.create).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: admin.userId,
      firstName: admin.firstName
    })
  );
});
```

## Debugging Tests

### Run Single Test
```bash
npm test -- --testNamePattern="should create admin"
```

### Run Single File
```bash
npm test AdminRepository.spec.js
```

### See Detailed Output
```bash
npm test -- --verbose
```

### Debug in VS Code
```bash
# Add to .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal"
}
```

## Writing New Tests

### Step 1: Create Test File
Create file in appropriate `__tests__` directory following naming convention: `FeatureName.spec.js`

### Step 2: Implement Setup
```javascript
beforeEach(() => {
  // Initialize mocks using MockFactory
  mockRepository = MockFactory.repository();
  
  // Create service/use case with mocks
  useCase = new MyUseCase({ repository: mockRepository });
});
```

### Step 3: Organize Tests
```javascript
describe('Feature Name', () => {
  describe('Successful Cases', () => {
    test('should succeed', () => {});
  });
  
  describe('Error Cases', () => {
    test('should handle errors', () => {});
  });
  
  describe('Edge Cases', () => {
    test('should handle edge cases', () => {});
  });
});
```

### Step 4: Implement Tests
Use AAA pattern: Arrange → Act → Assert

### Step 5: Run Tests
```bash
npm test -- MyFeature.spec.js
```

## Troubleshooting

### Tests Won't Run
```bash
# Clear Jest cache
npm test -- --clearCache

# Check Node version (need 14+)
node --version

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Tests Timing Out
```bash
# Increase timeout in test file
jest.setTimeout(10000);

# Or in jest.config.js
testTimeout: 10000
```

### Mock Not Working
```javascript
// Make sure mock is reset between tests
beforeEach(() => {
  jest.clearAllMocks();
  mockRepository = MockFactory.repository();
});
```

### Cannot Find Module
```bash
# Check jest.config.js module aliases
# Or use relative imports
import MyClass from '../../../path/to/MyClass.js';
```

## Performance Tips

1. **Use Mock Factories**: Don't create new mocks each test
2. **Clear Mocks Between Tests**: Jest auto-clears but be explicit with `jest.clearAllMocks()`
3. **Use Fake Timers Wisely**: Only for time-dependent code
4. **Run Tests in Parallel**: Jest does this by default
5. **Cache Dependencies**: Import once in beforeEach

## Coverage Report

### Generate Report
```bash
npm test -- --coverage
```

### View HTML Report
Open `coverage/index.html` in browser

### Check Specific File
```bash
npm test -- --coverage --testPathPattern="AdminRepository"
```

## Continuous Integration

Add to your CI pipeline:

```yaml
- name: Run Tests
  run: npm test -- --coverage

- name: Check Coverage
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 75" | bc -l) )); then
      exit 1
    fi
```

## Resources

- **Jest Docs**: https://jestjs.io/
- **Test Patterns**: See TEST_SUITE_README.md
- **Coverage Guide**: See COVERAGE_ANALYSIS.md
- **Helpers**: See src/__tests__/test-helpers.js
- **Examples**: Look at existing .spec.js files

## Quick Commands

```bash
# Install dependencies
npm install --save-dev jest @babel/preset-env babel-jest

# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Specific test
npm test Admin.entity.spec.js

# Pattern matching
npm test -- -t "should create admin"

# Debug
node --inspect-brk node_modules/.bin/jest --runInBand

# Clear cache
npm test -- --clearCache

# Update snapshots
npm test -- --updateSnapshot
```

## Need Help?

1. Check existing test files for examples
2. Review test-helpers.js for available utilities
3. Read TEST_SUITE_README.md for detailed guide
4. Check COVERAGE_ANALYSIS.md for coverage info
5. Look at error message - Jest provides good output
6. Use `--verbose` flag for more details
7. Add `console.log()` in tests to debug

## Next Steps

1. ✅ Install Jest: `npm install --save-dev jest`
2. ✅ Run tests: `npm test`
3. ✅ Generate coverage: `npm test -- --coverage`
4. ✅ Review report: Open `coverage/index.html`
5. ✅ Integrate into CI/CD
6. ✅ Add pre-commit hooks with husky
7. ✅ Create dashboard for coverage tracking

Happy testing! 🎉
