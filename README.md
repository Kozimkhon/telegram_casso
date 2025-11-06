# Telegram Casso

A sophisticated Telegram UserBot + AdminBot system for automated channel management and message forwarding. Built with Node.js, GramJS, Telegraf, and SQLite.

**⭐ NEW**: Multi-userbot support with advanced session management, spam protection, and throttling! See [MULTI_USERBOT_GUIDE.md](MULTI_USERBOT_GUIDE.md) for details.

## 🎯 Overview

Telegram Casso consists of two integrated bots:

1. **UserBot** - Authenticates as a user account, monitors channels, and forwards messages to channel members
2. **AdminBot** - Provides a Telegram-based admin panel for managing channels and monitoring activity

## ✨ Features

### UserBot Features
- 📱 User account authentication via phone number
- 🔍 Automatic channel monitoring and discovery
- 📤 Message forwarding to all channel members
- 👥 User synchronization from monitored channels
- 🔐 Secure session management
- 📊 Activity logging and error handling
- 🔄 **Multi-account support** with load balancing
- 🛡️ **Spam protection** with auto-pause on FloodWait/SpamWarning
- ⏱️ **Advanced throttling** with exponential backoff

### AdminBot Features
- 🎛️ Interactive Telegram admin panel
- 📋 Channel management (enable/disable forwarding)
- 📊 Real-time statistics and monitoring
- 👥 User analytics and recent activity
- 🔧 Bot status monitoring
- 🧹 Database cleanup tools
- 🔐 **Session management UI** for multiple userbots
- 📈 **Metrics dashboard** per session and system-wide
- ⏸️ **Manual controls** to pause/resume/restart sessions

## 🆕 Multi-Userbot System

The enhanced system now supports:

- **Multiple Telegram Accounts**: Run multiple userbot sessions simultaneously
- **Session Management**: Active, paused, and error states with auto-recovery
- **Spam Protection**: Automatic detection and handling of FloodWait and spam warnings
- **Rate Limiting**: Global and per-channel throttling to avoid spam detection
- **Metrics Tracking**: Detailed statistics per session, channel, and user
- **Load Balancing**: Random session selection for distributing message sending

For detailed documentation, see [MULTI_USERBOT_GUIDE.md](MULTI_USERBOT_GUIDE.md).

## 🏗️ Architecture

```
src/
├── config/          # Configuration management
├── db/              # SQLite database layer
├── bots/            # UserBot, AdminBot, and UserBotManager
├── services/        # Business logic (channels, users, messages, sessions, metrics)
├── utils/           # Utilities (logging, error handling, helpers, throttling)
└── index.js         # Main application entry point
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Telegram API credentials ([get from my.telegram.org](https://my.telegram.org/apps))
- Bot token from [@BotFather](https://t.me/BotFather)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd telegram_casso
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. **Required environment variables:**
```bash
# Telegram API credentials
API_ID=your_api_id_here
API_HASH=your_api_hash_here
PHONE_NUMBER=+1234567890

# Bot tokens and admin
ADMIN_BOT_TOKEN=your_bot_token_here
ADMIN_USER_ID=123456789

