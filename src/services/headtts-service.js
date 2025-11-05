/**
 * HeadTTS Service - Neural TTS wrapper
 * Uses Kokoro neural model for high-quality offline speech synthesis
 */

import { HeadTTS } from "@met4citizen/headtts/modules/headtts.mjs";

class HeadTTSService {
  constructor() {
    this.headtts = null;
    this.initialized = false;
    this.initializing = false;
    this.audioContext = null;
    this.currentVoice = "af_bella"; // Warm and friendly voice, good for kids
    this.loadError = null;
  }

  /**
   * Initialize HeadTTS with browser inference (WebGPU/WASM)
   * This may take time on first load as it downloads the model
   */
  async init() {
    if (this.initialized) return true;
    if (this.initializing) {
      // Wait for existing initialization
      return new Promise((resolve) => {
        const checkInit = setInterval(() => {
          if (this.initialized || this.loadError) {
            clearInterval(checkInit);
            resolve(this.initialized);
          }
        }, 100);
      });
    }

    this.initializing = true;

    try {
      console.log("HeadTTS: Initializing neural TTS...");

      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Determine the worker module path based on environment
      const workerModulePath = import.meta.env.DEV
        ? new URL('@met4citizen/headtts/modules/worker-tts.mjs', import.meta.url).href
        : new URL('../../../node_modules/@met4citizen/headtts/modules/worker-tts.mjs', import.meta.url).href;

      // Set dictionary path to the node_modules location
      // Must be a full absolute URL for Web Worker context
      const dictionaryPath = import.meta.env.DEV
        ? `${window.location.origin}/node_modules/@met4citizen/headtts/dictionaries/`
        : new URL('../../../node_modules/@met4citizen/headtts/dictionaries/', import.meta.url).href;

      console.log('HeadTTS: Worker module path:', workerModulePath);
      console.log('HeadTTS: Dictionary path:', dictionaryPath);

      // Create HeadTTS instance
      this.headtts = new HeadTTS({
        endpoints: ["webgpu", "wasm"], // Try WebGPU first, fallback to WASM
        languages: ["en-us"],
        voices: [this.currentVoice], // Preload the default voice
        audioCtx: this.audioContext,
        workerModule: workerModulePath, // Explicitly set worker path for Vite
        dictionaryURL: dictionaryPath, // Explicitly set dictionary path
        dtypeWebgpu: "fp32", // Best quality for WebGPU
        dtypeWasm: "q8", // Smaller model for WASM (88MB)
        defaultVoice: this.currentVoice,
        defaultLanguage: "en-us",
        defaultSpeed: 1,
        defaultAudioEncoding: "wav",
        trace: 0, // No debug output (set to 255 for debugging)
      });

      // Connect to the inference backend
      console.log("HeadTTS: Connecting to inference backend...");
      await this.headtts.connect();

      // Setup voice configuration
      this.headtts.setup({
        voice: this.currentVoice,
        language: "en-us",
        speed: 1,
        audioEncoding: "wav",
      });

      this.initialized = true;
      this.initializing = false;
      console.log("HeadTTS: Successfully initialized with voice:", this.currentVoice);
      return true;
    } catch (error) {
      console.error("HeadTTS: Initialization failed:", error);
      this.loadError = error;
      this.initializing = false;
      this.initialized = false;
      return false;
    }
  }

  /**
   * Speak text using neural TTS
   * @param {string} text - Text to speak
   * @param {object} options - Speech options (speed, etc.)
   * @returns {Promise} - Resolves when speech is complete
   */
  async speak(text, options = {}) {
    if (!this.initialized) {
      throw new Error("HeadTTS not initialized");
    }

    return new Promise((resolve, reject) => {
      try {
        // Update speed if provided
        const speed = options.speed || 1;
        this.headtts.setup({ speed });

        // Handle messages from HeadTTS
        const messageHandler = (message) => {
          console.log('HeadTTS: Received message:', message.type, Object.keys(message));

          if (message.type === "audio") {
            // HeadTTS might use different property names for audio data
            const audioData = message.audio || message.data || message.buffer || message.audioData;
            console.log('HeadTTS: Audio data found in property:', audioData ? 'yes' : 'no');

            // Play the audio
            this.playAudio(audioData)
              .then(() => {
                this.headtts.onmessage = null; // Clean up handler
                resolve();
              })
              .catch((error) => {
                this.headtts.onmessage = null; // Clean up handler
                reject(error);
              });
          } else if (message.type === "error") {
            this.headtts.onmessage = null; // Clean up handler
            reject(new Error(message.error));
          }
        };

        this.headtts.onmessage = messageHandler;

        // Synthesize the text
        this.headtts.synthesize({ input: text });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Play audio buffer
   * @param {Blob|ArrayBuffer|Uint8Array} audioData - WAV audio data
   * @returns {Promise} - Resolves when audio finishes playing
   */
  async playAudio(audioData) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('HeadTTS: Audio data type:', typeof audioData, audioData?.constructor?.name);

        // Convert to ArrayBuffer if needed
        let arrayBuffer;

        if (audioData instanceof Blob) {
          // Convert Blob to ArrayBuffer
          console.log('HeadTTS: Converting Blob to ArrayBuffer');
          arrayBuffer = await audioData.arrayBuffer();
        } else if (audioData instanceof ArrayBuffer) {
          console.log('HeadTTS: Already ArrayBuffer');
          arrayBuffer = audioData;
        } else if (audioData?.buffer instanceof ArrayBuffer) {
          // Typed array (Uint8Array, etc.)
          console.log('HeadTTS: Converting TypedArray to ArrayBuffer');
          arrayBuffer = audioData.buffer;
        } else if (audioData?.data instanceof ArrayBuffer) {
          // HeadTTS might wrap it in an object with a data property
          console.log('HeadTTS: Extracting ArrayBuffer from data property');
          arrayBuffer = audioData.data;
        } else if (audioData?.data?.buffer instanceof ArrayBuffer) {
          // HeadTTS might wrap TypedArray in data property
          console.log('HeadTTS: Extracting ArrayBuffer from data.buffer');
          arrayBuffer = audioData.data.buffer;
        } else {
          console.error('HeadTTS: Unsupported audio data format:', audioData);
          reject(new Error("Unsupported audio data format: " + typeof audioData));
          return;
        }

        // Decode the audio data
        this.audioContext.decodeAudioData(
          arrayBuffer,
          (audioBuffer) => {
            // Create and play the audio source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);

            source.onended = () => {
              resolve();
            };

            source.start(0);
          },
          (error) => {
            reject(error);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if HeadTTS is available and initialized
   * @returns {boolean}
   */
  isAvailable() {
    return this.initialized && !this.loadError;
  }

  /**
   * Stop any ongoing speech
   */
  stop() {
    // HeadTTS doesn't have a direct cancel method
    // We could disconnect/reconnect, but for now just let it finish
    // The audio will complete quickly anyway
  }
}

// Create singleton instance
const headttsService = new HeadTTSService();

export default headttsService;
