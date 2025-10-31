# Copilot Instructions for telegram_casso

## Project Context
Advanced Telegram UserBot + AdminBot system built with Node.js, GramJS, Telegraf, and SQLite. Two-bot architecture: UserBot (user account automation) and AdminBot (management interface).

## Architecture Overview
- **UserBot** (`src/bots/userBot.js`) - GramJS-based user account bot for channel monitoring and message forwarding
- **AdminBot** (`src/bots/adminBot.js`) - Telegraf-based management bot with inline keyboard interface
- **Service Layer** (`src/services/`) - Business logic for channels, users, and message forwarding
- **Database Layer** (`src/db/db.js`) - SQLite with structured tables (channels, users, message_logs, settings)

## Key File Structure
```
src/
├── config/index.js           # Environment config with validation
├── db/db.js                  # SQLite connection and schema
├── bots/
│   ├── userBot.js           # GramJS user authentication & monitoring
│   └── adminBot.js          # Telegraf admin panel with inline keyboards
├── services/
│   ├── channelService.js    # Channel CRUD, forwarding toggle
│   ├── userService.js       # User management, bulk operations
│   └── messageService.js    # Forwarding logic, rate limiting, logging
└── utils/
    ├── logger.js            # Winston multi-transport logging
    ├── errorHandler.js      # Custom error classes, retry logic
    └── helpers.js           # Utilities, validation, extraction
```

## Development Workflow
1. **Setup**: `npm install` → copy `.env.example` to `.env` → fill credentials
2. **Start**: `npm start` (launches both bots, handles UserBot auth flow)
3. **Admin Access**: Send `/start` to AdminBot for management interface
4. **Testing**: `npm test` (Node.js built-in test runner)

## Critical Patterns

**UserBot Authentication Flow:**
```javascript
// Console-based auth with session persistence
await this.client.start({
  phoneNumber: async () => await input.text('Enter phone: '),
  phoneCode: async () => await input.text('Enter code: '),
  password: async () => await input.password('2FA password: ')
});
```

**AdminBot Inline Keyboards:**
```javascript
// Telegraf callback-based navigation
const keyboard = Markup.inlineKeyboard([
  [Markup.button.callback('📋 Channels', 'channels_list')],
  [Markup.button.callback('📊 Stats', 'forwarding_stats')]
]);
```

**Message Forwarding Pipeline:**
```javascript
// Rate-limited bulk forwarding with retry
const results = await processMessageForwarding(
  message, channelId, this.forwardMessageToUser.bind(this)
);
```

## Database Schema Knowledge
- `channels` table: channel_id (TEXT), title, forward_enabled (BOOLEAN)
- `users` table: user_id (TEXT), first_name, username, phone
- `message_logs` table: tracks forwarding attempts with status/errors
- All tables have created_at/updated_at timestamps

## Environment Variables (Required)
```bash
API_ID=123456                    # Telegram API ID
API_HASH=abc123                  # Telegram API Hash  
PHONE_NUMBER=+1234567890         # UserBot phone
ADMIN_BOT_TOKEN=123:ABC          # AdminBot token
ADMIN_USER_ID=123456789          # Your Telegram ID
```

## Agent Rules
- **Session Security**: Never commit `data/userbot_session` - contains auth tokens
- **Database Initialization**: Always call `initializeDatabase()` before service operations
- **Error Handling**: Use custom error classes (`TelegramError`, `DatabaseError`, `AuthenticationError`)
- **Logging**: Use structured logging with context (`log.botEvent`, `log.messageForward`)
- **Rate Limiting**: Respect Telegram limits - use `messageLimiter` for user forwarding
- **Graceful Shutdown**: Both bots have `.stop()` methods for cleanup

## Common Operations
- **Toggle Channel**: `toggleChannelForwarding(channelId)` 
- **Add Users**: `bulkAddUsers(usersArray)` for channel member sync
- **Forward Messages**: Service handles chunking, rate limiting, error logging
- **Admin Commands**: All in AdminBot with callback query navigation

## Testing Approach
- Unit tests in `test/` directory using Node.js built-in test runner
- Database tests skip if DB not initialized (dev-friendly)
- Mock Telegram objects for service layer testing

Generated: 2025-10-31 for workspace: d:\experiments\telegram_casso