# GetDifference Migration - UserBotController

## O'zgarishlar

### Nima o'zgardi?

`UserBotController` endi **`addEventHandler`** o'rniga **`updates.getDifference`** API bilan ishlaydi.

### Asosiy farqlar

| Oldingi usul (`addEventHandler`) | Yangi usul (`getDifference`) |
|----------------------------------|------------------------------|
| Real-time push events | Polling-based (so'rov yuborish) |
| Telegram serveri yuboradi | Biz serverdan so'raymiz |
| Event-driven architecture | Polling architecture |
| Connectionni ochiq tutish kerak | Batch updates olish |
| Missed updates yo'qotilishi mumkin | Barcha updatelarni kuzatish |

### Afzalliklari

1. **Batched Updates** - Bir nechta yangilanishlarni bir vaqtda olish
2. **State Management** - pts, date, qts orqali barcha yangilanishlarni kuzatish
3. **Missed Updates** - Connection uzilganda ham updatelar yo'qolmaydi
4. **Less Connection Overhead** - Kam network traffic
5. **Better Control** - Polling intervalini boshqarish

### Arxitektura

```
┌─────────────────┐
│  UserBotController  │
└─────────┬──────────┘
          │
          ├─► #setupPolling()
          │   ├─► #initializeState() → GetState
          │   └─► #startPolling() → setInterval
          │
          ├─► #pollUpdates()
          │   ├─► GetDifference (pts, date, qts)
          │   ├─► Process: DifferenceEmpty
          │   ├─► Process: Difference
          │   ├─► Process: DifferenceSlice
          │   └─► Process: DifferenceTooLong
          │
          ├─► #processUpdates()
          │   ├─► newMessages → UpdateNewChannelMessage
          │   └─► otherUpdates → various updates
          │
          └─► #handleTelegramEvent()
              └─► ChannelEventHandlers
```

### Yangi metodlar

#### `#setupPolling()`
- Polling ni ishga tushiradi
- `ChannelEventHandlers` ni yaratadi
- Initial state ni oladi

#### `#initializeState()`
- `updates.GetState()` orqali boshlang'ich holatni oladi
- pts, date, qts, seq ni saqlaydi

#### `#startPolling()`
- Har 1 sekundda `#pollUpdates()` ni chaqiradi
- Polling intervalini boshqaradi

#### `#stopPolling()`
- Polling ni to'xtatadi
- Intervallarni tozalaydi

#### `#pollUpdates()`
- `updates.GetDifference()` ni chaqiradi
- Turli xil javoblarni qayta ishlaydi:
  - `DifferenceEmpty` - yangilanishlar yo'q
  - `Difference` - barcha yangilanishlar
  - `DifferenceSlice` - qisman yangilanishlar (davom ettirish kerak)
  - `DifferenceTooLong` - juda ko'p yangilanishlar (state ni reset qilish)

#### `#processUpdates(newMessages, otherUpdates)`
- Yangi xabarlar va boshqa yangilanishlarni qayta ishlaydi
- **Deduplication**: Bir xil message ID larni filtrlab oladi
- Har bir yangilanishni `#handleTelegramEvent()` ga yuboradi
- Avtomatik cleanup: 10000 dan oshsa, oxirgi 5000 tasini saqlaydi

### Message Deduplication

```javascript
#processedMessageIds = new Set(); // Qayta ishlanmagan messagelarni saqlaydi

// Message key format: "channelId_messageId"
const messageKey = `${channelId}_${messageId}`;

// Duplicate check
if (this.#processedMessageIds.has(messageKey)) {
  // Skip duplicate
  continue;
}

// Mark as processed
this.#processedMessageIds.add(messageKey);
```

**Features:**
- ✅ Memory-efficient Set structure
- ✅ Automatic cleanup (10000 → 5000)
- ✅ Per-batch deduplication
- ✅ Works for both newMessages and otherUpdates

### State Management

```javascript
#updateState = {
  pts: 0,      // Points - messages state
  date: 0,     // Last update date
  qts: 0,      // Qts - secret chats state
  seq: 0,      // Sequence number
}
```

### Polling Interval

- **Interval**: 1 sekund
- **Configurable**: Kerak bo'lsa o'zgartirish mumkin
- **Auto-restart**: Xatolikdan keyin avtomatik davom etadi

### Error Handling

1. **AUTH_KEY_UNREGISTERED** - Session xatosi, polling to'xtatiladi
2. **DifferenceTooLong** - State reset qilinadi
3. **Minor errors** - Log qilinadi, polling davom etadi

### Testing

```javascript
// Start userbot
const userBot = new UserBotController(dependencies, sessionData);
await userBot.start(); // Polling avtomatik boshlanadi

// Status
const status = userBot.getStatus();
console.log(status.isRunning); // true

// Stop
await userBot.stop(); // Polling to'xtatiladi
```

### Migration Checklist

- [x] `addEventHandler` olib tashlandi
- [x] `#setupPolling()` qo'shildi
- [x] `#initializeState()` qo'shildi
- [x] `#startPolling()` qo'shildi
- [x] `#stopPolling()` qo'shildi
- [x] `#pollUpdates()` qo'shildi
- [x] `#processUpdates()` qo'shildi
- [x] State management qo'shildi
- [x] Error handling yangilandi
- [x] `stop()` metodida polling to'xtatish qo'shildi
- [x] **Message deduplication** qo'shildi
- [x] **Processed message IDs tracking** qo'shildi
- [x] **Automatic cleanup** qo'shildi (10000 → 5000)

### Performance

- **Memory**: Kichik (state faqat 4 ta number)
- **CPU**: Past (1 sekundda 1 ta so'rov)
- **Network**: Efficient (batched updates)
- **Reliability**: Yuqori (missed updates yo'q)

### Kelajakda

- [ ] Polling intervalini konfiguratsiya qilish
- [ ] Metrics va monitoring qo'shish
- [ ] Advanced error recovery
- [ ] Adaptive polling (dinamik interval)

---

**Muallif**: GitHub Copilot  
**Sana**: 2025-01-14  
**Versiya**: 1.0.0
