/**
 * Audio Loader Service
 * Loads pre-generated audio files from static JSON
 *
 * This allows you to:
 * 1. Generate audio once using the bulk tools
 * 2. Host the JSON files on your server
 * 3. Load them automatically when the app starts
 * 4. Never need to regenerate (or use ElevenLabs API) again!
 */

import { loadSystemAudio } from './systemAudio.js';

/**
 * Load system audio (alphabet + prompts) from static JSON
 * @returns {Promise<boolean>} - True if loaded successfully
 */
export async function loadSystemAudioFromServer() {
  try {
    const response = await fetch('/wordmaster/data/system-audio.json');

    if (!response.ok) {
      console.warn('System audio JSON not found on server');
      return false;
    }

    const audioData = await response.json();
    loadSystemAudio(audioData);

    console.log('✓ System audio loaded from server');
    return true;
  } catch (error) {
    console.warn('Failed to load system audio from server:', error);
    return false;
  }
}

/**
 * Load common words audio from static JSON
 * This can be used to pre-populate the database with audio
 *
 * @returns {Promise<Array|null>} - Array of {text, audioBase64} or null
 */
export async function loadCommonWordsAudioFromServer() {
  try {
    const response = await fetch('/wordmaster/data/common-words-audio.json');

    if (!response.ok) {
      console.warn('Common words audio JSON not found on server');
      return null;
    }

    const audioData = await response.json();

    console.log(`✓ Common words audio loaded: ${audioData.length} words`);
    return audioData;
  } catch (error) {
    console.warn('Failed to load common words audio from server:', error);
    return null;
  }
}

/**
 * Convert audio data to word list with blobs
 * @param {Array} audioData - Array from JSON file
 * @returns {Array} - Array of {text, audioBlob}
 */
export function convertAudioDataToBlobs(audioData) {
  const results = [];

  for (const item of audioData) {
    if (!item.audioBase64 || !item.text) {
      results.push({ text: item.text, audioBlob: null });
      continue;
    }

    try {
      // Convert base64 to Blob
      const binaryString = atob(item.audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });

      results.push({ text: item.text, audioBlob: blob });
    } catch (error) {
      console.warn(`Failed to convert audio for "${item.text}":`, error);
      results.push({ text: item.text, audioBlob: null });
    }
  }

  return results;
}

// Cache for common words audio (in-memory lookup)
let commonWordsAudioCache = new Map();

/**
 * Initialize all audio from server (call this on app startup)
 * @returns {Promise<Object>} - Status of each load operation
 */
export async function initializeAllAudio() {
  const results = {
    systemAudio: false,
    commonWordsAudio: false,
  };

  // Load system audio (letters + prompts)
  results.systemAudio = await loadSystemAudioFromServer();

  // Load common words audio and cache it for backfilling
  const commonWordsData = await loadCommonWordsAudioFromServer();
  if (commonWordsData) {
    // Convert to Map for fast lookup
    commonWordsAudioCache.clear();
    for (const item of commonWordsData) {
      if (item.text && item.audioBase64) {
        // Store as blob for immediate use
        try {
          const binaryString = atob(item.audioBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/mpeg' });
          commonWordsAudioCache.set(item.text.toLowerCase(), blob);
        } catch (error) {
          console.warn(`Failed to cache audio for "${item.text}":`, error);
        }
      }
    }
    console.log(`Common words audio cached: ${commonWordsAudioCache.size} words`);
    results.commonWordsAudio = true;
  }

  return results;
}

/**
 * Backfill audio for words that don't have audioBlob
 * Checks the common words audio cache and attaches blobs if available
 * @param {Array} words - Array of word objects from database
 * @returns {Promise<Array>} - Same words array with audio blobs attached where available
 */
export async function backfillWordAudio(words) {
  if (commonWordsAudioCache.size === 0 && words.length > 0) {
    console.log('No cached audio available for backfill');
  }

  let backfilled = 0;
  const wordsNeedingGeneration = [];

  for (const word of words) {
    if (!word.audioBlob && word.text) {
      const cachedBlob = commonWordsAudioCache.get(word.text.toLowerCase());
      if (cachedBlob) {
        word.audioBlob = cachedBlob;
        backfilled++;
      } else {
        // Track words that need audio generation
        wordsNeedingGeneration.push(word);
      }
    }
  }

  if (backfilled > 0) {
    console.log(`Backfilled audio for ${backfilled} words from cache`);
  }

  // Generate audio for words not in cache
  if (wordsNeedingGeneration.length > 0) {
    console.log(`${wordsNeedingGeneration.length} words need audio generation`);
    await generateMissingAudio(wordsNeedingGeneration);
  }

  return words;
}

/**
 * Generate audio for words that don't have it
 * @param {Array} words - Array of word objects that need audio
 */
async function generateMissingAudio(words) {
  const { generateAudio } = await import('./ttsGenerator.js');
  const { updateWord } = await import('./storage.js');

  let generated = 0;
  let failed = 0;

  for (const word of words) {
    try {
      console.log(`Generating audio for: ${word.text}`);
      const audioBlob = await generateAudio(word.text);

      if (audioBlob) {
        // Attach to the word object (in-memory)
        word.audioBlob = audioBlob;

        // Persist to database for future use
        await updateWord(word.id, { audioBlob });

        generated++;
        console.log(`✓ Generated audio for: ${word.text}`);
      } else {
        failed++;
        console.warn(`✗ Failed to generate audio for: ${word.text}`);
      }
    } catch (error) {
      failed++;
      console.warn(`✗ Error generating audio for "${word.text}":`, error);
    }
  }

  if (generated > 0) {
    console.log(`Generated audio for ${generated} words`);
  }
  if (failed > 0) {
    console.warn(`Failed to generate audio for ${failed} words (will use HeadTTS)`);
  }
}
