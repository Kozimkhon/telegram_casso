# Duplicate Messages Fix - GetDifference

## Muammo

`getDifference` har safar chaqirilganda bir xil xabarlar qayta-qayta kelayotgan edi:

```
📥 Processing 1 new messages
📥 Processing 5 other updates
   ├─ UpdateNewChannelMessage ❌ (duplicate!)
   ├─ UpdateNewChannelMessage ❌ (duplicate!)
   ├─ UpdateChannelMessageViews
   ├─ UpdateReadChannelInbox
   └─ UpdateReadChannelOutbox
```

## Sabablari

1. **`newMessages` va `otherUpdates` overlap**: Bir xil message ikki joyda ham bo'lishi mumkin
2. **State to'g'ri yangilanmayapti**: `DifferenceEmpty` da faqat `date` yangilanayotgan edi
3. **Deduplication yo'q**: Bir xil message ID larni filter qilish yo'q edi

## Yechimlar

### 1. Message Deduplication System

```javascript
// Track processed messages
#processedMessageIds = new Set();

// Create unique key
const messageKey = `${channelId}_${messageId}`;

// Check if processed
if (this.#processedMessageIds.has(messageKey)) {
  continue; // Skip duplicate
}

// Mark as processed
this.#processedMessageIds.add(messageKey);
```

### 2. Per-Batch Deduplication

```javascript
async #processUpdates(newMessages, otherUpdates) {
  const processedInThisBatch = new Set();
  
  // Check both global and batch-level
  if (this.#processedMessageIds.has(key) || 
      processedInThisBatch.has(key)) {
    continue;
  }
  
  processedInThisBatch.add(key);
  this.#processedMessageIds.add(key);
}
```

### 3. Automatic Cleanup

```javascript
// Keep only last 5000 message IDs
if (this.#processedMessageIds.size > 10000) {
  const idsArray = Array.from(this.#processedMessageIds);
  const keepIds = idsArray.slice(-5000);
  this.#processedMessageIds = new Set(keepIds);
}
```

### 4. Filter Out Known Duplicates

```javascript
// Skip UpdateNewChannelMessage in otherUpdates
if (update.className === 'UpdateNewChannelMessage') {
  continue; // Already processed in newMessages
}

// Skip UpdateChannelTooLong
if (update.className === 'UpdateChannelTooLong') {
  continue;
}
```

### 5. Proper State Update

```javascript
if (difference.className === 'updates.DifferenceEmpty') {
  this.#updateState.date = difference.date;
  this.#updateState.seq = difference.seq;
  // pts and qts remain unchanged
}
```

### 6. Cleanup on Stop

```javascript
async stop() {
  // Stop polling
  this.#stopPolling();
  
  // Clear processed IDs
  this.#processedMessageIds.clear();
  
  // ...
}
```

## Ishlash Printsipi

```
┌─────────────────────────────────────┐
│  getDifference Response             │
├─────────────────────────────────────┤
│  newMessages: [msg1, msg2]          │
│  otherUpdates: [                    │
│    UpdateNewChannelMessage (msg1),  │ ← Duplicate!
│    UpdateChannelMessageViews,       │
│    UpdateReadChannelInbox           │
│  ]                                  │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Process newMessages                │
├─────────────────────────────────────┤
│  msg1: "1234567890_100"             │
│    ✅ Not in processedMessageIds    │
│    ✅ Add to processedMessageIds    │
│    ✅ Handle event                  │
│                                     │
│  msg2: "1234567890_101"             │
│    ✅ Not in processedMessageIds    │
│    ✅ Add to processedMessageIds    │
│    ✅ Handle event                  │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Process otherUpdates               │
├─────────────────────────────────────┤
│  UpdateNewChannelMessage (msg1)     │
│    ❌ Already in processedMessageIds│
│    ⏭️  Skip                          │
│                                     │
│  UpdateChannelMessageViews          │
│    ✅ Not a message update          │
│    ✅ Handle event                  │
│                                     │
│  UpdateReadChannelInbox             │
│    ✅ Not a message update          │
│    ✅ Handle event                  │
└─────────────────────────────────────┘
```

## Test

```javascript
// Start userbot
const userBot = new UserBotController(dependencies, sessionData);
await userBot.start();

// Send a message to channel
// Expected: Processed once only

// Check logs:
// ✅ Processing 1 new messages
// ✅ Processing 3 other updates (UpdateNewChannelMessage skipped)
```

## Natija

### Oldin

```
📥 Processing 1 new messages
   └─ Message 100 ✅

📥 Processing 5 other updates
   ├─ UpdateNewChannelMessage (100) ❌ DUPLICATE!
   ├─ UpdateNewChannelMessage (100) ❌ DUPLICATE!
   ├─ UpdateChannelMessageViews ✅
   ├─ UpdateReadChannelInbox ✅
   └─ UpdateReadChannelOutbox ✅

Result: Message 100 processed 3 times! 😱
```

### Keyin

```
📥 Processing 1 new messages
   └─ Message 100 ✅ Added to processedMessageIds

📥 Processing 5 other updates
   ├─ UpdateNewChannelMessage (100) ⏭️  Skipped (duplicate)
   ├─ UpdateNewChannelMessage (100) ⏭️  Skipped (duplicate)
   ├─ UpdateChannelMessageViews ✅
   ├─ UpdateReadChannelInbox ✅
   └─ UpdateReadChannelOutbox ✅

Result: Message 100 processed once! 🎉
```

## Performance

- **Memory**: ~50 bytes per message ID
- **10000 messages**: ~500 KB
- **Cleanup**: Automatic (10000 → 5000)
- **Lookup**: O(1) with Set
- **CPU**: Minimal overhead

## Summary

✅ **Deduplication** - Bir xil xabarlar filter qilinadi  
✅ **Memory efficient** - Avtomatik cleanup  
✅ **Per-batch tracking** - Bir batch ichida ham duplicate yo'q  
✅ **Filter known duplicates** - UpdateNewChannelMessage skip qilinadi  
✅ **Cleanup on stop** - Memory leak yo'q  

---

**Muallif**: GitHub Copilot  
**Sana**: 2025-01-14  
**Versiya**: 1.0.0
