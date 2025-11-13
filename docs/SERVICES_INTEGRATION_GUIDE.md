# Integration Guide - Updated Services

## Quick Start

### Installation
Services are already updated. No npm packages needed.

### Basic Setup

```javascript
// Import the services
import ThrottleService from './src/domain/services/ThrottleService.js';
import QueueService from './src/domain/services/QueueService.js';

// Initialize ThrottleService
const throttleService = new ThrottleService({
  tokensPerInterval: 10,      // 10 tokens per window
  interval: 60000,            // 60 second window
  minDelayMs: 1000,           // Min 1s between messages
  maxDelayMs: 5000,           // Max 5s between messages
  userDelayMs: 500            // 500ms per-user delay
});

// Initialize QueueService
const queueService = new QueueService({
  onError: async (error, metadata, sessionId) => {
    console.error('Queue error in session', sessionId, error);
    // Send alert, log to external service, etc.
  }
});
```

---

## ThrottleService Usage

### 1. Basic Rate Limiting

```javascript
// Wait for throttle permission (blocks until allowed)
await throttleService.waitForThrottle();
await sendMessage(data);

// With per-user throttling
await throttleService.waitForThrottle(userId);
await sendMessageToUser(userId, data);
```

### 2. Non-Blocking Check

```javascript
if (throttleService.canForwardNow()) {
  await sendMessage(data);
} else {
  console.log('Rate limit reached, try again later');
}
```

### 3. Retry with Exponential Backoff

```javascript
// Automatically retries with exponential backoff + jitter
const result = await throttleService.retryWithBackoff(
  async () => apiCall(data),
  {
    maxRetries: 3,          // 3 retry attempts
    baseDelay: 1000,        // Start with 1 second
    maxDelay: 60000         // Cap at 60 seconds
  }
);
```

### 4. Monitoring

```javascript
// Get current statistics
const stats = throttleService.getStatistics();
console.log('Available tokens:', stats.tokensAvailable);
console.log('Current limits:', {
  min: stats.minDelayMs,
  max: stats.maxDelayMs,
  window: stats.interval
});
```

### 5. User-Specific Throttling

```javascript
// Clear throttle for specific user (e.g., when user logs out)
throttleService.clearUserThrottle(userId);

// Reset all throttling
throttleService.reset(true); // true = also reset users
```

### 6. Cleanup

```javascript
// Stop service and cleanup resources
throttleService.stop();
```

---

## QueueService Usage

### 1. Enqueue Single Task

```javascript
// Simple enqueue with defaults
await queueService.enqueue(
  sessionId,
  async () => sendMessage(data)
);

// With options
await queueService.enqueue(
  sessionId,
  async () => sendMessage(data),
  {
    metadata: {
      messageId: '123',
      userId: 'user456',
      timestamp: Date.now()
    },
    minDelay: 2000,        // Min delay between messages
    maxDelay: 5000,        // Max delay between messages
    maxRetries: 2          // Retry attempts per item
  }
);
```

### 2. Enqueue Bulk Tasks

```javascript
// Queue multiple tasks at once
const tasks = [
  async () => sendMessage(msg1),
  async () => sendMessage(msg2),
  async () => sendMessage(msg3)
];

await queueService.enqueueBulk(sessionId, tasks, {
  metadata: { batchId: 'batch123' }
});
```

### 3. Monitor Queue Status

```javascript
// Check single session queue
const status = queueService.getQueueStatus(sessionId);
console.log({
  queueLength: status.length,
  processing: status.processing,
  avgWaitTime: status.averageWaitTimeMs,
  oldestItemAge: status.oldestItemAgeMs
});

// Check all queues
const allStatus = queueService.getAllQueuesStatus();
for (const [sid, info] of Object.entries(allStatus)) {
  console.log(`Session ${sid}: ${info.length} items queued`);
}
```

### 4. Manage Queues

```javascript
// Clear queue for session (rejects pending tasks)
const cleared = queueService.clearQueue(sessionId);
console.log(`Cleared ${cleared} items`);

// Remove queue entirely
queueService.removeQueue(sessionId);
```

### 5. Error Handling

```javascript
// Errors automatically call the onError callback
const queueService = new QueueService({
  onError: async (error, metadata, sessionId) => {
    logger.error('Task failed', {
      session: sessionId,
      metadata,
      error: error.message
    });

    // Re-queue with backoff
    if (metadata.retryCount < 3) {
      await sleep(Math.pow(2, metadata.retryCount) * 1000);
      await queueService.enqueue(
        sessionId,
        originalTask,
        { ...metadata, retryCount: (metadata.retryCount || 0) + 1 }
      );
    }
  }
});
```

### 6. Cleanup

```javascript
// Stop service and cleanup all queues
queueService.stop();
```

---

## Integration with Container/DI

### Update Container.js

```javascript
// src/shared/container/Container.js

import ThrottleService from '../../../domain/services/ThrottleService.js';
import QueueService from '../../../domain/services/QueueService.js';

class Container {
  register() {
    // Throttle Service
    this.registerSingleton('throttleService', () => 
      new ThrottleService({
        tokensPerInterval: 10,
        interval: 60000,
        minDelayMs: 1000,
        maxDelayMs: 5000,
        userDelayMs: 500
      })
    );

    // Queue Service
    this.registerSingleton('queueService', () => 
      new QueueService({
        onError: (error, metadata, sessionId) => {
          // Handle queue errors
          logger.error('Queue error', { error, metadata, sessionId });
        }
      })
    );
  }
}
```

---

## Integration with Controllers

### Example: UserBotController

