# Channel Log User Management Implementation

## Overview
Implemented automatic user management based on Telegram channel admin log events. When admin logs are fetched, the system now automatically adds or removes users from the database based on their participation status.

## Features Implemented

### 1. Event-Based User Operations
The following admin log action types now trigger automatic user management:

#### Join Events (Add User):
- `ChannelAdminLogEventActionParticipantJoin` - User joins channel
- `ChannelAdminLogEventActionParticipantInvite` - User is invited to channel
- `ChannelAdminLogEventActionParticipantJoinByInvite` - User joins via invite link
- `ChannelAdminLogEventActionParticipantJoinByRequest` - User's join request is approved

#### Leave Events (Remove User):
- `ChannelAdminLogEventActionParticipantLeave` - User leaves channel
- `ChannelAdminLogEventActionParticipantToggleBan` - User is banned/unbanned

### 2. User Addition Logic
When a join event is detected:
1. **Extract user info** from `adminLog.users[]` array
2. **Check if user exists** in database by `userId`
3. **Create user** if doesn't exist:
   - Uses fields from ORM User entity: `userId`, `firstName`, `lastName`, `username`, `phone`, `isBot`, `isPremium`
   - Sets `isActive = true` by default
4. **Link user to channel** via many-to-many relationship

### 3. User Removal Logic
When a leave/ban event is detected:
1. **Find user** by `userId`
2. **Check channel membership**:
   - Query all channels user belongs to
   - Determine if user has other channel connections
3. **Remove appropriately**:
   - If user is **only in this channel**: Delete user from database completely
   - If user has **other channels**: Only remove the channel association, keep user record

### 4. Repository Methods Added

#### Domain UserRepository
```javascript
async removeFromChannel(channelId, userId)
```
- Removes channel-user association
- Returns boolean success status

#### ORM UserRepository
```javascript
async removeFromChannel(channelId, userId)
```
- Handles TypeORM many-to-many relationship
- Removes user from channel's users array
- Saves changes to database

### 5. Service Layer Updates

#### ChannelLogFetcherService
**New Dependencies:**
- Added `userRepository` injection

**New Methods:**
- `#processUserOperations(channelId, events, users)` - Main processor for all events
- `#addUserToChannel(channelId, telegramUser)` - Handles user addition
- `#removeUserFromChannel(channelId, userId)` - Handles user removal with smart deletion

**Updated Methods:**
- `fetchChannelLogs()` - Now calls `#processUserOperations()` after saving logs

## Data Flow

```
Admin Log Fetch
    ↓
Events + Users Array
    ↓
Process User Operations
    ↓
For Each Event:
    ├─ Join/Invite → Add User to Channel
    │   ├─ Create user if not exists
    │   └─ Link to channel
    │
    └─ Leave/Ban → Remove User from Channel
        ├─ Check user's other channels
        ├─ If no other channels → Delete user
        └─ If has other channels → Remove channel link only
```

## Response Format

The `fetchChannelLogs()` method now returns:
```javascript
{
  count: 42,              // Number of logs saved
  logs: [...],            // Processed log entities
  userOperations: {       // NEW
    usersAdded: 5,        // Count of users added
    usersRemoved: 2,      // Count of users removed
    errors: 0,            // Count of errors
    details: {
      usersAdded: ['123', '456'],     // User IDs added
      usersRemoved: ['789'],          // User IDs removed
      errors: []                       // Error details
    }
  }
}
```

## Benefits

1. **Automatic Sync**: User database stays synchronized with actual channel membership
2. **Smart Deletion**: Users are only deleted when they have no channel associations
3. **Error Handling**: Each operation is wrapped in try-catch with detailed logging
4. **Clean Architecture**: All changes follow the established patterns
5. **Audit Trail**: All operations are logged for debugging

## Testing

To see the feature in action:
1. Add or remove users from a Telegram channel
2. Wait for the daily log fetch job (or trigger manually)
3. Check logs for:
   - `User created from admin log`
   - `User added to channel from admin log`
   - `User removed from channel`
   - `User deleted from DB (no other channels)`

## Configuration

No configuration needed. The feature is automatically active when admin logs are fetched.

## Notes

- User info comes from `adminLog.users[]` array, not from individual event objects
- The system does NOT track who invited whom (inviter is not saved)
- Join request approver is not saved
- Only handles user operations, does not update channel member counts (handled separately by UserBotController)
