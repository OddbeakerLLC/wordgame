/**
 * Text-to-Speech Service using Web Speech API
 */

class TTSService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.initialized = false;
    this.currentUtterance = null; // Keep reference to prevent garbage collection
  }

  /**
   * Initialize TTS with preferred voice
   */
  async init() {
    if (this.initialized) return;

    return new Promise((resolve) => {
      // Wait for voices to load
      const loadVoices = () => {
        const voices = this.synth.getVoices();

        // IMPORTANT: Prefer LOCAL voices (localService=true) - they're more reliable
        // Remote voices can cut off after 15 seconds in Chrome
        const localVoices = voices.filter(v => v.localService);
        const voicePool = localVoices.length > 0 ? localVoices : voices;

        // Prefer child-friendly voices (higher pitch, clear)
        // Try to find US English voices first
        this.voice = voicePool.find(v => v.lang === 'en-US' && v.name.includes('Female'))
          || voicePool.find(v => v.lang === 'en-US')
          || voicePool.find(v => v.lang.startsWith('en'))
          || voicePool[0];

        console.log('TTS initialized with voice:', this.voice?.name, '(local:', this.voice?.localService + ')');

        this.initialized = true;
        resolve();
      };

      if (this.synth.getVoices().length > 0) {
        loadVoices();
      } else {
        this.synth.addEventListener('voiceschanged', loadVoices, { once: true });
      }
    });
  }

  /**
   * Speak a word or phrase
   * @param {string} text - Text to speak
   * @param {object} options - Speech options
   * @returns {Promise} - Resolves when speech is complete
   */
  speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.initialized) {
        this.init().then(() => this.speak(text, options).then(resolve).catch(reject));
        return;
      }

      // Wait for any ongoing speech to finish
      if (this.synth.speaking) {
        this.synth.cancel();

        // Resume after cancel to reset speech engine (Chrome bug workaround)
        // Must wait longer for cancel to complete - 50ms is too short
        setTimeout(() => {
          this.synth.resume();
          this._speakUtterance(text, options, resolve, reject);
        }, 250); // Increased from 50ms to 250ms (browser needs time to reset)
      } else {
        this._speakUtterance(text, options, resolve, reject);
      }
    });
  }

  /**
   * Internal method to create and speak utterance
   */
  _speakUtterance(text, options, resolve, reject) {
    const utterance = new SpeechSynthesisUtterance(text);

    // Apply options
    utterance.voice = this.voice;
    utterance.rate = options.rate || 0.9; // Slightly slower for clarity
    utterance.pitch = options.pitch || 1.1; // Slightly higher for kids
    utterance.volume = options.volume || 1;

    // Store reference to prevent garbage collection (browser bug workaround)
    this.currentUtterance = utterance;

    utterance.onend = () => {
      // Add small delay before resolving to ensure audio fully completes
      // Some browsers fire 'onend' slightly before audio finishes
      setTimeout(() => {
        this.currentUtterance = null;
        resolve();
      }, 100);
    };

    utterance.onerror = (error) => {
      console.error('TTS error:', error);
      this.currentUtterance = null;
      resolve(); // Resolve anyway to prevent hanging
    };

    this.synth.speak(utterance);
  }

  /**
   * Speak a word
   */
  async speakWord(word) {
    return this.speak(word, { rate: 0.85 });
  }

  /**
   * Spell out a word letter by letter
   */
  async spellWord(word) {
    const letters = word.split('');

    for (let i = 0; i < letters.length; i++) {
      // Spell each letter with a small pause
      await this.speak(letters[i], { rate: 0.8 });
      // Add a small delay between letters
      if (i < letters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }

  /**
   * Speak a single letter
   */
  async speakLetter(letter) {
    return this.speak(letter, { rate: 0.85 });
  }

  /**
   * Stop any ongoing speech
   */
  stop() {
    this.synth.cancel();
  }
}

// Create singleton instance
const tts = new TTSService();

export default tts;
