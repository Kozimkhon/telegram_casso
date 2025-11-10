# Database-Based Admin Authentication

The system has been updated to use database-based admin authentication instead of hardcoded user IDs in environment variables.

## Key Changes

### ✅ What was removed from .env:
- `PHONE_NUMBER` - No longer needed for main configuration
- `ADMIN_USER_ID` - Admin access is now managed through database

### ✅ What's still required in .env:
- `API_ID` - Telegram API ID (from my.telegram.org)
- `API_HASH` - Telegram API Hash (from my.telegram.org)  
- `ADMIN_BOT_TOKEN` - Bot token from @BotFather

## Admin Authentication System

### How it works:
1. **Database Validation**: AdminBot checks the `admins` table for user permissions
2. **Self-Registration**: Unauthorized users can register themselves as admins
3. **Access Control**: Only users in the `admins` table with `is_active = 1` can access the system

### First Admin Setup:

#### Option 1: Use the setup script
```bash
node scripts/addFirstAdmin.js <your_telegram_user_id> "Your Name" "username"
```

#### Option 2: Self-registration (if enabled)
1. Send `/start` to your AdminBot
2. Click "📝 Register as Admin" when prompted
3. Confirm registration

### Finding Your Telegram User ID:
- Send a message to @userinfobot on Telegram
- Or send any message to your AdminBot and check the logs

## Benefits

✅ **Enhanced Security**: No hardcoded admin credentials in config files  
✅ **Multi-Admin Support**: Multiple administrators can be registered  
✅ **Dynamic Management**: Admins can be activated/deactivated without restart  
✅ **Self-Service**: Users can register themselves (when enabled)  
✅ **Audit Trail**: All admin registrations are logged with timestamps  

## Database Schema

The `admins` table structure:
```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE NOT NULL,           -- Telegram user ID
  first_name TEXT,                        -- User's first name
  last_name TEXT,                         -- User's last name (optional)
  username TEXT,                          -- Telegram username (optional)
  role TEXT DEFAULT 'admin',              -- Admin role
  is_active BOOLEAN DEFAULT 1,            -- Active status
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Admin Management

Once logged in as an admin, you can:
- Add/remove other administrators
- Manage user sessions via AdminBot
- Configure channel forwarding settings
- View system statistics and logs

The system provides a complete admin interface through the Telegram AdminBot with no need for direct database access.