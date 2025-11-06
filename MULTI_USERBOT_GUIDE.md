# Multi-Userbot System Documentation

## Overview

The enhanced Telegram Casso system now supports multiple userbot accounts with advanced session management, spam protection, and throttling capabilities.

## Key Features

### 1. Multi-Account Support
- Manage multiple Telegram userbot accounts simultaneously
- Random account selection for load balancing
- Independent session management for each account

### 2. Session Management
- **Session Status**: active, paused, error
- **Auto-Pause**: Automatic pause on FloodWait or SpamWarning
- **Manual Control**: Pause, resume, and restart sessions via AdminBot
- **Database-Backed**: All sessions stored in SQLite database

### 3. Spam Protection
- **Rate Limiting**: Global and per-channel rate limits
- **Throttling**: Per-member throttling to avoid spam detection
- **Exponential Backoff**: Automatic retry with increasing delays
- **FloodWait Handling**: Detects and auto-pauses sessions with flood errors
- **Spam Detection**: Monitors and responds to spam warnings

### 4. Metrics and Monitoring
- Track messages sent/failed per session
- Monitor flood errors and spam warnings
- Per-channel and per-user statistics
- System-wide metrics dashboard

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  phone TEXT PRIMARY KEY,          -- Phone number
  user_id TEXT,                    -- Telegram user ID
  session_string TEXT,             -- Encrypted session data
  status TEXT DEFAULT 'active',   -- active/paused/error
  auto_paused BOOLEAN DEFAULT 0,   -- Auto-paused by system
  pause_reason TEXT,               -- Reason for pause
  flood_wait_until DATETIME,       -- When flood wait expires
  last_error TEXT,                 -- Last error message
  last_active DATETIME,            -- Last activity timestamp
  ...
)
```

### Metrics Table
```sql
CREATE TABLE metrics (
  session_phone TEXT,              -- Which session
  channel_id TEXT,                 -- Which channel
  user_id TEXT,                    -- Which user
  messages_sent INTEGER,           -- Success count
  messages_failed INTEGER,         -- Failure count
  flood_errors INTEGER,            -- FloodWait count
  spam_warnings INTEGER,           -- Spam warning count
  last_activity DATETIME,
  ...
)
```

### Channels Table (Enhanced)
```sql
CREATE TABLE channels (
  channel_id TEXT PRIMARY KEY,
  title TEXT,
  forward_enabled BOOLEAN,
  throttle_delay_ms INTEGER DEFAULT 1000,      -- Delay between messages
  throttle_per_member_ms INTEGER DEFAULT 500,  -- Per-user throttle
  schedule_enabled BOOLEAN DEFAULT 0,
  schedule_config TEXT,                        -- JSON schedule config
  ...
)
```

## Usage

### Adding a New Session

1. Add session to database:
```sql
INSERT INTO sessions (phone, status) 
VALUES ('+1234567890', 'active');
```

2. Initialize from database (automatic on startup):
```javascript
await userBotManager.initializeFromDatabase();
```

3. Or add programmatically:
```javascript
const session = await userBotManager.addUserBot({
  phone: '+1234567890',
  status: 'active'
});
```

### Managing Sessions via AdminBot

1. Send `/sessions` or click "🔐 Sessions" button
2. View list of all sessions with status
3. Click on a session to see details
4. Use controls:
   - ⏸️ **Pause**: Manually pause the session
   - ▶️ **Resume**: Resume a paused session
   - 🔄 **Restart**: Restart a session
   - 📊 **Metrics**: View session statistics

### Session States

- **Active** (✅): Running normally, accepting messages
- **Paused** (⏸️): Manually paused or auto-paused
- **Error** (❌): Encountered an error, requires attention

### Auto-Pause Scenarios

Sessions are automatically paused in these cases:

1. **FloodWait**: Telegram rate limit exceeded
   - Paused until wait time expires
   - Automatically resumed after wait period
   
2. **Spam Warning**: Account flagged for spam
   - Paused indefinitely
   - Requires manual review and resume

3. **Peer Flood**: Too many requests to users
   - Paused to protect account
   - Manual resume after cooldown period

## Throttling Configuration

### Global Settings
```javascript
// In src/utils/throttle.js
const globalLimiter = new RateLimiter({
  minDelayMs: 800,        // Min delay between messages
  maxDelayMs: 2000,       // Max delay between messages  
  tokensPerInterval: 30,  // Max messages per interval
  interval: 60000         // Interval in ms (1 minute)
});
```

### Per-Channel Settings

Update via database:
```sql
UPDATE channels 
SET throttle_delay_ms = 2000,        -- 2 seconds between messages
    throttle_per_member_ms = 1000    -- 1 second per user