```javascript
// src/presentation/controllers/UserBotController.js

class UserBotController {
  constructor(dependencies) {
    this.throttleService = dependencies.throttleService;
    this.queueService = dependencies.queueService;
  }

  async handleMessage(message) {
    try {
      // Apply rate limiting
      await this.throttleService.waitForThrottle(message.from.id);

      // Queue message forwarding
      await this.queueService.enqueue(
        message.from.id,
        async () => this.forwardMessage(message),
        {
          metadata: {
            messageId: message.message_id,
            userId: message.from.id
          }
        }
      );
    } catch (error) {
      this.logger.error('Failed to handle message', error);
    }
  }

  async forwardMessage(message) {
    // Actual forwarding logic
    return await this.bot.forwardMessage(...);
  }
}
```

---

## Common Patterns

### Pattern 1: Batch Processing with Rate Limiting

```javascript
async function processUsersInBatch(userIds, processor) {
  for (const userId of userIds) {
    await throttleService.waitForThrottle(userId);
    
    try {
      const result = await processor(userId);
      console.log(`Processed ${userId}:`, result);
    } catch (error) {
      console.error(`Failed for ${userId}:`, error);
    }
  }
}

// Usage
await processUsersInBatch(userIds, async (id) => {
  await queueService.enqueue(id, async () => send(id));
});
```

### Pattern 2: Fallback Queue with Retry

```javascript
async function sendWithFallback(message, options = {}) {
  try {
    // Try direct send
    await throttleService.waitForThrottle();
    return await directSend(message);
  } catch (error) {
    // Fall back to queued with retry
    return await queueService.enqueue(
      options.sessionId,
      async () => directSend(message),
      {
        metadata: options.metadata,
        maxRetries: 3
      }
    );
  }
}
```

### Pattern 3: Per-Session Rate Limits

```javascript
async function sendToSession(sessionId, messages) {
  // Each session gets its own queue with independent rate limiting
  const tasks = messages.map(msg => 
    async () => send(msg)
  );

  await queueService.enqueueBulk(sessionId, tasks, {
    minDelay: 1000,
    maxDelay: 3000
  });
}
```

---

## Testing

### Unit Tests Example

```javascript
import ThrottleService from './ThrottleService.js';
import QueueService from './QueueService.js';

describe('ThrottleService', () => {
  let service;

  beforeEach(() => {
    service = new ThrottleService({
      tokensPerInterval: 2,
      interval: 1000,
      minDelayMs: 100,
      maxDelayMs: 200
    });
  });

  afterEach(() => {
    service.stop();
  });

  it('should limit rate based on tokens', async () => {
    const start = Date.now();
    await service.waitForThrottle();
    await service.waitForThrottle();
    // Third call should wait
    await service.waitForThrottle();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(1000);
  });

  it('should support per-user throttling', async () => {
    await service.waitForThrottle('user1');
    const canSendAgain = service.canForwardNow();
    expect(canSendAgain).toBe(false);
  });
});

describe('QueueService', () => {
  let service;

  beforeEach(() => {
    service = new QueueService();
  });

  afterEach(() => {
    service.stop();
  });

  it('should process tasks sequentially', async () => {
    const order = [];
    const task1 = async () => { order.push(1); };
    const task2 = async () => { order.push(2); };

    await service.enqueue('session1', task1);
    await service.enqueue('session1', task2);

    // Wait for processing
    await new Promise(r => setTimeout(r, 500));
    expect(order).toEqual([1, 2]);
  });

  it('should handle multiple sessions', async () => {
    const task1 = async () => 'result1';
    const task2 = async () => 'result2';

    const p1 = service.enqueue('session1', task1);
    const p2 = service.enqueue('session2', task2);

    const results = await Promise.all([p1, p2]);
    expect(results).toEqual(['result1', 'result2']);
  });
});
```

---

## Migration Checklist

- [ ] Review documentation
- [ ] Import new services in Container
- [ ] Update controller dependencies
- [ ] Test single message forwarding
- [ ] Test batch message forwarding
- [ ] Test error handling
- [ ] Test rate limiting
- [ ] Test queue monitoring
- [ ] Performance testing
- [ ] Load testing
- [ ] Production deployment

---

## Support & Documentation

- **Main Docs**: `docs/SERVICES_REFACTORING_DDD.md`
- **Before/After**: `docs/SERVICES_BEFORE_AFTER.md`
- **Summary**: `docs/SERVICES_REFACTORING_SUMMARY.md`

---

## Performance Tuning

### For High Volume

```javascript
const throttle = new ThrottleService({
  tokensPerInterval: 50,      // More tokens
  interval: 60000,            // Same window
  minDelayMs: 500,            // Shorter delays
  maxDelayMs: 1500
});
```

### For Conservative Rate Limiting

```javascript
const throttle = new ThrottleService({
  tokensPerInterval: 5,       // Fewer tokens
  interval: 60000,
  minDelayMs: 2000,           // Longer delays
  maxDelayMs: 8000
});
```

### For Per-Session Queues

```javascript
const queue = new QueueService({
  onError: async (error, metadata, sessionId) => {
    // Custom error handling per session
  }
});

// Sessions auto-create on first enqueue
await queue.enqueue('session1', task);
await queue.enqueue('session2', task);
// Independent processing
```

---

## Troubleshooting

### Q: Tasks not processing?
**A**: Check if service is stopped. Call `stop()` only when shutting down.

### Q: Queue filling up?
**A**: Monitor with `getQueueStatus()`. Increase minDelay/maxDelay or tokensPerInterval.

### Q: Memory leaks?
**A**: Always call `stop()` when shutting down. Use `removeQueue()` for old sessions.

### Q: Rate limiting too strict?
**A**: Increase `tokensPerInterval` or decrease `interval`.

---

Generated: 2025-11-12  
Services Version: 2.0.0  
Architecture: DDD-Compliant
