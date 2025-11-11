# AUTH_KEY_UNREGISTERED Xatosi va Yechimi

## ❌ Xato

```
RPCError: 401: AUTH_KEY_UNREGISTERED (caused by users.GetUsers)
```

## 🔍 Xato Sababi

Bu xato Telegram session authentication key'i yaroqsiz yoki o'chirilganligini bildiradi. Bu quyidagi sabablarga ko'ra yuzaga kelishi mumkin:

1. **Session muddati tugagan** - Uzoq vaqt ishlatilmagan session
2. **Session o'chirilgan** - Telegram tomonidan yoki foydalanuvchi tomonidan
3. **Telegram parolni o'zgartirgan** - 2FA parol o'zgartirilsa, barcha sessionlar bekor qilinadi
4. **Telegram tomonidan cheklov** - Spam yoki boshqa qoidabuzarliklar uchun
5. **Session ma'lumotlari buzilgan** - Database yoki session string corrupted

## ✅ Yechim

### Qadam 1: Session Holatini Tekshirish

Session avtomatik ravishda "error" statusga o'tkaziladi va pauzaga qo'yiladi:

```bash
# Database da tekshiring
SELECT * FROM sessions WHERE phone = '+998XXXXXXXXX';
```

Natija:
```
status: 'error'
is_paused: true
last_error: 'AUTH_KEY_UNREGISTERED: Session expired or revoked...'
```

### Qadam 2: Eski Sessionni O'chirish

AdminBot orqali eski sessionni o'chiring:

1. AdminBot'ga `/start` yuboring
2. "📋 Sessions" tugmasini bosing
3. Muammoli sessionni tanlang
4. "🗑️ Delete" tugmasini bosing

Yoki terminaldan:

```bash
# Script orqali
node scripts/removeSession.js +998XXXXXXXXX
```

### Qadam 3: Yangi Session Yaratish

AdminBot orqali yangi session yarating:

1. "➕ Add Session" tugmasini bosing
2. Telefon raqamingizni kiriting: `+998XXXXXXXXX`
3. Telegram'dan kelgan kodni kiriting
4. 2FA parolingizni kiriting (agar bor bo'lsa)

## 🛡️ Xatoliklardan Saqlanish

### 1. Session Monitoring

Sessionlarni muntazam tekshiring:

```bash
# Barcha sessionlar holati
node scripts/listSessions.js

# Faqat muammoli sessionlar
node scripts/listSessions.js --status=error
```

### 2. Auto-Cleanup

Eski va xatolik sessionlarni avtomatik tozalash:

```javascript
// Har hafta ishga tushirish
// cron: 0 0 * * 0

const errorSessions = await sessionRepository.findByStatus('error');
const oldDate = new Date();
oldDate.setDate(oldDate.getDate() - 30); // 30 kun eski

for (const session of errorSessions) {
  if (new Date(session.updatedAt) < oldDate) {
    await sessionRepository.delete(session.id);
    console.log(`Deleted old error session: ${session.phone}`);
  }
}
```

### 3. Health Checks

Har kuni sessionlarni tekshirish:

```javascript
// Har 24 soatda
setInterval(async () => {
  const sessions = await sessionRepository.findAllActive();
  
  for (const session of sessions) {
    try {
      // Simple check
      const userBot = await getUserBot(session.phone);
      await userBot.getMe();
      console.log(`✅ Session OK: ${session.phone}`);
    } catch (error) {
      if (error.code === 401) {
        console.warn(`⚠️  Session failed: ${session.phone}`);
        await sessionRepository.update(session.id, {
          status: 'error',
          last_error: error.message,
          is_paused: true
        });
      }
    }
  }
}, 24 * 60 * 60 * 1000);
```

## 📊 Session Lifecycle

```
CREATE → ACTIVE → [WORKING] → ERROR → DELETE
         ↓                      ↑
         └──────── 401 ─────────┘
```

### Status Meanings:

- **active** - Session ishlayapti va sog'lom
- **paused** - Foydalanuvchi tomonidan to'xtatilgan
- **error** - Xatolik yuz berdi (401, flood wait, etc.)
- **deleted** - O'chirilgan va ishlatilmaydi

## 🔧 Troubleshooting

### Xato 1: "Session authentication failed"

```bash
# Solution:
1. Session'ni o'chiring
2. Yangi session yarating
3. 2FA parolni to'g'ri kiriting
```

### Xato 2: "Failed to start UserBot"

```bash
# Check logs:
tail -f logs/app.log | grep AUTH_KEY

# Fix:
- Delete invalid session
- Create new session
- Restart application
```

### Xato 3: Barcha sessionlar ishlamayapti

```bash
# Possible causes:
1. API credentials noto'g'ri
2. Telegram server muammosi
3. Database corrupted

# Check:
- API_ID va API_HASH to'g'ri ekanligini tekshiring
- Telegram statusni tekshiring: https://core.telegram.org/status
- Database backup'dan restore qiling
```

## 🎯 Best Practices

### 1. Session Management

```javascript
// Good ✅
const session = await sessionRepository.findByPhone(phone);
if (session && session.status === 'active') {
  await userBot.start();
}

// Bad ❌
await userBot.start(); // No status check
```

### 2. Error Handling

```javascript
// Good ✅
try {
  await userBot.start();
} catch (error) {
  if (error.code === 401) {
    await sessionRepository.update(session.id, {
      status: 'error',
      last_error: error.message,
      is_paused: true
    });
    console.error('Session needs re-authentication');
  }
  throw error;
}

// Bad ❌
try {
  await userBot.start();
} catch (error) {
  console.error(error); // No session update
}
```

### 3. Logging

```javascript
// Good ✅
logger.error('Session auth failed', {
  phone: session.phone,
  error: error.message,
  code: error.code,
  timestamp: new Date().toISOString()
});

// Bad ❌
console.log(error); // Not structured
```

## 📝 Session Scripts

### List All Sessions

```bash
node scripts/listSessions.js
```

### Remove Session

```bash
node scripts/removeSession.js +998XXXXXXXXX
```

### Add First Admin

```bash
node scripts/addFirstAdmin.js YOUR_TELEGRAM_USER_ID
```

### Add Session (Manual)

```bash
node scripts/addSession.js
```

## 🚨 Emergency Response

Agar barcha sessionlar ishlamay qolsa:

```bash
# 1. Stop application
npm stop

# 2. Backup database
cp data/telegram_typeorm.db data/telegram_typeorm.db.backup

# 3. Check all sessions
node scripts/listSessions.js

# 4. Remove all error sessions
DELETE FROM sessions WHERE status = 'error';

# 5. Restart
npm start

# 6. Add new sessions via AdminBot
```

## 📞 Yordam

Agar muammo hal bo'lmasa:

1. Logs ni tekshiring: `logs/app.log`
2. Database ni tekshiring: `data/telegram_typeorm.db`
3. Telegram API statusni tekshiring
4. Config faylni tekshiring: `.env`

---

**Muhim Eslatma**: 
- Session string maxfiy saqlanishi kerak
- Har bir session faqat bir qurilmada ishlashi kerak
- 2FA parolni o'zgartirganingizda barcha sessionlarni qayta yarating

**Sana**: 11-noyabr, 2025  
**Status**: ✅ Auto-handling implemented
