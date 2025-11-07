/**
 * Text-to-Speech Service
 * Uses HeadTTS (neural) for better pronunciation, falls back to Web Speech API
 */

import headttsService from "./headtts-service.js";

class TTSService {
  constructor() {
    // Web Speech API (fallback)
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.initialized = false;
    this.initializing = false; // Prevent duplicate initialization
    this.currentUtterance = null; // Keep reference to prevent garbage collection

    // HeadTTS (neural, better quality)
    // Only use on desktop - mobile devices have excellent native TTS
    this.useNeural = this.isDesktop();
    this.neuralInitStarted = false;
  }

  /**
   * Detect if user is on desktop (not mobile/tablet)
   * Mobile devices have excellent native TTS, so we only use HeadTTS on desktop
   */
  isDesktop() {
    // Check for mobile user agents
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobile = mobileRegex.test(navigator.userAgent);

    // Also check for touch screen (tablets might have desktop user agents)
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Desktop = not mobile AND no touch screen (or very large touch screen like Surface)
    return !isMobile && (!hasTouch || window.screen.width >= 1024);
  }

  /**
   * Initialize TTS with preferred voice
   */
  async init() {
    if (this.initialized) return;

    // Wait if already initializing
    if (this.initializing) {
      return new Promise((resolve) => {
        const checkInit = setInterval(() => {
          if (this.initialized || !this.initializing) {
            clearInterval(checkInit);
            resolve();
          }
        }, 100);
      });
    }

    this.initializing = true;

    // Initialize Web Speech API (fast, always works)
    await new Promise((resolve) => {
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

        this.initialized = true;
        this.initializing = false;
        resolve();
      };

      if (this.synth.getVoices().length > 0) {
        loadVoices();
      } else {
        this.synth.addEventListener('voiceschanged', loadVoices, { once: true });
      }
    });

    // Start loading HeadTTS in the background (don't wait for it)
    // This allows the app to start quickly while neural TTS loads
    // Only on desktop - mobile has excellent native TTS
    if (this.useNeural && !this.neuralInitStarted) {
      this.neuralInitStarted = true;

      headttsService.init().then((success) => {
        if (success) {
          console.log('HeadTTS: Neural TTS ready (desktop mode)');
        } else {
          console.log('HeadTTS: Falling back to Web Speech API');
          this.useNeural = false; // Disable neural TTS if init failed
        }
      }).catch((error) => {
        console.log('HeadTTS: Using Web Speech API fallback');
        this.useNeural = false; // Disable neural TTS if init failed
      });
    }
  }

  /**
   * Speak a word or phrase
   * @param {string} text - Text to speak
   * @param {object} options - Speech options
   * @returns {Promise} - Resolves when speech is complete
   */
  async speak(text, options = {}) {
    if (!this.initialized) {
      await this.init();
    }

    // Strategy: Use Web Speech API for single letters (better pronunciation)
    // Use HeadTTS for words (better natural speech)
    const isSingleLetter = text.trim().length === 1;

    // Try HeadTTS (neural) for words only if available
    if (!isSingleLetter && this.useNeural && headttsService.isAvailable()) {
      try {
        // Convert rate to speed (Web Speech uses 0.1-10, HeadTTS uses 0.25-4)
        const speed = options.rate ? Math.min(4, Math.max(0.25, options.rate)) : 1;
        await headttsService.speak(text, { speed });
        return;
      } catch (error) {
        console.warn('HeadTTS failed:', error);
        // Fall through to Web Speech API
      }
    }

    // Use Web Speech API for letters or if HeadTTS unavailable

    return new Promise((resolve, reject) => {
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
    // Stop both TTS systems
    if (headttsService.isAvailable()) {
      headttsService.stop();
    }
    this.synth.cancel();
  }
}

// Create singleton instance
const tts = new TTSService();

export default tts;
