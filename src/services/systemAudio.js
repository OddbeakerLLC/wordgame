/**
 * System Audio Service
 * Pre-generated audio for alphabet letters and system prompts
 *
 * Supports two loading methods:
 * 1. MP3 files from public/sounds/ (letter-a.mp3, etc.)
 * 2. JSON file with base64 encoded audio
 */

// This will be populated after loading system audio
let systemAudioCache = {};

// Audio URLs for direct MP3 file loading
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
 * This is called automatically on app startup
 */
export async function loadLetterAudioFromFiles() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  for (const letter of alphabet) {
    const fileName = `letter-${letter.toLowerCase()}.mp3`;
    const url = `/wordmaster/sounds/${fileName}`;

    try {
      // Test if file exists by attempting to fetch it
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        // Store the URL for this letter
        const key = `letter:${letter}`;
        systemAudioUrls[key] = url;
      }
    } catch (error) {
      console.warn(`Letter audio file not found: ${fileName}`);
    }
  }

  console.log(`Loaded ${Object.keys(systemAudioUrls).length} letter audio files from /sounds/`);
}

/**
 * Get audio blob for a letter (A-Z)
 * @param {string} letter - Single letter A-Z
 * @returns {Blob|string|null} - Audio blob, URL, or null if not found
 */
export function getLetterAudio(letter) {
  const key = `letter:${letter.toUpperCase()}`;

  // First check if we have a URL to an MP3 file
  if (systemAudioUrls[key]) {
    return systemAudioUrls[key];
  }

  // Fallback to cached blob from JSON
  return systemAudioCache[key] || null;
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
