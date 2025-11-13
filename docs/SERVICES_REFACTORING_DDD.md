# Services Refactoring - DDD Architecture Implementation

## Overview

The `ThrottleService` and `QueueService` have been completely refactored to follow **Domain-Driven Design (DDD)** architecture principles and clean code standards. The new implementation is based on proven patterns from `throttle.js` and `messageQueue.js`.

## Key Architectural Changes

### 1. **Value Objects (VO)**

Domain logic is now encapsulated in dedicated Value Objects:

#### `RateLimiterVO` (ThrottleService)
- **Responsibility**: Manages token bucket algorithm for rate limiting
- **Features**:
  - Token bucket implementation with automatic refill
  - Jitter-based random delays between messages
  - Configurable tokens per interval and delay ranges
  - Timer management for token refill

#### `PerUserThrottleVO` (ThrottleService)
- **Responsibility**: Per-user rate limiting
- **Features**:
  - Individual delay tracking per user
  - Prevents message spam to specific users
  - User-specific throttle state management

#### `QueueItemVO` (QueueService)
- **Responsibility**: Represents a single queued task
- **Features**:
  - Unique item identification
  - Task metadata tracking
  - Retry attempt counting
  - Promise lifecycle management (resolve/reject)
  - Wait time calculation

#### `MessageQueueVO` (QueueService)
- **Responsibility**: Session-specific message queue
- **Features**:
  - Sequential item processing
  - Configurable delay management
  - Queue statistics and monitoring
  - Item lifecycle management

### 2. **Domain Services**

Services are now pure domain services following DDD principles:

#### `ThrottleService`
**Purpose**: Rate limiting domain logic

**Public Methods**:
- `waitForThrottle(userId)` - Blocks until rate limit allows
- `canForwardNow()` - Non-blocking permission check
- `reset(resetUsers)` - Clear throttle state
- `getStatistics()` - Monitoring data
- `clearUserThrottle(userId)` - Per-user throttle reset
- `retryWithBackoff(operation, options)` - Retry with exponential backoff
- `stop()` - Cleanup resources

**Example Usage**:
```javascript
const throttleService = new ThrottleService({
  tokensPerInterval: 10,
  interval: 60000,
  minDelayMs: 1000,
  maxDelayMs: 5000,
  userDelayMs: 500
});

// Wait for permission before forwarding
await throttleService.waitForThrottle(userId);
await forwardMessage(message);

// Retry with exponential backoff
await throttleService.retryWithBackoff(
  async () => sendMessage(data),
  { maxRetries: 3, baseDelay: 1000 }
);
```

#### `QueueService`
**Purpose**: Message queuing domain logic

**Public Methods**:
- `enqueue(sessionId, task, options)` - Add task to session queue
- `enqueueBulk(sessionId, tasks, options)` - Add multiple tasks
- `getQueueStatus(sessionId)` - Get session queue status
- `getAllQueuesStatus()` - Get all queues status
- `clearQueue(sessionId)` - Clear specific queue
- `removeQueue(sessionId)` - Remove session queue entirely
- `stop()` - Cleanup resources

**Example Usage**:
```javascript
const queueService = new QueueService({
  onError: async (error, metadata, sessionId) => {
    console.error('Queue error:', error);
  }
});

// Enqueue task for session
await queueService.enqueue(
  sessionId,
  async () => sendMessage(data),
  {
    metadata: { messageId: '123' },
    minDelay: 2000,
    maxDelay: 5000
  }
);

// Enqueue multiple tasks
await queueService.enqueueBulk(
  sessionId,
  [task1, task2, task3]
);

// Monitor queues
console.log(queueService.getAllQueuesStatus());
```

### 3. **Architecture Patterns**

#### Token Bucket Algorithm (ThrottleService)
```
Tokens refilled based on elapsed time within interval
- Prevents burst traffic
- Allows sustainable message rate
- Includes jitter to avoid synchronized peaks
```

#### Sequential Processing (QueueService)
```
Per-session queues with sequential execution
- Messages processed one at a time
- Configurable delays between messages
- Error handling with callbacks
- Per-user throttling support
```

