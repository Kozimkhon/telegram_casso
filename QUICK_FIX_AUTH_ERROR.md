# Tezkor Yechim: AUTH_KEY_UNREGISTERED

## ⚠️ Muammo
Session autentifikatsiyasi yaroqsiz - Telegram session eskirgan yoki o'chirilgan.

## ✅ Tezkor Yechim (3 qadam)

### 1. Eski sessionni o'chiring

AdminBot'da:
- `/start` → "📋 Sessions"
- Muammoli sessionni tanlang
- "🗑️ Delete" bosing

### 2. Yangi session yarating

AdminBot'da:
- "➕ Add Session"
- Telefon raqamingizni kiriting
- Telegram kodini kiriting
- 2FA parolni kiriting (kerak bo'lsa)

### 3. Ilovani qaytadan ishga tushiring

```bash
npm start
```

## 🔄 Avtomatik Boshqaruv

Sistema endi avtomatik ravishda:

✅ **Xatolarni aniqlaydi**
- AUTH_KEY_UNREGISTERED xatolarini catch qiladi
- 401 authentication xatolarini handle qiladi

✅ **Sessionni yangilaydi**
- Status: `active` → `error`
- Auto-pause: `is_paused = true`
- Error message yozadi

✅ **Loglarni yozadi**
- Error details
- Phone number
- Timestamp

✅ **Foydalanuvchini xabardor qiladi**
```
❌ Failed to start UserBot +998XXXXXXXXX: Session authentication failed
⚠️  Session +998XXXXXXXXX has invalid authentication.
💡 Please delete this session and create a new one via AdminBot.
```

## 📊 Session Status

Database da tekshiring:

```sql
SELECT phone, status, is_paused, last_error 
FROM sessions 
WHERE status = 'error';
```

Natija:
```
+998XXXXXXXXX | error | true | AUTH_KEY_UNREGISTERED: Session expired...
```

## 💡 Sabablari

1. **Session muddati tugagan** (uzoq vaqt ishlatilmagan)
2. **Telegram parol o'zgargan** (2FA)
3. **Session o'chirilgan** (Telegram orqali)
4. **Spam/Ban** (Telegram cheklovi)

## 🛡️ Oldini Olish

- Sessionlarni muntazam ishlatish
- 2FA parolni o'zgartirganingizda sessionlarni qayta yaratish
- Spam qilmaslik
- Session string'ni maxfiy saqlash

---

**To'liq ma'lumot**: `AUTH_KEY_UNREGISTERED_SOLUTION.md` faylini o'qing

**Status**: ✅ Auto-handling faol
