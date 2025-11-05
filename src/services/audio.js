import { Howl } from 'howler';

/**
 * Audio Service for sound effects
 */
class AudioService {
  constructor() {
    this.sounds = {};
    this.enabled = true;
  }

  /**
   * Load a sound effect
   */
  load(name, src) {
    this.sounds[name] = new Howl({
      src: [src],
      preload: true,
      volume: 0.7
    });
  }

  /**
   * Initialize all sound effects
   */
  init() {
    // For now, we'll use simple tone generators
    // In production, you'd load actual sound files

    // TODO: Add actual sound files to public/sounds/
    // this.load('buzz', '/sounds/buzz.mp3');
    // this.load('applause', '/sounds/applause.mp3');
    // this.load('fireworks', '/sounds/fireworks.mp3');
    // this.load('click', '/sounds/click.mp3');
    // this.load('success', '/sounds/success.mp3');
  }

  /**
   * Play a sound effect
   */
  play(name, options = {}) {
    if (!this.enabled) return;

    const sound = this.sounds[name];
    if (sound) {
      if (options.volume !== undefined) {
        sound.volume(options.volume);
      }
      sound.play();
    } else {
      // Fallback to Web Audio API beep for now
      this.playBeep(name);
    }
  }

  /**
   * Fallback beep generator using Web Audio API
   */
  playBeep(type) {
    if (!this.enabled) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different tones for different events
    switch (type) {
      case 'buzz':
        oscillator.frequency.value = 100;
        oscillator.type = 'sawtooth';
        gainNode.gain.value = 0.3;
        break;
      case 'applause':
      case 'success':
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.2;
        break;
      case 'fireworks':
        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.2;
        break;
      case 'click':
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        break;
      default:
        oscillator.frequency.value = 440;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.2;
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);

    // Cleanup
    setTimeout(() => {
      audioContext.close();
    }, 500);
  }

  /**
   * Specific sound effect methods
   */
  playBuzz() {
    this.play('buzz');
  }

  playApplause() {
    this.play('applause');
  }

  playFireworks() {
    this.play('fireworks');
  }

  playClick() {
    this.play('click');
  }

  playSuccess() {
    this.play('success');
  }

  /**
   * Toggle sound on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    Object.values(this.sounds).forEach(sound => {
      sound.volume(volume);
    });
  }
}

// Create singleton instance
const audio = new AudioService();
audio.init();

export default audio;