# Paths (optional)
DB_PATH=./data/telegram_casso.db
SESSION_PATH=./data/userbot_session
LOG_LEVEL=info
```

4. **Start the application:**
```bash
npm start
```

### First Run Authentication

1. **UserBot Authentication:**
   - Enter your phone number when prompted
   - Enter the verification code from Telegram
   - If 2FA is enabled, enter your password
   - Session will be saved for future runs

2. **AdminBot Access:**
   - Send `/start` to your AdminBot
   - Use the interactive menu to manage channels

## 📖 Usage Guide

### Initial Setup

1. **Start the application** - Both bots will initialize
2. **Complete UserBot authentication** - Follow the console prompts
3. **Access AdminBot** - Send `/start` to your bot in Telegram
4. **Enable channels** - Use AdminBot to enable forwarding for desired channels

### AdminBot Commands

- `/start` - Show main menu
- `/status` - Quick status check
- `/stats` - Detailed statistics
- `/help` - Help information
- `/cleanup` - Clean old message logs

### Channel Management

1. Go to **Channels List** in AdminBot
2. **Toggle forwarding** for specific channels
3. **Remove channels** if no longer needed
4. **Monitor statistics** to track performance

### Message Forwarding

- UserBot automatically monitors enabled channels
- New messages are forwarded to all channel members
- Rate limiting prevents API flooding
- Failed forwards are logged and can be retried

## 🛠️ Development

### Project Structure

```
telegram_casso/
├── src/
│   ├── config/index.js           # Configuration loading
│   ├── db/db.js                  # Database operations
│   ├── bots/
│   │   ├── userBot.js           # GramJS user bot (enhanced with multi-session support)
│   │   ├── userBotManager.js    # Multi-session manager
│   │   ├── adminBot.js          # Telegraf admin bot
│   │   └── adminBotSessions.js  # Session management UI
│   ├── services/
│   │   ├── channelService.js    # Channel management
│   │   ├── userService.js       # User management
│   │   ├── messageService.js    # Message forwarding with throttling
│   │   ├── sessionService.js    # Session lifecycle management
│   │   └── metricsService.js    # Statistics and metrics
│   └── utils/
│       ├── logger.js            # Winston logging
│       ├── errorHandler.js      # Error management (enhanced with FloodWait/Spam detection)
│       ├── throttle.js          # Rate limiting and throttling
│       └── helpers.js           # Utility functions
├── test/                        # Test files
├── data/                        # Database and session files
├── logs/                        # Log files
├── MULTI_USERBOT_GUIDE.md      # Comprehensive guide for multi-userbot features
└── package.json
```

### Database Schema

**Admins Table:**
- `id` - Primary key
- `user_id` - Telegram user ID
- `username` - Telegram username
- `role` - Admin role (admin, superadmin, etc.)
- `is_active` - Active status

**Sessions Table:**
- `id` - Primary key
- `phone` - Phone number (unique)
- `user_id` - Telegram user ID
- `session_string` - Encrypted session data
- `status` - Session status (active/paused/error)
- `auto_paused` - Auto-pause flag
- `pause_reason` - Reason for pause
- `flood_wait_until` - When FloodWait expires
- `last_error` - Last error message
- `last_active` - Last activity timestamp

**Metrics Table:**
- `id` - Primary key
- `session_phone` - Which session
- `channel_id` - Which channel
- `user_id` - Which user
- `messages_sent` - Success count
- `messages_failed` - Failure count
- `flood_errors` - FloodWait count
- `spam_warnings` - Spam warning count
- `last_activity` - Last activity timestamp

**Channels Table:**
- `id` - Primary key
- `channel_id` - Telegram channel ID
- `title` - Channel title
- `forward_enabled` - Enable/disable forwarding
- `throttle_delay_ms` - Delay between messages (for spam protection)
- `throttle_per_member_ms` - Per-user throttle delay
- `schedule_enabled` - Enable scheduling
- `schedule_config` - JSON schedule configuration

**Users Table:**
- `id` - Primary key
- `user_id` - Telegram user ID
- `first_name`, `last_name` - User names
- `username` - Telegram username
- `phone` - Phone number

**Message Logs Table:**
- `id` - Primary key
- `channel_id` - Source channel
- `message_id` - Original message ID
- `user_id` - Target user ID
- `status` - success/failed/skipped
- `error_message` - Error details if failed

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev    # Watch mode with auto-restart
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `API_ID` | Telegram API ID | Yes |
| `API_HASH` | Telegram API Hash | Yes |
| `PHONE_NUMBER` | Phone for UserBot | Yes |
| `ADMIN_BOT_TOKEN` | Bot token from BotFather | Yes |
| `ADMIN_USER_ID` | Your Telegram user ID | Yes |
| `DB_PATH` | Database file path | No |
| `SESSION_PATH` | Session file path | No |
| `LOG_LEVEL` | Logging level | No |

### Getting Your User ID

Send `/start` to [@userinfobot](https://t.me/userinfobot) to get your Telegram user ID.

### Getting API Credentials

1. Go to [my.telegram.org/apps](https://my.telegram.org/apps)
2. Log in with your phone number
3. Create a new application
4. Copy `api_id` and `api_hash`

## 📊 Monitoring & Logs

### Log Files

- `logs/app.log` - General application logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

### AdminBot Monitoring

- **Channel Statistics** - Enabled/disabled channels
- **User Statistics** - Total users, recent additions
- **Forwarding Statistics** - Success rates, failed attempts
- **Bot Status** - Connection status, uptime, memory usage

## 🔒 Security

### Best Practices

- **Never commit** `.env` file or session files
- **Use environment variables** for all sensitive data
- **Regularly cleanup** old message logs
- **Monitor logs** for unauthorized access attempts
- **Backup database** regularly

### Session Security

- Session files contain authentication data
- Keep `SESSION_PATH` secure and backed up
- Delete session file to force re-authentication

## 🚨 Troubleshooting

### Common Issues

**UserBot won't authenticate:**
- Check API_ID and API_HASH are correct
- Ensure phone number is in international format (+1234567890)
- Delete session file and try again

**AdminBot not responding:**
- Verify ADMIN_BOT_TOKEN is correct
- Check ADMIN_USER_ID matches your Telegram ID
- Ensure bot is started with `/start`

**Database errors:**
- Check DATA_DIR permissions
- Ensure SQLite3 is properly installed
- Review database logs for specific errors

**Rate limiting:**
- Telegram has strict rate limits
- Reduce forwarding frequency if needed
- Monitor rate limit logs

### Debug Mode

Set `LOG_LEVEL=debug` in `.env` for detailed logging.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational and personal use only. Users are responsible for complying with Telegram's Terms of Service and applicable laws. Use at your own risk.

## 🆘 Support

- Check the logs first (`logs/app.log`)
- Review this README for common solutions
- Create an issue with detailed error information

---

**Made with ❤️ for the Telegram community**