#### Value Object Pattern
All internal logic encapsulated in immutable VOs:
- `RateLimiterVO` - Token management
- `PerUserThrottleVO` - User delay tracking
- `QueueItemVO` - Task metadata
- `MessageQueueVO` - Queue state

### 4. **Key Improvements**

#### Code Organization
- ✅ Clear separation of concerns (VOs vs Services)
- ✅ Single Responsibility Principle (SRP)
- ✅ Dependency Injection ready
- ✅ Testable in isolation

#### Error Handling
- ✅ Retry logic with exponential backoff
- ✅ Error callbacks for custom handling
- ✅ Proper error propagation
- ✅ Comprehensive logging

#### Monitoring & Observability
- ✅ Statistics methods for queues and throttle
- ✅ Detailed logging with context
- ✅ Wait time tracking
- ✅ Queue length monitoring

#### Resource Management
- ✅ Timer cleanup on service stop
- ✅ Queue cleanup on session removal
- ✅ Promise cleanup on queue clear
- ✅ Memory leak prevention

### 5. **Migration Guide**

#### From Old ThrottleService
```javascript
// OLD
const service = new ThrottleService({
  timeWindow: 75000,
  maxMessages: 1000
});
await service.canForward();
await service.recordForwarding();

// NEW
const service = new ThrottleService({
  tokensPerInterval: 10,
  interval: 60000
});
await service.waitForThrottle(userId); // Blocks until allowed
```

#### From Old QueueService
```javascript
// OLD
const service = new QueueService(processor, 1000);
service.enqueue(message);
service.enqueueBulk(messages);

// NEW
const service = new QueueService();
await service.enqueue(sessionId, async () => process(), options);
const status = service.getQueueStatus(sessionId);
```

### 6. **DDD Principles Applied**

1. **Domain Logic Encapsulation**: Rate limiting and queueing logic lives in domain services
2. **Value Objects**: RateLimiterVO, PerUserThrottleVO represent domain concepts
3. **Ubiquitous Language**: Methods named after domain concepts (enqueue, throttle, backoff)
4. **Service Interface**: Focused public API for domain operations
5. **Repository Pattern Ready**: Services designed for integration with repositories
6. **Event-Driven Ready**: Error callbacks enable event publishing

### 7. **Testing Strategy**

```javascript
// Unit test example
const service = new ThrottleService({
  tokensPerInterval: 2,
  interval: 1000
});

// Test token bucket
assert(service.canForwardNow() === true);
await service.waitForThrottle();
assert(service.canForwardNow() === false);

// Test statistics
const stats = service.getStatistics();
assert(stats.tokensAvailable === 1);
```

### 8. **Performance Characteristics**

- **ThrottleService**: O(1) throttle check, O(1) token refill
- **QueueService**: O(1) enqueue, O(n) per-session processing
- **Memory**: Efficient - only stores active queues and delays
- **Timer overhead**: Minimal - shared refill timer per service

## Migration Checklist

- [x] Implement RateLimiterVO with token bucket
- [x] Implement PerUserThrottleVO for user delays
- [x] Implement QueueItemVO for task metadata
- [x] Implement MessageQueueVO for session queues
- [x] Refactor ThrottleService with DDD
- [x] Refactor QueueService with DDD
- [x] Add comprehensive documentation
- [ ] Update Container.js DI configuration
- [ ] Update controllers to use new API
- [ ] Add unit tests
- [ ] Verify integration tests pass
- [ ] Remove old throttle.js and messageQueue.js after deprecation period

## References

- **Token Bucket Algorithm**: Used for rate limiting
- **DDD Value Objects**: Encapsulation of domain logic
- **Domain Services**: Stateful business logic coordination
- **Exponential Backoff**: Retry strategy for resilience

## Future Enhancements

1. Add Distributed Rate Limiting (Redis-based)
2. Implement Circuit Breaker pattern
3. Add Metrics collection for monitoring
4. Implement queue persistence
5. Add queue priority levels
