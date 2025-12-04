/**
 * System Audio Service
 * Pre-generated audio for alphabet letters and system prompts
 *
 * Usage:
 * 1. Generate audio using tools/generate-system-audio.html
 * 2. Store the JSON file somewhere accessible
 * 3. Import and use the audio blobs in your app
 */

// This will be populated after generating system audio
// For now, it's empty - audio will be generated on demand via ElevenLabs
let systemAudioCache = {};

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
 * Get audio blob for a letter (A-Z)
 * @param {string} letter - Single letter A-Z
 * @returns {Blob|null} - Audio blob or null if not found
 */
export function getLetterAudio(letter) {
  const key = `letter:${letter.toUpperCase()}`;
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
