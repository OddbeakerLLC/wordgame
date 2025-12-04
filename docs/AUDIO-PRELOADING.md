# Audio Preloading Guide

This guide explains how to pre-generate and host audio files so you never need to call the ElevenLabs API again during runtime.

## Overview

Instead of generating audio on-demand (which uses your API quota), you can:

1. **Generate once** using the bulk tools
2. **Download the JSON files** containing base64-encoded audio
3. **Host them statically** on your server
4. **Load automatically** when the app starts

This gives you high-quality ElevenLabs audio with:
- ✅ No runtime API calls
- ✅ No ongoing costs
- ✅ Instant loading (cached in app)
- ✅ Works offline (PWA)

## Step 1: Generate Audio Files

### System Audio (Alphabet + Prompts)

1. Open [tools/generate-system-audio.html](../tools/generate-system-audio.html) in your browser
2. Enter your PHP API endpoint URL
3. Click "🧪 Test API Connection" to verify
4. Click "🎙️ Start System Audio Generation"
5. Wait ~30 seconds for 30 items to generate
6. Click "⬇️ Download System Audio (JSON)"
7. Save as `system-audio.json`

**What's included:**
- 26 letters (A-Z) for spelling mode
- 4 system prompts ("Let's learn a new word", "Spell", "Great job", "Try again")

### Common Words Audio

1. Open [tools/generate-audio.html](../tools/generate-audio.html)
2. Enter your PHP API endpoint URL
3. Click "🧪 Test API Connection"
4. Click "🎙️ Start Bulk Generation"
5. Wait ~2 minutes for 100 words to generate
6. Click "⬇️ Download Audio Data (JSON)"
7. Save as `common-words-audio.json`

**What's included:**
- 100 most common English words with high-quality audio

## Step 2: Host the Files

Copy the downloaded JSON files to your public directory:

```bash
cp system-audio.json /home/tmanso/dev/wordgame/public/data/
cp common-words-audio.json /home/tmanso/dev/wordgame/public/data/
```

The files will be available at:
- `http://localhost:3000/wordmaster/data/system-audio.json`
- `http://localhost:3000/wordmaster/data/common-words-audio.json`

## Step 3: Verify Auto-Loading

The app automatically loads these files on startup (see [src/main.js](../src/main.js)).

Check browser console for:
```
✓ System audio (alphabet + prompts) loaded
✓ Common words audio available
```

## How It Works

### System Audio (Letters + Prompts)

**File**: `public/data/system-audio.json`

**Format**:
```json
[
  {
    "type": "letter",
    "text": "A",
    "audioBase64": "base64-encoded-mp3..."
  },
  {
    "type": "prompt",
    "text": "Let's learn a new word",
    "audioBase64": "base64-encoded-mp3..."
  }
]
```

**Usage in code**:
```javascript
import { getLetterAudio, getPromptAudio } from './services/systemAudio.js';

// Get letter audio
const audioBlob = getLetterAudio('A');

// Get prompt audio
const promptBlob = getPromptAudio("Let's learn a new word");

// Use with TTS service
await tts.speakLetter('A'); // Automatically uses cached audio if available
```

### Common Words Audio

**File**: `public/data/common-words-audio.json`

**Format**:
```json
[
  {
    "text": "the",
    "audioBase64": "base64-encoded-mp3..."
  },
  {
    "text": "be",
    "audioBase64": "base64-encoded-mp3..."
  }
]
```

**Usage**:
This file is loaded for reference but not automatically imported into the database. Users can still choose to:

1. Use the "Load Common Words" button with audio generation (live API calls)
2. Or use the Web Speech API fallback (no API calls needed)

## File Sizes

**system-audio.json**: ~400-500 KB (30 items)
**common-words-audio.json**: ~1-2 MB (100 words)

These are small enough to:
- Load quickly on app startup
- Cache in service worker
- Work offline via PWA

## Deployment Checklist

When deploying to production:

- [ ] Generate both JSON files
- [ ] Copy to `public/data/` directory
- [ ] Verify files are accessible at `/wordmaster/data/*.json`
- [ ] Test app loads files successfully (check console)
- [ ] Confirm audio plays in quiz/practice modes
- [ ] (Optional) Add to service worker precache for offline support

## Updating Audio

If you want to change voices or regenerate:

1. Delete old JSON files from `public/data/`
2. Re-run the generation tools
3. Copy new files to `public/data/`
4. Clear browser cache or bump service worker version
5. Reload app

## Cost Analysis

**One-time generation cost**:
- System audio (30 items): ~$0.01
- Common words (100 words): ~$0.08
- **Total**: ~$0.09 (one time only!)

**Runtime cost**: $0.00 (files are static)

Compare to on-demand generation:
- Every user adding 100 words: $0.08 per user
- With preloading: $0.09 total for all users forever

## Troubleshooting

**"System audio not found on server"**
- Check that `public/data/system-audio.json` exists
- Verify the path in [src/services/audioLoader.js](../src/services/audioLoader.js) matches your base URL

**Audio not playing**
- Open browser DevTools → Application → IndexedDB
- Check if blobs are stored
- Verify blob MIME type is `audio/mpeg`

**Files too large**
- JSON files contain base64-encoded audio (33% larger than raw binary)
- For even smaller size, could host raw MP3 files instead of JSON
- Current sizes (~2 MB total) are acceptable for most use cases

## Advanced: Using Raw MP3 Files

Instead of JSON, you could host raw MP3 files:

```
public/data/audio/letters/A.mp3
public/data/audio/letters/B.mp3
public/data/audio/prompts/lets-learn.mp3
```

This would be:
- 25% smaller (no base64 encoding overhead)
- More cache-friendly (standard audio files)
- Easier to preview/test

But requires more code changes. Current JSON approach is simpler for now.

---

**Questions?** Check the main [ELEVENLABS-TTS.md](./ELEVENLABS-TTS.md) documentation.
