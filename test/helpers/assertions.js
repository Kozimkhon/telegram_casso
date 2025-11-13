/**
 * @fileoverview Test Helpers & Assertions
 * Custom assertions and helper functions for E2E tests
 * @module test/helpers/assertions.js
 */

/**
 * Custom Jest matchers for domain testing
 */
export const customMatchers = {
  /**
   * Assert valid Admin entity
   */
  toBeValidAdmin(received) {
    const pass = 
      received &&
      typeof received === 'object' &&
      typeof received.userId === 'string' &&
      typeof received.firstName === 'string' &&
      typeof received.isActive === 'boolean' &&
      received.createdAt instanceof Date;

    return {
      pass,
      message: () =>
        pass ? 'expected not to be valid admin' : 'expected to be valid admin'
    };
  },

  /**
   * Assert valid Channel entity
   */
  toBeValidChannel(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.channelId === 'string' &&
      typeof received.title === 'string' &&
      typeof received.forwardEnabled === 'boolean' &&
      typeof received.throttleDelayMs === 'number';

    return {
      pass,
      message: () =>
        pass ? 'expected not to be valid channel' : 'expected to be valid channel'
    };
  },

  /**
   * Assert valid Message entity
   */
  toBeValidMessage(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.messageId === 'string' &&
      typeof received.status === 'string' &&
      typeof received.retryCount === 'number' &&
      ['PENDING', 'SUCCESS', 'FAILED'].includes(received.status);

    return {
      pass,
      message: () =>
        pass ? 'expected not to be valid message' : 'expected to be valid message'
    };
  },

  /**
   * Assert valid Session entity
   */
  toBeValidSession(received) {
    const pass =
      received &&
      typeof received === 'object' &&
      typeof received.sessionString === 'string' &&
      ['active', 'paused', 'error'].includes(received.status) &&
      typeof received.adminId === 'number';

    return {
      pass,
      message: () =>
        pass ? 'expected not to be valid session' : 'expected to be valid session'
    };
  },

  /**
   * Assert valid Repository
   */
  toBeValidRepository(received) {
    const methods = [
      'create', 'findById', 'findAll', 'update', 'delete'
    ];

    const pass = methods.every(method => typeof received[method] === 'function');

    return {
      pass,
      message: () =>
        pass ? 'expected not to be valid repository' : 'expected to be valid repository'
    };
  },

  /**
   * Assert Repository method was called with entity
   */
  toHaveBeenCalledWithEntity(received, expectedEntity) {
    const calls = received.mock?.calls || [];
    const pass = calls.some(call => {
      const arg = call[0];
      return arg && typeof arg === 'object' &&
        JSON.stringify(arg).includes(JSON.stringify(expectedEntity));
    });

    return {
      pass,
      message: () =>
        pass
          ? 'expected not to be called with entity'
          : 'expected to be called with entity'
    };
  },

  /**
   * Assert array contains entity with properties
   */
  toContainEntityWith(received, properties) {
    const pass = Array.isArray(received) &&
      received.some(item =>
        Object.entries(properties).every(([key, value]) =>
          item[key] === value
        )
      );

    return {
      pass,
      message: () =>
        pass
          ? 'expected not to contain entity'
          : 'expected to contain entity with properties'
    };
  },

  /**
   * Assert property was updated
   */
  toHavePropertyUpdated(received, property, oldValue, newValue) {
    const pass = received[property] === newValue && received[property] !== oldValue;

    return {
      pass,
      message: () =>
        pass
          ? `expected ${property} not to be updated`
          : `expected ${property} to be updated from ${oldValue} to ${newValue}`
    };
  }
};

/**
 * Database assertion helpers
 */