WHERE channel_id = '-1001234567890';
```

## API Reference

### UserBotManager

```javascript
import { userBotManager } from './src/bots/userBotManager.js';

// Initialize from database
await userBotManager.initializeFromDatabase();

// Get random active bot
const bot = userBotManager.getRandomActiveBot();

// Get all active bots
const bots = userBotManager.getActiveBots();

// Get specific bot
const bot = userBotManager.getUserBot('+1234567890');

// Pause a bot
await userBotManager.pauseBot('+1234567890', 'Maintenance');

// Resume a bot
await userBotManager.resumeBot('+1234567890');

// Handle error
await userBotManager.handleBotError('+1234567890', error);

// Get status
const status = userBotManager.getStatus();

// Stop all
await userBotManager.stopAll();
```

### Session Service

```javascript
import * as sessionService from './src/services/sessionService.js';

// Save/update session
await sessionService.saveSession({
  phone: '+1234567890',
  userId: '123456789',
  sessionString: 'encrypted_session',
  status: 'active'
});

// Get session
const session = await sessionService.getSessionByPhone('+1234567890');

// Get all sessions
const sessions = await sessionService.getAllSessions({ status: 'active' });

// Update status
await sessionService.updateSessionStatus('+1234567890', 'paused');

// Auto-pause
await sessionService.autoPauseSession(
  '+1234567890', 
  'FloodWait: 60s',
  new Date(Date.now() + 60000)
);

// Resume
await sessionService.resumeSession('+1234567890');
```

### Metrics Service

```javascript
import * as metricsService from './src/services/metricsService.js';

// Record message sent
await metricsService.recordMessageSent({
  sessionPhone: '+1234567890',
  channelId: '-1001234567890',
  userId: '123456789',
  success: true
});

// Record flood error
await metricsService.recordFloodError({
  sessionPhone: '+1234567890',
  channelId: '-1001234567890'
});

// Get session metrics
const metrics = await metricsService.getSessionMetrics('+1234567890');

// Get system metrics
const systemMetrics = await metricsService.getSystemMetrics();
```

## Best Practices

### 1. Session Management
- Keep at least 2-3 active sessions for redundancy
- Monitor auto-pause events regularly
- Restart sessions that show errors
- Clean up inactive sessions periodically

### 2. Throttling
- Start with conservative settings (2-3 seconds between messages)
- Adjust based on account age and history
- Older accounts can handle higher rates
- Monitor flood errors and adjust accordingly

### 3. Spam Prevention
- Use random delays between messages
- Limit messages per user per day
- Rotate between multiple sessions
- Respect Telegram's rate limits
- Monitor spam warnings closely

### 4. Monitoring
- Check system metrics daily
- Review session health regularly
- Investigate failed messages
- Track success rates per session

## Troubleshooting

### Session Won't Start
1. Check database connection
2. Verify session data is valid
3. Check API credentials
4. Review error logs

### Constant FloodWait Errors
1. Reduce message rate
2. Increase throttle delays
3. Add more sessions to distribute load
4. Wait for cooldown period

### Messages Not Being Sent
1. Check session status (should be 'active')
2. Verify channel forwarding is enabled
3. Check user permissions
4. Review throttling settings

### High Failure Rate
1. Check network connectivity
2. Verify user permissions
3. Review error logs for patterns
4. Adjust retry settings

## Security Considerations

1. **Session Protection**
   - Session strings are sensitive data
   - Store securely in database
   - Don't commit to version control
   - Backup regularly

2. **Admin Access**
   - Restrict AdminBot to authorized users
   - Use environment variables for admin IDs
   - Monitor admin actions

3. **Rate Limiting**
   - Respect Telegram's terms of service
   - Don't abuse the API
   - Monitor for spam flags

## Migration from Single Bot

To migrate from single UserBot to multi-session:

1. Export existing session:
```javascript
const sessionString = client.session.save();
```

2. Add to database:
```sql
INSERT INTO sessions (phone, session_string, status)
VALUES ('+1234567890', 'your_session_string', 'active');
```

3. Update initialization:
```javascript
// Old
const userBot = new UserBot();
await userBot.start();

// New
await userBotManager.initializeFromDatabase();
```

4. Update AdminBot:
```javascript
// Old
const adminBot = new AdminBot(userBot);

// New  
const adminBot = new AdminBot(userBot, userBotManager);
```

## Support

For issues or questions:
1. Check logs in `logs/app.log`
2. Review error messages in AdminBot
3. Check session status via `/sessions`
4. Consult metrics for patterns
