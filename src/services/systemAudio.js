/**
 * System Audio Service
 * Pre-generated audio for alphabet letters and system prompts
 *
 * Supports two loading methods:
 * 1. MP3 files from public/sounds/ (letter-a.mp3, etc.)
 * 2. JSON file with base64 encoded audio
 */

// This will be populated after loading system audio
// All audio is stored as Blobs in memory for instant playback
let systemAudioCache = {};

// Pre-created Object URLs for audio blobs (created once, reused forever)
let systemAudioUrls = {};

/**
 * Load system audio from generated JSON
 * @param {Object} audioData - JSON object from generate-system-audio.html
 */
export function loadSystemAudio(audioData) {
  systemAudioCache = {};

  for (const item of audioData) {
    if (item.audioBase64 && item.text) {
      // Convert base64 to Blob
      try {
        const binaryString = atob(item.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });

        // Store with type prefix for easier lookup
        const key = item.type === 'letter'
          ? `letter:${item.text.toUpperCase()}`
          : `prompt:${item.text}`;

        systemAudioCache[key] = blob;
      } catch (error) {
        console.warn(`Failed to load audio for "${item.text}":`, error);
      }
    }
  }

  console.log(`System audio loaded: ${Object.keys(systemAudioCache).length} items`);
}

/**
 * Load letter audio from MP3 files in public/sounds/
 * Pre-loads and caches all MP3 files as Blobs in memory for instant playback
 * Creates persistent ObjectURLs for each blob to avoid corruption
 * This is called automatically on app startup
 */
export async function loadLetterAudioFromFiles() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let loaded = 0;

  // Load all letter audio files in parallel for faster startup
  await Promise.all(
    alphabet.map(async (letter) => {
      const fileName = `letter-${letter.toLowerCase()}.mp3`;
      const url = `/wordmaster/sounds/${fileName}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`Letter audio file not found: ${fileName}`);
          return;
        }

        // Convert to Blob and cache in memory
        const blob = await response.blob();
        const key = `letter:${letter}`;
        systemAudioCache[key] = blob;

        // Create persistent ObjectURL (never revoked, reused for entire session)
        systemAudioUrls[key] = URL.createObjectURL(blob);

        loaded++;
      } catch (error) {
        console.warn(`Failed to load letter audio for "${letter}":`, error);
      }
    })
  );

  console.log(`Loaded ${loaded} letter audio files as Blobs (pre-cached in memory with persistent URLs)`);
}

/**
 * Get audio URL for a letter (A-Z)
 * Returns persistent ObjectURL (created once, never revoked)
 * @param {string} letter - Single letter A-Z
 * @returns {string|null} - Audio URL or null if not found
 */
export function getLetterAudio(letter) {
  const key = `letter:${letter.toUpperCase()}`;
  return systemAudioUrls[key] || null;
}

/**
 * Get audio blob for a system prompt
 * @param {string} prompt - Prompt text
 * @returns {Blob|null} - Audio blob or null if not found
 */
export function getPromptAudio(prompt) {
  const key = `prompt:${prompt}`;
  return systemAudioCache[key] || null;
}

/**
 * Check if system audio is loaded
 * @returns {boolean}
 */
export function isSystemAudioLoaded() {
  return Object.keys(systemAudioCache).length > 0;
}

/**
 * Get all available letters with audio
 * @returns {Array<string>}
 */
export function getAvailableLetters() {
  return Object.keys(systemAudioCache)
    .filter(key => key.startsWith('letter:'))
    .map(key => key.replace('letter:', ''));
}

/**
 * Get all available prompts with audio
 * @returns {Array<string>}
 */
export function getAvailablePrompts() {
  return Object.keys(systemAudioCache)
    .filter(key => key.startsWith('prompt:'))
    .map(key => key.replace('prompt:', ''));
}
