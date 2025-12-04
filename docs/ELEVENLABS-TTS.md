# ElevenLabs TTS Integration

This document explains how Word Master Challenge integrates with ElevenLabs for high-quality text-to-speech audio generation.

## Overview

Word Master Challenge now supports **premium TTS audio** via ElevenLabs API, with automatic fallback to the Web Speech API. Audio is pre-generated and cached in IndexedDB for offline use.

### Key Benefits

✅ **Superior audio quality** - Natural, clear pronunciation
✅ **Offline-capable** - Audio cached locally after generation
✅ **Consistent experience** - Same voice across all devices
✅ **Cost-effective** - Audio generated once, reused forever
✅ **Graceful fallback** - Web Speech API works if generation fails

## Architecture

### Components

1. **PHP Proxy** ([api/tts.php](../api/tts.php))
   - Secures your API key server-side
   - Accepts text, returns base64-encoded MP3
   - Validates input and handles errors

2. **TTS Generator Service** ([src/services/ttsGenerator.js](../src/services/ttsGenerator.js))
   - Client-side wrapper for API calls
   - Bulk generation with progress callbacks
   - Converts base64 to Blob for storage

3. **Enhanced TTS Service** ([src/services/tts.js](../src/services/tts.js))
   - Updated `speakWord()` to accept optional audioBlob
   - Plays cached audio if available, falls back to Web Speech API
   - Handles cleanup (URL.revokeObjectURL)

4. **Storage Layer** ([src/services/storage.js](../src/services/storage.js))
   - Database schema v2 adds `audioBlob` field
   - `createWord()` accepts optional audioBlob parameter
   - `importCommonWords()` supports audio blobs

5. **Bulk Generation Tool** ([tools/generate-audio.html](../tools/generate-audio.html))
   - Browser-based UI for generating 100 common words
   - Progress tracking and logging
   - Exports JSON with base64-encoded audio

## Setup Instructions

### 1. Get ElevenLabs API Key

1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Navigate to Settings → API Keys
3. Generate a new API key

**Free Tier**: 10,000 characters/month (~1,000-2,000 words)
**Starter Plan**: $5/month for 30,000 characters (~3,000-6,000 words)

### 2. Configure the API Key

**Option A: Config File (Recommended)**

```bash
# Copy the template
cp config.example.php config.php

# Edit config.php and add your API key
nano config.php
```

**Option B: Environment Variable**

```bash
export ELEVENLABS_API_KEY="your-api-key-here"
```

### 3. Verify Setup

Test the API endpoint:

```bash
curl -X POST http://localhost/api/tts.php \
  -H "Content-Type: application/json" \
  -d '{"text":"test"}'
```

Expected response:
```json
{
  "success": true,
  "audio": "base64-encoded-mp3-data...",
  "text": "test"
}
```

## Usage

### Adding Words (Automatic Generation)

When parents/teachers add words via the interface:

1. User enters word text
2. App calls `generateAudio(text)` → PHP proxy → ElevenLabs API
3. Audio blob stored with word in IndexedDB
4. Future practice uses cached audio

**UI Feedback:**
- Button shows "Generating audio..." during generation
- Falls back silently if generation fails
- Works offline after first generation

### Bulk Loading Common Words

When loading the 100 common words:

1. User clicks "Load Common Words"
2. Confirmation dialog: "Generate audio?" (YES/NO)
3. If YES: Bulk generates audio for all words (2-5 minutes)
4. Progress shown in button text: "Generating audio 42/100..."
5. Words imported with cached audio

### Manual Bulk Generation (Advanced)

For pre-generating audio files:

1. Open `tools/generate-audio.html` in browser
2. Ensure API endpoint is accessible
3. Click "Start Bulk Generation"
4. Wait 2-5 minutes for completion
5. Download JSON file with base64-encoded audio
6. (Optional) Import JSON into app

**Use Cases:**
- Pre-populate common words before deployment
- Generate audio offline, import later
- Create custom word lists with audio

## How It Works

### Audio Generation Flow

```
User adds word "example"
       ↓
generateAudio("example")
       ↓
POST /api/tts.php {"text":"example"}
       ↓
PHP validates & calls ElevenLabs API
       ↓
ElevenLabs returns MP3 audio
       ↓
PHP returns base64-encoded audio
       ↓
JS converts base64 → Blob
       ↓
createWord({text, childId}, audioBlob)
       ↓
IndexedDB stores word with audioBlob
```

### Audio Playback Flow

```
Child practices word
       ↓
Load word from IndexedDB (includes audioBlob)
       ↓
tts.speakWord(text, audioBlob)
       ↓
audioBlob exists?
  YES → Play cached audio (ElevenLabs quality)
  NO  → Fall back to Web Speech API
```

### Caching Strategy

