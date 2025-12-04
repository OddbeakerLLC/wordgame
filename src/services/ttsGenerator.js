/**
 * TTS Generator Service
 * Handles generating audio via ElevenLabs API (through PHP proxy)
 */

/**
 * Generate audio for a word via ElevenLabs API
 * @param {string} text - Text to generate audio for
 * @returns {Promise<Blob|null>} - Audio blob or null if generation failed
 */
export async function generateAudio(text) {
  try {
    // Use relative path - will work from /wordmaster/ base
    const response = await fetch('/wordmaster/api/tts.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn(`ElevenLabs TTS failed for "${text}":`, error.error);
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.audio) {
      console.warn(`ElevenLabs TTS failed for "${text}": Invalid response`);
      return null;
    }

    // Convert base64 to Blob
    const binaryString = atob(data.audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });

    console.log(`Generated audio for "${text}" (${blob.size} bytes)`);
    return blob;

  } catch (error) {
    console.warn(`ElevenLabs TTS error for "${text}":`, error);
    return null;
  }
}

/**
 * Generate audio for multiple words (bulk generation)
 * @param {Array<string>} texts - Array of text strings
 * @param {Function} onProgress - Optional progress callback (currentIndex, total, text)
 * @returns {Promise<Array<{text, audioBlob}>>} - Array of objects with text and audioBlob
 */
export async function generateAudioBulk(texts, onProgress = null) {
  const results = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    if (onProgress) {
      onProgress(i, texts.length, text);
    }

    const audioBlob = await generateAudio(text);
    results.push({ text, audioBlob });

    // Small delay to avoid rate limiting (adjust based on your API plan)
    if (i < texts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }
  }

  if (onProgress) {
    onProgress(texts.length, texts.length, null); // Final progress update
  }

  return results;
}

/**
 * Test the TTS API endpoint
 * @returns {Promise<boolean>} - True if API is working
 */
export async function testAPI() {
  try {
    const response = await fetch('/wordmaster/api/tts.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'test' }),
    });

    return response.ok;
  } catch (error) {
    console.error('TTS API test failed:', error);
    return false;
  }
}
