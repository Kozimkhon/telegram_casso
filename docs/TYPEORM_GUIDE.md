# TypeORM + SQLite Integration Guide

## 📋 Overview

This project implements a clean architecture database layer using TypeORM with SQLite. The schema follows a hierarchical relationship structure:

```
Admins → Sessions → Channels → Users
                    ↓
                Messages → Metrics
```

## 🗂️ Schema Relationships

### Entity Relationships

1. **Admin** → **Session** (One-to-Many)
   - An admin can own multiple sessions
   - Sessions can belong to an admin (nullable)

2. **Admin** → **Channel** (One-to-Many)
   - An admin can manage multiple channels
   - Channels can belong to an admin (nullable)

3. **Session** → **Channel** (One-to-Many)
   - A session can manage multiple channels
   - Channels use a specific session (nullable)

4. **Channel** ↔ **User** (Many-to-Many)
   - Channels have many members (users)
   - Users can belong to many channels
   - Junction table: `channel_members`

5. **Channel** → **Message** (One-to-Many)
   - Channels have many messages
   - Messages come from a channel

6. **User** → **Message** (One-to-Many)
   - Users receive many messages
   - Messages are sent to a user

7. **Session** → **Message** (One-to-Many)
   - Sessions send many messages
   - Messages are sent via a session

8. **Channel** → **Metric** (One-to-Many)
   - Channels have many metrics
   - Metrics track channel statistics

9. **Session** → **Metric** (One-to-Many)
   - Sessions have many metrics
   - Metrics track session statistics

10. **User** → **Metric** (One-to-Many)
    - Users have many metrics
    - Metrics track user statistics

## 🏗️ Architecture

```
src/
├── config/
│   ├── index.js              # Environment configuration
│   └── database.js           # TypeORM DataSource configuration
├── entities/
│   └── db/                   # TypeORM entity schemas
│       ├── Admin.entity.js
│       ├── Session.entity.js
│       ├── Channel.entity.js
│       ├── User.entity.js
│       ├── Message.entity.js
│       ├── Metric.entity.js
│       └── index.js
├── repositories/
│   ├── typeorm/              # TypeORM repository implementations
│   │   ├── BaseRepository.js
│   │   ├── AdminRepository.js
│   │   ├── SessionRepository.js
│   │   ├── ChannelRepository.js
│   │   ├── UserRepository.js
│   │   ├── MessageRepository.js
│   │   ├── MetricRepository.js
│   │   └── index.js
│   └── RepositoryFactory.js  # Factory for repository instances
└── services/                 # Business logic layer (existing)
```

## 🚀 Getting Started

### 1. Installation

Dependencies are already installed:
```bash
npm install typeorm reflect-metadata sqlite3
```

### 2. Initialize Database

```javascript
import { initializeTypeORM, closeTypeORM } from './src/config/database.js';

// Initialize TypeORM
await initializeTypeORM();

// Your application code here...

// Cleanup on shutdown
process.on('SIGINT', async () => {
  await closeTypeORM();
  process.exit(0);
});
```

### 3. Using Repositories

```javascript
import RepositoryFactory from './src/repositories/RepositoryFactory.js';

// Get repository instances
const adminRepo = RepositoryFactory.getAdminRepository();
const sessionRepo = RepositoryFactory.getSessionRepository();
const channelRepo = RepositoryFactory.getChannelRepository();
const userRepo = RepositoryFactory.getUserRepository();
const messageRepo = RepositoryFactory.getMessageRepository();
const metricRepo = RepositoryFactory.getMetricRepository();
```

## 📖 Usage Examples

### Admin Operations

```javascript
const adminRepo = RepositoryFactory.getAdminRepository();

// Create admin
const admin = await adminRepo.create({
  userId: '123456789',
  firstName: 'John',
  lastName: 'Doe',
  username: 'johndoe',
  phone: '+1234567890',
  role: 'admin',
  isActive: true,
});

// Find admin by user ID
const admin = await adminRepo.findByUserId('123456789');

// Find admin with sessions
const adminWithSessions = await adminRepo.findWithSessions('123456789');

// Find admin with all relationships
const fullAdmin = await adminRepo.findWithRelations('123456789');

// Update admin role
await adminRepo.updateRole('123456789', 'super_admin');

// Activate/deactivate admin
await adminRepo.activate('123456789');
await adminRepo.deactivate('123456789');
```

### Session Operations

