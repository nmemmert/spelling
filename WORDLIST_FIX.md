# Word List Active Week Fix

## Summary
Fixed the `/getWordList` endpoint to return only the active week's words instead of flattening all words from all weeks.

## Problem
The `/getWordList` endpoint was returning ALL words from ALL weeks, regardless of which week was marked as active. This meant:
- Students would practice words from multiple weeks at once
- The active week selection had no effect
- Word lists could become very large over time

## Solution
Updated the `/getWordList` endpoint to:
1. Check if the wordlist uses the new format (with `weeks` and `activeWeek`)
2. Return only words from the active week
3. Fallback to the latest week if no active week is set
4. Still support old format (direct array) for backward compatibility

## Changes Made

### `server.js` - `/getWordList` endpoint
**Before:**
```javascript
// Flatten all words from all weeks
words = userWordlist.weeks.flatMap(week => week.words || []);
```

**After:**
```javascript
// New format: get words from active week only
const activeWeek = userWordlist.weeks.find(week => week.date === userWordlist.activeWeek);
if (activeWeek && Array.isArray(activeWeek.words)) {
  words = activeWeek.words;
} else {
  // If no active week found, use the latest week
  const latestWeek = userWordlist.weeks[userWordlist.weeks.length - 1];
  words = latestWeek?.words || [];
}
```

## Wordlist Format Support

### Old Format (Backward Compatible):
```json
{
  "student1": ["apple", "banana", "cherry"]
}
```

### New Format (Active Week):
```json
{
  "nate": {
    "weeks": [
      {
        "date": "2025-08-03",
        "words": ["not", "bot", "snot"]
      },
      {
        "date": "2025-08-10",
        "words": ["bate", "hate", "late"]
      }
    ],
    "activeWeek": "2025-08-10"
  }
}
```

## Impact

### Spelling Challenge (`startGame`)
- Now pulls words from active week only
- Students practice the current week's words
- Respects admin's week selection

### Typing Practice (`startTyping`)
- Now pulls words from active week only
- Consistent with spelling challenge behavior
- Uses same `/getWordList` endpoint

## Testing
1. Set an active week for a user in the admin panel
2. Start spelling challenge - should show only active week's words
3. Start typing practice - should show only active week's words
4. Verify old format users still work (direct array)

## Logging
Added console logging to track which week's words are being returned:
```javascript
console.log(`📚 Returning words for ${username}: ${words.length} words from ${userWordlist.activeWeek || 'array format'}`);
```

## Date of Fix
October 15, 2025

## Modified Files
- `server.js` - Updated `/getWordList` endpoint logic
