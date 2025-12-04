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

  // Load common words audio (for reference)
  const commonWordsData = await loadCommonWordsAudioFromServer();
  results.commonWordsAudio = commonWordsData !== null;

  return results;
}