```javascript
const sessionRepo = RepositoryFactory.getSessionRepository();

// Create session
const session = await sessionRepo.create({
  phone: '+1234567890',
  userId: '123456789',
  sessionString: 'encrypted_session_string',
  status: 'active',
  firstName: 'John',
  adminUserId: '987654321', // Link to admin
});

// Find session by phone
const session = await sessionRepo.findByPhone('+1234567890');

// Find active sessions
const activeSessions = await sessionRepo.findAllActive();

// Find sessions by admin
const adminSessions = await sessionRepo.findByAdmin('987654321');

// Pause/resume session
await sessionRepo.pause('+1234567890', 'Maintenance');
await sessionRepo.resume('+1234567890');

// Set flood wait
await sessionRepo.setFloodWait('+1234567890', 300); // 300 seconds

// Find sessions ready to resume
const readySessions = await sessionRepo.findReadyToResume();
```

### Channel Operations

```javascript
const channelRepo = RepositoryFactory.getChannelRepository();

// Create channel
const channel = await channelRepo.create({
  channelId: '-1001234567890',
  title: 'My Channel',
  forwardEnabled: true,
  sessionPhone: '+1234567890',
  adminUserId: '987654321',
  throttleDelayMs: 1000,
  minDelayMs: 2000,
  maxDelayMs: 5000,
});

// Find channel by ID
const channel = await channelRepo.findByChannelId('-1001234567890');

// Find channels by session
const sessionChannels = await channelRepo.findBySession('+1234567890');

// Find channels with forwarding enabled
const activeChannels = await channelRepo.findWithForwardingEnabled();

// Find channel with users (members)
const channelWithUsers = await channelRepo.findWithUsers('-1001234567890');

// Toggle forwarding
await channelRepo.toggleForwarding('-1001234567890');

// Add/remove user
await channelRepo.addUser('-1001234567890', '123456789');
await channelRepo.removeUser('-1001234567890', '123456789');

// Get member count
const memberCount = await channelRepo.getMemberCount('-1001234567890');
```

### User Operations

```javascript
const userRepo = RepositoryFactory.getUserRepository();

// Create user
const user = await userRepo.create({
  userId: '123456789',
  firstName: 'Alice',
  lastName: 'Smith',
  username: 'alice',
  phone: '+9876543210',
  isActive: true,
});

// Bulk create users
const result = await userRepo.bulkCreate([
  { userId: '111', firstName: 'User1' },
  { userId: '222', firstName: 'User2' },
  { userId: '333', firstName: 'User3' },
]);
console.log(`Added: ${result.added}, Updated: ${result.updated}`);

// Find user by ID
const user = await userRepo.findByUserId('123456789');

// Find active users
const activeUsers = await userRepo.findAllActive();

// Search users
const searchResults = await userRepo.search('alice');

// Activate/deactivate user
await userRepo.activate('123456789');
await userRepo.deactivate('123456789');
```

### Message Operations

```javascript
const messageRepo = RepositoryFactory.getMessageRepository();

// Create message log
const message = await messageRepo.create({
  messageId: '12345',
  channelId: '-1001234567890',
  userId: '123456789',
  sessionPhone: '+1234567890',
  status: 'pending',
});

// Mark as sent
await messageRepo.markAsSent(message.id, 'forwarded_msg_id_67890');

// Mark as failed
await messageRepo.markAsFailed(message.id, 'FloodWait error');

// Find pending messages
const pendingMessages = await messageRepo.findPending();

// Find failed messages
const failedMessages = await messageRepo.findFailed();

// Find old messages for cleanup
const oldMessages = await messageRepo.findOldMessages(7); // 7 days old

// Get statistics
const stats = await messageRepo.getStatistics();
console.log(stats); // { total: 100, sent: 80, failed: 15, pending: 5 }

// Get channel statistics
const channelStats = await messageRepo.getChannelStatistics('-1001234567890');
```

### Metric Operations

```javascript
const metricRepo = RepositoryFactory.getMetricRepository();

// Increment counters
await metricRepo.incrementMessagesSent('+1234567890', '-1001234567890', '123456789');
await metricRepo.incrementMessagesFailed('+1234567890', '-1001234567890', '123456789');
await metricRepo.incrementFloodErrors('+1234567890', '-1001234567890', '123456789');

// Find metrics
const sessionMetrics = await metricRepo.findBySession('+1234567890');
const channelMetrics = await metricRepo.findByChannel('-1001234567890');
const userMetrics = await metricRepo.findByUser('123456789');

// Get aggregated statistics
const aggStats = await metricRepo.getAggregatedStatistics();
console.log(aggStats);
// {
//   totalSent: 1000,
//   totalFailed: 50,
//   totalFloodErrors: 10,
//   totalSpamWarnings: 2
// }

// Get statistics by channel
const channelStats = await metricRepo.getChannelStatistics('-1001234567890');

// Get statistics by session
const sessionStats = await metricRepo.getSessionStatistics('+1234567890');
```