- **Storage**: IndexedDB stores Blob objects (efficient binary storage)
- **Lifetime**: Audio cached forever (until word deleted)
- **Size**: ~5-20 KB per word (MP3 compressed)
- **100 words**: ~0.5-2 MB total storage

## Voice Configuration

Default voice: **Rachel** (`EXAVITQu4vr4xnSDxMaL`)

### Changing the Voice

Edit [api/tts.php](../api/tts.php):

```php
// Change this line:
$voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Rachel

// To a different voice:
$voiceId = 'ThT5KcBeYPX3keUQqHPh'; // Dorothy
```

### Child-Friendly Voices

- **Rachel**: Clear, friendly female voice (default)
- **Dorothy**: Warm, patient female voice
- **Josh**: Clear male voice

Browse all voices at: [elevenlabs.io/voice-library](https://elevenlabs.io/voice-library)

## Cost Estimation

### Character Counting

ElevenLabs charges per character (including spaces/punctuation).

**Examples:**
- "the" = 3 characters
- "because" = 7 characters
- Average word = ~5-7 characters

### Common Scenarios

| Scenario | Characters | Cost (Starter $5) |
|----------|-----------|------------------|
| 100 common words | ~500 chars | $0.08 |
| 500 custom words | ~3,000 chars | $0.50 |
| 1,000 words total | ~6,000 chars | $1.00 |

**Monthly budget on $5 plan:** ~6,000 words generated

### Optimizing Costs

1. **Bulk generate once**: Pre-generate common words, cache forever
2. **Generate on-demand**: Only generate custom words as added
3. **Use Web Speech API**: Skip generation for simple words
4. **Share audio**: One generation shared across all children

## Troubleshooting

### "API key not configured"

**Cause**: PHP can't find your API key

**Fix:**
1. Verify `config.php` exists with correct key
2. Or set environment variable: `export ELEVENLABS_API_KEY="..."`
3. Check PHP can read the config file

### "Network error" or timeouts

**Cause**: ElevenLabs API unreachable or slow

**Fix:**
1. Check internet connection
2. Increase timeout in [api/tts.php](../api/tts.php):
   ```php
   curl_setopt($ch, CURLOPT_TIMEOUT, 60); // Increase from 30
   ```
3. Verify API status: [status.elevenlabs.io](https://status.elevenlabs.io)

### Audio not playing in app

**Cause**: Audio blob not stored or corrupted

**Fix:**
1. Check browser console for errors
2. Verify IndexedDB contains `audioBlob` field:
   - DevTools → Application → IndexedDB → WordMasterDB → words
3. Re-generate audio for affected words

### "Quota exceeded" error

**Cause**: Monthly character limit reached

**Fix:**
1. Upgrade ElevenLabs plan
2. Or wait until quota resets (monthly)
3. Use Web Speech API fallback (automatic)

### CORS errors in browser

**Cause**: PHP proxy not accessible or CORS headers missing

**Fix:**
1. Verify `/api/tts.php` loads in browser
2. Check CORS headers in [api/tts.php](../api/tts.php):
   ```php
   header('Access-Control-Allow-Origin: *'); // Or specific domain
   ```

## Development Notes

### Testing Without API Key

The app works perfectly without ElevenLabs:
- All TTS falls back to Web Speech API
- No errors shown to users
- Feature is fully optional

### Database Migrations

If you have existing words without audio:
- No migration needed
- Audio generated on next word edit
- Or regenerate via bulk tool

### Extending for Other APIs

The architecture supports other TTS providers:

1. Update [api/tts.php](../api/tts.php) to call different API
2. Adjust voice settings in payload
3. Ensure response format matches (base64 audio)

## Security Considerations

### API Key Protection

✅ **Good**: Store in `config.php` (outside public directory)
✅ **Good**: Use environment variables
❌ **Bad**: Hardcode in client-side JavaScript
❌ **Bad**: Commit to git (use `.gitignore`)

### Input Validation

The PHP proxy validates:
- Text length (max 500 characters)
- Request method (POST only)
- Content type (JSON)

### Rate Limiting

Not implemented by default. Consider adding:
- IP-based rate limiting
- Authentication for production use
- Request logging

## Future Enhancements

Potential improvements:

1. **Progress indicators**: Show generation progress in UI
2. **Audio preview**: Let users hear voice before bulk generation
3. **Voice selection**: Allow per-child voice preferences
4. **Batch retry**: Retry failed generations automatically
5. **Analytics**: Track audio cache hit rate
6. **Compression**: Use lower bitrate for smaller files

## Resources

- [ElevenLabs API Docs](https://docs.elevenlabs.io/)
- [Voice Library](https://elevenlabs.io/voice-library)
- [Pricing](https://elevenlabs.io/pricing)
- [API Status](https://status.elevenlabs.io/)

---

**Questions or issues?** Check the browser console for detailed error logs.