export const databaseAssertions = {
  /**
   * Assert record exists in repository
   */
  async assertRecordExists(repository, criteria) {
    const record = await repository.findOne({ where: criteria });
    if (!record) {
      throw new Error(`Record not found with criteria: ${JSON.stringify(criteria)}`);
    }
    return record;
  },

  /**
   * Assert record doesn't exist
   */
  async assertRecordNotExists(repository, criteria) {
    const record = await repository.findOne({ where: criteria });
    if (record) {
      throw new Error(`Record found but shouldn't exist: ${JSON.stringify(criteria)}`);
    }
  },

  /**
   * Assert record count
   */
  async assertRecordCount(repository, criteria, expectedCount) {
    const count = await repository.count({ where: criteria });
    if (count !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} records but found ${count}`
      );
    }
  },

  /**
   * Assert record was updated
   */
  async assertRecordUpdated(repository, id, updates) {
    const record = await repository.findOne({ where: { id } });
    if (!record) {
      throw new Error(`Record not found: ${id}`);
    }

    for (const [key, value] of Object.entries(updates)) {
      if (record[key] !== value) {
        throw new Error(
          `Field ${key}: expected ${value} but got ${record[key]}`
        );
      }
    }
  },

  /**
   * Assert referential integrity
   */
  async assertReferentialIntegrity(
    parentRepo,
    childRepo,
    foreignKeyField,
    parentId
  ) {
    const parent = await parentRepo.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new Error(`Parent record not found: ${parentId}`);
    }

    const children = await childRepo.find({
      where: { [foreignKeyField]: parentId }
    });

    if (children.length === 0) {
      throw new Error(
        `No child records found for parent ${parentId}`
      );
    }

    return children;
  }
};

/**
 * Service assertion helpers
 */
export const serviceAssertions = {
  /**
   * Assert throttle was applied
   */
  assertThrottleApplied(throttleService, userId) {
    expect(throttleService.checkLimit).toHaveBeenCalledWith(userId);
    expect(throttleService.recordEvent).toHaveBeenCalledWith(userId);
  },

  /**
   * Assert state was updated
   */
  assertStateUpdated(stateManager, key, value) {
    expect(stateManager.setState).toHaveBeenCalledWith(key, value);
  },

  /**
   * Assert error handling
   */
  assertErrorHandled(errorHandler, errorType, message) {
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(message)
      })
    );
  }
};

/**
 * Workflow assertion helpers
 */
export const workflowAssertions = {
  /**
   * Assert use case executed successfully
   */
  async assertUseCaseSuccess(useCase, input) {
    const result = await useCase.execute(input);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result).not.toHaveProperty('error');
    return result;
  },

  /**
   * Assert use case failed with error
   */
  async assertUseCaseFailure(useCase, input, errorMessage) {
    try {
      await useCase.execute(input);
      throw new Error('Use case should have failed');
    } catch (error) {
      if (errorMessage) {
        expect(error.message).toContain(errorMessage);
      }
      expect(error).toBeDefined();
    }
  },

  /**
   * Assert complete workflow
   */
  async assertCompleteWorkflow(steps) {
    for (const step of steps) {
      const result = await step.action();
      expect(result).toBeDefined();

      if (step.assertions) {
        for (const assertion of step.assertions) {
          assertion(result);
        }
      }
    }
  }
};

/**
 * Test data assertion helpers
 */
export const dataAssertions = {
  /**
   * Assert all required fields present
   */
  assertRequiredFields(object, fields) {
    const missing = fields.filter(field => !(field in object));
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  },

  /**
   * Assert field types
   */
  assertFieldTypes(object, typeMap) {
    for (const [field, expectedType] of Object.entries(typeMap)) {
      const actualType = typeof object[field];
      if (actualType !== expectedType) {
        throw new Error(
          `Field ${field}: expected ${expectedType} but got ${actualType}`
        );
      }
    }
  },

  /**
   * Assert field values in range
   */
  assertFieldInRange(object, field, min, max) {
    if (object[field] < min || object[field] > max) {
      throw new Error(
        `Field ${field}: expected between ${min} and ${max} but got ${object[field]}`
      );
    }
  },

  /**
   * Assert field matches pattern
   */
  assertFieldMatches(object, field, pattern) {
    if (!pattern.test(object[field])) {
      throw new Error(
        `Field ${field}: value "${object[field]}" doesn't match pattern ${pattern}`
      );
    }
  }
};

/**
 * Export all assertion helpers
 */
export const allAssertions = {
  custom: customMatchers,
  database: databaseAssertions,
  service: serviceAssertions,
  workflow: workflowAssertions,
  data: dataAssertions
};