## 🔄 Working with Relationships

### Loading Related Data

```javascript
// Load channel with all relationships
const channel = await channelRepo.findWithRelations('-1001234567890');
console.log(channel.admin);    // Admin object
console.log(channel.session);  // Session object
console.log(channel.users);    // Array of User objects
console.log(channel.messages); // Array of Message objects
console.log(channel.metrics);  // Array of Metric objects
```

### Transactions

```javascript
import { runInTransaction } from './src/config/database.js';

const result = await runInTransaction(async (entityManager) => {
  // Create admin
  const admin = await entityManager.save('Admin', {
    userId: '999',
    firstName: 'Test',
  });

  // Create session for admin
  const session = await entityManager.save('Session', {
    phone: '+999999999',
    adminUserId: admin.userId,
  });

  // Create channel for session
  const channel = await entityManager.save('Channel', {
    channelId: '-100999',
    title: 'Test Channel',
    sessionPhone: session.phone,
    adminUserId: admin.userId,
  });

  return { admin, session, channel };
});
```

## 📊 Database Schema Visualization

```
┌─────────────┐
│   Admins    │
├─────────────┤
│ id (PK)     │
│ user_id (UK)│───┐
│ first_name  │   │
│ ...         │   │
└─────────────┘   │
                  │ 1:N
                  ↓
            ┌──────────────┐
            │   Sessions   │
            ├──────────────┤
            │ id (PK)      │
            │ phone (UK)   │───┐
            │ admin_user_id│   │
            │ ...          │   │
            └──────────────┘   │
                               │ 1:N
                               ↓
                         ┌──────────────┐
                         │   Channels   │
                         ├──────────────┤
                         │ id (PK)      │
                         │ channel_id(UK)│──┐
                         │ session_phone│  │
                         │ admin_user_id│  │
                         │ ...          │  │
                         └──────────────┘  │
                                │          │
                         M:N    │          │ 1:N
                         ┌──────┴────┐     │
                         ↓           ↓     ↓
                    ┌─────────┐ ┌──────────────┐
                    │  Users  │ │   Messages   │
                    ├─────────┤ ├──────────────┤
                    │id (PK)  │ │ id (PK)      │
                    │user_id  │ │ channel_id   │
                    │...      │ │ user_id      │
                    └─────────┘ │ session_phone│
                         │      │ ...          │
                         │      └──────────────┘
                         │            │
                         └────────────┼───────┐
                                      ↓       ↓
                                ┌──────────────┐
                                │   Metrics    │
                                ├──────────────┤
                                │ id (PK)      │
                                │ session_phone│
                                │ channel_id   │
                                │ user_id      │
                                │ messages_sent│
                                │ ...          │
                                └──────────────┘
```

## 🔧 Configuration

TypeORM configuration is in `src/config/database.js`:

```javascript
export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: './data/telegram_casso.db',
  entities: [AdminEntity, SessionEntity, ...],
  synchronize: true, // Auto-create tables in development
  logging: ['error', 'warn', 'schema'],
});
```

## 🎯 Best Practices

1. **Use Repository Factory**: Always get repositories through `RepositoryFactory`
2. **Leverage Relationships**: Use `findWithRelations()` methods to load related data
3. **Handle Errors**: Wrap database operations in try-catch blocks
4. **Use Transactions**: For operations that modify multiple tables
5. **Optimize Queries**: Use specific find methods instead of loading all data
6. **Cache Repositories**: RepositoryFactory caches instances automatically
7. **Close Connections**: Always close TypeORM on application shutdown

## 🔐 Migration from Old Schema

To migrate from the old `db.js` schema to TypeORM:

1. The old database will continue to work
2. TypeORM will create new tables with proper relationships
3. Run data migration script (to be created) to copy data
4. Update services to use new repositories
5. Remove old database layer after verification

## 📝 Next Steps

1. ✅ TypeORM entities created with relationships
2. ✅ Repository layer implemented with CRUD operations
3. ✅ Factory pattern for repository management
4. ⏳ Create data migration script
5. ⏳ Update services to use TypeORM repositories
6. ⏳ Update controllers to use new service layer
7. ⏳ Test all functionality

---

**Created**: November 10, 2025  
**Technology Stack**: Node.js + TypeORM + SQLite + Clean Architecture
